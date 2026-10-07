import { applicationPath } from '../../../runtime/node/application-paths.mjs';
import { createHash, randomUUID } from 'node:crypto';
import { access, chmod, mkdir, readFile, rename, rm } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile, execFileSync, spawn } from 'node:child_process';
import { promisify } from 'node:util';

export const LOCAL_TRANSLATION_RESOURCE = 'local-translation';
const sourcePath = applicationPath('server', 'platform', 'macos', 'local-translation.swift');
const runExec = promisify(execFile);
const languageAliases = new Map([
  ['english', 'en'],
  ['en-us', 'en-US'],
  ['en-gb', 'en-GB'],
  ['french', 'fr'],
  ['fr-fr', 'fr-FR'],
  ['german', 'de'],
  ['spanish', 'es'],
  ['italian', 'it'],
  ['japanese', 'ja'],
  ['korean', 'ko'],
  ['chinese', 'zh'],
  ['simplified chinese', 'zh'],
  ['traditional chinese', 'zh-TW'],
  ['zh-cn', 'zh'],
  ['zh-hans', 'zh'],
  ['zh-tw', 'zh-TW'],
  ['zh-hant', 'zh-TW'],
]);

function normalizeLanguage(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  return languageAliases.get(raw.toLowerCase()) || raw.replaceAll('_', '-');
}

function abortError(signal) {
  if (signal?.reason instanceof Error) return signal.reason;
  const error = new Error('Local translation was cancelled.');
  error.name = 'AbortError';
  return error;
}

function unsupportedMessage(platform, version) {
  if (platform !== 'darwin') return 'Apple on-device translation requires macOS 26 or later.';
  return version && Number.parseInt(version, 10) < 26
    ? 'Apple on-device translation requires macOS 26 or later.'
    : 'Apple on-device translation helper is unavailable.';
}

async function executable(path) {
  try {
    await access(path, fsConstants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function sendSignal(child, signal) {
  try {
    if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch {
    try {
      child.kill(signal);
    } catch {}
  }
}

function childTermination(child) {
  if (!child || typeof child.kill !== 'function') return Promise.resolve();
  if (
    (child.exitCode !== null && child.exitCode !== undefined) ||
    (child.signalCode !== null && child.signalCode !== undefined)
  )
    return Promise.resolve();
  return new Promise((resolveDone) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolveDone();
    };
    const timer = setTimeout(() => {
      sendSignal(child, 'SIGKILL');
      finish();
    }, 1000);
    child.once?.('close', finish);
    sendSignal(child, 'SIGTERM');
  });
}

function detectSystemVersion(platform) {
  if (platform !== 'darwin') return '';
  if (typeof process.getSystemVersion === 'function') return process.getSystemVersion() || '';
  try {
    return execFileSync('/usr/bin/sw_vers', ['-productVersion'], {
      encoding: 'utf8',
      timeout: 2000,
    }).trim();
  } catch {
    return '';
  }
}

export function createLocalTranslation({
  resourcesPath = process.resourcesPath,
  cacheRoot = resolve('.cache/native'),
  source = sourcePath,
  platform = process.platform,
  systemVersion,
  execFileImpl = runExec,
  spawnImpl = spawn,
  onProcess,
  timeoutMs = 60000,
} = {}) {
  const active = new Set();
  let closed = false;
  let helperPromise;
  let availabilityError;
  let closePromise;
  const version = typeof systemVersion === 'string' ? systemVersion : detectSystemVersion(platform);
  const compileControllers = new Set();
  const compileTasks = new Set();
  const terminations = new Map();

  function assertSupported() {
    if (platform !== 'darwin' || (version && Number.parseInt(version, 10) < 26))
      throw Error(unsupportedMessage(platform, version));
  }

  async function packagedHelper() {
    if (typeof resourcesPath !== 'string' || !resourcesPath) return null;
    const candidate = join(resourcesPath, LOCAL_TRANSLATION_RESOURCE);
    return (await executable(candidate)) ? candidate : null;
  }

  async function compileHelper() {
    const packaged = await packagedHelper();
    if (packaged) return packaged;
    let sourceBytes;
    try {
      sourceBytes = await readFile(source);
    } catch {
      throw Error(
        'Apple on-device translation helper source is unavailable. Reinstall PDFMathReader.',
      );
    }
    const hash = createHash('sha256')
      .update(sourceBytes)
      .update(process.arch + ':macos26:v1')
      .digest('hex');
    const binary = join(resolve(cacheRoot), `${LOCAL_TRANSLATION_RESOURCE}-${hash}`);
    if (await executable(binary)) return binary;
    await mkdir(resolve(cacheRoot), { recursive: true });
    const moduleCache = join(resolve(cacheRoot), 'swift-modules');
    await mkdir(moduleCache, { recursive: true });
    const temporary = `${binary}.${randomUUID()}.tmp`;
    const compilerController = new AbortController();
    compileControllers.add(compilerController);
    try {
      const target = `${process.arch === 'arm64' ? 'arm64' : 'x86_64'}-apple-macosx26.0`;
      await execFileImpl(
        '/usr/bin/swiftc',
        [
          '-O',
          '-parse-as-library',
          '-target',
          target,
          '-framework',
          'Translation',
          '-module-cache-path',
          moduleCache,
          '-o',
          temporary,
          source,
        ],
        { timeout: 120000, maxBuffer: 4 * 1024 * 1024, signal: compilerController.signal },
      );
      await chmod(temporary, 0o755);
      await rename(temporary, binary);
      return binary;
    } catch (error) {
      await rm(temporary, { force: true });
      const detail = error?.stderr || error?.message || 'unknown compiler error';
      throw Error(`Could not compile Apple on-device translation helper: ${String(detail).trim()}`);
    } finally {
      compileControllers.delete(compilerController);
    }
  }

  async function helper() {
    assertSupported();
    if (closed) throw Error('Local translation is closed.');
    if (!helperPromise) {
      const task = compileHelper().catch((error) => {
        helperPromise = undefined;
        throw error;
      });
      helperPromise = task;
      compileTasks.add(task);
      task.then(
        () => compileTasks.delete(task),
        () => compileTasks.delete(task),
      );
    }
    return helperPromise;
  }

  function terminate(child) {
    if (!child) return Promise.resolve();
    if (!terminations.has(child))
      terminations.set(
        child,
        childTermination(child).finally(() => terminations.delete(child)),
      );
    return terminations.get(child);
  }

  async function translate({ text, source: sourceLanguage, target: targetLanguage, signal } = {}) {
    assertSupported();
    if (closed) throw Error('Local translation is closed.');
    if (typeof text !== 'string') throw Error('Local translation text must be a string.');
    const source = normalizeLanguage(sourceLanguage),
      target = normalizeLanguage(targetLanguage);
    if (!source || !target)
      throw Error('Local translation source and target languages are required.');
    if (signal?.aborted) throw abortError(signal);
    if (source.toLowerCase() === target.toLowerCase()) return text;
    const executablePath = await helper();
    if (signal?.aborted) throw abortError(signal);
    return new Promise((resolveTranslation, rejectTranslation) => {
      let settled = false;
      let output = '';
      let stderr = '';
      let abortListener;
      let timeout;
      let child;
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (signal && abortListener) signal.removeEventListener('abort', abortListener);
        if (error) rejectTranslation(error);
        else resolveTranslation(value);
      };
      const parseLine = (line) => {
        const trimmed = line.trim();
        if (!trimmed) return;
        let result;
        try {
          result = JSON.parse(trimmed);
        } catch {
          finish(Error('Apple on-device translation returned invalid JSON.'));
          void terminate(child);
          return;
        }
        if (typeof result.translation === 'string') {
          finish(null, result.translation);
          void terminate(child);
          return;
        }
        const detail = typeof result.error === 'string' ? result.error : result.error?.message;
        finish(Error(detail || 'Apple on-device translation failed.'));
        void terminate(child);
      };
      try {
        child = spawnImpl(executablePath, [], {
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
          detached: process.platform !== 'win32',
        });
      } catch (error) {
        finish(error);
        return;
      }
      active.add(child);
      try {
        onProcess?.(child, executablePath);
      } catch {}
      child.once?.('error', (error) => {
        finish(Error(`Apple on-device translation helper failed to start: ${error.message}`));
        void terminate(child);
      });
      child.once?.('close', (code, signalCode) => {
        active.delete(child);
        if (settled) return;
        if (output.trim()) parseLine(output);
        if (settled) return;
        const detail = stderr.trim();
        finish(
          Error(
            detail ||
              `Apple on-device translation helper exited before returning a translation${code === null && signalCode ? ` (${signalCode})` : code === null ? '' : ` (code ${code})`}.`,
          ),
        );
      });
      child.stdout?.on('data', (chunk) => {
        output += String(chunk);
        const lines = output.split(/\r?\n/);
        output = lines.pop() || '';
        for (const line of lines) parseLine(line);
      });
      child.stderr?.on('data', (chunk) => {
        stderr += String(chunk);
      });
      abortListener = () => {
        const error = abortError(signal);
        finish(error);
        void terminate(child);
      };
      signal?.addEventListener('abort', abortListener, { once: true });
      if (signal?.aborted) {
        abortListener();
        return;
      }
      const limit = Number(timeoutMs);
      if (Number.isFinite(limit) && limit > 0)
        timeout = setTimeout(() => {
          finish(
            Error(
              `Apple on-device translation timed out after ${Math.ceil(limit / 1000)} seconds.`,
            ),
          );
          void terminate(child);
        }, limit);
      try {
        child.stdin?.end(JSON.stringify({ text, source, target }) + '\n');
      } catch (error) {
        finish(error);
        void terminate(child);
      }
    });
  }

  async function available() {
    if (closed) return false;
    try {
      await helper();
      availabilityError = undefined;
      return true;
    } catch (error) {
      availabilityError = error;
      return false;
    }
  }

  async function close() {
    if (closePromise) return closePromise;
    closed = true;
    for (const controller of compileControllers) controller.abort();
    closePromise = Promise.allSettled([...active].map(terminate).concat([...compileTasks])).then(
      () => undefined,
    );
    return closePromise;
  }

  return {
    available,
    translate: async (request) => {
      try {
        return await translate(request);
      } catch (error) {
        if (
          error?.message === 'Apple on-device translation helper is unavailable.' &&
          availabilityError
        )
          throw availabilityError;
        throw error;
      }
    },
    close,
  };
}
