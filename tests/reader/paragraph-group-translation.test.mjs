import test from 'node:test';
import assert from 'node:assert/strict';
import { createTranslationQueue } from '../../src/features/translation/translation-queue.mjs';
import { createTranslationScope } from '../../src/features/translation/translation-scope.mjs';

const tick = () => new Promise((resolve) => setImmediate(resolve));

function ref(value) {
  return { value };
}

function block(id, text, x = 20, y = 20) {
  return {
    id,
    text,
    x,
    y,
    width: 180,
    height: 20,
    fontSize: 10,
    status: 'idle',
    translation: '',
    translated: true,
    cached: false,
    error: '',
  };
}

function page(number, blocks) {
  return { number, width: 240, height: 320, status: 'ready', blocks };
}

function fixture({ continuation, api, activity = true, allowed = [1, 2], pages } = {}) {
  const actualPages = pages || [
    page(1, [block(0, 'First source fragment.'), block(1, 'Second source fragment.', 20, 50)]),
    page(2, [block(0, 'A separate page.')]),
  ];
  const session = { epoch: 1, documentId: 'document', pages: ref(actualPages) };
  const activityState = { foreground: ref(activity) };
  const translationState = {
    pageQueue: [],
    queue: [],
    pageRunning: 0,
    running: 0,
    forceRetranslation: false,
    translationRequests: new Map(),
    controllers: new Set(),
    translationDeferred: ref(false),
  };
  const requests = [];
  const continuationService =
    typeof continuation === 'function' ? continuation(actualPages) : continuation;
  const backend = {
    api: async (path, options = {}) => {
      const body = options.body ? JSON.parse(options.body) : {};
      requests.push({ path, body, options });
      return api
        ? api(path, body, options)
        : { translation: 'Translated result.', cached: false, model: 'mock' };
    },
  };
  const scope = {
    readingTranslationPages: () => [...allowed],
    scopePages: () => new Set(allowed),
    pruneTranslationQueue() {},
  };
  const queue = createTranslationQueue({
    session,
    preferences: {
      documentLanguageDetection: ref(false),
      jevApiToken: ref(''),
      engine: ref('pdf_inspector'),
      pageConcurrency: ref(1),
      concurrency: ref(2),
      translationMode: ref('reading'),
      language: ref('English'),
      sourceLanguage: ref('Chinese'),
      reuseTranslations: ref(false),
    },
    translationState,
    activity: activityState,
    provider: {
      activeGlossary: ref([]),
      currentTranslationService: ref({ id: 'mock' }),
    },
    view: { showTranslations: ref(true) },
    actions: {
      backendRequests: backend,
      translationScope: scope,
      kernelSettings: { reportKernelFailure() {} },
      paragraphContinuation: continuationService,
    },
  });
  return {
    queue,
    session,
    pages: actualPages,
    translationState,
    requests,
    scope,
    activity: activityState,
  };
}

function pairContinuation(pages) {
  const group = {
    id: '1:0',
    members: [
      { page: pages[0], block: pages[0].blocks[0] },
      { page: pages[0], block: pages[0].blocks[1] },
    ],
    text: 'First source fragment. Second source fragment.',
  };
  return {
    groupFor: async (_page, current) =>
      current === pages[0].blocks[0] || current === pages[0].blocks[1]
        ? group
        : {
            id: `singleton:${current.id}`,
            members: [{ page: pages[1], block: current }],
            text: current.text,
          },
    invalidate() {},
  };
}

async function waitForTranslation(fixtureValue) {
  fixtureValue.activity.foreground.value = true;
  fixtureValue.queue.pump();
  await tick();
  await tick();
}

test('group translation requests combined text once, preserves geometry, and distributes losslessly', async () => {
  const f = fixture({
    activity: false,
    allowed: [1],
    continuation: pairContinuation,
    api: async (path, body) =>
      path === '/api/translate' && !body.cacheOnly
        ? { translation: 'First translated fragment continues.', cached: false, model: 'mock' }
        : null,
  });
  const first = f.pages[0].blocks[0],
    second = f.pages[0].blocks[1];
  const geometry = [first.x, first.y, first.width, first.height, second.x, second.y];
  await f.queue.processPage(f.pages[0], true);
  assert.equal(f.translationState.queue.length, 1);
  assert.deepEqual([first.status, second.status], ['queued', 'queued']);
  await waitForTranslation(f);
  assert.equal(
    f.requests.filter(({ path, body }) => path === '/api/translate' && !body.cacheOnly).length,
    1,
  );
  assert.equal(
    f.requests.find(({ path, body }) => path === '/api/translate' && !body.cacheOnly).body.text,
    'First source fragment. Second source fragment.',
  );
  assert.equal(first.translation + second.translation, 'First translated fragment continues.');
  assert.equal(first.paragraphGroupId, '1:0');
  assert.equal(second.paragraphIndex, 1);
  assert.equal(first.paragraphTranslation, 'First translated fragment continues.');
  assert.equal(first.paragraphDisplayTranslation, 'First translated fragment continues.');
  assert.equal(second.paragraphDisplayOffset, paragraphDisplayLength(first.translation));
  assert.equal(first.paragraphSourceText, 'First source fragment. Second source fragment.');
  assert.equal(second.paragraphSourceOffset, first.text.length + 1);
  assert.deepEqual([first.x, first.y, first.width, first.height, second.x, second.y], geometry);
});

function paragraphDisplayLength(text) {
  return text.length;
}

test('default-off path makes no continuation request and keeps ordinary block jobs', async () => {
  const f = fixture({ activity: false });
  await f.queue.processPage(f.pages[0], true);
  assert.equal(f.translationState.queue.length, 2);
  assert.deepEqual(
    f.translationState.queue.map((job) => job.block.id),
    [0, 1],
  );
  assert.equal(
    f.requests.some(({ path }) => path === '/api/paragraph-continuation'),
    false,
  );
});

test('group failures reset every member and retain original source fields', async () => {
  const f = fixture({
    allowed: [1],
    continuation: pairContinuation,
    api: async (path, body) => {
      if (path === '/api/translate' && !body.cacheOnly) throw Error('offline');
      return null;
    },
  });
  const first = f.pages[0].blocks[0],
    second = f.pages[0].blocks[1];
  await f.queue.processPage(f.pages[0], true);
  await waitForTranslation(f);
  assert.deepEqual([first.status, second.status], ['error', 'error']);
  assert.equal(first.translation, '');
  assert.equal(second.translation, '');
  assert.equal(first.text, 'First source fragment.');
  assert.equal(second.text, 'Second source fragment.');
});

test('scope pruning removes a queued cross-page group and resets every member', async () => {
  const pages = [
    page(1, [block(0, 'Continued before page break.')]),
    page(2, [block(0, 'Continued after page break.')]),
  ];
  const members = [
    { page: pages[0], block: pages[0].blocks[0] },
    { page: pages[1], block: pages[1].blocks[0] },
  ];
  let allowed = [1];
  const f = fixture({
    activity: false,
    pages,
    allowed,
    continuation: {
      groupFor: async () => ({
        id: '1:0',
        members,
        text: 'Continued before page break. Continued after page break.',
      }),
    },
  });
  f.scope.readingTranslationPages = () => allowed;
  f.scope.scopePages = () => new Set(allowed);
  await f.queue.processPage(pages[0]);
  assert.deepEqual([pages[0].blocks[0].status, pages[1].blocks[0].status], ['queued', 'queued']);
  allowed = [];
  f.translationState.translationDeferred.value = true;
  // Use the real scope implementation for the all-member retention rule.
  const scope = createTranslationScope({
    translationState: f.translationState,
    renderState: { layoutElement: ref(null), visiblePages: new Set() },
    preferences: { translationMode: ref('reading-ahead') },
    session: { pages: ref(pages) },
    view: { reader: ref(null), active: ref(1), direction: ref('vertical') },
  });
  scope.pruneTranslationQueue();
  assert.deepEqual([pages[0].blocks[0].status, pages[1].blocks[0].status], ['idle', 'idle']);
  assert.equal(f.translationState.queue.length, 0);
});

test('speculative layout loads deduplicate by page and epoch without marking the page detecting', async () => {
  let resolveLayout;
  let calls = 0;
  const target = page(3, []);
  target.status = 'idle';
  const f = fixture({
    pages: [...fixture().pages, target],
    activity: false,
    allowed: [1, 2, 3],
    api: async (path) => {
      if (path !== '/api/layout') return null;
      calls++;
      return new Promise((resolve) => (resolveLayout = resolve));
    },
  });
  const first = f.queue.ensureLayout(target);
  const second = f.queue.ensureLayout(target);
  assert.equal(calls, 1);
  assert.equal(target.status, 'idle');
  resolveLayout({ paragraphs: [block(0, 'Speculative layout.')] });
  assert.equal(await first, true);
  assert.equal(await second, true);
  assert.equal(target.status, 'idle');
  assert.equal(target.blocks.length, 1);
});

test('stale epoch cannot publish a group translation', async () => {
  let resolve;
  const f = fixture({
    activity: false,
    allowed: [1],
    continuation: pairContinuation,
    api: async (path, body) => {
      if (path === '/api/translate' && !body.cacheOnly)
        return new Promise(
          (r) => (resolve = () => r({ translation: 'stale result', cached: false, model: 'mock' })),
        );
      return null;
    },
  });
  await f.queue.processPage(f.pages[0], true);
  f.activity.foreground.value = true;
  f.queue.pump();
  await tick();
  f.session.epoch++;
  resolve();
  await tick();
  await tick();
  assert.equal(f.pages[0].blocks[0].translation, '');
  assert.equal(f.pages[0].blocks[1].translation, '');
});
