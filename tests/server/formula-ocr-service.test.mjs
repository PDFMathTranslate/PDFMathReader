import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdtemp, mkdir, open, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createFormulaOcrService,
  FORMULA_OCR_FILES,
} from '../../server/formula/formula-ocr-service.mjs';

async function fixture(t, options = {}, ready = false) {
  const cacheDir = await mkdtemp(join(tmpdir(), 'formula-ocr-test-'));
  const service = createFormulaOcrService({ cacheDir, ...options });
  t.after(async () => {
    await service.dispose();
    await rm(cacheDir, { recursive: true, force: true });
  });
  const { modelDir } = await service.status();
  if (ready) {
    await mkdir(modelDir, { recursive: true });
    for (const file of FORMULA_OCR_FILES) {
      const handle = await open(join(modelDir, file.name), 'w');
      await handle.truncate(file.bytes);
      await handle.close();
    }
  }
  return service;
}
class Child extends EventEmitter {
  constructor() {
    super();
    this.pid = 98765;
    this.stdin = new PassThrough();
    this.stdout = new PassThrough();
    this.stderr = new PassThrough();
    this.exitCode = null;
    this.signalCode = null;
  }
  kill(signal) {
    this.signalCode = signal;
    queueMicrotask(() => this.emit('close', null, signal));
  }
  finish() {
    this.stdout.write(JSON.stringify({ latex: 'x^2' }));
    this.exitCode = 0;
    this.emit('close', 0, null);
  }
}
async function started(service) {
  for (let n = 0; n < 50; n++) {
    if ((await service.status()).activePids.length) return;
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw Error('Worker did not start');
}

test('status and recognition never download models; an explicit failed download is retryable', async (t) => {
  let downloads = 0;
  const service = await fixture(t, {
    fetchImpl: async () => {
      downloads++;
      return new Response('', { status: 503 });
    },
  });
  assert.equal((await service.status()).ready, false);
  await assert.rejects(service.recognize(Buffer.from('png')), { code: 'MODEL_NOT_DOWNLOADED' });
  assert.equal(downloads, 0);
  await assert.rejects(service.download(), { code: 'MODEL_DOWNLOAD_FAILED' });
  await assert.rejects(service.download(), { code: 'MODEL_DOWNLOAD_FAILED' });
  assert.equal(downloads, 2);
  const status = await service.status();
  assert.equal(status.downloading, false);
  assert.deepEqual(await readdir(status.modelDir), []);
});
test('recognition resolves only after the worker closes and excludes overlapping workers', async (t) => {
  const child = new Child();
  const service = await fixture(t, { spawnImpl: () => child }, true);
  const recognition = service.recognize(Buffer.from('png'));
  let resolved = false;
  recognition.then(() => {
    resolved = true;
  });
  await started(service);
  assert.equal(resolved, false);
  await assert.rejects(service.recognize(Buffer.from('png')), { code: 'FORMULA_OCR_BUSY' });
  child.finish();
  assert.deepEqual(await recognition, { latex: 'x^2' });
  assert.deepEqual((await service.status()).activePids, []);
});
test('aborting recognition terminates the worker before rejection', async (t) => {
  const child = new Child();
  const service = await fixture(t, { spawnImpl: () => child }, true);
  const controller = new AbortController();
  const recognition = service.recognize(Buffer.from('png'), { signal: controller.signal });
  const rejected = assert.rejects(recognition, { name: 'AbortError' });
  await started(service);
  controller.abort();
  await rejected;
  assert.equal(child.signalCode, 'SIGTERM');
  assert.deepEqual((await service.status()).activePids, []);
});
