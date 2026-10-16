import assert from 'node:assert/strict';
import test from 'node:test';
import { createRenderer } from 'vue';
import { useAnnotationPersistence } from '../../src/features/annotations/useAnnotationPersistence.mjs';

function fixture(notifyCopy) {
  let result;
  const renderer = createRenderer({
    createComment: () => ({}),
    createElement: () => ({}),
    createText: () => ({}),
    insert() {},
    remove() {},
    setText() {},
    setElementText() {},
    patchProp() {},
    parentNode: () => null,
    nextSibling: () => null,
  });
  const app = renderer.createApp({
    setup() {
      result = useAnnotationPersistence(notifyCopy);
      return () => null;
    },
  });
  app.mount({});
  return { result, cleanup: () => app.unmount() };
}

test('flush retries the latest captured annotation snapshot after a failed save', async () => {
  const originalWindow = globalThis.window,
    notices = [],
    calls = [];
  let attempts = 0;
  globalThis.window = {
    previewAnnotations: {
      save: async (value) => {
        calls.push(value);
        if (++attempts === 1) throw new Error('offline');
      },
    },
  };
  const f = fixture((...args) => notices.push(args));
  try {
    f.result.annotationKey.value = 'document-before-close';
    f.result.annotationNativeRefs.value = [{ id: 'native-reference' }];
    f.result.saveAnnotations([
      {
        id: 'annotation',
        page: 1,
        animateUntil: 123,
      },
    ]);
    f.result.annotationKey.value = 'document-after-switch';

    await f.result.flushAnnotations();

    assert.equal(calls.length, 2);
    assert.deepEqual(calls[0], calls[1]);
    assert.equal(calls[0].key, 'document-before-close');
    assert.deepEqual(calls[0].nativeRefs, [{ id: 'native-reference' }]);
    assert.equal('animateUntil' in calls[0].annotations[0], false);
    assert.deepEqual(notices, [['批注保存失败：offline', 5000], ['批注已自动保存']]);
  } finally {
    f.cleanup();
    globalThis.window = originalWindow;
  }
});

test('flush rejects when the retry of the latest annotation snapshot fails', async () => {
  const originalWindow = globalThis.window,
    notices = [];
  let attempts = 0;
  globalThis.window = {
    previewAnnotations: {
      save: async () => {
        attempts++;
        throw new Error('still offline');
      },
    },
  };
  const f = fixture((...args) => notices.push(args));
  try {
    f.result.annotationKey.value = 'document';
    f.result.saveAnnotations([{ id: 'annotation', page: 1 }]);

    await assert.rejects(f.result.flushAnnotations(), /still offline/);

    assert.equal(attempts, 2);
    assert.deepEqual(notices, [
      ['批注保存失败：still offline', 5000],
      ['批注保存失败：still offline', 5000],
    ]);
  } finally {
    f.cleanup();
    globalThis.window = originalWindow;
  }
});
