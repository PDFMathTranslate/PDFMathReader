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
  .replace(
    "import { animateParagraphGaps } from './paragraph-gap-motion.mjs';",
    'const animateParagraphGaps = () => {};',
  )
  .replace(
    "import { normalizeBionicReading } from '../translation/bionic-reading.mjs';",
    `const normalizeBionicReading = ({ mode, fixedLength } = {}) => {
      const length = Math.round(Number(fixedLength));
      return {
        mode: ['off', 'fixed', 'root'].includes(mode) ? mode : 'off',
        fixedLength: Number.isFinite(length) ? Math.min(6, Math.max(1, length)) : 3,
      };
    };`,
  )
  .replace(
    "import { bionicRenderOptions, mergeGlyphPlans } from './bionic-rendering.mjs';",
    `const bionicRenderOptions = async (page, options) => {
      const key = options.mode === 'off' ? '' : 'bionic:' + options.mode + ':' + options.fixedLength;
      await page.bionicPlans?.get(key)?.promise;
      return { key, render: key ? { bionicGlyphs: key } : {} };
    };
    const mergeGlyphPlans = (...plans) => plans.filter(Boolean).join('|') || null;`,
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
    bionicPlans: new Map(),
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
  const preferences = {
    bionicReading: { value: 'off' },
    bionicFixedLength: { value: 3 },
    bionicOriginalOnly: { value: true },
  };
  const tfidfWeighting = {
    on: false,
    enabled() {
      return this.on;
    },
    renderOptions: async () => ({ key: 'tfidf', plan: 'tfidf-plan' }),
  };
  const fontSubstitution = {
    options: null,
    translatedOptions: null,
    renderOptions(translated) {
      return translated ? this.translatedOptions : this.options;
    },
  };
  const renderer = createCanvasRendering({
    renderState: state,
    session: { pdf, pages: { value: pages } },
    motion: { pinching: { value: false } },
    preferences,
    tfidfWeighting,
    fontSubstitution,
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
    preferences,
    tfidfWeighting,
    fontSubstitution,
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

for (const [shape, fail] of [
  ['a rejected render task', () => ({ promise: Promise.reject(Error('boom')), cancel() {} })],
  [
    'a render call that throws',
    () => {
      throw Error('boom');
    },
  ],
]) {
  test(`${shape} neither aborts the pass nor leaves its visible page blank`, async () => {
    const f = fixture(),
      render = f.pdfPages[1].render,
      error = console.error;
    let attempts = 0;
    f.pdfPages[1].render = (options) => (attempts++ ? render(options) : fail());
    console.error = () => {};
    try {
      await f.renderer.renderPages();
      assert.ok(f.state.canvasEls.get(1).width > 0);
      assert.ok(f.state.canvasEls.get(3).width > 0, 'pages after the failure still paint');
      assert.equal(f.state.canvasEls.get(2).width, 0);
      await new Promise((resolve) => setTimeout(resolve, 600));
      assert.ok(f.state.canvasEls.get(2).width > 0, 'the empty visible page is painted again');
      assert.equal(attempts, 2);
    } finally {
      console.error = error;
      f.renderer.resetBitmaps();
      f.restore();
    }
  });
}

test('a visible page that stays empty is retried a bounded number of times', async () => {
  const f = fixture(),
    error = console.error;
  let attempts = 0;
  f.pdfPages[1].render = () => {
    attempts++;
    return { promise: Promise.reject(Error('boom')), cancel() {} };
  };
  console.error = () => {};
  try {
    await f.renderer.renderPages();
    await new Promise((resolve) => setTimeout(resolve, 2500));
    assert.equal(attempts, 4);
    assert.equal(f.state.canvasEls.get(2).width, 0);
  } finally {
    console.error = error;
    f.renderer.resetBitmaps();
    f.restore();
  }
});

test('a cached frame is not trusted once its canvas has been emptied', async () => {
  const f = fixture(),
    target = f.state.canvasEls.get(1);
  try {
    assert.equal(await f.renderer.draw(f.pdfPages[0], target, 1), true);
    target.width = target.height = 0;
    f.pdfPages[0].render = () => {
      throw Error('The shared bitmap must be reused');
    };
    assert.equal(await f.renderer.draw(f.pdfPages[0], target, 1), true);
    assert.ok(target.width > 0);
  } finally {
    f.restore();
  }
});

test('bionic render keys separate canvas, task, and bitmap reuse', async () => {
  const f = fixture(),
    target = f.state.canvasEls.get(1),
    page = f.pdfPages[0],
    options = [];
  page.render = (renderOptions) => {
    options.push(renderOptions);
    return { promise: Promise.resolve(), cancel() {} };
  };
  try {
    f.preferences.bionicReading.value = 'fixed';
    f.preferences.bionicFixedLength.value = 2;
    assert.equal(await f.renderer.draw(page, target, 1), true);
    assert.equal(options.length, 1);
    assert.equal(options[0].bionicGlyphs, 'bionic:fixed:2');
    assert.equal(f.state.canvasCache.get(target).bionicKey, 'bionic:fixed:2');
    assert.ok([...f.state.bitmapFrames.keys()].some((key) => key.endsWith(':bionic:fixed:2')));

    f.preferences.bionicFixedLength.value = 3;
    assert.equal(await f.renderer.draw(page, target, 1), true);
    assert.equal(options.length, 2);
    assert.equal(f.state.canvasCache.get(target).bionicKey, 'bionic:fixed:3');

    f.preferences.bionicReading.value = 'off';
    assert.equal(await f.renderer.draw(page, target, 1), true);
    assert.equal(options.length, 3);
    assert.equal(options[2].bionicGlyphs, undefined);
    assert.equal(f.state.canvasCache.get(target).bionicKey, '');
  } finally {
    f.restore();
  }
});

test('TF-IDF weighting joins bionic glyphs on original pages only', async () => {
  const f = fixture(),
    target = f.state.canvasEls.get(1),
    translatedOptions = [],
    translated = {
      getViewport: f.pdfPages[0].getViewport,
      render: (options) => {
        translatedOptions.push(options);
        return { promise: Promise.resolve(), cancel() {} };
      },
    };
  f.pages[0].mathDocument = { getPage: async () => translated };
  f.tfidfWeighting.on = true;
  try {
    await f.renderer.renderPages();
    assert.equal(f.state.canvasCache.get(target).bionicKey, 'tfidf');
    f.preferences.bionicReading.value = 'fixed';
    await f.renderer.renderPages();
    assert.equal(f.state.canvasCache.get(target).bionicKey, 'bionic:fixed:3+tfidf');
    // Translated pages never get TF-IDF, even when bionic reading covers them.
    f.preferences.bionicOriginalOnly.value = false;
    f.view.showTranslations.value = true;
    await f.renderer.renderPages();
    assert.equal(translatedOptions.at(-1).bionicGlyphs, 'bionic:fixed:3');
    assert.equal(f.state.canvasCache.get(target).bionicKey, 'bionic:fixed:3');
    assert.equal(
      f.state.canvasCache.get(f.state.canvasEls.get(2)).bionicKey,
      'bionic:fixed:3+tfidf',
    );
    f.tfidfWeighting.on = false;
    f.view.showTranslations.value = false;
    await f.renderer.renderPages();
    assert.equal(f.state.canvasCache.get(target).bionicKey, 'bionic:fixed:3');
  } finally {
    f.restore();
  }
});

for (const mode of ['fixed', 'root']) {
  test(`original-only ${mode} reading follows the displayed document and refreshes warm frames`, async () => {
    const f = fixture(),
      target = f.state.canvasEls.get(1),
      translatedOptions = [],
      translated = {
        getViewport: f.pdfPages[0].getViewport,
        render: (options) => {
          translatedOptions.push(options);
          return { promise: Promise.resolve(), cancel() {} };
        },
      };
    f.pages[0].mathDocument = { getPage: async () => translated };
    f.preferences.bionicReading.value = mode;
    try {
      await f.renderer.renderPages();
      assert.equal(f.state.canvasCache.get(target).bionicKey, `bionic:${mode}:3`);
      f.view.showTranslations.value = true;
      await f.renderer.renderPages();
      assert.equal(translatedOptions.at(-1).bionicGlyphs, undefined);
      assert.equal(f.state.canvasCache.get(target).bionicKey, '');
      assert.equal(
        f.state.canvasCache.get(f.state.canvasEls.get(2)).bionicKey,
        `bionic:${mode}:3`,
        'untranslated pages still show original glyph emphasis',
      );

      f.preferences.bionicOriginalOnly.value = false;
      await f.renderer.renderPages();
      assert.equal(translatedOptions.at(-1).bionicGlyphs, `bionic:${mode}:3`);
      f.preferences.bionicOriginalOnly.value = true;
      await f.renderer.renderPages();
      assert.equal(f.state.canvasCache.get(target).bionicKey, '');
      assert.equal(translatedOptions.length, 2, 'warm plain translation frame is reused');
      f.view.showTranslations.value = false;
      await f.renderer.renderPages();
      assert.equal(f.state.canvasCache.get(target).bionicKey, `bionic:${mode}:3`);
    } finally {
      f.restore();
    }
  });
}

test('enabling original-only rejects an in-flight translated bionic frame', async () => {
  const f = fixture(),
    gate = deferred(),
    target = f.state.canvasEls.get(1);
  const translated = {
    getViewport: f.pdfPages[0].getViewport,
    render: () => ({ promise: gate.promise, cancel() {} }),
  };
  f.preferences.bionicReading.value = 'fixed';
  f.preferences.bionicOriginalOnly.value = false;
  try {
    const drawing = f.renderer.draw(translated, target, 1, false, true);
    await new Promise((resolve) => setImmediate(resolve));
    f.preferences.bionicOriginalOnly.value = true;
    gate.resolve();
    assert.equal(await drawing, false);
    assert.equal(target.width, 0);
    assert.equal(f.state.bitmapFrames.size, 0);
    assert.equal(await f.renderer.draw(translated, target, 1, false, true), true);
    assert.equal(f.state.canvasCache.get(target).bionicKey, '');
  } finally {
    gate.resolve();
    f.restore();
  }
});

test('a stale bionic plan cannot start rendering after settings change', async () => {
  const f = fixture(),
    target = f.state.canvasEls.get(1),
    page = f.pdfPages[0],
    plan = deferred(),
    options = [];
  page.bionicPlans.set('bionic:fixed:2', plan);
  page.render = (renderOptions) => {
    options.push(renderOptions);
    return { promise: Promise.resolve(), cancel() {} };
  };
  try {
    f.preferences.bionicReading.value = 'fixed';
    f.preferences.bionicFixedLength.value = 2;
    const stale = f.renderer.draw(page, target, 1);
    await new Promise((resolve) => setImmediate(resolve));
    f.preferences.bionicReading.value = 'off';
    plan.resolve();
    assert.equal(await stale, false);
    assert.equal(options.length, 0);

    assert.equal(await f.renderer.draw(page, target, 1), true);
    assert.equal(options.length, 1);
    assert.equal(options[0].bionicGlyphs, undefined);
    assert.equal(f.state.canvasCache.get(target).bionicKey, '');
  } finally {
    plan.resolve();
    f.restore();
  }
});

test('an in-flight bionic frame cannot present after settings change', async () => {
  const f = fixture(),
    target = f.state.canvasEls.get(1),
    page = f.pdfPages[0],
    gate = deferred(),
    options = [];
  page.render = (renderOptions) => {
    options.push(renderOptions);
    return { promise: gate.promise, cancel() {} };
  };
  try {
    f.preferences.bionicReading.value = 'fixed';
    f.preferences.bionicFixedLength.value = 2;
    const stale = f.renderer.draw(page, target, 1);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(options.length, 1);
    f.preferences.bionicReading.value = 'off';
    gate.resolve();
    assert.equal(await stale, false);
    assert.equal(target.width, 0);
    assert.equal(f.state.bitmapFrames.size, 0);

    assert.equal(await f.renderer.draw(page, target, 1), true);
    assert.equal(options.length, 2);
    assert.equal(options[1].bionicGlyphs, undefined);
    assert.equal(target.width > 0, true);
  } finally {
    gate.resolve();
    f.restore();
  }
});

test('a settled frame replaces its scroll preview and serves later previews', async () => {
  const f = fixture();
  f.state.visiblePages = new Set([1]);
  let renders = 0;
  const render = f.pdfPages[0].render;
  f.pdfPages[0].render = (...args) => {
    renders++;
    return render(...args);
  };
  try {
    const target = f.state.canvasEls.get(1);
    // At this zoom the preview budget cannot hold a 2x frame.
    assert.equal(await f.renderer.draw(f.pdfPages[0], target, 10, true), true);
    assert.equal(await f.renderer.draw(f.pdfPages[0], target, 10), true);
    assert.equal(renders, 2);
    assert.equal(f.state.bitmapFrames.size, 1);
    f.renderer.releaseCanvas(target);
    assert.equal(await f.renderer.draw(f.pdfPages[0], target, 10, true), true);
    assert.equal(renders, 2);
    assert.equal(target.width, 2000);
  } finally {
    f.restore();
  }
});

test('local fonts follow the shown document and refresh their warm frames', async () => {
  const f = fixture(),
    target = f.state.canvasEls.get(1),
    originalOptions = [],
    translatedOptions = [],
    translated = {
      getViewport: f.pdfPages[0].getViewport,
      render: (options) => {
        translatedOptions.push(options);
        return { promise: Promise.resolve(), cancel() {} };
      },
    };
  f.pdfPages[0].render = (options) => {
    originalOptions.push(options);
    return { promise: Promise.resolve(), cancel() {} };
  };
  f.pages[0].mathDocument = { getPage: async () => translated };
  try {
    await f.renderer.renderPages();
    assert.equal(originalOptions.at(-1).fontSubstitution, undefined);
    f.fontSubstitution.options = {
      key: 'font:Iowan|',
      render: { fontSubstitution: 'local-fonts' },
    };
    await f.renderer.renderPages();
    assert.equal(originalOptions.at(-1).fontSubstitution, 'local-fonts');
    assert.equal(f.state.canvasCache.get(target).filter, 'font:Iowan|');
    f.view.showTranslations.value = true;
    await f.renderer.renderPages();
    assert.equal(translatedOptions.at(-1).fontSubstitution, undefined);
    assert.equal(f.state.canvasCache.get(target).filter, '');
    f.fontSubstitution.translatedOptions = {
      key: 'font:|PingFang|',
      render: { fontSubstitution: 'translated-fonts' },
    };
    await f.renderer.renderPages();
    assert.equal(translatedOptions.at(-1).fontSubstitution, 'translated-fonts');
    assert.equal(f.state.canvasCache.get(target).filter, 'font:|PingFang|');
  } finally {
    f.restore();
  }
});
