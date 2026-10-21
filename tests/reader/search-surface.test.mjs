import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectScope, isRef, nextTick, ref } from 'vue';
import { createReaderDocumentSurface } from '../../src/features/reader/document-surface.mjs';

test('reader surface forwards the mode used by actual document searches', async () => {
  const previousWindow = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  const scope = effectScope();
  const noop = () => {};
  let surface;
  try {
    surface = scope.run(() =>
      createReaderDocumentSurface({
        session: { pdf: {}, epoch: 1 },
        renderState: { pageEls: new Map() },
        motion: { referenceReturn: ref(null), referenceNavigation: 0 },
        pages: ref([
          {
            number: 1,
            blocks: [{ translation: 'Beta alpha', x: 0, y: 0, width: 100, height: 10 }],
          },
        ]),
        loading: ref(false),
        restoringView: ref(false),
        reader: ref(null),
        settings: ref(false),
        zoom: ref(1),
        showTranslations: ref(true),
        interactionMode: ref('reading'),
        readingView: noop,
        renderPages: noop,
        go: noop,
        viewportPages: noop,
        scheduleViewport: noop,
        scheduleReadingSave: noop,
        active: ref(1),
        documentOutline: ref([]),
        foreground: ref(true),
        error: ref(''),
      }),
    );
    assert.ok(isRef(surface.searchMode), 'the reader must expose the engine mode ref');
    surface.searchOpen.value = true;
    surface.searchQuery.value = 'alpha beta';
    const settle = async () => {
      await nextTick();
      await new Promise((r) => setTimeout(r, 250));
    };
    await settle();
    assert.equal(surface.searchResults.value.length, 1);
    surface.searchMode.value = 'exact';
    await settle();
    assert.equal(surface.searchResults.value.length, 0);
    surface.searchMode.value = 'regex';
    surface.searchQuery.value = 'beta\\s+alpha';
    await settle();
    assert.equal(surface.searchResults.value.length, 1);
    assert.equal(surface.searchFailure.value, '');
  } finally {
    surface?.closeSearch();
    scope.stop();
    globalThis.window = previousWindow;
  }
});
