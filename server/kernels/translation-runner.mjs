import { createKernelProgressParser } from '../../shared/translation/kernel-progress.mjs';
import { mkdir, readFile, writeFile, mkdtemp, rm, readdir, rename } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { translationAdvancedArgs } from './kernel-options.mjs';
import { createTranslationCache } from '../translation/translation-cache.mjs';
import { buildKernelServiceConfig } from './kernel-services.mjs';
import { redactDiagnosticText } from '../diagnostics/developer-diagnostics.mjs';
import { createRemoteKernel, normalizeRemoteKernelUrl } from './remote-kernel.mjs';
import {
  isTranslationLanguageSupported,
  translationLanguageCode,
} from '../../shared/translation/languages.mjs';

const MAX_STDERR_TAIL_LENGTH = 4 * 1024;
const REMOTE_MODEL = 'pdf2zh-remote';
const USEFUL_ERROR_LINE =
  /(?:^|[\s:])(?:[A-Za-z_][\w.]*(?:Error|Exception|Failure|Interrupt)\b|(?:error|exception|failure|fatal|failed)\b)/i;

function appendTail(current, value, limit) {
  const next = current + value;
  return next.length > limit ? next.slice(-limit) : next;
}

function finalStderrMessage(stderr) {
  const lines = String(stderr)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('PDFMATH_PROGRESS:'));
  if (!lines.length) return '';
  const exception = [...lines]
    .reverse()
    .find(
      (line) =>
        USEFUL_ERROR_LINE.test(line) && !/^Traceback \(most recent call last\):$/i.test(line),
    );
  if (exception) return exception;
  const last = lines.at(-1);
  return /^Traceback \(most recent call last\):$/i.test(last) ? '' : last;
}

let pdfLib;

function loadPdfLib() {
  pdfLib ??= import('pdf-lib');
  return pdfLib;
}

export function createTranslationRunner({
  root,
  baseCacheDir,
  runtimeHomeRoot = root,
  pythonResourcesPath,
  processes,
  python,
  getState,
  advanced,
  ensureGpu = async () => {},
  serviceCatalog,
  prepareKernelAssets,
  pythonResourcePath,
  onDiagnostic,
  onOutput,
  onTiming,
  remote = createRemoteKernel(),
} = {}) {
  async function translate({
    id,
    bytes,
    documentHash,
    page,
    language,
    sourceLanguage,
    threads,
    model,
    proxy,
    signal,
    translationService,
    serviceIdentity,
    cacheSelection = translationService,
    localTranslation = false,
    glossary = [],
    advancedOptions = {},
    reuseTranslations = false,
    forceRetranslation = false,
    cacheScope = '',
    paragraphContinuationDetection = false,
    onPageTiming,
    onProgress,
    cacheOnly = false,
    remoteKernel,
    runWorker = (fn) => fn(),
  }) {
    const emitTiming = (report) => {
      onTiming?.(report);
      onPageTiming?.(report);
    };
    const started = performance.now(),
      stages = {};
    let checkpoint = started;
    const step = (name) => {
      const now = performance.now();
      stages[name] = now - checkpoint;
      checkpoint = now;
    };
    if (signal?.aborted) throw Error('Cancelled');
    if (
      sourceLanguage !== undefined &&
      !isTranslationLanguageSupported(id, sourceLanguage, 'source')
    )
      throw Error('Unsupported source language');
    const lang = translationLanguageCode(language);
    if (!isTranslationLanguageSupported(id, language))
      throw Error('Unsupported language for this kernel');
    const sourceHash =
      documentHash && typeof documentHash.copy === 'function'
        ? documentHash.copy()
        : createHash('sha256').update(bytes);
    const [scopeHash, scopeGeneration] = cacheScope.split(':');
    const cacheDir = cacheScope
      ? join(baseCacheDir, '..', 'documents', scopeHash, 'math', scopeGeneration)
      : baseCacheDir;
    const currentLayoutSchema =
      id === 'pdf_math_fast'
        ? ['zh', 'ja', 'ko'].includes(lang.toLowerCase().split('-')[0])
          ? 6
          : 4
        : 3;
    const paragraphContinuationEnabled =
      id === 'pdf_math_fast' && paragraphContinuationDetection === true;
    const groupingIdentity = paragraphContinuationEnabled ? { paragraphGroupingSchema: 2 } : {};
    // This request index points to complete artifacts, so reopening does not
    // need Python discovery, option introspection, or the service catalog.
    // Only a digest is persisted; service values may contain credentials.
    const requestDigest = (serviceBound) =>
      sourceHash
        .copy()
        .update(
          JSON.stringify({
            cacheIndex: 1,
            layoutSchema: currentLayoutSchema,
            id,
            page,
            language,
            sourceLanguage: sourceLanguage || 'English',
            glossary,
            advancedOptions,
            ...(serviceBound
              ? { translationService: cacheSelection, serviceIdentity, localTranslation }
              : { compatible: 1 }),
            cacheScope,
            ...groupingIdentity,
          }),
        )
        .digest('hex');
    const requestPath = join(cacheDir, requestDigest(true) + '.page.json');
    // The compatible index omits the service, so any service can reuse it.
    const compatibleRequestPath = join(cacheDir, requestDigest(false) + '.page.json');
    const writeIndex = async (path, value) => {
      const temporary = path + '.' + crypto.randomUUID() + '.tmp';
      try {
        await mkdir(cacheDir, { recursive: true });
        await writeFile(temporary, JSON.stringify(value));
        await rename(temporary, path);
      } finally {
        await rm(temporary, { force: true }).catch(() => {});
      }
    };
    const rememberPage = async (artifactKey, translationModel, reused = false) => {
      await writeIndex(requestPath, { key: artifactKey, model: translationModel, reused });
      await writeIndex(compatibleRequestPath, { key: artifactKey, model: translationModel });
    };
    if (!forceRetranslation) {
      for (const indexPath of reuseTranslations
        ? [requestPath, compatibleRequestPath]
        : [requestPath]) {
        try {
          const saved = JSON.parse(await readFile(indexPath, 'utf8'));
          if (!/^[0-9a-f]{64}$/.test(saved.key) || typeof saved.model !== 'string')
            throw Error('Invalid page cache index');
          // Without reuse, only the requested model's own artifact qualifies.
          if (!reuseTranslations && (saved.model !== model || saved.reused))
            throw Error('Different cached model');
          const [result, metadata] = await Promise.all([
            readFile(join(cacheDir, saved.key + '.pdf')),
            readFile(join(cacheDir, saved.key + '.layout.json'), 'utf8'),
          ]);
          if (
            !result.subarray(0, 1024).includes(Buffer.from('%PDF')) ||
            !Array.isArray(JSON.parse(metadata).paragraphs)
          )
            throw Error('Invalid cached page');
          if (indexPath === compatibleRequestPath)
            await writeIndex(requestPath, {
              key: saved.key,
              model: saved.model,
              reused: true,
            }).catch(() => {});
          result.layoutKey = cacheScope
            ? `${scopeHash}-${scopeGeneration}-${saved.key}`
            : saved.key;
          result.cached = true;
          result.translationModel = saved.model;
          step('cacheLookup');
          emitTiming({
            engine: id,
            cached: true,
            model: saved.model,
            totalMs: performance.now() - started,
            stages,
          });
          return result;
        } catch {}
      }
    }
    // Experimental remote Precise kernel. When enabled it takes precedence over
    // the selected service and glossary: the server cannot receive either, so
    // it translates with its own service and no glossary.
    const remoteUrl = id === 'pdf_math_precise' ? normalizeRemoteKernelUrl(remoteKernel?.url) : '';
    const remoteService =
      typeof remoteKernel?.service === 'string' ? remoteKernel.service.trim() : '';
    // Remote artifacts live under their own key, so they stay readable offline.
    const remoteKey = remoteUrl
      ? sourceHash
          .copy()
          .update(
            JSON.stringify({
              remote: 1,
              id,
              url: remoteUrl,
              service: remoteService,
              page,
              language,
              sourceLanguage: sourceLanguage || 'English',
              layoutSchema: currentLayoutSchema,
              cacheScope,
            }),
          )
          .digest('hex')
      : '';
    const remoteLayoutKey = cacheScope ? `${scopeHash}-${scopeGeneration}-${remoteKey}` : remoteKey;
    if (remoteKey && !forceRetranslation) {
      try {
        const [result, metadata] = await Promise.all([
          readFile(join(cacheDir, remoteKey + '.pdf')),
          readFile(join(cacheDir, remoteKey + '.layout.json'), 'utf8'),
        ]);
        if (
          !result.subarray(0, 1024).includes(Buffer.from('%PDF')) ||
          !Array.isArray(JSON.parse(metadata).paragraphs)
        )
          throw Error('Invalid cached page');
        result.layoutKey = remoteLayoutKey;
        result.cached = true;
        result.translationModel = REMOTE_MODEL;
        step('cacheLookup');
        emitTiming({
          engine: id,
          cached: true,
          model: REMOTE_MODEL,
          totalMs: performance.now() - started,
          stages,
        });
        return result;
      } catch {}
    }
    // A cache miss is not kernel work. The actual translation request can still
    // migrate legacy artifacts below, but this fast lookup must never probe Python.
    if (cacheOnly) return null;
    if (remoteKey) {
      const health = await remote.health(remoteUrl, { signal });
      if (!health.ok)
        onDiagnostic?.(`Remote kernel unavailable (${health.reason}); using the local kernel.`);
      else {
        if (translationService || localTranslation || glossary.length)
          onDiagnostic?.(
            'Remote kernel in use: the selected translation service and glossary are not sent to it.',
          );
        try {
          const remoteResult = await runWorker(async () => {
            if (signal?.aborted) throw Error('Cancelled');
            checkpoint = performance.now();
            const translated = await remote.translatePage({
              url: remoteUrl,
              bytes,
              page,
              language: lang,
              sourceLanguage: sourceLanguage ? translationLanguageCode(sourceLanguage) : undefined,
              service: remoteService,
              threads,
              signal,
              onProgress,
            });
            step('remoteProcess');
            const { PDFDocument } = await loadPdfLib();
            const size = (await PDFDocument.load(translated)).getPage(0).getSize();
            // A remote server returns only the PDF, so there is no paragraph
            // identity to offer the reading text layer.
            const metadata = {
              schema: 1,
              engine: id,
              page,
              width: size.width,
              height: size.height,
              paragraphs: [],
            };
            await mkdir(cacheDir, { recursive: true });
            for (const [path, data] of [
              [join(cacheDir, remoteKey + '.pdf'), translated],
              [join(cacheDir, remoteKey + '.layout.json'), JSON.stringify(metadata)],
            ]) {
              const temporary = path + '.' + crypto.randomUUID() + '.tmp';
              await writeFile(temporary, data);
              await rename(temporary, path);
            }
            translated.layoutKey = remoteLayoutKey;
            translated.cached = false;
            translated.translationModel = REMOTE_MODEL;
            step('outputAndCache');
            emitTiming({
              engine: id,
              cached: false,
              model: REMOTE_MODEL,
              totalMs: performance.now() - started,
              stages,
            });
            return translated;
          });
          if (remoteResult) return remoteResult;
        } catch (error) {
          if (signal?.aborted || error?.message === 'Cancelled') throw error;
          remote.markUnhealthy(remoteUrl, error?.message);
          onDiagnostic?.(`Remote kernel failed (${error?.message}); using the local kernel.`);
        }
      }
    }
    const state = await getState(id);
    if (!state.available) throw Error(state.reason);
    const { overrides, args: advancedArgs } = await translationAdvancedArgs(
      id,
      advancedOptions,
      () => advanced(id, state),
    );
    const service = translationService
      ? buildKernelServiceConfig(id, translationService, await serviceCatalog.get(id))
      : null;
    if (service) model = service.model;
    step('environmentAndOptions');
    const layoutKey = (key) => (cacheScope ? `${scopeHash}-${scopeGeneration}-${key}` : key);
    const keyFor = (cacheModel, layoutSchema = currentLayoutSchema, serviceBound = true) =>
      sourceHash
        .copy()
        .update(
          JSON.stringify({
            id,
            version: state.version,
            page,
            language,
            ...(sourceLanguage && sourceLanguage !== 'English' ? { sourceLanguage } : {}),
            model: cacheModel,
            ...(!serviceBound
              ? { compatible: 1 }
              : service || serviceIdentity
                ? { service: service?.cacheIdentity || serviceIdentity }
                : {}),
            prompt: 2,
            ...(glossary.length ? { glossary } : {}),
            ...(cacheScope ? { cacheScope } : {}),
            layoutSchema,
            ...groupingIdentity,
            ...(Object.keys(overrides).length ? { advancedOptions: overrides } : {}),
          }),
        )
        .digest('hex');
    const key = keyFor(model);
    const cache = createTranslationCache({
      directory: cacheDir,
      keyFor,
      compatibleKey: keyFor(undefined, currentLayoutSchema, false),
      fallbackKeyFors:
        paragraphContinuationEnabled || currentLayoutSchema >= 5
          ? []
          : [(cacheModel) => keyFor(cacheModel, currentLayoutSchema - 1)],
      readResult: async (cachedKey) => {
        const result = await readFile(join(cacheDir, `${cachedKey}.pdf`));
        const metadata = JSON.parse(
          await readFile(join(cacheDir, cachedKey + '.layout.json'), 'utf8'),
        );
        if (!Array.isArray(metadata.paragraphs)) throw Error('Invalid cached layout');
        return result;
      },
    });
    const cached = join(cacheDir, `${key}.pdf`);
    const hit = await cache.lookup(model, { reuseTranslations, forceRetranslation });
    if (hit) {
      await rememberPage(hit.key, hit.model, hit.reused).catch(() => {});
      const result = hit.result;
      result.layoutKey = layoutKey(hit.key);
      result.cached = true;
      result.translationModel = hit.model;
      step('cacheLookup');
      emitTiming({
        engine: id,
        cached: true,
        model: hit.model,
        totalMs: performance.now() - started,
        stages,
      });
      return result;
    }
    step('cacheLookup');
    return runWorker(async () => {
      if (signal?.aborted) throw Error('Cancelled');
      if (overrides.prefer_gpu === true) await ensureGpu(id);
      // Exclude scheduling delay from input preparation; the API reports queueMs.
      checkpoint = performance.now();
      // Another queued request for the same page may have filled the cache.
      const queuedHit = await cache.lookup(model, { reuseTranslations, forceRetranslation });
      step('cacheRecheck');
      if (queuedHit) {
        await rememberPage(queuedHit.key, queuedHit.model, queuedHit.reused).catch(() => {});
        const result = queuedHit.result;
        result.layoutKey = layoutKey(queuedHit.key);
        result.cached = true;
        result.translationModel = queuedHit.model;
        emitTiming({
          engine: id,
          cached: true,
          model: queuedHit.model,
          totalMs: performance.now() - started,
          stages,
        });
        return result;
      }
      await mkdir(root, { recursive: true });
      const dir = await mkdtemp(join(root, 'job-'));
      try {
        const input = join(dir, 'input.pdf');
        await writeFile(input, bytes);
        const glossaryPath = join(dir, 'glossary.json');
        if (glossary.length) await writeFile(glossaryPath, JSON.stringify(glossary));
        const assetHome = join(runtimeHomeRoot, id, 'home');
        const home = join(dir, 'home');
        await prepareKernelAssets(assetHome, home);
        const env = {
          ...process.env,
          HOME: home,
          OPENAI_API_KEY: proxy.token,
          OPENAI_BASE_URL: proxy.url,
          OPENAI_MODEL: model,
          PDF2ZH_OPENAI_API_KEY: proxy.token,
          PDF2ZH_OPENAI_BASE_URL: proxy.url,
          PDF2ZH_OPENAI_MODEL: model,
          PDFMATHREADER_GLOSSARY_PATH: glossary.length ? glossaryPath : '',
        };
        delete env.OPENAI_API_KEY_REAL;
        if (service) {
          // Native services own their credentials and endpoint. An omitted
          // endpoint must use the upstream default, never our token-only proxy.
          for (const name of [
            'OPENAI_API_KEY',
            'OPENAI_BASE_URL',
            'OPENAI_MODEL',
            'PDF2ZH_OPENAI_API_KEY',
            'PDF2ZH_OPENAI_BASE_URL',
            'PDF2ZH_OPENAI_MODEL',
          ])
            delete env[name];
          Object.assign(env, service.env);
        }
        if (localTranslation) env.PDFMATHREADER_LOCAL_TRANSLATION = '1';
        if (paragraphContinuationEnabled) {
          env.PDFMATHREADER_PARAGRAPH_CONTINUATION_URL = `${proxy.url}/paragraph-continuation`;
          env.PDFMATHREADER_PARAGRAPH_CONTINUATION_TOKEN = proxy.token;
        }
        const args =
          id === 'pdf_math_fast'
            ? [
                '-m',
                'pdf2zh.pdf2zh',
                input,
                '--mode',
                'fast',
                '-p',
                String(page),
                '-lo',
                lang,
                '-s',
                `openai:${model}`,
                '-t',
                String(threads),
                '-o',
                dir,
                ...(Object.keys(overrides).length
                  ? advancedArgs
                  : ['--backend', 'cpu', '--ignore-cache']),
              ]
            : [
                '-m',
                'pdf2zh_next',
                input,
                '--openai',
                '--pages',
                String(page),
                '--lang-out',
                lang,
                '--qps',
                String(threads),
                '--pool-max-workers',
                String(threads),
                '--output',
                dir,
                '--no-dual',
                '--ignore-cache',
                '--disable-config-auto-save',
                '--watermark-output-mode',
                'no_watermark',
                ...advancedArgs,
              ];
        if (forceRetranslation && !args.includes('--ignore-cache')) args.push('--ignore-cache');
        if (overrides.prefer_gpu === true && id === 'pdf_math_fast') {
          const backendIndex = args.findIndex(
            (arg) => arg === '--backend' || arg.startsWith('--backend='),
          );
          if (backendIndex >= 0)
            args.splice(backendIndex, args[backendIndex] === '--backend' ? 2 : 1);
          args.push('--backend=auto');
        }
        if (sourceLanguage) args.push('--lang-in', translationLanguageCode(sourceLanguage));
        if (
          localTranslation &&
          id === 'pdf_math_precise' &&
          !args.includes('--no-auto-extract-glossary')
        )
          args.push('--no-auto-extract-glossary');
        if (service) {
          if (id === 'pdf_math_fast') {
            const index = args.indexOf('-s');
            args.splice(index, 2, ...service.args);
          } else args.splice(args.indexOf('--openai'), 1, ...service.args);
        }
        step('prepareInput');
        let kernelError = '';
        await new Promise((resolve, reject) => {
          if (signal?.aborted) return reject(Error('Cancelled'));
          const child = processes.spawn(
            python(id),
            [
              pythonResourcePath('kernel-worker.py', pythonResourcesPath),
              id,
              join(dir, 'layout.json'),
              String(page),
              input,
              ...args.slice(2),
            ],
            {
              env,
              cwd: dir,
              stdio: ['ignore', 'pipe', 'pipe'],
              detached: process.platform !== 'win32',
            },
            {
              kernel: id,
              name: 'kernel-worker',
              secrets: [proxy?.token, ...(service?.secrets || [])],
            },
          );
          const secrets = [proxy?.token, ...(service?.secrets || [])];
          let stderrTail = '';
          let stdoutTail = '';
          const consumeProgress = createKernelProgressParser(onProgress);
          const capture = (chunk, stream) => {
            if (stream === 'stdout') consumeProgress(String(chunk));
            const text = String(chunk);
            const message = redactDiagnosticText(text, {
              secrets,
              maxLength: Math.max(text.length, 1),
            });
            if (stream === 'stderr')
              stderrTail = appendTail(stderrTail, message, MAX_STDERR_TAIL_LENGTH);
            else stdoutTail = appendTail(stdoutTail, message, MAX_STDERR_TAIL_LENGTH);
            onDiagnostic?.(message);
          };
          child.stderr.on('data', (chunk) => capture(chunk, 'stderr'));
          child.stdout?.on('data', (chunk) => capture(chunk, 'stdout'));
          const kill = () => {
            void processes.terminate(child).catch((error) => onDiagnostic?.(error.message));
          };
          const timer = setTimeout(kill, 15 * 60 * 1000);
          signal?.addEventListener('abort', kill, { once: true });
          child.on('error', () => reject(Error('Kernel could not start')));
          child.on('close', (code, exitSignal) => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', kill);
            const details = [stderrTail, stdoutTail].filter(Boolean).join('\n');
            kernelError =
              details
                .split(/\r?\n/)
                .find((line) => /(?:PermissionDeniedError|AuthenticationError):/.test(line))
                ?.trim() || (USEFUL_ERROR_LINE.test(details) ? finalStderrMessage(details) : '');
            code === 0
              ? resolve()
              : reject(
                  Error(
                    signal?.aborted
                      ? 'Cancelled'
                      : `Kernel translation failed: ${
                          kernelError ||
                          finalStderrMessage(
                            redactDiagnosticText(stderrTail || stdoutTail, {
                              secrets,
                              maxLength: MAX_STDERR_TAIL_LENGTH,
                            }),
                          ) ||
                          (exitSignal ? `signal ${exitSignal}` : `exit code ${code ?? 'unknown'}`)
                        }`,
                  ),
                );
          });
        });
        step('kernelProcess');
        let worker;
        try {
          worker = JSON.parse(await readFile(join(dir, 'layout.json.timing.json'), 'utf8'));
        } catch {}
        const names = await readdir(dir);
        const output = names.find((n) => /mono.*\.pdf$/i.test(n) || /\.mono\.pdf$/i.test(n));
        if (!output)
          throw Error(
            kernelError
              ? `Kernel translation failed: ${kernelError}`
              : 'Kernel did not produce a translated PDF',
          );
        const raw = await readFile(join(dir, output));
        await onOutput?.(raw, id);
        const { PDFDocument } = await loadPdfLib();
        const document = await PDFDocument.load(raw);
        const index = document.getPageCount() === 1 ? 0 : page - 1;
        if (index >= document.getPageCount())
          throw Error('Kernel returned an unexpected page count');
        const one = await PDFDocument.create();
        const [selected] = await one.copyPages(document, [index]);
        one.addPage(selected);
        const result = Buffer.from(await one.save());
        const metadata = JSON.parse(await readFile(join(dir, 'layout.json'), 'utf8'));
        if (!Array.isArray(metadata.paragraphs)) throw Error('Kernel returned invalid layout');
        await mkdir(cacheDir, { recursive: true });
        const temporary = cached + '.' + crypto.randomUUID() + '.tmp';
        await writeFile(temporary, result);
        await (await import('node:fs/promises')).rename(temporary, cached);
        const metaPath = join(cacheDir, key + '.layout.json'),
          metaTemp = metaPath + '.' + crypto.randomUUID() + '.tmp';
        await writeFile(metaTemp, JSON.stringify(metadata));
        await (await import('node:fs/promises')).rename(metaTemp, metaPath);
        await cache.remember(model, key).catch(() => {});
        await rememberPage(key, model).catch(() => {});
        result.layoutKey = layoutKey(key);
        result.cached = false;
        result.translationModel = model;
        step('outputAndCache');
        emitTiming({
          engine: id,
          cached: false,
          totalMs: performance.now() - started,
          stages,
          worker,
        });
        return result;
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    });
  }

  return { translate };
}
