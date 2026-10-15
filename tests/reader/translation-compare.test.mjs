import assert from 'node:assert/strict';
import test from 'node:test';
import { nextTick, ref } from 'vue';
import { createTranslationCompare } from '../../src/features/translation/compare/translation-compare.mjs';

function deferred() {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
}

function fixture({ deferPage = false } = {}) {
  const foreground = ref(true);
  const pageGate = deferred();
  const gates = [];
  const renders = [];
  const pages = [];
  const canvases = [];
  const pdf = {
    async getPage() {
      if (deferPage) await pageGate.promise;
      const gate = deferred();
      gates.push(gate);
      const page = {
        getViewport: ({ scale }) => ({ width: 100 * scale, height: 200 * scale }),
        render() {
          const task = {
            promise: gate.promise,
            cancel() {
              gate.resolve();
            },
          };
          renders.push(task);
          return task;
        },
        cleanup() {
          pages.push(page);
        },
      };
      return page;
    },
  };
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement(tag) {
      assert.equal(tag, 'canvas');
      const canvas = { width: 0, height: 0, getContext: () => ({}) };
      canvases.push(canvas);
      return canvas;
    },
  };
  const compare = createTranslationCompare({
    session: {
      documentId: 'doc',
      pages: ref([{ width: 100, height: 200 }]),
      pdf,
    },
    preferences: { translationCompareEnabled: ref(true) },
    provider: {},
    kernel: {},
    activity: { foreground },
  });
  compare.compareOpen.value = true;
  return {
    compare,
    foreground,
    pageGate,
    gates,
    renders,
    pages,
    canvases,
    restore() {
      if (previousDocument === undefined) delete globalThis.document;
      else globalThis.document = previousDocument;
    },
  };
}

test('inactive comparison cancels original rendering and reactivation starts a fresh frame', async () => {
  const f = fixture();
  try {
    const first = f.compare.compareOriginalPage(1, 100);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(f.renders.length, 1);
    assert.deepEqual([f.canvases[0].width, f.canvases[0].height], [100, 200]);

    f.foreground.value = false;
    assert.deepEqual([f.canvases[0].width, f.canvases[0].height], [0, 0]);
    await assert.rejects(first, { name: 'AbortError' });
    assert.equal(f.pages.length, 1, 'the cancelled PDF page is cleaned up');

    f.foreground.value = true;
    await nextTick();
    const second = f.compare.compareOriginalPage(1, 100);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(f.renders.length, 2, 'reactivation does not reuse the invalidated render');
    f.gates[1].resolve();
    const source = await second;
    assert.deepEqual([source.width, source.height], [100, 200]);
  } finally {
    f.restore();
  }
});

test('inactivity invalidates a settled original cache entry', async () => {
  const f = fixture();
  try {
    f.compare.compareOpen.value = true;
    const source = f.compare.compareOriginalPage(1, 100);
    await new Promise((resolve) => setImmediate(resolve));
    f.gates[0].resolve();
    const settled = await source;
    assert.deepEqual([settled.width, settled.height], [100, 200]);

    f.foreground.value = false;
    assert.deepEqual([settled.width, settled.height], [0, 0]);
    assert.equal(f.pages.length, 1);
    await assert.rejects(f.compare.compareOriginalPage(1, 100), { name: 'AbortError' });
    assert.equal(f.renders.length, 1, 'suspended calls do not start another PDF render');
  } finally {
    f.restore();
  }
});

test('a page resolving after suspension cannot populate the original cache', async () => {
  const f = fixture({ deferPage: true });
  try {
    f.compare.compareOpen.value = true;
    const pending = f.compare.compareOriginalPage(1, 100);
    f.foreground.value = false;
    f.pageGate.resolve();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(f.renders.length, 0, 'the late page never starts rendering');
    assert.equal(f.canvases.length, 0, 'the late page never creates a bitmap');
    assert.equal(f.pages.length, 1, 'the late page proxy is cleaned up');
  } finally {
    f.restore();
  }
});

test('comparison factory does not eagerly read a lazy foreground port', () => {
  let foreground;
  const activity = {};
  Object.defineProperty(activity, 'foreground', {
    get() {
      if (!foreground) throw Error('foreground is not initialized');
      return foreground;
    },
  });
  const compare = createTranslationCompare({
    session: { pages: ref([]) },
    preferences: { translationCompareEnabled: ref(true) },
    provider: {},
    kernel: {},
    activity,
  });
  foreground = ref(true);
  assert.equal(compare.compareForeground.value, true);
});
