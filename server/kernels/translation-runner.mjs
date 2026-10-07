import { mkdir, readFile, writeFile, mkdtemp, rm, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { translationAdvancedArgs } from './kernel-options.mjs';
import { createTranslationCache } from '../translation/translation-cache.mjs';
import { buildKernelServiceConfig } from './kernel-services.mjs';
import {
  isTranslationLanguageSupported,
  translationLanguageCode,
} from '../../shared/translation/languages.mjs';

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
  serviceCatalog,
  prepareKernelAssets,
  pythonResourcePath,
  onDiagnostic,
  onOutput,
  onTiming,
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
    localTranslation = false,
    glossary = [],
    advancedOptions = {},
    reuseTranslations = true,
    forceRetranslation = false,
    cacheScope = '',
    onPageTiming,
    cacheOnly = false,
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
    const sourceHash =
      documentHash && typeof documentHash.copy === 'function'
        ? documentHash.copy()
        : createHash('sha256').update(bytes);
    const [scopeHash, scopeGeneration] = cacheScope.split(':');
    const cacheDir = cacheScope
      ? join(baseCacheDir, '..', 'documents', scopeHash, 'math', scopeGeneration)
      : baseCacheDir;
    const layoutKey = (key) => (cacheScope ? `${scopeHash}-${scopeGeneration}-${key}` : key);
    const currentLayoutSchema =
      id === 'pdf_math_fast'
        ? ['zh', 'ja', 'ko'].includes(lang.toLowerCase().split('-')[0])
          ? 5
          : 4
        : 3;
    const keyFor = (cacheModel, layoutSchema = currentLayoutSchema) =>
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
            ...(service || serviceIdentity
              ? { service: service?.cacheIdentity || serviceIdentity }
              : {}),
            prompt: 2,
            ...(glossary.length ? { glossary } : {}),
            ...(cacheScope ? { cacheScope } : {}),
            layoutSchema,
            ...(Object.keys(overrides).length ? { advancedOptions: overrides } : {}),
          }),
        )
        .digest('hex');
    const key = keyFor(model);
    const cache = createTranslationCache({
      directory: cacheDir,
      keyFor,
      fallbackKeyFors:
        currentLayoutSchema === 5
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
    if (cacheOnly) return null;
    return runWorker(async () => {
      if (signal?.aborted) throw Error('Cancelled');
      // Exclude scheduling delay from input preparation; the API reports queueMs.
      checkpoint = performance.now();
      // Another queued request for the same page may have filled the cache.
      const queuedHit = await cache.lookup(model, { reuseTranslations, forceRetranslation });
      step('cacheRecheck');
      if (queuedHit) {
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
        if (service) Object.assign(env, service.env);
        if (localTranslation) env.PDFMATHREADER_LOCAL_TRANSLATION = '1';
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
          child.stderr.on('data', (chunk) => {
            let message = String(chunk);
            for (const secret of [proxy.token, ...(service?.secrets || [])])
              if (secret) message = message.replaceAll(secret, '[redacted]');
            onDiagnostic?.(message);
          });
          const kill = () => {
            void processes.terminate(child).catch((error) => onDiagnostic?.(error.message));
          };
          const timer = setTimeout(kill, 15 * 60 * 1000);
          signal?.addEventListener('abort', kill, { once: true });
          child.on('error', () => reject(Error('Kernel could not start')));
          child.on('close', (code) => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', kill);
            code === 0
              ? resolve()
              : reject(
                  Error(
                    signal?.aborted
                      ? 'Cancelled'
                      : 'Kernel translation failed. Check its runtime assets and provider configuration.',
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
        if (!output) throw Error('Kernel did not produce a translated PDF');
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
