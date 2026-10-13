import assert from 'node:assert/strict';
import test from 'node:test';
import { effect, reactive, ref, stop } from 'vue';
import { createReaderViewport } from '../../src/features/reader/reader-viewport.mjs';

function readerViewport(bounds) {
  const pages = ref(reactive([1, 2, 3].map((number) => ({ number, visible: 0 }))));
  const layout = {
    columns: 1,
    rows: [0, 1, 2].map((i) => ({ offset: i * 110, extent: 100, start: i, end: i + 1 })),
    frames: [0, 1, 2].map((i) => ({ number: i + 1, x: 0, y: i * 110, width: 100, height: 100 })),
  };
  const rect = (r) => ({ getBoundingClientRect: () => r });
  const renderState = {
    layoutElement: { value: rect({ left: 0, top: 0 }) },
    renderMetrics: { viewportLookups: 0, geometryReads: 0 },
    visiblePages: new Set(),
    renderWindow: ref(new Set()),
    canvasEls: new Map(),
  };
  const viewport = createReaderViewport({
    renderState,
    session: { pages, restoringView: { value: false } },
    motion: { pinching: { value: false }, referenceReturn: { value: null } },
    view: { reader: { value: rect(bounds) }, pageLayout: { value: layout }, active: ref(1) },
    activity: { foreground: { value: true } },
    actions: { canvasRendering: { releaseCanvas() {} } },
  });
  return { pages, viewport };
}

test('repeating an unchanged viewport lookup does not touch page visibility', () => {
  const { pages, viewport } = readerViewport({ left: 0, right: 100, top: 50, bottom: 150 });
  viewport.viewportPages();
  let runs = 0;
  const runner = effect(() => {
    for (const page of pages.value) void page.visible;
    runs++;
  });
  runs = 0;
  viewport.viewportPages();
  stop(runner);
  // A reset-then-restore would re-run pageLayout and schedule another lookup.
  assert.equal(runs, 0);
  assert.deepEqual(
    pages.value.map((page) => page.visible),
    [0.5, 0.4, 0],
  );
});

test('pages that scroll out of the viewport are cleared', () => {
  const bounds = { left: 0, right: 100, top: 50, bottom: 150 };
  const { pages, viewport } = readerViewport(bounds);
  viewport.viewportPages();
  Object.assign(bounds, { top: 220, bottom: 320 });
  viewport.viewportPages();
  assert.deepEqual(
    pages.value.map((page) => page.visible),
    [0, 0, 1],
  );
});
