import test from 'node:test';
import assert from 'node:assert/strict';
import { registerKernelRoutes } from '../../../server/http/kernel-routes.mjs';

test('progress endpoint isolates active translation requests and never caches status', () => {
  const routes = new Map();
  const progress = { stage: 'Translate paragraphs', completed: 3, total: 4, percent: 75 };
  const jobs = new Map([['token', { progressId: 'request-a', progress }]]);
  registerKernelRoutes(
    { get: (path, fn) => routes.set(path, fn), post() {} },
    {
      providerRuntime: {},
      proxyJobs: jobs,
    },
  );
  const route = routes.get('/api/math-progress/:id');
  let status, body, cache;
  const res = {
    setHeader: (_key, value) => {
      cache = value;
    },
    sendStatus: (value) => {
      status = value;
    },
    json: (value) => {
      body = value;
    },
  };
  route({ params: { id: 'request-a' } }, res);
  assert.deepEqual(body, progress);
  assert.equal(cache, 'no-store');
  body = null;
  route({ params: { id: 'other-request' } }, res);
  assert.equal(status, 204);
  assert.equal(body, null);
  jobs.clear();
  route({ params: { id: 'request-a' } }, res);
  assert.equal(status, 204);
});
