import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, lstat, rename, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { applicationPath } from '../../runtime/node/application-paths.mjs';

export const FORMULA_OCR_MODEL_ID = 'breezedeus/pix2text-mfr-1.5';
export const FORMULA_OCR_MODEL_LICENSE = 'MIT';
export const FORMULA_OCR_MODEL_REVISION = '1cef9f0bdcd6a4c63df7de1311fb0894593340cc';
export const FORMULA_OCR_MODEL_URL = `https://huggingface.co/${FORMULA_OCR_MODEL_ID}/resolve/${FORMULA_OCR_MODEL_REVISION}`;

// The two ONNX files expose their Xet SHA-256 identifiers as the linked ETag.
// The small Git LFS files expose the usual Git blob SHA-1 ETag.
export const FORMULA_OCR_FILES = Object.freeze([
  {
    name: 'encoder_model.onnx',
    bytes: 87_510_770,
    hash: 'sha256',
    digest: '080a3f660f08bc9ebcacdd96e34be6b6400f8c7e62d7cd0dd8251badc37f610b',
  },
  {
    name: 'decoder_model.onnx',
    bytes: 32_026_253,
    hash: 'sha256',
    digest: '917deb98e91a0453c5f234f58a0f32f9fb037de8527c7eb4ed394daf9e692f2a',
  },
  {
    name: 'config.json',
    bytes: 1_573,
    hash: 'sha1',
    gitBlob: true,
    digest: 'a8867e7f8034faf8478c1c1a446a7cda53deef76',
  },
  {
    name: 'generation_config.json',
    bytes: 211,
    hash: 'sha1',
    gitBlob: true,
    digest: 'e0ced48cc2d1373fd18b3a7d2f06a45e204226a0',
  },
  {
    name: 'preprocessor_config.json',
    bytes: 450,
    hash: 'sha1',
    gitBlob: true,
    digest: 'c2bbec3a0dbefdd3ecce8a82458664790ce39b20',
  },
  {
    name: 'special_tokens_map.json',
    bytes: 964,
    hash: 'sha1',
    gitBlob: true,
    digest: 'b1879d702821e753ffe4245048eee415d54a9385',
  },
  {
    name: 'tokenizer.json',
    bytes: 113_168,
    hash: 'sha1',
    gitBlob: true,
    digest: '4b06b3486959247b09dd6f7ac33347cf0f83ca72',
  },
  {
    name: 'tokenizer_config.json',
    bytes: 1_244,
    hash: 'sha1',
    gitBlob: true,
    digest: 'a4702175de221f580ba1f1e3982cb4b4618f4e45',
  },
]);

export const FORMULA_OCR_TOTAL_BYTES = FORMULA_OCR_FILES.reduce(
  (total, file) => total + file.bytes,
  0,
);

const MODEL_DIRECTORY_NAME = 'pix2text-mfr-1.5';
const MAX_CHILD_OUTPUT_BYTES = 2 * 1024 * 1024;
const RECOGNITION_TIMEOUT_MS = 120_000;

function serviceError(message, code) {
  const error = Error(message);
  error.code = code;
  return error;
}

function abortError() {
  const error = Error('Formula OCR recognition was aborted.');
  error.name = 'AbortError';
  error.code = 'ABORT_ERR';
  return error;
}

function cloneError(error) {
  if (!error) return null;
  return {
    code: error.code || 'FORMULA_OCR_ERROR',
    message: error.message || String(error),
  };
}

function responseUrl(file) {
  return `${FORMULA_OCR_MODEL_URL}/${encodeURIComponent(file.name)}`;
}

async function fileIsComplete(path, expectedBytes) {
  try {
    const info = await lstat(path);
    return info.isFile() && info.size === expectedBytes;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

async function inspectModel(modelDir) {
  let completeFiles = 0;
  let downloadedBytes = 0;
  for (const file of FORMULA_OCR_FILES) {
    if (await fileIsComplete(join(modelDir, file.name), file.bytes)) {
      completeFiles++;
      downloadedBytes += file.bytes;
    }
  }
  return {
    completeFiles,
    downloadedBytes,
    ready: completeFiles === FORMULA_OCR_FILES.length,
  };
}

async function safeRemove(path) {
  try {
    const info = await lstat(path);
    if (info.isSymbolicLink() || info.isFile()) await unlink(path);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

async function writeDownloadedFile({ file, modelDir, fetchImpl, onProgress, baseBytes }) {
  const target = join(modelDir, file.name);
  const temporary = join(modelDir, `.${file.name}.${process.pid}.${randomUUID()}.part`);
  let handle;
  let receivedBytes = 0;
  const digest = createHash(file.hash);
  if (file.gitBlob) digest.update(`blob ${file.bytes}\0`);
  try {
    const response = await fetchImpl(responseUrl(file), { redirect: 'follow' });
    if (!response?.ok) {
      throw serviceError(
        `Pix2Text model download failed for ${file.name}: HTTP ${response?.status ?? 'unknown'}.`,
        'MODEL_DOWNLOAD_FAILED',
      );
    }
    const advertisedHeader = response.headers?.get?.('content-length');
    const advertisedLength =
      advertisedHeader == null || advertisedHeader === '' ? null : Number(advertisedHeader);
    if (
      advertisedLength !== null &&
      Number.isFinite(advertisedLength) &&
      advertisedLength !== file.bytes
    ) {
      throw serviceError(
        `Pix2Text model download size for ${file.name} was advertised as ${advertisedLength} bytes; expected ${file.bytes}.`,
        'MODEL_DOWNLOAD_FAILED',
      );
    }
    if (!response.body || typeof response.body[Symbol.asyncIterator] !== 'function') {
      throw serviceError(
        `Pix2Text model download for ${file.name} returned no body.`,
        'MODEL_DOWNLOAD_FAILED',
      );
    }
    handle = await open(temporary, 'wx', 0o600);
    for await (const chunk of response.body) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      receivedBytes += bytes.length;
      if (receivedBytes > file.bytes) {
        throw serviceError(
          `Pix2Text model download for ${file.name} exceeded the expected size.`,
          'MODEL_DOWNLOAD_FAILED',
        );
      }
      digest.update(bytes);
      await handle.write(bytes);
      onProgress(baseBytes + receivedBytes, receivedBytes, file);
    }
    if (receivedBytes !== file.bytes) {
      throw serviceError(
        `Pix2Text model download for ${file.name} was truncated at ${receivedBytes} of ${file.bytes} bytes.`,
        'MODEL_DOWNLOAD_FAILED',
      );
    }
    if (digest.digest('hex') !== file.digest) {
      throw serviceError(
        `Pix2Text model digest did not match for ${file.name}.`,
        'MODEL_DOWNLOAD_FAILED',
      );
    }
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporary, target);
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await safeRemove(temporary).catch(() => {});
    throw error;
  }
}

function childEnvironment() {
  const environment = { ...process.env };
  if (process.versions?.electron) environment.ELECTRON_RUN_AS_NODE = '1';
  return environment;
}

function appendOutput(current, chunk) {
  if (current.length >= MAX_CHILD_OUTPUT_BYTES) return current;
  const remaining = MAX_CHILD_OUTPUT_BYTES - current.length;
  return current + String(chunk).slice(0, remaining);
}

function killChild(child) {
  if (!child || child.exitCode != null || child.signalCode != null) return;
  try {
    child.kill('SIGTERM');
  } catch {}
  setTimeout(() => {
    if (child.exitCode == null && child.signalCode == null) {
      try {
        child.kill('SIGKILL');
      } catch {}
    }
  }, 500).unref?.();
}

function recognizeInChild({
  spawnImpl,
  execPath,
  workerPath,
  modelDir,
  imageBuffer,
  signal,
  activeChildren,
}) {
  return new Promise((resolveResult, rejectResult) => {
    if (signal?.aborted) {
      rejectResult(abortError());
      return;
    }
    let child;
    try {
      child = spawnImpl(execPath, [workerPath], {
        cwd: modelDir,
        env: childEnvironment(),
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch (error) {
      rejectResult(error);
      return;
    }
    activeChildren.add(child);
    let stdout = '';
    let stderr = '';
    let settled = false;
    let spawnError = null;
    let abortRequested = false;
    let timeoutRequested = false;
    let timeoutHandle;
    const onAbort = () => {
      abortRequested = true;
      killChild(child);
    };
    signal?.addEventListener?.('abort', onAbort, { once: true });
    child.stdout?.on('data', (chunk) => {
      stdout = appendOutput(stdout, chunk);
    });
    child.stderr?.on('data', (chunk) => {
      stderr = appendOutput(stderr, chunk);
    });
    child.stdin?.on?.('error', (error) => {
      spawnError ||= error;
      killChild(child);
    });
    child.once?.('error', (error) => {
      spawnError = error;
      killChild(child);
    });
    timeoutHandle = setTimeout(() => {
      timeoutRequested = true;
      killChild(child);
    }, RECOGNITION_TIMEOUT_MS);
    timeoutHandle.unref?.();
    child.once?.('close', (code, exitSignal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutHandle);
      activeChildren.delete(child);
      signal?.removeEventListener?.('abort', onAbort);
      if (abortRequested) {
        rejectResult(abortError());
        return;
      }
      if (timeoutRequested) {
        rejectResult(
          serviceError(
            `Formula OCR worker exceeded the ${RECOGNITION_TIMEOUT_MS / 1000} second timeout.`,
            'FORMULA_OCR_TIMEOUT',
          ),
        );
        return;
      }
      if (spawnError) {
        rejectResult(spawnError);
        return;
      }
      const text = stdout.trim();
      if (code === 0) {
        try {
          const result = JSON.parse(text);
          if (!result || typeof result.latex !== 'string')
            throw serviceError(
              'Formula OCR worker returned an invalid result.',
              'FORMULA_OCR_FAILED',
            );
          resolveResult({ latex: result.latex });
        } catch (error) {
          rejectResult(error);
        }
        return;
      }
      const diagnostic = stderr.trim().slice(-1200);
      const suffix = diagnostic ? ` ${diagnostic}` : '';
      rejectResult(
        serviceError(
          `Formula OCR worker exited with ${exitSignal ? `signal ${exitSignal}` : `code ${code ?? 'unknown'}`}.${suffix}`,
          'FORMULA_OCR_FAILED',
        ),
      );
    });
    try {
      child.stdin.end(
        JSON.stringify({ modelDir, imageBase64: Buffer.from(imageBuffer).toString('base64') }) +
          '\n',
      );
    } catch (error) {
      killChild(child);
      spawnError = error;
    }
  });
}

export function createFormulaOcrService({
  cacheDir,
  fetchImpl = globalThis.fetch,
  spawnImpl = spawn,
  processExecPath = process.execPath,
  workerPath = applicationPath('server', 'formula', 'formula-ocr-worker.mjs'),
} = {}) {
  if (typeof cacheDir !== 'string' || !cacheDir.trim())
    throw serviceError('A formula OCR cache directory is required.', 'INVALID_CACHE_DIR');
  if (typeof fetchImpl !== 'function')
    throw serviceError('Formula OCR downloads require fetch support.', 'DOWNLOAD_UNAVAILABLE');
  const modelDir = join(resolve(cacheDir), 'formula', MODEL_DIRECTORY_NAME);
  const activeChildren = new Set();
  let downloadPromise = null;
  let downloadAbortController = null;
  let disposed = false;
  let disposePromise = null;
  let lastError = null;
  let activeRecognition = false;
  let progress = {
    downloadedBytes: 0,
    totalBytes: FORMULA_OCR_TOTAL_BYTES,
    currentFile: null,
    currentFileBytes: 0,
    currentFileTotalBytes: 0,
    filesCompleted: 0,
    filesTotal: FORMULA_OCR_FILES.length,
  };

  const ensureOpen = () => {
    if (disposed) throw serviceError('Formula OCR service is disposed.', 'SERVICE_DISPOSED');
  };

  async function status() {
    const inspected = await inspectModel(modelDir);
    const downloading =
      downloadPromise !== null && progress.downloadedBytes < FORMULA_OCR_TOTAL_BYTES;
    const ready = !disposed && inspected.ready;
    const activePids = [...activeChildren]
      .map((child) => child?.pid)
      .filter((pid) => Number.isInteger(pid) && pid > 0);
    return {
      modelId: FORMULA_OCR_MODEL_ID,
      license: FORMULA_OCR_MODEL_LICENSE,
      modelDir,
      ready,
      downloaded: inspected.ready,
      downloading,
      downloadedBytes: downloading ? progress.downloadedBytes : inspected.downloadedBytes,
      totalBytes: FORMULA_OCR_TOTAL_BYTES,
      filesCompleted: downloading ? progress.filesCompleted : inspected.completeFiles,
      filesTotal: FORMULA_OCR_FILES.length,
      currentFile: downloading ? progress.currentFile : null,
      currentFileBytes: downloading ? progress.currentFileBytes : 0,
      currentFileTotalBytes: downloading ? progress.currentFileTotalBytes : 0,
      activePid: activePids[0] || null,
      activePids,
      busy: activeRecognition,
      error: cloneError(lastError),
      state: disposed
        ? 'disposed'
        : downloading
          ? 'downloading'
          : ready
            ? 'ready'
            : lastError
              ? 'error'
              : 'not-downloaded',
    };
  }

  async function download() {
    ensureOpen();
    if (downloadPromise) {
      await downloadPromise;
      return await status();
    }
    downloadPromise = (async () => {
      lastError = null;
      await mkdir(modelDir, { recursive: true });
      const inspected = await inspectModel(modelDir);
      let baseBytes = inspected.downloadedBytes;
      let filesCompleted = inspected.completeFiles;
      progress = {
        downloadedBytes: baseBytes,
        totalBytes: FORMULA_OCR_TOTAL_BYTES,
        currentFile: null,
        currentFileBytes: 0,
        currentFileTotalBytes: 0,
        filesCompleted,
        filesTotal: FORMULA_OCR_FILES.length,
      };
      downloadAbortController = new AbortController();
      try {
        for (const file of FORMULA_OCR_FILES) {
          ensureOpen();
          if (await fileIsComplete(join(modelDir, file.name), file.bytes)) continue;
          progress.currentFile = file.name;
          progress.currentFileBytes = 0;
          progress.currentFileTotalBytes = file.bytes;
          await writeDownloadedFile({
            file,
            modelDir,
            fetchImpl: async (url, options = {}) =>
              fetchImpl(url, { ...options, signal: downloadAbortController.signal }),
            baseBytes,
            onProgress(downloadedBytes, currentFileBytes) {
              progress.downloadedBytes = downloadedBytes;
              progress.currentFileBytes = currentFileBytes;
            },
          });
          baseBytes += file.bytes;
          filesCompleted++;
          progress.downloadedBytes = baseBytes;
          progress.filesCompleted = filesCompleted;
          progress.currentFile = null;
          progress.currentFileBytes = 0;
          progress.currentFileTotalBytes = 0;
        }
        progress.downloadedBytes = FORMULA_OCR_TOTAL_BYTES;
        progress.filesCompleted = FORMULA_OCR_FILES.length;
        return true;
      } catch (error) {
        lastError = error;
        throw error;
      } finally {
        downloadAbortController = null;
      }
    })();
    try {
      await downloadPromise;
    } finally {
      downloadPromise = null;
    }
    return await status();
  }

  async function recognize(imageBuffer, { signal } = {}) {
    ensureOpen();
    if (activeRecognition)
      throw serviceError(
        'Formula OCR is busy with another recognition. Wait for it to finish or abort it first.',
        'FORMULA_OCR_BUSY',
      );
    if (
      !(Buffer.isBuffer(imageBuffer) || imageBuffer instanceof Uint8Array) ||
      imageBuffer.length === 0
    )
      throw serviceError('Formula OCR requires a non-empty PNG image buffer.', 'INVALID_IMAGE');
    activeRecognition = true;
    try {
      if (signal?.aborted) throw abortError();
      const inspected = await inspectModel(modelDir);
      ensureOpen();
      if (signal?.aborted) throw abortError();
      if (!inspected.ready)
        throw serviceError(
          'Pix2Text MFR 1.5 is not downloaded. Call download() explicitly first.',
          'MODEL_NOT_DOWNLOADED',
        );
      return await recognizeInChild({
        spawnImpl,
        execPath: processExecPath,
        workerPath,
        modelDir,
        imageBuffer,
        signal,
        activeChildren,
      });
    } finally {
      activeRecognition = false;
    }
  }

  async function dispose() {
    if (disposePromise) return disposePromise;
    disposed = true;
    downloadAbortController?.abort();
    disposePromise = (async () => {
      for (const child of activeChildren) killChild(child);
      while (activeChildren.size) await new Promise((resolveWait) => setTimeout(resolveWait, 25));
    })();
    return disposePromise;
  }

  return Object.freeze({ status, download, recognize, dispose });
}
