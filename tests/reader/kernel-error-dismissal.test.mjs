import test from 'node:test';
import assert from 'node:assert/strict';
import { ref } from 'vue';
import { createKernelSettings } from '../../src/features/settings/kernel-settings.mjs';

test('document error dismissal persists across sessions and stays document-specific', async () => {
  const saved = new Map();
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key) => saved.get(key), setItem: (key, value) => saved.set(key, value) },
  });
  const previousWindow = globalThis.window;
  let nativePreferences = {};
  globalThis.window = {
    previewPreferences: {
      load: async () => nativePreferences,
      save: async (patch) => {
        nativePreferences = { ...nativePreferences, ...patch };
      },
    },
  };
  try {
    function open(id) {
      const kernel = {
        kernelFailure: ref(null),
        kernelIgnored: ref(false),
        kernelIgnoreUsed: ref(false),
        kernelDocumentIgnored: ref(false),
      };
      let reveals = 0;
      const settings = createKernelSettings({
        preferences: { engine: ref('pdf_math_fast') },
        session: { currentRecentId: id },
        kernel,
        runtime: {},
        actions: { rootActions: { revealHeader: () => reveals++ } },
      });
      return { kernel, settings, reveals: () => reveals };
    }
    const first = open('document-a');
    await first.settings.reportKernelFailure('HTTP 429: quota exhausted');
    assert.equal(first.reveals(), 1);
    await first.settings.ignoreKernelFailure();
    saved.clear(); // A new desktop launch may use a different local backend port.
    assert.equal(first.kernel.kernelDocumentIgnored.value, true);

    const reopened = open('document-a');
    await reopened.settings.reportKernelFailure('HTTP 401: invalid credentials');
    assert.equal(reopened.kernel.kernelDocumentIgnored.value, true);
    assert.equal(reopened.reveals(), 0);
    // Suppression preserves the actual failure and does not disable translation.
    assert.equal(reopened.kernel.kernelFailure.value.message, 'HTTP 401: invalid credentials');

    const other = open('document-b');
    await other.settings.reportKernelFailure('Connection refused');
    assert.equal(other.kernel.kernelDocumentIgnored.value, false);
    assert.equal(other.reveals(), 1);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});
