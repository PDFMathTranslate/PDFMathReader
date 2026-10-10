import { POWERSHELL_SCRIPT } from './windows-send-to-script.mjs';
import { spawn } from 'node:child_process';
import { stat } from 'node:fs/promises';
import pathModule from 'node:path';

const SHARE_START_TIMEOUT_MS = 30_000;
const SHARE_PROCESS_TIMEOUT_MS = 150_000;
const MAX_OUTPUT_BYTES = 64 * 1024;

const activeShares = new WeakMap();

function makeShareError(code, message, cause) {
  const error = new Error(message, { cause });
  error.code = code;
  return error;
}

function getWindowHandle(target) {
  if (!target || typeof target.getNativeWindowHandle !== 'function') {
    throw makeShareError(
      'ERR_SHARE_TARGET',
      'Windows file sharing requires an Electron BrowserWindow target.',
    );
  }

  if (typeof target.isDestroyed === 'function' && target.isDestroyed()) {
    throw makeShareError('ERR_SHARE_CANCELLED', 'The target window is already destroyed.');
  }

  let nativeHandle;
  try {
    nativeHandle = target.getNativeWindowHandle();
  } catch (error) {
    throw makeShareError('ERR_SHARE_TARGET', 'Could not read the target window handle.', error);
  }

  if (!Buffer.isBuffer(nativeHandle) && !(nativeHandle instanceof Uint8Array)) {
    throw makeShareError('ERR_SHARE_TARGET', 'Electron returned an invalid native window handle.');
  }

  const bytes = Buffer.from(nativeHandle);
  if (bytes.length !== 4 && bytes.length !== 8) {
    throw makeShareError(
      'ERR_SHARE_TARGET',
      `Electron returned a ${bytes.length}-byte native window handle; expected 4 or 8 bytes.`,
    );
  }

  const value = bytes.length === 4 ? BigInt(bytes.readUInt32LE(0)) : bytes.readBigUInt64LE(0);
  if (value === 0n) {
    throw makeShareError('ERR_SHARE_TARGET', 'Electron returned a null native window handle.');
  }

  return value.toString(10);
}

async function getSharePath(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0 || filePath.includes('\0')) {
    throw makeShareError('ERR_SHARE_PATH', 'Windows file sharing requires a non-empty file path.');
  }

  const windowsPath = filePath.replaceAll('/', '\\');
  if (!pathModule.win32.isAbsolute(windowsPath)) {
    throw makeShareError('ERR_SHARE_PATH', 'Windows file sharing requires an absolute file path.');
  }

  let fileInfo;
  try {
    fileInfo = await stat(windowsPath);
  } catch (error) {
    throw makeShareError('ERR_SHARE_PATH', 'The file to share could not be read.', error);
  }

  if (!fileInfo.isFile()) {
    throw makeShareError('ERR_SHARE_PATH', 'The path to share is not a regular file.');
  }

  return windowsPath;
}

function appendOutput(buffer, chunk) {
  const next = `${buffer}${chunk.toString('utf8')}`;
  return next.length > MAX_OUTPUT_BYTES ? next.slice(-MAX_OUTPUT_BYTES) : next;
}

function terminateChild(child) {
  if (child.exitCode !== null || child.signalCode !== null || child.killed) {
    return;
  }

  try {
    child.kill();
  } catch {
    // The child may have exited between the state check and kill().
  }
}

function cancelActiveShare(target) {
  const current = activeShares.get(target);
  if (!current) {
    return;
  }

  current.cancel();
}

function startShare(target, windowsPath, hwndText) {
  const environment = {
    ...process.env,
    PDFMATHREADER_SHARE_PATH: windowsPath,
    PDFMATHREADER_SHARE_HWND: hwndText,
  };

  const child = spawn(
    'powershell.exe',
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-STA',
      '-Command',
      'Invoke-Expression ([Console]::In.ReadToEnd())',
    ],
    {
      env: environment,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    },
  );

  let stdout = '';
  let stderr = '';
  let ready = false;
  let settled = false;
  let startTimer;
  let processTimer;
  let onWindowClosed;
  let cancelShare;

  const promise = new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(startTimer);
      clearTimeout(processTimer);
      if (onWindowClosed && typeof target.removeListener === 'function') {
        target.removeListener('closed', onWindowClosed);
      }
      if (activeShares.get(target)?.child === child) {
        activeShares.delete(target);
      }
    };

    const finish = (error, value) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      if (error) {
        reject(error);
      } else {
        resolve(value);
      }
    };

    cancelShare = () => {
      terminateChild(child);
      finish(undefined, false);
    };

    const processError = (message, cause) => {
      finish(makeShareError('ERR_SHARE_PROCESS', message, cause));
    };

    const processLine = (line) => {
      if (line === 'READY') {
        ready = true;
        clearTimeout(startTimer);
        return;
      }

      if (line.startsWith('ERROR\t')) {
        const [, kind = 'WindowsError', ...parts] = line.split('\t');
        processError(`Windows sharing failed (${kind}): ${parts.join('\t') || 'unknown error'}`);
        return;
      }

      if (line === 'RESULT\tcancelled' && !ready) {
        processError('Windows sharing was cancelled before the share UI became ready.');
      }
    };

    const consumeLines = (chunk) => {
      const lines = chunk.split(/\r?\n/);
      const remainder = lines.pop();
      for (const line of lines) {
        processLine(line.trim());
      }
      return remainder;
    };

    let stdoutRemainder = '';
    child.stdout.on('data', (chunk) => {
      stdout = appendOutput(stdout, chunk);
      stdoutRemainder = consumeLines(`${stdoutRemainder}${chunk.toString('utf8')}`);
    });

    child.stderr.on('data', (chunk) => {
      stderr = appendOutput(stderr, chunk);
    });

    child.once('error', (error) => {
      processError('The PowerShell sharing process could not be started.', error);
    });
    child.stdin.once('error', (error) => {
      terminateChild(child);
      processError('The PowerShell Send To helper could not receive its script.', error);
    });

    child.once('close', (code, signal) => {
      if (ready && (code === 0 || code === 2)) {
        finish(undefined, code === 0);
        return;
      }

      const details = stderr.trim() || stdout.trim();
      const suffix = details ? `: ${details}` : '';
      processError(
        `The PowerShell sharing process exited before the share UI became ready (code ${code ?? 'unknown'}, signal ${signal ?? 'none'})${suffix}`,
      );
    });

    onWindowClosed = () => {
      terminateChild(child);
      finish(undefined, false);
    };
    if (typeof target.once === 'function') {
      target.once('closed', onWindowClosed);
    }

    startTimer = setTimeout(() => {
      const error = makeShareError(
        'ERR_SHARE_TIMEOUT',
        'Windows sharing did not open within 30 seconds.',
      );
      terminateChild(child);
      finish(error);
    }, SHARE_START_TIMEOUT_MS);

    processTimer = setTimeout(() => {
      terminateChild(child);
      if (!ready) {
        finish(makeShareError('ERR_SHARE_TIMEOUT', 'Windows sharing timed out before completion.'));
      } else {
        finish(undefined, false);
      }
    }, SHARE_PROCESS_TIMEOUT_MS);
  });

  activeShares.set(target, {
    child,
    cancel: cancelShare,
  });

  child.stdin.end(POWERSHELL_SCRIPT);

  return promise;
}

/**
 * Shows Explorer's native Send To submenu for the file.
 * The Shell populates recipients and invokes the selected command. Returns true
 * when the command is invoked and false on cancellation or an unsupported platform.
 */
export async function shareWindowsFile(target, filePath) {
  if (process.platform !== 'win32') {
    return false;
  }

  const hwndText = getWindowHandle(target);
  const windowsPath = await getSharePath(filePath);
  cancelActiveShare(target);
  return startShare(target, windowsPath, hwndText);
}
