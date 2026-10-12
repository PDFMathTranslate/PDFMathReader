import test from 'node:test';
import assert from 'node:assert/strict';
import { createTranslationQueue } from '../../src/features/translation/translation-queue.mjs';

test('math cache restoration is scheduled while kernel state is still pending', async () => {
  const pages = [1, 2].map((number) => ({ number, status: 'idle', blocks: [] }));
  const calls = [];
  const queue = createTranslationQueue({
    session: { epoch: 1, pages: { value: pages } },
    preferences: {
      engine: { value: 'pdf_math_fast' },
      pageConcurrency: { value: 1 },
      concurrency: { value: 2 },
      translationMode: { value: 'reading' },
    },
    translationState: { pageQueue: [], queue: [], pageRunning: 0, running: 0 },
    activity: { foreground: { value: true } },
    kernel: { engineState: { value: null } },
    actions: {
      translationScope: { pruneTranslationQueue() {}, readingTranslationPages: () => [1, 2] },
      mathTranslation: {
        async mathPage(page) {
          calls.push(page.number);
          page.status = 'ready';
        },
      },
    },
  });
  queue.schedulePages();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, [1, 2]);
});

test('layout paragraphs holding only removed watermark text are left out', async () => {
  const paragraphs = [
    { id: 'a', text: 'A body paragraph.' },
    { id: 'b', text: 'DRAFT COPY' },
  ];
  const queueFor = (hidden, enabled) =>
    createTranslationQueue({
      session: { epoch: 1, documentId: 'doc', pdf: { getPage: async () => ({}) } },
      preferences: { language: { value: 'en' }, sourceLanguage: { value: 'auto' } },
      translationState: { pageQueue: [], queue: [], pageRunning: 0, running: 0 },
      activity: { foreground: { value: true } },
      view: { showTranslations: { value: true } },
      actions: { backendRequests: { api: async () => ({ paragraphs }) } },
      watermarkRemoval: {
        enabled: () => enabled,
        hiddenText: async () => hidden,
      },
    });
  const matcher = { length: 1, matches: (text) => text === 'DRAFT COPY' };
  const layout = async (hidden, enabled) => {
    const page = { number: 1, height: 792, status: 'idle', blocks: [] };
    await queueFor(hidden, enabled).ensureLayout(page);
    return page.blocks.map((block) => block.id);
  };
  assert.deepEqual(await layout(matcher, true), ['a']);
  assert.deepEqual(await layout(matcher, false), ['a', 'b']);
  assert.deepEqual(await layout(null, true), ['a', 'b']);
  const failing = createTranslationQueue({
    session: { epoch: 1, documentId: 'doc', pdf: null },
    preferences: { language: { value: 'en' }, sourceLanguage: { value: 'auto' } },
    translationState: { pageQueue: [], queue: [], pageRunning: 0, running: 0 },
    activity: { foreground: { value: true } },
    view: { showTranslations: { value: true } },
    actions: { backendRequests: { api: async () => ({ paragraphs }) } },
    watermarkRemoval: { enabled: () => true, hiddenText: async () => matcher },
  });
  const page = { number: 1, height: 792, status: 'idle', blocks: [] };
  await failing.ensureLayout(page);
  assert.deepEqual(
    page.blocks.map((block) => block.id),
    ['a', 'b'],
  );
});
