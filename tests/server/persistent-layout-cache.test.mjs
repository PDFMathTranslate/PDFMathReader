import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { registerDocumentRoutes } from '../../server/http/document-routes.mjs';
import { createCacheManager } from '../../server/cache/cache-management.mjs';
import { createDocumentCache } from '../../server/documents/document-cache.mjs';
import {
  createDocumentStore,
  isDocumentId,
  MAX_DOCUMENT_BYTES,
} from '../../server/documents/documents.mjs';

const PDF = Buffer.from('%PDF-1.7\nlayout-cache-fixture');
const ITEMS = [
  {
    page: 1,
    text: 'Persistent layout fixture',
    x: 40,
    y: 700,
    width: 220,
    height: 20,
    fontSize: 16,
    itemType: 'Text',
  },
];

async function harness(directory, extractPage) {
  const app = express();
  const documents = createDocumentStore();
  const documentCache = createDocumentCache(directory);
  const cacheManager = createCacheManager({
    directory,
    documentCache,
    limitMB: null,
    sweepIntervalMs: 0,
  });
  await cacheManager.start({ deferSweep: true });
  const layoutEntries = new Map();
  registerDocumentRoutes(app, {
    documents,
    isDocumentId,
    documentCache,
    layoutEntries,
    layoutExtraction: { extractPage, cleanup() {} },
    performanceTracker: { now: () => performance.now(), recordLayout() {} },
    cacheManager,
    maxDocumentBytes: MAX_DOCUMENT_BYTES,
  });
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin,
    async close() {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      await cacheManager.close();
    },
  };
}

async function upload(origin, name = 'fixture.pdf') {
  const response = await fetch(origin + '/api/documents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/pdf', 'X-Document-Name': encodeURIComponent(name) },
    body: PDF,
  });
  assert.equal(response.status, 201);
  return (await response.json()).id;
}

async function layout(origin, documentId, height = 792) {
  return fetch(origin + '/api/layout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId, page: 1, height }),
  });
}

async function cachePath(directory, height = 792) {
  const documentHash = createHash('sha256').update(PDF).digest('hex');
  const generation = (
    await readFile(join(directory, 'documents', `${documentHash}.generation`), 'utf8')
  ).trim();
  const key = createHash('sha256')
    .update(JSON.stringify({ page: 1, height, schema: 1 }))
    .digest('hex');
  return join(directory, 'documents', documentHash, 'layout', generation, `${key}.json`);
}

test('persists inspector layout and serves a reopened cache hit without extraction', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'persistent-layout-cache-'));
  let firstCalls = 0;
  const first = await harness(directory, async () => {
    firstCalls++;
    return ITEMS;
  });
  let stored;
  try {
    const id = await upload(first.origin);
    const response = await layout(first.origin, id);
    assert.equal(response.status, 200);
    stored = await response.json();
    assert.deepEqual(
      stored.paragraphs.map(({ text }) => text),
      ['Persistent layout fixture'],
    );
    assert.equal(firstCalls, 1);
    const path = await cachePath(directory);
    assert.deepEqual(JSON.parse(await readFile(path, 'utf8')), { paragraphs: stored.paragraphs });
    assert.deepEqual(
      (await readdir(join(path, '..'))).filter((name) => name.endsWith('.tmp')),
      [],
    );
  } finally {
    await first.close();
  }

  let reopenedCalls = 0;
  const reopened = await harness(directory, async () => {
    reopenedCalls++;
    throw Error('layout extractor must not run for a persistent cache hit');
  });
  try {
    const id = await upload(reopened.origin, '/another/folder/renamed.pdf');
    const response = await layout(reopened.origin, id);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).paragraphs, stored.paragraphs);
    assert.equal(reopenedCalls, 0);
  } finally {
    await reopened.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('malformed layout cache falls back and an empty paragraph list is a valid hit', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'persistent-layout-cache-'));
  let calls = 0;
  let empty = false;
  const server = await harness(directory, async () => {
    calls++;
    if (empty) throw Error('empty cache should bypass extraction');
    return ITEMS;
  });
  try {
    const id = await upload(server.origin);
    const path = await cachePath(directory);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, '{ malformed cache');
    const fallback = await layout(server.origin, id);
    assert.equal(fallback.status, 200);
    assert.deepEqual(
      (await fallback.json()).paragraphs.map(({ text }) => text),
      ['Persistent layout fixture'],
    );
    assert.equal(calls, 1);
    assert.deepEqual(
      JSON.parse(await readFile(path, 'utf8')).paragraphs[0].text,
      'Persistent layout fixture',
    );

    await writeFile(path, JSON.stringify({ paragraphs: [] }));
    empty = true;
    const cachedEmpty = await layout(server.origin, id);
    assert.equal(cachedEmpty.status, 200);
    assert.deepEqual((await cachedEmpty.json()).paragraphs, []);
    assert.equal(calls, 1);
  } finally {
    await server.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('legacy byte layout requests remain unscoped and do not create persistent entries', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'persistent-layout-cache-'));
  let calls = 0;
  const server = await harness(directory, async () => {
    calls++;
    return ITEMS;
  });
  try {
    const request = () =>
      fetch(server.origin + '/api/layout?page=1&height=792', {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf' },
        body: PDF,
      });
    assert.equal((await request()).status, 200);
    assert.equal((await request()).status, 200);
    assert.equal(calls, 2);
    assert.deepEqual(
      (await readdir(join(directory, 'documents')).catch(() => [])).filter(Boolean),
      [],
    );
  } finally {
    await server.close();
    await rm(directory, { recursive: true, force: true });
  }
});
