import { applicationPath } from '../../runtime/node/application-paths.mjs';
import { execFile } from 'node:child_process';
import { installUvRuntime } from './install-uv.mjs';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, mkdtemp, rm, readdir, symlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { homedir } from 'node:os';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import { decorateAdvancedOptions } from './kernel-options.mjs';
import { replaceFile } from '../../runtime/node/atomic-file.mjs';
import { createKernelProcesses } from './kernel-processes.mjs';
import { createKernelServiceCatalog } from './kernel-services.mjs';
import { createTranslationRunner } from './translation-runner.mjs';
const exec = promisify(execFile);

import { LANGUAGE_CODES } from '../../shared/translation/languages.mjs';
export { LANGUAGE_CODES };

export const definitions = {
  pdf_inspector: { label: 'PDF Inspector', package: '@firecrawl/pdf-inspector' },
  pdf_math_fast: {
    label: 'PDF Math · Fast',
    package: 'pdf2zh',
    spec: 'pdf2zh @ git+https://github.com/PDFMathTranslate/PDFMathTranslate.git@a799fc0ba3b863982f116e3a47a8534f1f5dc475',
    updateSpec: 'pdf2zh @ git+https://github.com/PDFMathTranslate/PDFMathTranslate.git',
    gitSpec: 'pdf2zh @ git+https://github.com/PDFMathTranslate/PDFMathTranslate.git@main',
  },
  pdf_math_precise: {
    label: 'PDF Math · Precise',
    package: 'pdf2zh-next',
    spec: 'pdf2zh-next==2.8.2',
    updateSpec: 'pdf2zh-next',
    gitSpec:
      'pdf2zh-next @ git+https://github.com/PDFMathTranslate-next/PDFMathTranslate-next.git@main',
  },
};

export function createLimiter(max = 4, { label = 'limiter', now = () => Date.now() } = {}) {
  let active = 0,
    nextTaskId = 0;
  const waiting = [],
    running = new Map();
  function taskMetadata(meta) {
    const safe = {};
    for (const key of [
      'kind',
      'label',
      'kernel',
      'engine',
      'page',
      'language',
      'sourceLanguage',
      'requestId',
    ]) {
      const value = meta?.[key];
      if (typeof value === 'string' || typeof value === 'number') safe[key] = value;
    }
    return safe;
  }
  function view(job, state) {
    return {
      id: job.id,
      label: job.meta.label || label,
      kind: job.meta.kind || label,
      state,
      kernel: job.meta.kernel || job.meta.engine || null,
      ...job.meta,
      queuedAt: job.createdAt,
      startedAt: job.startedAt ?? null,
    };
  }
  function snapshot() {
    const tasks = [...running.values()]
      .map((job) => view(job, 'running'))
      .concat(waiting.map((job) => view(job, 'queued')));
    return {
      label,
      limit: max,
      running: active,
      queued: waiting.length,
      tasks: tasks.slice(0, 128),
    };
  }
  return {
    setMax(n) {
      max = Math.max(1, Math.min(12, Number(n) || 4));
      drain();
    },
    snapshot,
    run(fn, { signal, meta } = {}) {
      return new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(signal.reason || Error('Cancelled'));
        const job = {
          id: `${label}-${++nextTaskId}`,
          fn,
          resolve,
          reject,
          signal,
          meta: taskMetadata(meta),
          createdAt: now(),
          startedAt: null,
        };
        job.abort = () => {
          const index = waiting.indexOf(job);
          if (index < 0) return;
          waiting.splice(index, 1);
          signal.removeEventListener('abort', job.abort);
          reject(signal.reason || Error('Cancelled'));
        };
        signal?.addEventListener('abort', job.abort, { once: true });
        waiting.push(job);
        drain();
      });
    },
  };
  function drain() {
    while (active < max && waiting.length) {
      const job = waiting.shift();
      job.signal?.removeEventListener('abort', job.abort);
      active++;
      job.startedAt = now();
      running.set(job.id, job);
      Promise.resolve()
        .then(() => {
          if (job.signal?.aborted) throw job.signal.reason || Error('Cancelled');
          return job.fn();
        })
        .then(job.resolve, job.reject)
        .finally(() => {
          active--;
          running.delete(job.id);
          drain();
        });
    }
  }
}

export async function prepareKernelAssets(
  assetHome,
  home,
  sharedCache = join(homedir(), '.cache', 'babeldoc'),
) {
  const cache = join(home, '.cache', 'babeldoc');
  await mkdir(cache, { recursive: true });
  for (const kind of ['fonts', 'models', 'tiktoken', 'cmap']) {
    const owned = join(assetHome, '.cache', 'babeldoc', kind);
    const existing = join(sharedCache, kind);
    const assets = existsSync(owned) ? owned : existsSync(existing) ? existing : owned;
    await mkdir(assets, { recursive: true });
    await symlink(
      resolve(assets),
      join(cache, kind),
      process.platform === 'win32' ? 'junction' : 'dir',
    );
  }
}

export function kernelPythonPath(environment, platform = process.platform) {
  return platform === 'win32'
    ? join(environment, 'Scripts', 'python.exe')
    : join(environment, 'bin', 'python');
}

export async function findUv({
  platform = process.platform,
  home = homedir(),
  env = process.env,
  run = exec,
} = {}) {
  const candidates =
    platform === 'win32'
      ? [
          'uv.exe',
          ...(env.UV_INSTALL_DIR ? [join(env.UV_INSTALL_DIR, 'uv.exe')] : []),
          join(home, '.local', 'bin', 'uv.exe'),
          join(home, '.cargo', 'bin', 'uv.exe'),
        ]
      : [
          'uv',
          ...(env.UV_INSTALL_DIR ? [join(env.UV_INSTALL_DIR, 'uv')] : []),
          join(home, '.local/bin/uv'),
          '/opt/homebrew/bin/uv',
          '/usr/local/bin/uv',
        ];
  for (const path of candidates) {
    try {
      const { stdout } = await run(path, ['--version'], { timeout: 5000, windowsHide: true });
      if (/^uv \d/.test(stdout)) return { available: true, path, version: stdout.trim() };
    } catch {}
  }
  return {
    available: false,
    version: null,
    message: 'uv was not found. Install uv and reopen the app.',
  };
}

export function pythonResourcePath(name, resourcesPath = process.resourcesPath) {
  const packaged = typeof resourcesPath === 'string' ? join(resourcesPath, name) : null;
  return packaged && existsSync(packaged)
    ? packaged
    : applicationPath('server', 'kernels', 'python', name);
}

export function createEngineRuntime({
  root,
  cacheDir: baseCacheDir,
  runtimeHomeRoot = root,
  appVersion = 'development',
  pythonResourcesPath,
  onDiagnostic,
  onOutput,
  onTiming,
  onKernelEvent,
  findUvImpl = findUv,
  execImpl = exec,
}) {
  const processes = createKernelProcesses({ execImpl, onEvent: onKernelEvent });
  const runExec = processes.exec;
  const uvDirectory = join(root, 'tools', 'bin');
  const detectUv = () =>
    findUvImpl({ run: runExec, env: { ...process.env, UV_INSTALL_DIR: uvDirectory } });
  let uv, uvInstallation;
  const installing = new Map(),
    advancedMetadata = new Map(),
    knownStates = new Map(),
    advancedBackground = new Map(),
    advancedFailures = new Map();
  const envPath = (id) => join(root, id);
  const python = (id) => kernelPythonPath(envPath(id));
  const metadataPath = (id) => join(root, '.advanced-options', id + '.json');
  const serviceCatalog = createKernelServiceCatalog({
    root,
    pythonResourcesPath,
    runExec,
    python,
    check,
    appVersion,
  });

  async function check(id) {
    if (!Object.hasOwn(definitions, id)) throw Error('Unknown kernel');
    if (id === 'pdf_inspector')
      return {
        id,
        label: definitions[id].label,
        installed: true,
        available: true,
        version: require('@firecrawl/pdf-inspector/package.json').version,
      };
    const known = knownStates.get(id);
    if (known && performance.now() - known.at < 30000 && !installing.has(id)) return known.state;
    const installed = existsSync(envPath(id));
    if (!uv) uv = await detectUv();
    if (!uv.available)
      return { id, label: definitions[id].label, installed, available: false, reason: uv.message };
    try {
      const { stdout } = await runExec(
        python(id),
        [
          '-c',
          `import importlib.metadata, importlib.util; assert importlib.util.find_spec('${id === 'pdf_math_fast' ? 'pdf2zh' : 'pdf2zh_next'}'); print(importlib.metadata.version('${definitions[id].package}'))`,
        ],
        { timeout: 15000 },
        { kernel: id, name: 'python' },
      );
      const version = stdout.trim();
      if (!/^\d+\.\d+/.test(version)) throw Error();
      const state = { id, label: definitions[id].label, installed: true, available: true, version };
      knownStates.set(id, { state, at: performance.now() });
      return state;
    } catch {
      knownStates.delete(id);
      return {
        id,
        label: definitions[id].label,
        installed,
        available: false,
        reason: installing.has(id)
          ? 'Installing…'
          : 'Kernel environment is not installed or its version cannot be queried.',
      };
    }
  }

  async function install(id, { reinstall = false, source = 'release' } = {}) {
    if (!Object.hasOwn(definitions, id) || id === 'pdf_inspector') throw Error('Unknown kernel');
    if (installing.has(id)) return installing.get(id);
    const task = (async () => {
      knownStates.delete(id);
      const state = await check(id);
      if (state.available && reinstall !== true) {
        await advanced(id, state);
        return state;
      }
      uv = await detectUv();
      if (!uv.available) throw Error(uv.message);
      await mkdir(root, { recursive: true });
      const env = { ...process.env, UV_CACHE_DIR: join(root, 'uv-cache') };
      knownStates.delete(id);
      try {
        if (!state.available)
          await runExec(
            uv.path,
            ['venv', '--allow-existing', '--python', '3.12', envPath(id)],
            { env, timeout: 300000, maxBuffer: 1024 * 1024 },
            { kernel: id, name: 'uv' },
          );
        const pipArgs = [
          'pip',
          'install',
          ...(reinstall === true
            ? ['--upgrade', '--reinstall', ...(source === 'git' ? ['--refresh'] : [])]
            : []),
          '--python',
          python(id),
          reinstall === true
            ? source === 'git'
              ? definitions[id].gitSpec
              : definitions[id].updateSpec
            : definitions[id].spec,
        ];
        await runExec(
          uv.path,
          pipArgs,
          { env, timeout: 600000, maxBuffer: 2 * 1024 * 1024 },
          { kernel: id, name: 'uv' },
        );
      } catch {
        throw Error('uv could not install this kernel. Check network access and retry.');
      }
      const installed = await check(id);
      if (installed.available) {
        await serviceCatalog.invalidate(id);
        // Installation owns refresh, including reinstalls with the same version.
        await Promise.allSettled(
          [...advancedMetadata].filter(([key]) => key.startsWith(`${id}:`)).map(([, task]) => task),
        );
        for (const key of advancedMetadata.keys())
          if (key.startsWith(`${id}:`)) advancedMetadata.delete(key);
        advancedFailures.delete(id);
        await rm(metadataPath(id), { force: true });
        await advanced(id, installed);
      }
      return installed;
    })();
    installing.set(id, task);
    try {
      return await task;
    } finally {
      installing.delete(id);
    }
  }

  async function cachedAdvanced(id, state) {
    try {
      const cached = JSON.parse(await readFile(metadataPath(id), 'utf8'));
      if (
        cached.schemaVersion !== 1 ||
        cached.appVersion !== appVersion ||
        cached.kernelVersion !== state.version ||
        cached.result?.id !== id ||
        !Array.isArray(cached.result.options) ||
        cached.result.reason
      )
        return null;
      const options = cached.result.options;
      if (
        !options.every(
          (option) =>
            option &&
            typeof option.id === 'string' &&
            typeof option.flag === 'string' &&
            ['boolean', 'number', 'string'].includes(option.type),
        )
      )
        return null;
      return { id, options: decorateAdvancedOptions(id, options) };
    } catch {
      return null;
    }
  }

  async function advanced(id, knownState, { cacheOnly = false } = {}) {
    if (!Object.hasOwn(definitions, id)) throw Error('Unknown kernel');
    if (id === 'pdf_inspector') return { id, options: [] };
    // GUI requests only read disk; probing runs in this backend utility process.
    const state = knownState || knownStates.get(id)?.state;
    if (cacheOnly) {
      const cached = state?.available && (await cachedAdvanced(id, state));
      if (cached) return cached;
      if (state && !state.available) return { id, options: [], reason: state.reason };
      if (advancedFailures.has(id)) {
        const result = advancedFailures.get(id);
        advancedFailures.delete(id);
        return result;
      }
      if (!advancedBackground.has(id)) {
        const task = advanced(id, state)
          .then((result) => {
            if (result.reason) advancedFailures.set(id, result);
          })
          .catch(() => {
            advancedFailures.set(id, {
              id,
              options: [],
              reason: 'Kernel advanced options could not be queried.',
            });
          })
          .finally(() => advancedBackground.delete(id));
        advancedBackground.set(id, task);
      }
      return { id, options: [], pending: true };
    }
    const current = state || (await check(id));
    if (!current.available) return { id, options: [], reason: current.reason };
    const cacheKey = `${id}:${appVersion}:${current.version}`;
    if (advancedMetadata.has(cacheKey)) return advancedMetadata.get(cacheKey);
    const task = (async () => {
      const cached = await cachedAdvanced(id, current);
      if (cached) return cached;
      const optionsHomeRoot = runtimeHomeRoot || root;
      await mkdir(optionsHomeRoot, { recursive: true });
      let home;
      try {
        home = await mkdtemp(join(optionsHomeRoot, 'kernel-options-'));
        const isolatedTmp = join(home, 'tmp');
        const env = {
          ...process.env,
          HOME: home,
          TMPDIR: isolatedTmp,
          TMP: isolatedTmp,
          TEMP: isolatedTmp,
          XDG_CONFIG_HOME: join(home, '.config'),
          XDG_CACHE_HOME: join(home, '.cache'),
          PYTHONPYCACHEPREFIX: join(optionsHomeRoot, 'kernel-options-pycache'),
        };
        await mkdir(isolatedTmp, { recursive: true });
        const { stdout } = await runExec(
          python(id),
          [pythonResourcePath('kernel-options.py', pythonResourcesPath), id],
          { env, cwd: home, timeout: 120000, maxBuffer: 4 * 1024 * 1024 },
          { kernel: id, name: 'python' },
        );
        const raw = JSON.parse(stdout.trim());
        if (!Array.isArray(raw)) throw Error('Invalid advanced schema');
        const result = { id, options: decorateAdvancedOptions(id, raw) };
        const directory = join(root, '.advanced-options'),
          target = metadataPath(id),
          temporary = target + '.' + randomBytes(8).toString('hex') + '.tmp';
        await mkdir(directory, { recursive: true });
        try {
          await writeFile(
            temporary,
            JSON.stringify({
              schemaVersion: 1,
              appVersion,
              kernelVersion: current.version,
              result,
            }),
          );
          await replaceFile(temporary, target);
        } finally {
          await rm(temporary, { force: true });
        }
        return result;
      } catch {
        return { id, options: [], reason: 'Kernel advanced options could not be queried.' };
      } finally {
        if (home) await rm(home, { recursive: true, force: true });
      }
    })();
    advancedMetadata.set(cacheKey, task);
    try {
      return await task;
    } catch {
      return { id, options: [], reason: 'Kernel advanced options could not be queried.' };
    } finally {
      if (advancedMetadata.get(cacheKey) === task) advancedMetadata.delete(cacheKey);
    }
  }

  const translationRunner = createTranslationRunner({
    root,
    baseCacheDir,
    runtimeHomeRoot,
    pythonResourcesPath,
    processes,
    python,
    getState: async (id) => {
      const known = knownStates.get(id);
      return known && performance.now() - known.at < 30_000 && !installing.has(id)
        ? known.state
        : check(id);
    },
    advanced,
    serviceCatalog,
    prepareKernelAssets,
    pythonResourcePath,
    onDiagnostic,
    onOutput,
    onTiming,
  });

  function tasks() {
    return [
      ...[...installing.keys()].map((kernel) => ({
        id: `install-${kernel}`,
        label: 'Kernel installation',
        kind: 'kernel-install',
        kernel,
        state: 'running',
      })),
      ...[...advancedMetadata.keys()].map((key) => ({
        id: `advanced-${key}`,
        label: 'Advanced options',
        kind: 'kernel-advanced-options',
        kernel: key.split(':')[0],
        state: 'running',
      })),
      ...[...advancedBackground.keys()].map((kernel) => ({
        id: `advanced-background-${kernel}`,
        label: 'Advanced options',
        kind: 'kernel-advanced-options',
        kernel,
        state: 'running',
      })),
    ];
  }
  return {
    layout: async (key) => {
      const scoped = key.match(/^([a-f0-9]{64})-([a-f0-9-]{36})-([a-f0-9]{64})$/);
      if (scoped)
        return JSON.parse(
          await readFile(
            join(
              baseCacheDir,
              '..',
              'documents',
              scoped[1],
              'math',
              scoped[2],
              scoped[3] + '.layout.json',
            ),
            'utf8',
          ),
        );
      if (!/^[a-f0-9]{64}$/.test(key)) throw Error('Invalid layout key');
      return JSON.parse(await readFile(join(baseCacheDir, key + '.layout.json'), 'utf8'));
    },
    startup: async () => ({
      uv: (uv = await detectUv()),
      engines: await Promise.all(Object.keys(definitions).map(check)),
    }),
    installUv: async () => {
      uvInstallation ??= installUvRuntime({
        directory: uvDirectory,
        run: runExec,
        detect: detectUv,
      })
        .then((result) => {
          uv = result;
          knownStates.clear();
          return result;
        })
        .finally(() => {
          uvInstallation = undefined;
        });
      return uvInstallation;
    },
    check,
    install,
    advanced,
    services: serviceCatalog.get,
    translate: translationRunner.translate,
    tasks,
    observeProcess: (child, file, metadata = {}) => processes.observe(child, file, metadata),
    processes: processes.snapshot,
    close: processes.close,
  };
}
