import test from 'node:test';
import assert from 'node:assert/strict';
import { createReaderTasks } from '../../src/features/translation/reader-tasks.mjs';

function ref(value) {
  return { value };
}

function deferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function fixture() {
  const posts = [];
  const gates = [];
  const deletes = [];
  const api = async (path, options = {}) => {
    if (path === '/api/reader-tasks') {
      const body = JSON.parse(options.body);
      const gate = deferred();
      posts.push(body);
      gates.push({ body, ...gate });
      return gate.promise;
    }
    if (path.startsWith('/api/reader-tasks/') && options.method === 'DELETE') {
      deletes.push(path);
      return {};
    }
    throw Error(`Unexpected API request: ${path}`);
  };
  const session = {
    documentId: 'document',
    epoch: 1,
    pages: ref(Array.from({ length: 3 }, (_, index) => ({ number: index + 1, height: 800 }))),
  };
  const preferences = {
    engine: ref('pdf_inspector'),
    language: ref('English'),
    sourceLanguage: ref(''),
    concurrency: ref(2),
    pageConcurrency: ref(2),
    reuseTranslations: ref(true),
    paragraphContinuationDetection: ref(false),
    jevApiToken: ref(''),
    remoteKernelEnabled: ref(false),
    remoteKernelUrl: ref(''),
    remoteKernelService: ref(''),
    loadingPreferences: false,
  };
  const translationState = {
    forceRetranslation: false,
    translateAllPages: false,
    running: 0,
    pageRunning: 0,
    queue: [],
    pageQueue: [],
  };
  const tasks = createReaderTasks({
    session,
    preferences,
    translationState,
    provider: {
      activeGlossary: ref([]),
      currentTranslationService: ref({ id: 'auto', values: {} }),
    },
    activity: { foreground: ref(true) },
    actions: {
      backendRequests: { api },
      preferencePersistence: { currentKernelAdvancedOptions: () => ({}) },
      translationScope: { readingTranslationPages: () => [] },
    },
  });
  return { tasks, posts, gates, deletes, session, preferences };
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 50; attempt++) {
    if (predicate()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.ok(predicate(), 'condition did not settle');
}

function response(id, body) {
  return {
    id,
    state: 'running',
    pages: body.pages.map(({ number }) => ({ number, state: 'queued', progress: null })),
    completed: 0,
    total: body.pages.length,
  };
}

test('coalesces overlapping manual scopes before resolving either caller', async () => {
  const f = fixture();
  const first = f.tasks.submitScope({ pages: [1], layoutPages: [1] });
  await waitFor(() => f.gates.length === 1);

  const second = f.tasks.submitScope({ pages: [2], layoutPages: [2] });
  f.gates[0].resolve(response('task-1', f.gates[0].body));
  await waitFor(() => f.gates.length === 2);
  f.gates[1].resolve(response('task-1', f.gates[1].body));

  const [firstResult, secondResult] = await Promise.all([first, second]);
  assert.deepEqual(
    f.posts.map((body) => body.pages.map(({ number }) => number)),
    [[1], [1, 2]],
  );
  assert.deepEqual(firstResult.pages, [1, 2]);
  assert.deepEqual(secondResult.pages, [1, 2]);
  assert.equal(firstResult.taskId, 'task-1');
});

test('cancels an in-flight submission and deletes its stale task result', async () => {
  const f = fixture();
  const pending = f.tasks.submitScope({ pages: [1], layoutPages: [1] });
  await waitFor(() => f.gates.length === 1);

  await f.tasks.cancelTranslationTask();
  f.gates[0].resolve(response('stale-task', f.gates[0].body));

  assert.equal(await pending, null);
  assert.deepEqual(f.deletes, ['/api/reader-tasks/stale-task']);
  assert.equal(f.tasks.readerTaskSnapshot(), null);
});

test('settings changes supersede an in-flight task before creating the replacement', async () => {
  const f = fixture();
  const oldTask = f.tasks.submitScope({ pages: [1], layoutPages: [1] });
  await waitFor(() => f.gates.length === 1);

  f.preferences.language.value = 'Japanese';
  const newTask = f.tasks.submitScope({ pages: [2], layoutPages: [2] });
  f.gates[0].resolve(response('obsolete-task', f.gates[0].body));
  await waitFor(() => f.gates.length === 2);
  assert.deepEqual(f.deletes, ['/api/reader-tasks/obsolete-task']);
  f.gates[1].resolve(response('replacement-task', f.gates[1].body));

  assert.equal(await oldTask, null);
  const result = await newTask;
  assert.equal(result.taskId, 'replacement-task');
  assert.equal(f.posts[1].settings.language, 'Japanese');
});

test('restores a task snapshot without submitting a duplicate task', async () => {
  const original = fixture();
  const pending = original.tasks.submitScope({ pages: [1], layoutPages: [1] });
  await waitFor(() => original.gates.length === 1);
  original.gates[0].resolve(response('restored-task', original.gates[0].body));
  const snapshot = await pending;

  const restored = fixture();
  const metadata = await restored.tasks.restoreServiceMode(snapshot);
  const result = await restored.tasks.submitScope({ pages: [1], layoutPages: [1] });

  assert.equal(restored.posts.length, 0);
  assert.equal(metadata.taskId, 'restored-task');
  assert.equal(result.taskId, 'restored-task');
  assert.equal(result.settingsKey, snapshot.settingsKey);
});
