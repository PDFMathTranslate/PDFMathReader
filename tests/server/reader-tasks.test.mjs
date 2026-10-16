import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createReaderTasks } from '../../server/translation/reader-tasks.mjs';

const settings = (overrides = {}) => ({
  engine: 'pdf_math_fast',
  language: 'Simplified Chinese',
  sourceLanguage: 'English',
  concurrency: 1,
  pageConcurrency: 1,
  reuseTranslations: true,
  forceRetranslation: false,
  paragraphContinuationDetection: false,
  glossary: [],
  advancedOptions: {},
  ...overrides,
});

const page = (number) => ({ number, height: 792 });

async function waitForStatus(service, task) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const status = service.status(task);
    if (status.state !== 'running') return status;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw Error(`Reader task ${task.id} did not settle.`);
}

async function serve({ delayMs = 15, taskTtlMs } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'pdfmathreader-reader-task-'));
  const documents = new Map([
    ['doc-a', { id: 'doc-a', bytes: Buffer.from('%PDF-a'), documentHash: 'a'.repeat(64) }],
    ['doc-b', { id: 'doc-b', bytes: Buffer.from('%PDF-b'), documentHash: 'b'.repeat(64) }],
  ]);
  const calls = [];
  const fakeFetch = async (url, options = {}) => {
    const parsed = new URL(url);
    const body = options.body ? JSON.parse(options.body) : {};
    if (parsed.pathname === '/api/math-progress') return new Response(null, { status: 204 });
    if (parsed.pathname === '/api/math-page') {
      const number = Number(parsed.searchParams.get('page'));
      calls.push({ documentId: body.documentId, page: number, cacheOnly: body.cacheOnly === true });
      if (body.cacheOnly === true) return new Response(null, { status: 204 });
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, delayMs);
        options.signal?.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            const error = Error('aborted');
            error.name = 'AbortError';
            reject(error);
          },
          { once: true },
        );
      });
      return new Response(Buffer.from(`%PDF-page-${number}`), {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'X-Layout-Key': `layout-${number}`,
          'X-Translation-Cache': number === 1 ? 'hit' : 'miss',
          'X-Translation-Model': 'test-model',
        },
      });
    }
    throw Error(`Unexpected internal request: ${parsed.pathname}`);
  };
  const service = createReaderTasks({
    documents: { getEntry: (id) => documents.get(id) || null },
    fetchImpl: fakeFetch,
    origin: () => 'http://backend',
    tempRoot: root,
    ...(taskTtlMs === undefined ? {} : { taskTtlMs }),
  });
  const close = async () => {
    await service.close();
    await rm(root, { recursive: true, force: true });
  };
  return { calls, service, close };
}

async function serveInspector() {
  const root = await mkdtemp(join(tmpdir(), 'pdfmathreader-reader-task-inspector-'));
  const documents = new Map([
    ['doc-a', { id: 'doc-a', bytes: Buffer.from('%PDF-a'), documentHash: 'a'.repeat(64) }],
  ]);
  const calls = { layout: [], continuation: [], translate: [] };
  const layouts = new Map([
    [
      1,
      [
        {
          id: 'first',
          text: 'alpha-',
          x: 10,
          y: 100,
          width: 500,
          height: 12,
          fontSize: 12,
        },
      ],
    ],
    [
      2,
      [
        {
          id: 'second',
          text: 'beta',
          x: 10,
          y: 100,
          width: 500,
          height: 12,
          fontSize: 12,
        },
      ],
    ],
  ]);
  const fakeFetch = async (url, options = {}) => {
    const parsed = new URL(url);
    const body = options.body ? JSON.parse(options.body) : {};
    if (parsed.pathname === '/api/layout') {
      calls.layout.push(body.page);
      return Response.json({ paragraphs: layouts.get(body.page) || [] });
    }
    if (parsed.pathname === '/api/paragraph-continuation') {
      calls.continuation.push(body);
      return Response.json({ status: 'classified', combine: true });
    }
    if (parsed.pathname === '/api/translate') {
      calls.translate.push(body);
      return Response.json({
        translation: body.text.toUpperCase(),
        model: 'test-model',
        cached: false,
      });
    }
    throw Error(`Unexpected internal request: ${parsed.pathname}`);
  };
  const service = createReaderTasks({
    documents: { getEntry: (id) => documents.get(id) || null },
    fetchImpl: fakeFetch,
    origin: () => 'http://backend',
    tempRoot: root,
  });
  const close = async () => {
    await service.close();
    await rm(root, { recursive: true, force: true });
  };
  return { calls, service, close };
}

function create(service, documentId, numbers, taskSettings = settings()) {
  return service.create({
    documentId,
    settings: taskSettings,
    pages: numbers.map(page),
    layoutPages: numbers.map(page),
  });
}

test('reader task survives a disconnected submitter and reconnects to page results', async () => {
  const { service, calls, close } = await serve();
  try {
    // The service receives no renderer request signal. Dropping the submitter
    // after create() therefore cannot abort the backend-owned task.
    const task = create(service, 'doc-a', [1, 2]);
    const status = await waitForStatus(service, task);
    assert.equal(status.state, 'complete');
    assert.equal(status.completed, 2);
    assert.equal(status.total, 2);
    assert.equal(
      new Set(
        calls.filter((call) => !call.cacheOnly).map((call) => `${call.documentId}:${call.page}`),
      ).size,
      2,
    );
    const result = service.page(task.id, 2);
    assert.equal(result.state, 'done');
    assert.equal(result.resultHeaders['x-layout-key'], 'layout-2');
    assert.equal((await readFile(result.resultPath)).toString(), '%PDF-page-2');
  } finally {
    await close();
  }
});

test('same document and canonical settings deduplicate while page scope grows', async () => {
  const { service, close } = await serve({ delayMs: 5 });
  try {
    const first = create(service, 'doc-a', [1], settings());
    const second = create(service, 'doc-a', [2], {
      ...settings(),
      glossary: [],
      advancedOptions: {},
    });
    assert.equal(second.id, first.id);
    const status = await waitForStatus(service, first);
    assert.equal(status.total, 2);
    assert.equal(status.state, 'complete');
  } finally {
    await close();
  }
});

test('a completed task reopens when its page scope grows', async () => {
  const { service, calls, close } = await serve({ delayMs: 5 });
  try {
    const first = create(service, 'doc-a', [1]);
    assert.equal((await waitForStatus(service, first)).state, 'complete');
    const expanded = create(service, 'doc-a', [1, 2]);
    assert.equal(expanded.id, first.id);
    const status = await waitForStatus(service, expanded);
    assert.equal(status.state, 'complete');
    assert.deepEqual(
      status.pages.map((entry) => [entry.number, entry.state]),
      [
        [1, 'done'],
        [2, 'done'],
      ],
    );
    assert.equal(calls.filter((call) => !call.cacheOnly).length, 2);
  } finally {
    await close();
  }
});

test('a completed task can be cancelled and recreated with a new id', async () => {
  const { service, close } = await serve({ delayMs: 5 });
  try {
    const completed = create(service, 'doc-a', [1]);
    assert.equal((await waitForStatus(service, completed)).state, 'complete');
    assert.equal(service.cancel(completed.id), true);
    assert.equal(service.status(completed).state, 'cancelled');
    const retry = create(service, 'doc-a', [1]);
    assert.notEqual(retry.id, completed.id);
    assert.equal((await waitForStatus(service, retry)).state, 'complete');
  } finally {
    await close();
  }
});

test('completed live-document results survive the terminal cleanup interval', async () => {
  const { service, close } = await serve({ delayMs: 0, taskTtlMs: 1 });
  try {
    const task = create(service, 'doc-a', [1]);
    assert.equal((await waitForStatus(service, task)).state, 'complete');
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal(service.get(task.id), task);
    const result = service.page(task.id, 1);
    assert.equal(result.state, 'done');
    assert.equal((await readFile(result.resultPath)).toString(), '%PDF-page-1');
  } finally {
    await close();
  }
});

test('terminal tasks are retired when the bounded task map fills', async () => {
  const { service, close } = await serve({ delayMs: 0 });
  try {
    const completed = [];
    for (let index = 0; index < 32; index++) {
      const task = create(service, 'doc-a', [1], {
        ...settings(),
        advancedOptions: { taskIndex: index },
      });
      completed.push(task);
      assert.equal((await waitForStatus(service, task)).state, 'complete');
    }
    const replacement = create(service, 'doc-a', [1], {
      ...settings(),
      advancedOptions: { taskIndex: 32 },
    });
    assert.equal((await waitForStatus(service, replacement)).state, 'complete');
    assert.equal(service.get(completed[0].id), null);
    assert.equal(service.tasks().length, 32);
  } finally {
    await close();
  }
});

test('cancellation is explicit, bounded to one document, and reconnectable as cancelled', async () => {
  const { service, close } = await serve({ delayMs: 500 });
  try {
    const cancelled = create(service, 'doc-b', [1]);
    const isolated = create(service, 'doc-a', [1]);
    assert.equal(service.cancel(cancelled.id), true);
    const cancelledStatus = await waitForStatus(service, cancelled);
    assert.equal(cancelledStatus.state, 'cancelled');
    assert.equal(cancelledStatus.pages[0].state, 'cancelled');
    const isolatedStatus = await waitForStatus(service, isolated);
    assert.equal(isolatedStatus.state, 'complete');
  } finally {
    await close();
  }
});

test('document cancellation retires more than the bounded task count', async () => {
  const { service, close } = await serve({ delayMs: 500 });
  try {
    for (let index = 0; index < 40; index++) {
      const task = create(service, 'doc-a', [1], {
        ...settings(),
        advancedOptions: { cancelledTaskIndex: index },
      });
      service.cancelForDocument('doc-a');
      assert.equal(service.get(task.id), null);
    }
    assert.equal(service.tasks().length, 0);
  } finally {
    await close();
  }
});

test('inspector groups cross-page fragments and deduplicates the provider call', async () => {
  const { service, calls, close } = await serveInspector();
  try {
    const task = create(
      service,
      'doc-a',
      [1, 2],
      settings({
        engine: 'pdf_inspector',
        pageConcurrency: 2,
        paragraphContinuationDetection: true,
      }),
    );
    assert.equal((await waitForStatus(service, task)).state, 'complete');
    assert.equal(calls.translate.length, 1);
    assert.equal(calls.layout.filter((number) => number === 1).length, 1);
    assert.equal(calls.layout.filter((number) => number === 2).length, 1);
    assert.ok(calls.continuation.length > 0);

    const first = JSON.parse(await readFile(service.page(task.id, 1).resultPath, 'utf8'));
    const second = JSON.parse(await readFile(service.page(task.id, 2).resultPath, 'utf8'));
    assert.equal(first.paragraphs[0].paragraphGroupId, second.paragraphs[0].paragraphGroupId);
    assert.equal(first.paragraphs[0].paragraphText, 'alphabeta');
    assert.equal(second.paragraphs[0].paragraphText, 'alphabeta');
    assert.equal(first.paragraphs[0].paragraphIndex, 0);
    assert.equal(second.paragraphs[0].paragraphIndex, 1);
    assert.equal(first.paragraphs[0].paragraphTranslation, 'ALPHABETA');
    assert.equal(second.paragraphs[0].paragraphTranslation, 'ALPHABETA');
  } finally {
    await close();
  }
});
