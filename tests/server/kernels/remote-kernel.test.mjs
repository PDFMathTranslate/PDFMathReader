import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import {
  createRemoteKernel,
  normalizeRemoteKernelUrl,
} from '../../../server/kernels/remote-kernel.mjs';
import { createTranslationRunner } from '../../../server/kernels/translation-runner.mjs';

async function pdf(pages = 2) {
  const document = await PDFDocument.create();
  for (let i = 0; i < pages; i++) document.addPage([200 + i, 300]);
  return Buffer.from(await document.save());
}

// Speaks the zotero-pdf2zh protocol and "translates" by echoing the upload.
async function fakeServer(
  t,
  { health = { status: 'ok', version: '2.4.3' }, fail = false, stall = '', running = [] } = {},
) {
  const files = new Map();
  const history = [];
  const requests = [];
  const server = createServer((req, res) => {
    requests.push(`${req.method} ${req.url}`);
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.url === '/health') return send(200, health);
    if (stall === 'poll' && req.url.startsWith('/api/')) return;
    if (req.url === '/api/tasks') {
      const [progress] = running.splice(0, 1);
      const tasks =
        progress === undefined
          ? []
          : [
              {
                taskId: `task-${history.length}`,
                finished: false,
                status: 'running',
                progress,
                message: 'translate 0/100',
              },
            ];
      return send(200, { status: 'success', tasks });
    }
    if (req.url === '/api/history') return send(200, { status: 'success', history });
    if (req.url.startsWith('/translatedFile/')) {
      const name = decodeURIComponent(req.url.slice('/translatedFile/'.length));
      if (!files.has(name)) return send(404, { status: 'error' });
      res.writeHead(200, { 'Content-Type': 'application/pdf' });
      return res.end(files.get(name));
    }
    if (req.url === '/translate' && req.method === 'POST') {
      if (stall === 'submit') return;
      const chunks = [];
      req.on('data', (chunk) => chunks.push(chunk));
      req.on('end', () => {
        const body = JSON.parse(Buffer.concat(chunks));
        requests.push(body);
        const taskId = `task-${history.length + 1}`;
        if (fail) history.unshift({ taskId, status: 'failed', finished: true, error: 'boom' });
        else {
          const stem = body.fileName.replace(/\.pdf$/, '');
          const mono = `${stem}.no_watermark.zh.mono.pdf`;
          files.set(mono, Buffer.from(body.fileContent, 'base64'));
          history.unshift({
            taskId,
            status: 'success',
            finished: true,
            fileList: [mono],
          });
        }
        send(200, { status: 'accepted', taskId });
      });
      return;
    }
    send(404, {});
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return { url: `http://127.0.0.1:${server.address().port}`, requests };
}

test('remote URL normalization accepts only plain http(s) origins', () => {
  assert.equal(normalizeRemoteKernelUrl(' http://host:8890/ '), 'http://host:8890');
  assert.equal(normalizeRemoteKernelUrl('https://host/base/?x=1#y'), 'https://host/base');
  for (const value of ['', 'ftp://host', 'host:8890', 'http://user:pw@host', null, 7])
    assert.equal(normalizeRemoteKernelUrl(value), '');
});

test('health requires status ok and reports unreachable servers', async (t) => {
  const healthy = await fakeServer(t);
  const odd = await fakeServer(t, { health: { status: 'starting' } });
  const kernel = createRemoteKernel({ healthTimeoutMs: 500 });
  assert.deepEqual(await kernel.health(healthy.url), { ok: true, version: '2.4.3' });
  assert.equal((await kernel.health(odd.url)).ok, false);
  assert.equal((await kernel.health('http://127.0.0.1:1')).ok, false);
  assert.equal((await kernel.health('nonsense')).ok, false);
});

test('health results are cached until forced or marked unhealthy', async (t) => {
  const server = await fakeServer(t);
  const kernel = createRemoteKernel();
  await Promise.all([kernel.health(server.url), kernel.health(server.url)]);
  await kernel.health(server.url);
  assert.equal(server.requests.filter((r) => r === 'GET /health').length, 1);
  await kernel.health(server.url, { force: true });
  assert.equal(server.requests.filter((r) => r === 'GET /health').length, 2);
  kernel.markUnhealthy(server.url);
  assert.equal((await kernel.health(server.url)).ok, false);
});

test('translatePage uploads one page, never sends credentials, and returns one page', async (t) => {
  const server = await fakeServer(t);
  const kernel = createRemoteKernel({ pollIntervalMs: 10 });
  const result = await kernel.translatePage({
    url: server.url,
    bytes: await pdf(3),
    page: 2,
    language: 'zh-CN',
    service: 'siliconflowfree',
  });
  const upload = server.requests.find((r) => typeof r === 'object');
  assert.equal(upload.engine, 'pdf2zh_next');
  assert.equal(upload.targetLang, 'zh-CN');
  assert.equal(upload.noDual, true);
  assert.equal(upload.asyncJob, true);
  assert.equal(upload.next_service, 'siliconflowfree');
  assert.equal('llm_api' in upload, false);
  const uploaded = await PDFDocument.load(Buffer.from(upload.fileContent, 'base64'));
  assert.equal(uploaded.getPageCount(), 1);
  assert.equal(uploaded.getPage(0).getWidth(), 201);
  assert.equal((await PDFDocument.load(result)).getPageCount(), 1);
});

test('translatePage rejects when the remote task fails', async (t) => {
  const server = await fakeServer(t, { fail: true });
  const kernel = createRemoteKernel({ pollIntervalMs: 10 });
  await assert.rejects(
    kernel.translatePage({ url: server.url, bytes: await pdf(1), page: 1, language: 'zh-CN' }),
    /boom/,
  );
});

test('translatePage gives up on a server that never accepts the job', async (t) => {
  const server = await fakeServer(t, { stall: 'submit' });
  const kernel = createRemoteKernel({ submitTimeoutMs: 100 });
  await assert.rejects(
    kernel.translatePage({ url: server.url, bytes: await pdf(1), page: 1, language: 'zh' }),
    /timed out|aborted/i,
  );
});

test('translatePage gives up when the server stops answering status polls', async (t) => {
  const server = await fakeServer(t, { stall: 'poll' });
  const kernel = createRemoteKernel({ pollIntervalMs: 5, pollTimeoutMs: 50 });
  await assert.rejects(
    kernel.translatePage({ url: server.url, bytes: await pdf(1), page: 1, language: 'zh' }),
    /stopped responding/,
  );
});

test('translatePage stops polling when cancelled', async (t) => {
  const server = await fakeServer(t);
  server.requests.length = 0;
  const controller = new AbortController();
  controller.abort();
  const kernel = createRemoteKernel();
  await assert.rejects(
    kernel.translatePage({
      url: server.url,
      bytes: await pdf(1),
      page: 1,
      language: 'zh-CN',
      signal: controller.signal,
    }),
    /Cancelled/,
  );
  assert.equal(server.requests.length, 0);
});

class Child extends EventEmitter {
  constructor() {
    super();
    this.pid = 1;
    this.stderr = new PassThrough();
    this.stdout = new PassThrough();
  }
}

async function runnerFixture(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'remote-kernel-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const spawned = [];
  const diagnostics = [];
  const runner = createTranslationRunner({
    root,
    baseCacheDir: join(root, 'cache'),
    processes: {
      spawn: (...args) => {
        spawned.push(args);
        const child = new Child();
        queueMicrotask(() => child.emit('close', 1, null));
        return child;
      },
      terminate: async () => {},
    },
    python: () => process.execPath,
    pythonResourcePath: () => join(root, 'kernel-worker.py'),
    getState: async () => ({ available: true, version: 'test' }),
    advanced: async () => ({ options: [] }),
    prepareKernelAssets: async () => {},
    onDiagnostic: (message) => diagnostics.push(message),
    remote: createRemoteKernel({ pollIntervalMs: 10, healthTimeoutMs: 500 }),
    ...options,
  });
  return {
    spawned,
    diagnostics,
    translate: async (extra = {}) =>
      runner.translate({
        id: 'pdf_math_precise',
        bytes: await pdf(2),
        page: 1,
        language: 'Simplified Chinese',
        threads: 1,
        model: 'test-model',
        proxy: { token: 'secret', url: 'https://example.test' },
        ...extra,
      }),
  };
}

test('runner uses a healthy remote kernel, skips Python and serves the cache offline', async (t) => {
  const server = await fakeServer(t);
  const data = await runnerFixture(t);
  const remoteKernel = { url: server.url };
  const result = await data.translate({ remoteKernel });
  assert.equal(result.cached, false);
  assert.equal(result.translationModel, 'pdf2zh-remote');
  assert.equal(data.spawned.length, 0);
  // The server is gone, yet the stored page is still served.
  const again = await data.translate({ remoteKernel: { url: server.url }, cacheOnly: true });
  assert.equal(again.cached, true);
  assert.equal(again.layoutKey, result.layoutKey);
  assert.equal(data.spawned.length, 0);
});

test('runner falls back to the local kernel when the health check fails', async (t) => {
  const data = await runnerFixture(t);
  await assert.rejects(
    data.translate({ remoteKernel: { url: 'http://127.0.0.1:1' } }),
    /Kernel translation failed/,
  );
  assert.equal(data.spawned.length, 1);
  assert.match(data.diagnostics.join('\n'), /Remote kernel unavailable/);
});

test('runner falls back to local when the remote job fails', async (t) => {
  const server = await fakeServer(t, { fail: true });
  const data = await runnerFixture(t);
  await assert.rejects(
    data.translate({ remoteKernel: { url: server.url } }),
    /Kernel translation failed/,
  );
  assert.equal(data.spawned.length, 1);
  assert.match(data.diagnostics.join('\n'), /Remote kernel failed/);
});

test('runner prefers the remote kernel over a selected service and glossary', async (t) => {
  const server = await fakeServer(t);
  const data = await runnerFixture(t);
  const result = await data.translate({
    remoteKernel: { url: server.url },
    glossary: [{ source: 'a', target: 'b' }],
    translationService: { id: 'custom-1', values: {} },
  });
  assert.equal(result.translationModel, 'pdf2zh-remote');
  assert.equal(data.spawned.length, 0);
  assert.match(data.diagnostics.join('\n'), /glossary are not sent/);
});

test('runner keeps the Fast kernel and cache-only misses off the remote server', async (t) => {
  const server = await fakeServer(t);
  const data = await runnerFixture(t);
  const remoteKernel = { url: server.url };
  await assert.rejects(
    data.translate({ remoteKernel, id: 'pdf_math_fast', language: 'English' }),
    /Kernel translation failed/,
  );
  assert.equal(await data.translate({ remoteKernel, cacheOnly: true }), null);
  assert.equal(server.requests.length, 0);
});

test('a remote job stuck at 0% reports indeterminate progress, then real percentages', async (t) => {
  const server = await fakeServer(t, { running: [0, 0, 40] });
  const kernel = createRemoteKernel({ pollIntervalMs: 10 });
  const events = [];
  await kernel.translatePage({
    url: server.url,
    bytes: await pdf(),
    page: 1,
    language: 'zh',
    onProgress: (progress) => events.push(progress),
  });
  assert.equal(events[0].percent, null);
  assert.ok(events.length >= 3);
  assert.deepEqual(
    events.map((event) => event.percent),
    [null, null, null, 40].slice(0, events.length),
  );
  assert.deepEqual(events.at(-1), {
    stage: 'translate 0/100',
    completed: 40,
    total: 100,
    percent: 40,
  });
});
