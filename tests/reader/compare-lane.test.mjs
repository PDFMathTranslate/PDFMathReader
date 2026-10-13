import assert from 'node:assert/strict';
import test from 'node:test';
import { createCompareLane } from '../../src/features/translation/compare/compare-lane.mjs';

function response(status, body = {}, headers = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => headers[name] ?? null },
    json: async () => body,
    arrayBuffer: async () => new ArrayBuffer(4),
  };
}

function deferred() {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function laneWith(kernel, fetcher, overrides = {}) {
  return createCompareLane({
    config: {
      kernel,
      service: { id: kernel + '-service', values: {} },
      language: 'Simplified Chinese',
      sourceLanguage: 'English',
    },
    documentId: 'doc',
    getDocument: () => ({ promise: Promise.resolve({ loadingTask: { destroy() {} } }) }),
    layoutFor: async (number) => [
      { id: number * 10 + 1, x: 0, y: 0, width: 10, height: 10, text: `p${number}a` },
      { id: number * 10 + 2, x: 0, y: 20, width: 10, height: 10, text: `p${number}b` },
    ],
    limits: { pages: () => 1, paragraphs: () => 2, pageCount: () => 10 },
    fetcher,
    progressInterval: 5,
    ...overrides,
  });
}

test('math lane asks the cache first, then requests a full translation', async () => {
  const calls = [];
  const lane = laneWith('pdf_math_fast', async (url, options) => {
    if (url.startsWith('/api/math-progress/')) return response(204);
    const body = JSON.parse(options.body);
    calls.push(body.cacheOnly);
    return body.cacheOnly ? response(204) : response(200, {}, { 'X-Translation-Model': 'm1' });
  });
  lane.want([3], 3);
  lane.want([3], 3);
  for (let i = 0; i < 20 && lane.pages[3]?.status !== 'ready'; i++) await flush();
  assert.equal(lane.pages[3].status, 'ready');
  assert.equal(lane.pages[3].model, 'm1');
  assert.ok(lane.pages[3].document);
  assert.deepEqual(calls.slice(0, 2), [true, false]);
  lane.dispose();
});

test('paragraph lane translates each paragraph through the cache-first route', async () => {
  const seen = [];
  const lane = laneWith('pdf_inspector', async (url, options) => {
    const body = JSON.parse(options.body);
    seen.push([body.text, body.cacheOnly, body.translationService.id]);
    if (body.cacheOnly && body.text.endsWith('a')) return response(204);
    return response(200, { translation: 'done-' + body.text, cached: body.cacheOnly });
  });
  lane.want([1, 2, 3, 4, 5], 1);
  for (let i = 0; i < 40 && lane.pages[1]?.status !== 'ready'; i++) await flush();
  const page = lane.pages[1];
  assert.equal(page.status, 'ready');
  assert.deepEqual(
    page.blocks.map((block) => block.translation),
    ['done-p1a', 'done-p1b'],
  );
  assert.ok(seen.some(([text, cacheOnly]) => text === 'p1a' && cacheOnly === false));
  assert.ok(!seen.some(([text, cacheOnly]) => text === 'p1b' && cacheOnly === false));
  assert.ok(seen.every(([, , service]) => service === 'pdf_inspector-service'));
  lane.dispose();
});

test('lane respects page and paragraph concurrency limits', async () => {
  const gates = [];
  let active = 0,
    peak = 0;
  const lane = laneWith(
    'pdf_inspector',
    async () => {
      active++;
      peak = Math.max(peak, active);
      const gate = deferred();
      gates.push(gate);
      await gate.promise;
      active--;
      return response(200, { translation: 'x' });
    },
    { limits: { pages: () => 1, paragraphs: () => 3, pageCount: () => 10 } },
  );
  lane.want([1, 2, 3, 4, 5, 6], 1);
  for (let round = 0; round < 60; round++) {
    await flush();
    gates.splice(0).forEach((gate) => gate.resolve());
  }
  assert.ok(peak <= 3, `peak ${peak}`);
  assert.ok(peak >= 2, `paragraphs ran in parallel (peak ${peak})`);
  assert.equal(lane.pending, 0);
  lane.dispose();
});

test('scrolling away drops queued pages that are no longer near the view', async () => {
  const hold = deferred();
  const lane = laneWith('pdf_math_fast', async (url) => {
    if (url.startsWith('/api/math-progress/')) return response(204);
    await hold.promise;
    return response(200);
  });
  lane.want([1, 2, 3], 1);
  await flush();
  assert.equal(lane.pages[1].status, 'working');
  assert.equal(lane.pages[3].status, 'queued');
  lane.want([8], 8);
  assert.equal(lane.pages[3].status, 'idle');
  assert.equal(lane.pages[2].status, 'idle');
  assert.equal(lane.pages[8].status, 'queued');
  assert.equal(lane.pages[1].status, 'working', 'running work finishes');
  lane.dispose();
  hold.resolve();
});

test('dispose aborts requests and ignores late responses', async () => {
  const hold = deferred();
  let signal;
  const lane = laneWith('pdf_math_fast', async (url, options) => {
    if (url.startsWith('/api/math-progress/')) return response(204);
    signal = options.signal;
    await hold.promise;
    return response(200);
  });
  lane.want([1], 1);
  await flush();
  lane.dispose();
  assert.equal(signal.aborted, true);
  hold.resolve();
  await flush();
  await flush();
  assert.equal(lane.pages[1].status, 'working');
  assert.equal(lane.pages[1].document, null);
  assert.equal(lane.disposed, true);
  assert.equal(lane.pending, 0);
});

test('two lanes progress independently of each other', async () => {
  const slow = deferred();
  const left = laneWith('pdf_math_fast', async (url) => {
    if (url.startsWith('/api/math-progress/')) return response(204);
    await slow.promise;
    return response(200);
  });
  const right = laneWith('pdf_inspector', async () => response(200, { translation: 'ok' }));
  left.want([1], 1);
  right.want([1], 1);
  for (let i = 0; i < 40 && right.pages[1]?.status !== 'ready'; i++) await flush();
  assert.equal(right.pages[1].status, 'ready');
  assert.equal(left.pages[1].status, 'working');
  slow.resolve();
  for (let i = 0; i < 20 && left.pages[1]?.status !== 'ready'; i++) await flush();
  assert.equal(left.pages[1].status, 'ready');
  left.dispose();
  right.dispose();
});

test('retry requeues a failed page', async () => {
  let fail = true;
  const lane = laneWith('pdf_math_fast', async (url, options) => {
    if (url.startsWith('/api/math-progress/')) return response(204);
    if (fail) return response(500, { error: 'boom' });
    return JSON.parse(options.body).cacheOnly ? response(204) : response(200);
  });
  lane.want([1], 1);
  for (let i = 0; i < 20 && lane.pages[1]?.status !== 'error'; i++) await flush();
  assert.equal(lane.pages[1].status, 'error');
  assert.equal(lane.pages[1].message, 'boom');
  fail = false;
  lane.retry(1);
  for (let i = 0; i < 20 && lane.pages[1]?.status !== 'ready'; i++) await flush();
  assert.equal(lane.pages[1].status, 'ready');
  lane.dispose();
});
