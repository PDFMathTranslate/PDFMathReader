import { createHash, randomUUID } from 'node:crypto';
import { execFile, spawn } from 'node:child_process';
import { cp, lstat, mkdir, mkdtemp, open, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { dirname, join, resolve, sep } from 'node:path';

const execFileAsync = promisify(execFile);

export const MAX_UPDATE_DOWNLOAD_SIZE = 1024 * 1024 * 1024;
export const UPDATE_DOWNLOAD_TIMEOUT = 10 * 60 * 1000;
export const UPDATE_HELPER_TIMEOUT = 15 * 60 * 1000;

const VERSION_PATTERN =
  /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\da-zA-Z.-]+))?(?:\+([\da-zA-Z.-]+))?$/;
const SHA256_PATTERN = /^(?:sha256:)?([\da-f]{64})$/i;
const GITHUB_ORIGIN = 'https://github.com';
const GITHUB_OWNER = 'PDFMathTranslate';
const GITHUB_REPOSITORY = 'PDFMathReader';

/*
 * The helper is deliberately written to userData before it is spawned. The
 * production bundle removes electron/main after esbuild has bundled main.mjs,
 * and replacing the app bundle would otherwise delete the helper while it is
 * still needed. The helper only uses Node built-ins so it can run with
 * ELECTRON_RUN_AS_NODE=1.
 */
const UPDATE_HELPER_SOURCE = `
// Electron patches fs even in RUN_AS_NODE mode. Copy app.asar as a physical
// file, otherwise fs.cp treats the partly copied archive as a virtual directory.
process.noAsar = true;
import { spawnSync } from 'node:child_process';
import { cp, lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';

const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

function inside(path, root) {
  const child = resolve(path);
  const parent = resolve(root);
  const childKey = process.platform === 'win32' ? child.toLowerCase() : child;
  const parentKey = process.platform === 'win32' ? parent.toLowerCase() : parent;
  return childKey === parentKey || childKey.startsWith(parentKey + sep);
}

async function exists(path) {
  try {
    await lstat(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function renameWithRetry(source, target) {
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(source, target);
      return;
    } catch (error) {
      if (
        process.platform !== 'win32' ||
        !['EPERM', 'EACCES', 'EBUSY'].includes(error.code) ||
        attempt >= 12
      )
        throw error;
      await sleep(Math.min(500, 25 * 2 ** attempt));
    }
  }
}

async function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

async function waitForParentExit(pid, timeout) {
  if (!Number.isInteger(pid) || pid <= 0) return;
  const deadline = Date.now() + timeout;
  while (await processExists(pid)) {
    if (Date.now() >= deadline) throw Error('Timed out waiting for PDFMathReader to exit');
    await sleep(100);
  }
}

async function copyToSibling(source, target) {
  const temporary = target + '.updating-' + process.pid + '-' + Date.now();
  await rm(temporary, { recursive: true, force: true });
  await cp(source, temporary, { recursive: true, dereference: false, verbatimSymlinks: true, preserveTimestamps: true });
  return temporary;
}

function commandText(result) {
  return [result?.stdout, result?.stderr]
    .filter((value) => value !== undefined && value !== null)
    .map((value) => (Buffer.isBuffer(value) ? value.toString('utf8') : String(value)))
    .join('\\n');
}

function runCommand(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = Error(command + ' ' + args.join(' ') + ' exited with status ' + result.status);
    error.status = result.status;
    error.stdout = result.stdout;
    error.stderr = result.stderr;
    throw error;
  }
  return result;
}

function readIdentity(bundle, codesignPath) {
  const output = commandText(runCommand(codesignPath, ['-dv', '--verbose=4', bundle]));
  const identifier = /^Identifier=([^\\r\\n]+)$/m.exec(output)?.[1]?.trim();
  const teamIdentifier = /^TeamIdentifier=([^\\r\\n]+)$/m.exec(output)?.[1]?.trim();
  if (!identifier || !teamIdentifier) throw Error('Signed app identity is unavailable');
  return { identifier, teamIdentifier };
}

function verifyIdentity(bundle, expected, codesignPath) {
  runCommand(codesignPath, ['--verify', '--deep', '--strict', bundle]);
  const actual = readIdentity(bundle, codesignPath);
  if (
    actual.teamIdentifier !== expected.teamIdentifier ||
    actual.identifier !== expected.identifier
  )
    throw Error('Signed app identity does not match the installed app');
}

function readBundleVersion(bundle, plutilPath) {
  const plist = bundle + '/Contents/Info.plist';
  try {
    return commandText(
      runCommand(plutilPath, [
        '-extract',
        'CFBundleShortVersionString',
        'raw',
        '-o',
        '-',
        plist,
      ]),
    ).trim();
  } catch {
    return commandText(
      runCommand(plutilPath, ['-extract', 'CFBundleVersion', 'raw', '-o', '-', plist]),
    ).trim();
  }
}

function verifyBundle(bundle, manifest) {
  verifyIdentity(bundle, manifest.identity, manifest.codesignPath || '/usr/bin/codesign');
  if (
    readBundleVersion(bundle, manifest.plutilPath || '/usr/bin/plutil') !==
    manifest.expectedVersion
  )
    throw Error('Staged app version does not match the requested update');
}

async function writeResult(resultPath, result) {
  if (!resultPath) return;
  try {
    await mkdir(dirname(resultPath), { recursive: true });
    const temporary = resultPath + '.tmp-' + process.pid;
    await writeFile(temporary, JSON.stringify(result), { encoding: 'utf8', mode: 0o600 });
    await rename(temporary, resultPath);
  } catch (error) {
    console.error('Unable to write update result:', error?.stack || error);
  }
}

async function replacePath(source, target, stageRoot, manifest) {
  if (!inside(source, stageRoot)) throw Error('Staged update is outside its staging directory');
  if (!(await exists(source))) throw Error('Staged update no longer exists');
  if (!(await exists(target))) throw Error('Installed application no longer exists');

  verifyBundle(source, manifest);
  verifyIdentity(target, manifest.identity, manifest.codesignPath || '/usr/bin/codesign');
  const targetParent = dirname(target);
  await mkdir(targetParent, { recursive: true });
  const backup = target + '.previous-' + process.pid + '-' + Date.now();
  if (await exists(backup)) throw Error('Update backup path already exists');
  const temporary = await copyToSibling(source, target);
  let backedUp = false;
  try {
    verifyBundle(temporary, manifest);
    await renameWithRetry(target, backup);
    backedUp = true;
    await renameWithRetry(temporary, target);
    verifyBundle(target, manifest);
  } catch (error) {
    await rm(temporary, { recursive: true, force: true }).catch(() => {});
    if (backedUp) {
      try {
        await rm(target, { recursive: true, force: true });
        await renameWithRetry(backup, target);
      } catch (rollbackError) {
        error.rollbackError = rollbackError;
      }
    }
    throw error;
  }
  return backup;
}

async function replaceApplication(manifest) {
  if (!manifest.stagedPath || !manifest.targetPath || !manifest.stageRoot)
    throw Error('Incomplete macOS update manifest');
  if (!manifest.targetPath.endsWith('.app')) throw Error('Invalid macOS application target');
  return replacePath(manifest.stagedPath, manifest.targetPath, manifest.stageRoot, manifest);
}

async function main() {
  const manifestPath = process.argv[2];
  const resultPathArgument = process.argv[3];
  if (!manifestPath) throw Error('Missing update manifest');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.type !== 'pdfmathreader-update-v1' || manifest.platform !== 'darwin')
    throw Error('Unsupported update manifest');
  await waitForParentExit(manifest.parentPid, manifest.waitTimeout);
  const backupPath = await replaceApplication(manifest);
  await writeResult(manifest.resultPath || resultPathArgument, {
    status: 'installed',
    version: manifest.expectedVersion,
    backupPath,
    finishedAt: new Date().toISOString(),
  });
  await rm(manifest.stageRoot, { recursive: true, force: true }).catch(() => {});
  await rm(manifest.helperPath, { force: true }).catch(() => {});
}

try {
  await main();
} catch (error) {
  try {
    const resultPath = process.argv[3];
    if (resultPath)
      await writeResult(resultPath, {
        status: 'error',
        code: error?.code || 'UPDATE_INSTALL_FAILED',
        message: String(error?.message || error),
        stack: error?.stack || null,
        finishedAt: new Date().toISOString(),
      });
  } catch {}
  console.error(error?.stack || error);
  process.exitCode = 1;
}
`;

function versionParts(value) {
  const match = VERSION_PATTERN.exec(String(value || ''));
  return match
    ? {
        numbers: match.slice(1, 4).map(Number),
        pre: match[4]?.split('.') || [],
        build: match[5] || '',
      }
    : null;
}

function compareVersions(leftValue, rightValue) {
  const left = versionParts(leftValue),
    right = versionParts(rightValue);
  if (!left || !right) return null;
  for (let index = 0; index < 3; index++)
    if (left.numbers[index] !== right.numbers[index])
      return Math.sign(left.numbers[index] - right.numbers[index]);
  if (!left.pre.length || !right.pre.length) return left.pre.length ? -1 : right.pre.length ? 1 : 0;
  for (let index = 0; index < Math.max(left.pre.length, right.pre.length); index++) {
    const leftPart = left.pre[index],
      rightPart = right.pre[index];
    if (leftPart === rightPart) continue;
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    const leftNumeric = /^\d+$/.test(leftPart),
      rightNumeric = /^\d+$/.test(rightPart);
    if (leftNumeric && rightNumeric) return Math.sign(Number(leftPart) - Number(rightPart));
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    return leftPart < rightPart ? -1 : 1;
  }
  return 0;
}

function normalizedVersion(value, fieldName) {
  const parts = versionParts(value);
  if (!parts || parts.pre.length || parts.build) throw Error(`Invalid ${fieldName || 'version'}`);
  return parts.numbers.join('.');
}

function errorWithCode(message, code) {
  const error = Error(message);
  error.code = code;
  return error;
}

function commandText(result) {
  if (result == null) return '';
  if (Buffer.isBuffer(result)) return result.toString('utf8');
  if (typeof result === 'string') return result;
  return [result.stdout, result.stderr]
    .filter((value) => value !== undefined && value !== null)
    .map((value) => (Buffer.isBuffer(value) ? value.toString('utf8') : String(value)))
    .join('\n');
}

function assertCommandSuccess(result, command, args) {
  if (result?.error) throw result.error;
  if (typeof result?.status === 'number' && result.status !== 0) {
    const error = Error(`${command} ${args.join(' ')} exited with status ${result.status}`);
    error.status = result.status;
    error.stdout = result.stdout;
    error.stderr = result.stderr;
    throw error;
  }
  return result;
}

function appBundleFromExecutable(executable) {
  if (typeof executable !== 'string' || !executable) return null;
  const normalized = resolve(executable);
  if (normalized.endsWith('.app')) return normalized;
  const match = normalized.match(/[\\/]Contents[\\/]MacOS[\\/]/);
  return match ? normalized.slice(0, match.index) : null;
}

function headerValue(headers, name) {
  if (!headers) return null;
  const value =
    typeof headers.get === 'function'
      ? headers.get(name)
      : headers[name] || headers[name.toLowerCase()];
  return value == null ? null : String(value);
}

function abortReason(signal) {
  return signal?.reason || errorWithCode('Update download aborted', 'ABORT_ERR');
}

function timeoutError() {
  return errorWithCode('Update download timed out', 'UPDATE_DOWNLOAD_TIMEOUT');
}

function withDeadline(promise, { signal, deadline, setTimer, clearTimer, onTimeout }) {
  return new Promise((resolvePromise, rejectPromise) => {
    let settled = false;
    let timer;
    let abort;
    const finish = (finishPromise, value) => {
      if (settled) return;
      settled = true;
      clearTimer(timer);
      signal?.removeEventListener('abort', abort);
      finishPromise(value);
    };
    abort = () => finish(rejectPromise, abortReason(signal));
    const remaining = Math.max(1, deadline - Date.now());
    timer = setTimer(() => {
      const error = timeoutError();
      onTimeout?.(error);
      finish(rejectPromise, error);
    }, remaining);
    signal?.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(
      (value) => finish(resolvePromise, value),
      (error) => finish(rejectPromise, error),
    );
    if (signal?.aborted) abort();
  });
}

function validateDownloadUrl(downloadUrl, { platform, arch, latestVersion }) {
  if (typeof downloadUrl !== 'string')
    throw errorWithCode('Missing update download URL', 'INVALID_UPDATE');
  let parsed;
  try {
    parsed = new URL(downloadUrl);
  } catch {
    throw errorWithCode('Invalid update download URL', 'INVALID_UPDATE');
  }
  const extension = platform === 'darwin' ? 'zip' : platform === 'win32' ? 'exe' : 'tar.gz';
  const filename = `PDFMathReader-${platform}-${arch}.${extension}`;
  const prefix = `/${GITHUB_OWNER}/${GITHUB_REPOSITORY}/releases/download/`;
  const path = parsed.pathname;
  const tag = path.startsWith(prefix) ? path.slice(prefix.length).split('/')[0] : '';
  if (
    parsed.origin !== GITHUB_ORIGIN ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !tag ||
    ![latestVersion, `v${latestVersion}`].includes(tag) ||
    path !== `${prefix}${tag}/${filename}`
  )
    throw errorWithCode(
      'Update download URL is not a trusted PDFMathReader release asset',
      'INVALID_UPDATE',
    );
  return parsed.href;
}

function normalizedDigest(value) {
  const match = SHA256_PATTERN.exec(String(value || '').trim());
  if (!match) throw errorWithCode('A SHA-256 update digest is required', 'INVALID_UPDATE');
  return match[1].toLowerCase();
}

function normalizedSize(value, maximum) {
  const size =
    typeof value === 'number' ? value : /^\d+$/.test(String(value || '')) ? Number(value) : NaN;
  if (!Number.isSafeInteger(size) || size <= 0 || size > maximum)
    throw errorWithCode('Invalid or unsafe update download size', 'INVALID_UPDATE');
  return size;
}

function validateArchiveEntry(entry, destination) {
  const normalized = String(entry).replaceAll('\\', '/');
  if (!normalized) return;
  if (normalized.startsWith('/') || /^[a-zA-Z]:\//.test(normalized) || normalized.includes('\0'))
    throw errorWithCode('Update archive contains an unsafe path', 'INVALID_UPDATE');
  if (normalized.split('/').includes('..'))
    throw errorWithCode('Update archive contains a path traversal entry', 'INVALID_UPDATE');
  const candidate = resolve(destination, normalized);
  const root = resolve(destination);
  if (candidate !== root && !candidate.startsWith(root + sep))
    throw errorWithCode('Update archive contains a path traversal entry', 'INVALID_UPDATE');
}

async function defaultExtractZip(archivePath, destination) {
  await mkdir(destination, { recursive: true, mode: 0o700 });
  const listing = await execFileAsync('/usr/bin/unzip', ['-Z1', archivePath], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
  for (const entry of String(listing.stdout || '').split(/\r?\n/))
    if (entry) validateArchiveEntry(entry, destination);
  await execFileAsync('/usr/bin/ditto', ['-x', '-k', archivePath, destination], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
}

async function findStagedBundle(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const bundles = [];
  for (const entry of entries) {
    if (!entry.name.endsWith('.app') || !entry.isDirectory()) continue;
    const candidate = join(root, entry.name);
    const info = await lstat(candidate);
    if (info.isSymbolicLink())
      throw errorWithCode('Update app bundle must not be a symlink', 'INVALID_UPDATE');
    bundles.push(candidate);
  }
  if (bundles.length !== 1)
    throw errorWithCode('Update archive must contain exactly one app bundle', 'INVALID_UPDATE');
  return bundles[0];
}

function makeProgress(onProgress, receivedBytes, totalBytes) {
  if (typeof onProgress !== 'function') return;
  return onProgress(totalBytes ? receivedBytes / totalBytes : 0);
}

async function downloadToFile({
  url,
  destination,
  expectedSize,
  expectedDigest,
  fetchImpl,
  onProgress,
  signal,
  timeoutMs,
  setTimer,
  clearTimer,
}) {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort(abortReason(signal));
  signal?.addEventListener('abort', forwardAbort, { once: true });
  const deadline = Date.now() + timeoutMs;
  let response;
  try {
    response = await withDeadline(
      Promise.resolve().then(() => fetchImpl(url, { signal: controller.signal })),
      {
        signal,
        deadline,
        setTimer,
        clearTimer,
        onTimeout: (error) => controller.abort(error),
      },
    );
    if (!response?.ok)
      throw errorWithCode(
        `Update download failed with HTTP ${response?.status || 0}`,
        'DOWNLOAD_FAILED',
      );
    const contentLength = headerValue(response.headers, 'content-length');
    if (contentLength !== null) {
      const reportedSize = Number(contentLength);
      if (!Number.isSafeInteger(reportedSize) || reportedSize > expectedSize)
        throw errorWithCode('Update download exceeds its declared size', 'DOWNLOAD_FAILED');
    }

    const file = await open(destination, 'w', 0o600);
    const hash = createHash('sha256');
    let receivedBytes = 0;
    const write = async (chunk) => {
      const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
      receivedBytes += bytes.byteLength;
      if (receivedBytes > expectedSize)
        throw errorWithCode('Update download exceeds its expected size', 'DOWNLOAD_FAILED');
      hash.update(bytes);
      await file.write(bytes);
      await makeProgress(onProgress, receivedBytes, expectedSize);
    };
    try {
      if (response.body?.getReader) {
        const reader = response.body.getReader();
        try {
          for (;;) {
            const result = await withDeadline(reader.read(), {
              signal,
              deadline,
              setTimer,
              clearTimer,
              onTimeout: (error) => controller.abort(error),
            });
            if (result.done) break;
            await write(result.value);
          }
        } finally {
          await reader.releaseLock?.();
        }
      } else if (response.body?.[Symbol.asyncIterator]) {
        const iterator = response.body[Symbol.asyncIterator]();
        for (;;) {
          const result = await withDeadline(iterator.next(), {
            signal,
            deadline,
            setTimer,
            clearTimer,
            onTimeout: (error) => controller.abort(error),
          });
          if (result.done) break;
          await write(result.value);
        }
      } else if (typeof response.arrayBuffer === 'function') {
        const bytes = await withDeadline(response.arrayBuffer(), {
          signal,
          deadline,
          setTimer,
          clearTimer,
          onTimeout: (error) => controller.abort(error),
        });
        await write(bytes);
      } else throw errorWithCode('Update response has no readable body', 'DOWNLOAD_FAILED');
    } finally {
      await file.close();
    }
    if (receivedBytes !== expectedSize)
      throw errorWithCode(
        'Update download size does not match the API metadata',
        'DOWNLOAD_FAILED',
      );
    if (hash.digest('hex') !== expectedDigest)
      throw errorWithCode(
        'Update download digest does not match the API metadata',
        'DOWNLOAD_FAILED',
      );
  } finally {
    signal?.removeEventListener('abort', forwardAbort);
  }
}

function createUnsupportedError(reason) {
  return errorWithCode(`Automatic update installation is unsupported: ${reason}`, 'unsupported');
}

export function createUpdateInstaller({
  app,
  platform = process.platform,
  arch = process.arch,
  fetchImpl = globalThis.fetch,
  maxDownloadSize = MAX_UPDATE_DOWNLOAD_SIZE,
  downloadTimeout = UPDATE_DOWNLOAD_TIMEOUT,
  helperTimeout = UPDATE_HELPER_TIMEOUT,
  updatesDirectory,
  appBundlePath,
  runCommand,
  runCommandSync,
  codesignPath = '/usr/bin/codesign',
  plutilPath = '/usr/bin/plutil',
  extractZip,
  readBundleVersion,
  spawnImpl = spawn,
  processExecPath = process.execPath,
  parentPid = process.pid,
  environment = process.env,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  let userDataPath;
  try {
    userDataPath = updatesDirectory || join(app?.getPath?.('userData'), 'updates');
  } catch {}
  const installedBundlePath =
    appBundlePath ||
    appBundleFromExecutable(
      (() => {
        try {
          return app?.getPath?.('exe');
        } catch {
          return null;
        }
      })(),
    );
  const installedBundle = installedBundlePath ? resolve(installedBundlePath) : null;
  const supported = platform === 'darwin' && !!userDataPath && !!installedBundle;
  const unsupportedReason =
    platform === 'win32'
      ? 'the current Windows artifact is a portable executable; no safe portable replacement is enabled'
      : platform === 'darwin'
        ? 'the packaged application path is unavailable'
        : 'only signed macOS app bundles are currently supported';
  let prepared;

  async function executeCommand(command, args) {
    if (runCommand) return assertCommandSuccess(await runCommand(command, args), command, args);
    if (runCommandSync) return assertCommandSuccess(runCommandSync(command, args), command, args);
    return assertCommandSuccess(
      await execFileAsync(command, args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }),
      command,
      args,
    );
  }

  async function readIdentity(bundle) {
    const output = commandText(await executeCommand(codesignPath, ['-dv', '--verbose=4', bundle]));
    const identifier = /^Identifier=([^\r\n]+)$/m.exec(output)?.[1]?.trim();
    const teamIdentifier = /^TeamIdentifier=([^\r\n]+)$/m.exec(output)?.[1]?.trim();
    if (!identifier || !teamIdentifier)
      throw errorWithCode('Installed app has no pinned macOS bundle identity', 'SIGNATURE_INVALID');
    return { identifier, teamIdentifier };
  }

  async function verifySignature(bundle, identity) {
    await executeCommand(codesignPath, ['--verify', '--deep', '--strict', bundle]);
    const staged = await readIdentity(bundle);
    if (
      staged.teamIdentifier !== identity.teamIdentifier ||
      staged.identifier !== identity.identifier
    )
      throw errorWithCode(
        'Update app signature identity does not match the installed app',
        'SIGNATURE_INVALID',
      );
  }

  async function defaultReadBundleVersion(bundle) {
    const plist = join(bundle, 'Contents', 'Info.plist');
    let output;
    try {
      output = commandText(
        await executeCommand(plutilPath, [
          '-extract',
          'CFBundleShortVersionString',
          'raw',
          '-o',
          '-',
          plist,
        ]),
      );
    } catch {
      output = commandText(
        await executeCommand(plutilPath, ['-extract', 'CFBundleVersion', 'raw', '-o', '-', plist]),
      );
    }
    return output.trim();
  }

  function installerFor(manifestPath, helperPath, manifest, stageRoot) {
    let child;
    const installOnQuit = () => {
      if (child) return child;
      child = spawnImpl(processExecPath, [helperPath, manifestPath, manifest.resultPath], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        env: { ...environment, ELECTRON_RUN_AS_NODE: '1' },
      });
      child?.unref?.();
      return child;
    };
    Object.assign(installOnQuit, {
      installOnQuit,
      manifestPath,
      helperPath,
      stageRoot,
      stagedPath: manifest.stagedPath,
      expectedVersion: manifest.expectedVersion,
      resultPath: manifest.resultPath,
    });
    return installOnQuit;
  }

  async function prepare(
    { downloadUrl, latestVersion, downloadDigest, downloadSize } = {},
    onProgress,
    signal,
  ) {
    if (!supported) throw createUnsupportedError(unsupportedReason);
    if (signal?.aborted) throw abortReason(signal);
    if (typeof fetchImpl !== 'function')
      throw errorWithCode('Update download is unavailable', 'DOWNLOAD_FAILED');
    const expectedVersion = normalizedVersion(latestVersion, 'latest update version');
    const currentVersion = app?.getVersion?.();
    if (compareVersions(expectedVersion, currentVersion) !== 1)
      throw errorWithCode(
        'Update version is not newer than the installed version',
        'INVALID_UPDATE',
      );
    const url = validateDownloadUrl(downloadUrl, {
      platform,
      arch,
      latestVersion: expectedVersion,
    });
    const expectedDigest = normalizedDigest(downloadDigest);
    const expectedSize = normalizedSize(downloadSize, maxDownloadSize);
    const identity = await readIdentity(installedBundle);
    const root = resolve(userDataPath);
    let stageRoot;
    try {
      await mkdir(root, { recursive: true, mode: 0o700 });
      stageRoot = await mkdtemp(join(root, `.stage-${expectedVersion}-`));
      const resultPath = join(root, 'last-update-result.json');
      await rm(resultPath, { force: true });
      const archivePath = join(stageRoot, `PDFMathReader-${platform}-${arch}.zip`);
      await downloadToFile({
        url,
        destination: archivePath,
        expectedSize,
        expectedDigest,
        fetchImpl,
        onProgress,
        signal,
        timeoutMs: downloadTimeout,
        setTimer,
        clearTimer,
      });
      const extractedRoot = join(stageRoot, 'extracted');
      await (extractZip || defaultExtractZip)(archivePath, extractedRoot, {
        signal,
        platform,
        arch,
      });
      const stagedPath = await findStagedBundle(extractedRoot);
      await verifySignature(stagedPath, identity);
      const stagedVersion = normalizedVersion(
        await (readBundleVersion || defaultReadBundleVersion)(stagedPath),
        'staged update version',
      );
      if (compareVersions(stagedVersion, expectedVersion) !== 0)
        throw errorWithCode(
          'Staged app version does not match the requested update',
          'INVALID_UPDATE',
        );
      const helperPath = join(root, `.update-helper-${randomUUID()}.mjs`);
      const manifestPath = join(stageRoot, 'update-manifest.json');
      const manifest = {
        type: 'pdfmathreader-update-v1',
        platform,
        arch,
        parentPid,
        waitTimeout: helperTimeout,
        stageRoot,
        stagedPath,
        targetPath: installedBundle,
        expectedVersion,
        identity,
        codesignPath,
        plutilPath,
        resultPath,
        helperPath,
      };
      await writeFile(manifestPath, JSON.stringify(manifest), { encoding: 'utf8', mode: 0o600 });
      await writeFile(helperPath, UPDATE_HELPER_SOURCE, { encoding: 'utf8', mode: 0o700 });
      prepared = installerFor(manifestPath, helperPath, manifest, stageRoot);
      return prepared;
    } catch (error) {
      if (stageRoot) await rm(stageRoot, { recursive: true, force: true }).catch(() => {});
      throw error;
    }
  }

  return {
    supported,
    unsupportedReason: supported ? null : unsupportedReason,
    resultPath: supported ? join(resolve(userDataPath), 'last-update-result.json') : null,
    prepare,
    installOnQuit: () => prepared?.installOnQuit?.() || false,
  };
}
