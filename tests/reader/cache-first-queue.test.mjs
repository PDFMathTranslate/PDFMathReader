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
