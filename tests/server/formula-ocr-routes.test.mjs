import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import { registerFormulaOcrRoutes } from '../../server/http/formula-ocr-routes.mjs';

test('formula routes require explicit download and accept only image requests', async () => {
  const calls = [];
  const gpuRequests = [];
  const app = express();
  registerFormulaOcrRoutes(app, {
    service: {
      status: async () => ({ ready: calls.includes('download') }),
      download: async () => {
        calls.push('download');
      },
      recognize: async (buffer, options) => {
        calls.push(buffer.toString());
        gpuRequests.push(options.preferGpu);
        return '  x^2  ';
      },
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/formula-ocr`;
  try {
    assert.deepEqual(await (await fetch(url + '/status')).json(), { ready: false });
    assert.deepEqual(calls, []);
    assert.equal(
      (
        await fetch(url + '/recognize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
      ).status,
      400,
    );
    assert.deepEqual(await (await fetch(url + '/download', { method: 'POST' })).json(), {
      ready: true,
    });
    assert.deepEqual(
      await (
        await fetch(url + '/recognize', {
          method: 'POST',
          headers: { 'Content-Type': 'image/png' },
          body: 'png',
        })
      ).json(),
      { latex: 'x^2' },
    );
    assert.deepEqual(calls, ['download', 'png']);
    for (const value of ['true', 'false', '1']) {
      await fetch(url + '/recognize?prefer_gpu=' + value, {
        method: 'POST',
        headers: { 'Content-Type': 'image/png' },
        body: 'png',
      });
    }
    assert.deepEqual(gpuRequests, [false, true, false, false]);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});
