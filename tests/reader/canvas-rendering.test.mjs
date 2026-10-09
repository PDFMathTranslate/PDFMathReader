import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
// Isolate decorative motion (and its browser-only PDF worker import) while
// exercising the production scheduler, task ownership and frame presentation.
const sourceURL = new URL('../../src/features/reader/canvas-rendering.mjs', import.meta.url);
const source = (await readFile(sourceURL, 'utf8'))
  .replace(
    "'./render-resolution.mjs'",
    JSON.stringify(new URL('./render-resolution.mjs', sourceURL).href),
  )
  .replace("'vue'", JSON.stringify(import.meta.resolve('vue')))
  .replace(
    "import { snapshot, revealPDF } from '../../ui/motion/text-reveal.mjs';",
    `const snapshot = (canvas) => canvas?.width ? { width: canvas.width, height: canvas.height } : null;
    const revealPDF = async (options) => options.host.reveals.push(options);`,
  );
const { createCanvasRendering } = await import(
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
);

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
};
function fixture() {
  const oldDocument = globalThis.document;
  const oldRatio = globalThis.devicePixelRatio;
  const oldEvent = globalThis.CustomEvent;
  const canvas = (number) => ({
    width: 0,
    height: 0,
    isConnected: true,
    closest: () => (number ? { dataset: { page: number } } : null),
    parentElement: { dataset: { page: number } },
    style: { setProperty() {} },
    getContext: () => ({ clearRect() {}, drawImage() {} }),
    dispatchEvent() {},
  });
  globalThis.document = { createElement: () => canvas() };
  globalThis.devicePixelRatio = 2;
  globalThis.CustomEvent = class {};
  const state = {
    pageEls: new Map(
      [1, 2, 3].map((n) => [
        n,
        {
          reveals: [],
          getBoundingClientRect: () => ({ top: 0, bottom: 200, left: 0, right: 100 }),
        },
      ]),
    ),
    revealControllers: new Set(),
    canvasEls: new Map([1, 2, 3].map((n) => [n, canvas(n)])),
    thumbEls: new Map(),
    pageTasks: new Map(),
    canvasCache: new Map(),
    bitmapFrames: new Map(),
    bitmapIds: new WeakMap(),
    bitmapId: 0,
    renderEpoch: 0,
    visiblePages: new Set([1, 2, 3]),
    renderWindow: { value: new Set([1, 2, 3]) },
    renderMetrics: { pageFrames: 0, firstPageMs: null, openedAt: 0, peakResidentBytes: 0 },
  };
  const pages = [1, 2, 3].map((number) => ({ number, blocks: [] }));
  const pdfPages = pages.map(() => ({
    getViewport: ({ scale }) => ({ width: 100 * scale, height: 200 * scale }),
    render: () => ({ promise: Promise.resolve(), cancel() {} }),
  }));
  const pdf = { getPage: async (number) => pdfPages[number - 1] };
  const view = {
    zoom: { value: 1 },
    active: { value: 1 },
    pageCrop: { value: {} },
    showTranslations: { value: false },
    fitMode: { value: 'manual' },
    reader: {
      value: { getBoundingClientRect: () => ({ top: 0, bottom: 200, left: 0, right: 100 }) },
    },
  };
  const renderer = createCanvasRendering({
    renderState: state,
    session: { pdf },
    motion: { pinching: { value: false } },
    view,
    activity: { foreground: { value: true }, performanceRecorder: { painted() {} } },
    actions: {
      readerViewport: { viewportPages: () => pages },
      rootActions: { displayedPage: (p) => p },
      readerFit: { updateReaderInsets: () => false },
    },
  });
  return {
    state,
    pdf,
    pdfPages,
    pages,
    view,
    renderer,
    restore() {
      globalThis.document = oldDocument;
      globalThis.devicePixelRatio = oldRatio;
      globalThis.CustomEvent = oldEvent;
    },
  };
}

test('translation toggles refocus mounted visible pages in both directions, including warm frames', async () => {
  const f = fixture();
  const translated = {
    getViewport: f.pdfPages[0].getViewport,
    render: f.pdfPages[0].render,
  };
  f.pages[0].mathDocument = { getPage: async () => translated };
  f.pages[1].mathDocument = { getPage: async () => translated };
  f.state.visiblePages = new Set([1]);
  try {
    await f.renderer.renderPages();
    for (const enabled of [true, false, true]) {
      f.view.showTranslations.value = enabled;
      await f.renderer.renderPages(true);
      await new Promise((resolve) => setImmediate(resolve));
      const reveals = f.state.pageEls.get(1).reveals;
      assert.equal(reveals.at(-1).page, enabled ? translated : f.pdfPages[0]);
      assert.equal(f.state.pageEls.get(2).reveals.length, 0);
    }
    assert.equal(f.state.pageEls.get(1).reveals.length, 3);
    assert.equal(f.state.revealControllers.size, 0);
  } finally {
    f.restore();
  }
});

test('a delayed visible page does not block painting its visible neighbours', async () => {
  const f = fixture(),
    gate = deferred();
  const original = f.pdf.getPage;
  f.pdf.getPage = async (number) => {
    if (number === 1) await gate.promise;
    return original(number);
  };
  try {
    const rendering = f.renderer.renderPages();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(f.state.canvasEls.get(1).width, 0);
    assert.ok(f.state.canvasEls.get(2).width > 0);
    assert.ok(f.state.canvasEls.get(3).width > 0);
    gate.resolve();
    await rendering;
    assert.ok(f.state.canvasEls.get(1).width > 0);
  } finally {
    gate.resolve();
    f.restore();
  }
});

test('scroll preview reuses an in-flight sharper frame instead of cancelling it', async () => {
  const f = fixture(),
    gate = deferred();
  let renders = 0,
    cancellations = 0;
  f.pdfPages[0].render = () => {
    renders++;
    return { promise: gate.promise, cancel: () => cancellations++ };
  };
  try {
    const target = f.state.canvasEls.get(1);
    const sharp = f.renderer.draw(f.pdfPages[0], target, 30);
    const scrolling = f.renderer.draw(f.pdfPages[0], target, 30, true);
    assert.equal(renders, 1);
    assert.equal(cancellations, 0);
    gate.resolve();
    assert.deepEqual(await Promise.all([sharp, scrolling]), [true, true]);
    assert.ok(target.width > 0);
  } finally {
    gate.resolve();
    f.restore();
  }
});

test('prefetch uses only the bounded frame cache and presents immediately on visibility', async () => {
  const f = fixture();
  f.state.visiblePages = new Set([1]);
  try {
    await f.renderer.renderPages();
    assert.ok(f.state.canvasEls.get(1).width > 0);
    assert.equal(f.state.canvasEls.get(2).width, 0);
    assert.equal(f.state.canvasEls.get(3).width, 0);
    assert.equal(f.state.bitmapFrames.size, 3);
    f.state.visiblePages.add(2);
    f.pdfPages[1].render = () => {
      throw Error('Warm frame must not rerender');
    };
    assert.equal(await f.renderer.draw(f.pdfPages[1], f.state.canvasEls.get(2), 1), true);
    assert.ok(f.state.canvasEls.get(2).width > 0);
    f.state.visiblePages.delete(1);
    await f.renderer.renderPages();
    assert.equal(f.state.canvasEls.get(1).width, 0);
  } finally {
    f.restore();
  }
});

test('a prefetched preview stays visible while its sharper replacement is pending', async () => {
  const f = fixture(),
    gate = deferred();
  const target = f.state.canvasEls.get(2),
    page = f.pdfPages[1];
  try {
    f.state.visiblePages.delete(2);
    await f.renderer.draw(page, target, 30, true);
    assert.equal(target.width, 0);
    f.state.visiblePages.add(2);
    page.render = () => ({ promise: gate.promise, cancel() {} });
    const drawing = f.renderer.draw(page, target, 30);
    const previewWidth = target.width;
    assert.ok(previewWidth > 0, 'Show warm preview without waiting for sharp render');
    gate.resolve();
    await drawing;
    assert.ok(target.width > previewWidth);
  } finally {
    gate.resolve();
    f.restore();
  }
});

test('reader scroll keeps sidebar thumbnail tasks alive through continuation and page rendering', async () => {
  const f = fixture(),
    gate = deferred();
  const oldRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (fn) => {
    fn();
    return 1;
  };
  let cancellations = 0,
    continued = false;
  const task = { promise: gate.promise, cancel: () => cancellations++ };
  const page = { getViewport: () => ({ width: 128, height: 160 }), render: () => task };
  const target = { ...f.state.canvasEls.get(1), closest: () => null };
  f.state.thumbEls.set(106, target);
  f.state.previewScrolling = true;
  try {
    const drawing = f.renderer.draw(page, target, 1);
    task.onContinue(() => {
      continued = true;
    });
    await f.renderer.renderPages();
    assert.equal(continued, true);
    assert.equal(cancellations, 0);
    gate.resolve();
    assert.equal(await drawing, true);
    assert.ok(target.width > 0);
  } finally {
    gate.resolve();
    f.restore();
    globalThis.requestAnimationFrame = oldRaf;
  }
});

test('bitmap eviction preserves the thumbnail window for foreground repaint', async () => {
  const f = fixture();
  f.state.visibleThumbnails = new Set([106, 107]);
  f.state.thumbnailEpoch = 0;
  const target = { ...f.state.canvasEls.get(1), closest: () => null };
  f.state.thumbEls.set(106, target);
  try {
    await f.renderer.draw(f.pdfPages[0], target, 1);
    assert.ok(target.width > 0);
    f.renderer.resetBitmaps();
    assert.equal(target.width, 0);
    assert.deepEqual([...f.state.visibleThumbnails], [106, 107]);
    assert.equal(await f.renderer.draw(f.pdfPages[0], target, 1), true);
    assert.ok(target.width > 0);
  } finally {
    f.restore();
  }
});
