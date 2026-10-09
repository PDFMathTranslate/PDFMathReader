import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { registerKernelRoutes } from '../../../server/http/kernel-routes.mjs';
import { createTranslationRuntime } from '../../../server/translation/provider-runtime.mjs';

test('math cache-only route passes lookup mode without discovering native services or running work', async (t) => {
  const app = express();
  const selection = { id: 'openai', values: { model: 'test' } };
  let lookups = 0;
  const engines = {
    services: async () => {
      throw Error('Service discovery must not run');
    },
    translate: async (options) => {
      assert.equal(options.cacheOnly, true);
      assert.deepEqual(options.cacheSelection, selection);
      assert.deepEqual(options.translationService, selection);
      lookups++;
      return null;
    },
  };
  const providerRuntime = createTranslationRuntime({ engines, sessionId: 'test' });
  registerKernelRoutes(app, {
    engines,
    providerRuntime,
    cacheManager: { runTask: (_label, task) => task() },
    documentRequest: () => ({ bytes: Buffer.from('%PDF-test') }),
    documentCache: { scope: async () => '' },
    limiter: { setMax() {} },
    pageLimiter: { setMax() {} },
    proxyJobs: new Map(),
    origin: () => 'http://localhost',
    kernelReports: [],
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/math-page?engine=pdf_math_fast&page=1&language=English`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cacheOnly: true, translationService: selection }),
    },
  );
  assert.equal(response.status, 204);
  assert.equal(lookups, 1);
});
