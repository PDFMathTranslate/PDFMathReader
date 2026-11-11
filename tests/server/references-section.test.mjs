import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  blocksBeforeReferences,
  isReferencesHeading,
} from '../../shared/translation/references-section.mjs';
import { createReferencesLocator } from '../../server/documents/references-start.mjs';
import { createReaderTasks } from '../../server/translation/reader-tasks.mjs';

const block = (id, text, x, y, width = 240, fontSize = 10) => ({
  id,
  text,
  x,
  y,
  width,
  height: fontSize * 1.2,
  fontSize,
});

test('references headings match common titles, numbering, and spacing', () => {
  for (const text of [
    'References',
    'REFERENCES',
    'R EFERENCES',
    '7. References',
    'VII. Bibliography',
    'A. References:',
    '§ 5 Works Cited',
    'Literaturverzeichnis',
    'Références bibliographiques',
    'Список литературы',
    '参 考 文 献',
    '第五章 参考文献',
    '참고문헌',
    'Tài liệu tham khảo',
  ])
    assert.equal(isReferencesHeading(text), true, text);
  for (const text of [
    'References 23',
    'References ........ 23',
    'References to earlier work show that the effect persists.',
    'Related work',
    '',
    undefined,
  ])
    assert.equal(isReferencesHeading(text), false, String(text));
});

test('one column keeps the blocks above the heading and the heading itself', () => {
  const blocks = [
    block(0, 'Conclusion text.', 50, 100, 500),
    block(1, 'References', 50, 300, 80, 12),
    block(2, '[1] A. Author. A paper. 2020.', 50, 330, 500),
  ];
  assert.deepEqual(
    blocksBeforeReferences(blocks).map((entry) => entry.id),
    [0, 1],
  );
});

test('a centred heading still drops the full-width blocks below it', () => {
  const blocks = [
    block(0, 'Conclusion text.', 50, 100, 500),
    block(1, 'REFERENCES', 260, 300, 80, 12),
    block(2, '[1] A. Author. A paper. 2020.', 50, 330, 500),
  ];
  assert.deepEqual(
    blocksBeforeReferences(blocks).map((entry) => entry.id),
    [0, 1],
  );
});

test('a heading centred over two columns drops narrow fragments below it', () => {
  const blocks = [
    block(0, 'Left note.', 53, 100, 190),
    block(1, 'Right note.', 258, 100, 190),
    block(2, 'REFERENCES', 224, 300, 50, 7),
    block(3, 'Bardhan, P., Alternative approaches.', 53, 320, 190),
    block(4, 'W., Dividing', 98, 370, 43),
    block(5, '(Oxford:', 218, 340, 24),
    block(6, 'Fafchamps, M., Solidarity networks.', 258, 340, 190),
  ];
  assert.deepEqual(
    blocksBeforeReferences(blocks).map((entry) => entry.id),
    [0, 1, 2],
  );
});

test('two columns follow reading order around a right-column heading', () => {
  const blocks = [
    block(0, 'Left top.', 50, 100),
    block(1, 'Left bottom.', 50, 600),
    block(2, 'Right top.', 320, 100),
    block(3, 'References', 320, 300, 80, 12),
    block(4, '[1] Entry.', 320, 330),
  ];
  assert.deepEqual(
    blocksBeforeReferences(blocks).map((entry) => entry.id),
    [0, 1, 2, 3],
  );
});

test('two columns drop the whole right column after a left-column heading', () => {
  const blocks = [
    block(0, 'Left top.', 50, 100),
    block(1, 'References', 50, 300, 80, 12),
    block(2, '[1] Entry.', 50, 330),
    block(3, '[2] Entry.', 320, 100),
  ];
  assert.deepEqual(
    blocksBeforeReferences(blocks).map((entry) => entry.id),
    [0, 1],
  );
});

test('pages without a heading keep every block', () => {
  const blocks = [block(0, 'Body.', 50, 100)];
  assert.equal(blocksBeforeReferences(blocks), blocks);
});

// Inspector items use a lower-left origin.
const item = (text, y, fontSize = 10) => ({
  text,
  x: 50,
  y,
  width: text.length * fontSize * 0.5,
  height: fontSize,
  fontSize,
});

test('the locator searches only the second half and retries failed pages', async () => {
  const pages = new Map([
    [1, [item('Contents', 700, 14), item('References', 600)]],
    [5, [item('Discussion ends here.', 700), item('6 References', 500, 12)]],
  ]);
  const extracted = [];
  let failPage = 4;
  const locator = createReferencesLocator({
    extractPage: async (entry, page) => {
      extracted.push(page);
      if (page === failPage) {
        failPage = 0;
        throw Error('extraction failed');
      }
      return pages.get(page) || [item('Body text.', 700)];
    },
  });
  const entry = {};
  await assert.rejects(locator.referencesStart(entry, { page: 4, pageCount: 6 }));
  assert.equal(await locator.referencesStart(entry, { page: 4, pageCount: 6 }), null);
  assert.equal(await locator.referencesStart(entry, { page: 6, pageCount: 6 }), 5);
  assert.equal(await locator.referencesStart(entry, { page: 2, pageCount: 6 }), null);
  assert.ok(!extracted.includes(1));
  assert.deepEqual(
    extracted.filter((page) => page === 3),
    [3],
  );
});

async function serveSkipping(engine) {
  const root = await mkdtemp(join(tmpdir(), 'pdfmathreader-references-'));
  const documents = new Map([['doc-a', { id: 'doc-a', bytes: Buffer.from('%PDF-a') }]]);
  const calls = { references: [], layout: [], translate: [], math: [] };
  const layouts = new Map([
    [2, [block(0, 'Body text.', 50, 100, 500)]],
    [
      3,
      [
        block(0, 'Conclusion text.', 50, 100, 500),
        block(1, 'References', 50, 300, 80, 12),
        block(2, '[1] A. Author. A paper. 2020.', 50, 330, 500),
      ],
    ],
  ]);
  const fakeFetch = async (url, options = {}) => {
    const parsed = new URL(url);
    const body = options.body ? JSON.parse(options.body) : {};
    if (parsed.pathname === '/api/references-start') {
      calls.references.push(body);
      return Response.json({ page: body.page >= 3 ? 3 : null });
    }
    if (parsed.pathname === '/api/layout') {
      calls.layout.push(body.page);
      return Response.json({ paragraphs: layouts.get(body.page) || [] });
    }
    if (parsed.pathname === '/api/translate-batch') {
      for (const entry of body.items) calls.translate.push(entry.text);
      return Response.json({
        results: body.items.map((entry) => ({ translation: entry.text.toUpperCase() })),
      });
    }
    if (parsed.pathname === '/api/math-page') {
      const number = Number(parsed.searchParams.get('page'));
      if (body.cacheOnly === true) return new Response(null, { status: 204 });
      calls.math.push(number);
      return new Response(Buffer.from(`%PDF-page-${number}`), {
        status: 200,
        headers: { 'Content-Type': 'application/pdf', 'X-Layout-Key': `layout-${number}` },
      });
    }
    if (parsed.pathname.startsWith('/api/math-progress'))
      return new Response(null, { status: 204 });
    throw Error(`Unexpected internal request: ${parsed.pathname}`);
  };
  const service = createReaderTasks({
    documents: { getEntry: (id) => documents.get(id) || null },
    fetchImpl: fakeFetch,
    origin: () => 'http://backend',
    tempRoot: root,
  });
  const pages = [2, 3, 4].map((number) => ({ number, height: 792 }));
  const task = service.create({
    documentId: 'doc-a',
    settings: {
      engine,
      language: 'Simplified Chinese',
      concurrency: 1,
      pageConcurrency: 1,
      skipReferences: true,
    },
    pages,
    layoutPages: pages,
    pageCount: 4,
  });
  for (let attempt = 0; attempt < 100 && service.status(task).state === 'running'; attempt++)
    await new Promise((resolve) => setTimeout(resolve, 10));
  const close = async () => {
    await service.close();
    await rm(root, { recursive: true, force: true });
  };
  return { service, task, calls, close };
}

test('inspector tasks stop translating at the references heading', async () => {
  const { service, task, calls, close } = await serveSkipping('pdf_inspector');
  try {
    assert.equal(service.status(task).state, 'complete');
    assert.equal(task.settings.skipReferences, true);
    assert.deepEqual(
      calls.references.map((body) => [body.page, body.pageCount]),
      [
        [2, 4],
        [3, 4],
        [4, 4],
      ],
    );
    assert.equal(service.page(task.id, 4).resultKind, 'skipped');
    assert.ok(!calls.layout.includes(4));
    assert.deepEqual(calls.translate, ['Body text.', 'Conclusion text.', 'References']);
    const third = JSON.parse(await readFile(service.page(task.id, 3).resultPath, 'utf8'));
    assert.deepEqual(
      third.paragraphs.map((entry) => entry.text),
      ['Conclusion text.', 'References'],
    );
  } finally {
    await close();
  }
});

test('math tasks translate the heading page and skip the pages after it', async () => {
  const { service, task, calls, close } = await serveSkipping('pdf_math_fast');
  try {
    assert.equal(service.status(task).state, 'complete');
    assert.deepEqual(calls.math, [2, 3]);
    assert.equal(service.page(task.id, 4).resultKind, 'skipped');
  } finally {
    await close();
  }
});
