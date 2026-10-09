import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocumentLanguageGuard } from '../../src/features/translation/document-language-guard.mjs';
function fixture(api) {
  const reads = [];
  const session = {
    epoch: 1,
    pdf: {
      numPages: 20,
      async getPage(n) {
        reads.push(n);
        return {
          async getTextContent() {
            return { items: [{ str: '😀'.repeat(200) }, { str: 'extra' }] };
          },
        };
      },
    },
  };
  const preferences = {
    documentLanguageDetection: { value: true },
    sourceLanguage: { value: 'English' },
    jevApiToken: { value: 'custom' },
  };
  return {
    session,
    preferences,
    reads,
    allow: createDocumentLanguageGuard({ session, preferences, api }),
  };
}
test('reads only three pages with 100 Unicode characters; concurrent requests share check', async () => {
  let calls = 0;
  const f = fixture(async (path, options) => {
    calls++;
    assert.equal(path, '/api/document-language');
    const body = JSON.parse(options.body);
    assert.equal(body.sourceLanguage, 'English');
    assert.equal(body.token, 'custom');
    assert.deepEqual(
      body.samples.map((s) => Array.from(s).length),
      [100, 100, 100],
    );
    return { skipAutomaticTranslation: true };
  });
  assert.deepEqual(await Promise.all([f.allow(), f.allow()]), [false, false]);
  assert.deepEqual(f.reads, [1, 2, 3]);
  assert.equal(calls, 1);
  assert.equal(await f.allow(), false);
  assert.equal(calls, 1);
});
test('disabled feature reads no pages and makes no request', async () => {
  const f = fixture(() => assert.fail('request'));
  f.preferences.documentLanguageDetection.value = false;
  assert.equal(await f.allow(), true);
  assert.deepEqual(f.reads, []);
});
test('failure permits automatic translation', async () => {
  const f = fixture(async () => {
    throw Error('offline');
  });
  assert.equal(await f.allow(), true);
});
test('changed source language reruns judgment', async () => {
  let calls = 0;
  const f = fixture(async () => {
    calls++;
    return { skipAutomaticTranslation: true };
  });
  await f.allow();
  f.preferences.sourceLanguage.value = 'Japanese';
  await f.allow();
  assert.equal(calls, 2);
});
test('switching documents while sampling prevents stale request', async () => {
  const f = fixture(() => assert.fail('stale request'));
  f.session.pdf.getPage = async () => {
    f.session.epoch++;
    return { getTextContent: async () => ({ items: [{ str: 'text' }] }) };
  };
  assert.equal(await f.allow(), true);
});
test('disabling feature during a request ignores match', async () => {
  const f = fixture(async () => {
    f.preferences.documentLanguageDetection.value = false;
    return { skipAutomaticTranslation: true };
  });
  assert.equal(await f.allow(), true);
});

test('automatic math translation is skipped while manual translation remains available', async () => {
  const { createTranslationQueue } =
    await import('../../src/features/translation/translation-queue.mjs');
  const f = fixture(async () => ({ skipAutomaticTranslation: true }));
  const pages = [{ number: 1, status: 'idle', blocks: [] }];
  f.session.pages = { value: pages };
  const calls = [];
  const queue = createTranslationQueue({
    session: f.session,
    preferences: {
      ...f.preferences,
      engine: { value: 'pdf_math_fast' },
      pageConcurrency: { value: 1 },
      concurrency: { value: 2 },
      translationMode: { value: 'reading' },
    },
    translationState: { pageQueue: [], queue: [], pageRunning: 0, running: 0 },
    activity: { foreground: { value: true } },
    actions: {
      backendRequests: { api: async () => ({ skipAutomaticTranslation: true }) },
      translationScope: { pruneTranslationQueue() {}, readingTranslationPages: () => [1] },
      mathTranslation: {
        async mathPage(page, epoch, manual) {
          calls.push({ page: page.number, manual });
        },
      },
    },
  });
  await queue.schedulePages();
  assert.deepEqual(calls, []);
  assert.equal(pages[0].status, 'idle');
  await queue.processPage(pages[0], true);
  assert.deepEqual(calls, [{ page: 1, manual: true }]);
});
