import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerKernelRoutes } from '../../../server/http/kernel-routes.mjs';
import { registerProxyRoutes } from '../../../server/http/proxy-routes.mjs';
import { createTranslationRuntime } from '../../../server/translation/provider-runtime.mjs';

function registerProxy(app, jobs, classifyParagraphContinuation) {
  registerProxyRoutes(app, {
    limiter: { run: (task) => task() },
    proxyJobs: jobs,
    localTranslator: {},
    providerClient: {},
    classifyParagraphContinuation,
  });
}

function capturePostRoutes() {
  const routes = new Map();
  return {
    app: {
      post(path, ...handlers) {
        routes.set(path, handlers.at(-1));
      },
    },
    routes,
  };
}

function response() {
  const result = { statusCode: 200, body: undefined };
  return Object.assign(result, {
    destroyed: false,
    writableEnded: false,
    setHeader() {
      return result;
    },
    on() {
      return result;
    },
    status(code) {
      result.statusCode = code;
      return result;
    },
    json(body) {
      result.body = body;
      return result;
    },
    sendStatus(code) {
      result.statusCode = code;
      return result;
    },
    type() {
      return result;
    },
    send(body) {
      result.body = body;
      return result;
    },
  });
}

test('paragraph continuation proxy authenticates the active job and keeps its Jev token server-side', async () => {
  const { app, routes } = capturePostRoutes();
  const controller = new AbortController();
  const jobs = new Map([
    [
      'ephemeral-proxy-token',
      {
        controller,
        kernel: 'pdf_math_fast',
        paragraphContinuationEnabled: true,
        paragraphContinuationToken: 'actual-jev-token',
      },
    ],
  ]);
  let classification;
  registerProxy(app, jobs, async (input) => {
    classification = input;
    return { combine: true, status: 'classified' };
  });
  const result = response();
  await routes.get('/kernel-proxy/v1/paragraph-continuation')(
    {
      headers: { authorization: 'Bearer ephemeral-proxy-token' },
      body: {
        before: 'first fragment',
        after: 'second fragment',
        layout: { sameColumn: true, gapInEm: 0.25, afterIndentInEm: 0 },
        token: 'attacker',
      },
    },
    result,
  );

  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, { combine: true, status: 'classified' });
  assert.deepEqual(classification, {
    before: 'first fragment',
    after: 'second fragment',
    layout: { sameColumn: true, gapInEm: 0.25, afterIndentInEm: 0 },
    token: 'actual-jev-token',
  });
  assert.equal(controller.signal.aborted, false);
});

test('paragraph continuation proxy falls back without aborting the translation job', async () => {
  const { app, routes } = capturePostRoutes();
  const controller = new AbortController();
  const job = {
    controller,
    kernel: 'pdf_math_fast',
    paragraphContinuationEnabled: true,
    paragraphContinuationToken: 'actual-jev-token',
    error: '',
  };
  const jobs = new Map([['proxy-token', job]]);
  registerProxy(app, jobs, async () => {
    throw Error('classifier unavailable');
  });
  const result = response();
  await routes.get('/kernel-proxy/v1/paragraph-continuation')(
    {
      headers: { authorization: 'Bearer proxy-token' },
      body: { before: 'first fragment', after: 'second fragment' },
    },
    result,
  );

  assert.equal(result.statusCode, 200);
  assert.deepEqual(result.body, { combine: false, status: 'fallback' });
  assert.equal(controller.signal.aborted, false);
  assert.equal(job.error, '');
});

test('paragraph continuation proxy rejects missing or disabled job credentials', async () => {
  const { app, routes } = capturePostRoutes();
  const jobs = new Map([
    ['disabled-token', { controller: new AbortController(), paragraphContinuationEnabled: false }],
  ]);
  registerProxy(app, jobs, async () => ({ combine: true, status: 'classified' }));
  const route = routes.get('/kernel-proxy/v1/paragraph-continuation');
  for (const token of ['missing-token', 'disabled-token']) {
    const result = response();
    await route(
      {
        headers: { authorization: `Bearer ${token}` },
        body: { before: 'first fragment', after: 'second fragment' },
      },
      result,
    );
    assert.equal(result.statusCode, 403);
  }
});

function kernelRoute(engines, jobs = new Map()) {
  const routes = new Map();
  const app = {
    get(path, handler) {
      routes.set(`GET ${path}`, handler);
    },
    post(path, ...handlers) {
      routes.set(`POST ${path}`, handlers.at(-1));
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
    pageLimiter: { setMax() {}, run: (task) => task() },
    proxyJobs: jobs,
    origin: () => 'http://localhost',
    kernelReports: [],
  });
  return routes.get('POST /api/math-page');
}

test('math route defaults continuation off and keeps the Jev token out of runner arguments', async () => {
  const jobs = new Map();
  let observed;
  const engines = {
    services: async () => ({ services: [] }),
    translate: async (options) => {
      observed = { options, job: [...jobs.values()][0] };
      return null;
    },
  };
  const route = kernelRoute(engines, jobs);
  const result = response();
  await route(
    {
      query: { engine: 'pdf_math_fast', page: '1', language: 'English' },
      body: {
        jevApiToken: 'actual-jev-token',
        translationService: { id: 'openai', values: { model: 'test' } },
      },
    },
    result,
  );

  assert.equal(result.statusCode, 204);
  assert.equal(observed.options.paragraphContinuationDetection, false);
  assert.equal('jevApiToken' in observed.options, false);
  assert.equal(observed.job.paragraphContinuationEnabled, false);
  assert.equal(observed.job.paragraphContinuationToken, '');
  assert.equal(jobs.size, 0);
});

test('math route forwards enabled Fast continuation only to the active proxy job', async () => {
  const jobs = new Map();
  let observed;
  const engines = {
    services: async () => ({ services: [] }),
    translate: async (options) => {
      observed = { options, job: [...jobs.values()][0] };
      return null;
    },
  };
  const route = kernelRoute(engines, jobs);
  const result = response();
  await route(
    {
      query: { engine: 'pdf_math_fast', page: '1', language: 'English' },
      body: {
        paragraphContinuationDetection: true,
        jevApiToken: 'actual-jev-token',
        translationService: { id: 'openai', values: { model: 'test' } },
      },
    },
    result,
  );

  assert.equal(result.statusCode, 204);
  assert.equal(observed.options.paragraphContinuationDetection, true);
  assert.equal('jevApiToken' in observed.options, false);
  assert.equal(observed.job.paragraphContinuationEnabled, true);
  assert.equal(observed.job.paragraphContinuationToken, 'actual-jev-token');
  assert.equal(jobs.size, 0);
});

test('math route validates continuation preference and bounded Jev token', async () => {
  let calls = 0;
  const engines = {
    services: async () => ({ services: [] }),
    translate: async () => {
      calls++;
      return null;
    },
  };
  const route = kernelRoute(engines);
  const request = async (body) => {
    const result = response();
    await route(
      {
        query: { engine: 'pdf_math_fast', page: '1', language: 'English' },
        body: {
          ...body,
          translationService: { id: 'openai', values: { model: 'test' } },
        },
      },
      result,
    );
    return result;
  };

  assert.equal((await request({ paragraphContinuationDetection: 'true' })).statusCode, 400);
  assert.equal((await request({ jevApiToken: null })).statusCode, 400);
  assert.equal((await request({ jevApiToken: 'x'.repeat(4097) })).statusCode, 400);
  assert.equal(calls, 0);
});
