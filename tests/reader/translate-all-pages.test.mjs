import test from 'node:test';
import assert from 'node:assert/strict';
import { createTranslationQueueState } from '../../src/features/translation/queue-state.mjs';
import { createTranslationQueue } from '../../src/features/translation/translation-queue.mjs';
import { createTranslationScope } from '../../src/features/translation/translation-scope.mjs';
import { createReaderCommands } from '../../src/features/reader/reader-commands.mjs';

function fixture(engine) {
  const pages = Array.from({ length: 20 }, (_, i) => ({
    number: i + 1,
    status: i === 0 ? 'ready' : i === 19 ? 'error' : 'idle',
    blocks: i === 0 ? [{ text: 'Existing', translation: 'Saved', status: 'ready' }] : [],
  }));
  const session = { epoch: 1, documentId: 'document', pages: { value: pages }, pdf: {} };
  const preferences = {
    engine: { value: engine },
    pageConcurrency: { value: 2 },
    concurrency: { value: 3 },
    translationMode: { value: 'reading-ahead' },
    automatic: { value: false },
    language: { value: 'English' },
    sourceLanguage: { value: 'French' },
    jevApiToken: { value: '' },
    documentLanguageDetection: { value: true },
    reuseTranslations: { value: true },
  };
  const translationState = createTranslationQueueState();
  translationState.translationDeferred.value = true;
  const view = {
    reader: { value: null },
    active: { value: 10 },
    showTranslations: { value: false },
  };
  const scope = createTranslationScope({
    session,
    preferences,
    translationState,
    view,
    renderState: { layoutElement: { value: null }, visiblePages: new Set([10]) },
  });
  const calls = [];
  let concurrent = 0,
    peak = 0;
  const queue = createTranslationQueue({
    session,
    preferences,
    translationState,
    view,
    activity: { foreground: { value: false } },
    provider: { activeGlossary: { value: [] }, currentTranslationService: { value: {} } },
    actions: {
      translationScope: scope,
      kernelSettings: { reportKernelFailure: assert.fail },
      backendRequests: {
        async api(path, options) {
          assert.notEqual(
            path,
            '/api/document-language',
            'explicit requests bypass automatic language skipping',
          );
          const body = JSON.parse(options.body);
          assert.equal(options.translationJob.manual, true);
          if (path === '/api/layout')
            return { paragraphs: [{ id: 'body', text: `Page ${body.page}` }] };
          assert.equal(body.forceRetranslation, false);
          assert.equal(body.cacheOnly, true);
          calls.push(options.translationJob.page);
          concurrent++;
          peak = Math.max(peak, concurrent);
          await new Promise((resolve) => setImmediate(resolve));
          concurrent--;
          return { translation: 'Translated', cached: true };
        },
      },
      mathTranslation: {
        async mathPage(page, token, manual) {
          assert.equal(token, session.epoch);
          assert.equal(manual, true);
          page.status = 'detecting';
          calls.push(page.number);
          concurrent++;
          peak = Math.max(peak, concurrent);
          await new Promise((resolve) => setImmediate(resolve));
          concurrent--;
          page.blocks = [{ text: 'Original', translation: 'Translated', status: 'ready' }];
          page.status = 'ready';
        },
      },
    },
  });
  return { session, preferences, translationState, scope, view, calls, queue, peak: () => peak };
}

for (const engine of ['pdf_inspector', 'pdf_math_fast', 'pdf_math_precise']) {
  test(`${engine}: explicit all-pages translation respects cache, limits and document scope`, async () => {
    const f = fixture(engine),
      other = fixture(engine);
    await f.queue.translateAllDocumentPages();
    await f.queue.translateAllDocumentPages();
    f.view.active.value = 20;
    f.scope.pruneTranslationQueue();
    for (let i = 0; i < 100 && (f.translationState.pageRunning || f.translationState.running); i++)
      await new Promise((resolve) => setImmediate(resolve));
    assert.equal(f.translationState.pageRunning, 0);
    assert.equal(f.translationState.running, 0);
    assert.equal(f.calls.length, 19);
    assert.equal(new Set(f.calls).size, 19, 'repeat clicks do not duplicate work');
    assert.ok(f.calls.includes(20), 'failed pages are retried');
    assert.ok(f.peak() <= (engine === 'pdf_inspector' ? 3 : 2));
    assert.ok(f.session.pages.value.every((p) => p.blocks[0].translation));
    assert.equal(f.session.pages.value[0].blocks[0].translation, 'Saved');
    assert.equal(f.preferences.translationMode.value, 'reading-ahead');
    assert.equal(f.preferences.automatic.value, false);
    assert.equal(f.translationState.translationDeferred.value, false);
    assert.equal(other.translationState.translateAllPages, false);
    assert.equal(other.translationState.translationDeferred.value, true);
    f.translationState.translateAllPages = false;
    assert.ok(
      f.scope.readingTranslationPages().length < 20,
      'normal reading scope returns after cancellation',
    );
  });
}

test('hidden renderer leaves queued backend-task pages untouched until foreground restore', async () => {
  const page = { number: 1, status: 'queued', blocks: [] };
  const translationState = {
    pageQueue: [{ p: page, token: 1 }],
    queue: [],
    pageRunning: 0,
    running: 0,
    translateAllPages: true,
    forceRetranslation: false,
    translationRequests: new Map(),
    controllers: new Set(),
  };
  let readerTasksEnabled = true;
  let mathCalls = 0;
  const queue = createTranslationQueue({
    session: { epoch: 1, documentId: 'document', pages: { value: [page] } },
    preferences: {
      engine: { value: 'pdf_math_fast' },
      pageConcurrency: { value: 1 },
      concurrency: { value: 1 },
      translationMode: { value: 'full' },
      automatic: { value: true },
      documentLanguageDetection: { value: false },
      language: { value: 'English' },
      sourceLanguage: { value: 'Chinese' },
      jevApiToken: { value: '' },
      reuseTranslations: { value: true },
    },
    translationState,
    activity: { foreground: { value: false } },
    provider: { activeGlossary: { value: [] }, currentTranslationService: { value: {} } },
    view: { showTranslations: { value: true } },
    actions: {
      readerTasks: { enabled: () => readerTasksEnabled },
      translationScope: { readingTranslationPages: () => [1], pruneTranslationQueue() {} },
      mathTranslation: {
        async mathPage() {
          mathCalls++;
          page.status = 'ready';
        },
      },
    },
  });

  queue.pumpPages();
  assert.equal(translationState.pageRunning, 0);
  assert.equal(translationState.pageQueue.length, 1);
  assert.equal(mathCalls, 0);

  // The control path demonstrates the same queued page is runnable once the
  // backend task is no longer responsible for hidden-window progress.
  readerTasksEnabled = false;
  queue.pumpPages();
  assert.equal(translationState.pageRunning, 1);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(translationState.pageRunning, 0);
  assert.equal(mathCalls, 1);
});

test('the menu command starts current-document translation and ignores empty/settings windows', () => {
  const oldWindow = globalThis.window;
  globalThis.window = {};
  try {
    const f = fixture('pdf_inspector'),
      shell = { settingsWindowMode: false };
    let started = 0;
    const commands = createReaderCommands({
      ...f,
      shell,
      actions: { translationQueue: { translateAllDocumentPages: () => started++ } },
    });
    commands.readerAction('translate-all-pages');
    assert.equal(started, 1);
    assert.equal(f.view.showTranslations.value, true);
    assert.equal(f.preferences.automatic.value, false);
    shell.settingsWindowMode = true;
    commands.readerAction('translate-all-pages');
    shell.settingsWindowMode = false;
    f.session.pages.value = [];
    commands.readerAction('translate-all-pages');
    assert.equal(started, 1);
  } finally {
    globalThis.window = oldWindow;
  }
});
