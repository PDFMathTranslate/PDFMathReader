import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { extendPDFRuntime } from '../../scripts/pdf-bionic-runtime.mjs';
import { bionicGlyphRuns, bionicGlyphPlan } from '../../src/features/reader/bionic-rendering.mjs';

test('PDF runtime extension fails closed when the glyph-paint hook changes', async () => {
  const source = await readFile('node_modules/pdfjs-dist/build/pdf.mjs', 'utf8');
  assert.doesNotThrow(() => extendPDFRuntime(source));
  assert.throws(() => extendPDFRuntime('changed runtime'), /needs review/);
});

test('native glyph plans join kerning, split font runs and hyphenated lines', async () => {
  const { OPS } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const fnArray = [],
    argsArray = [];
  const op = (name, ...args) => {
    fnArray.push(OPS[name]);
    argsArray.push(args);
  };
  const glyphs = (text) => [...text].map((unicode) => ({ unicode, width: 500 }));
  op('beginText');
  op('setFont', 'body', 10);
  op('setTextMatrix', [1, 0, 0, 1, 20, 100]);
  op('showText', glyphs('inter-'));
  op('setTextMatrix', [1, 0, 0, 1, 20, 88]);
  op('showText', glyphs('national'));
  op('setTextMatrix', [1, 0, 0, 1, 20, 76]);
  op('showText', glyphs('rea'));
  op('setFont', 'other', 10);
  op('showText', [-50, ...glyphs('ding')]);
  const font = { ascent: 0.8 },
    viewport = { transform: [1, 0, 0, -1, 0, 200] },
    runs = bionicGlyphRuns({ fnArray, argsArray }, OPS, () => font, viewport),
    plan = bionicGlyphPlan(runs, { mode: 'fixed', fixedLength: 3 });
  const marked = runs.filter((r) => plan.get(r.op)?.has(r.glyph));
  assert.equal(marked.map((r) => r.text).join(''), 'intrea');
  assert.equal(runs.at(-1).x, 50.5);
  assert.equal(runs[6].y, 104);
  assert.deepEqual(bionicGlyphPlan(runs, { mode: 'off' }), new Map());
});

test('glyph strokes render with the page at multiple scales, leaving suffixes and graphics intact', async () => {
  const { createCanvas, DOMMatrix, Path2D, ImageData } = await import('@napi-rs/canvas');
  Object.assign(globalThis, { DOMMatrix, Path2D, ImageData });
  await mkdir('.cache', { recursive: true });
  const directory = await mkdtemp(join(process.cwd(), '.cache/bionic-test-'));
  let loading;
  try {
    const runtimePath = join(directory, 'pdf.mjs');
    await writeFile(
      runtimePath,
      extendPDFRuntime(await readFile('node_modules/pdfjs-dist/legacy/build/pdf.mjs', 'utf8')),
    );
    const pdf = await import(pathToFileURL(runtimePath).href);
    pdf.GlobalWorkerOptions.workerSrc = pathToFileURL(
      join(process.cwd(), 'node_modules/pdfjs-dist/build/pdf.worker.mjs'),
    ).href;
    class Factory {
      create(width, height) {
        const canvas = createCanvas(width, height);
        return { canvas, context: canvas.getContext('2d') };
      }
      reset(target, width, height) {
        target.canvas.width = width;
        target.canvas.height = height;
      }
      destroy(target) {
        target.canvas.width = target.canvas.height = 0;
      }
    }
    const fixture = await PDFDocument.create(),
      font = await fixture.embedFont(StandardFonts.TimesRoman),
      source = fixture.addPage([200, 120]);
    source.drawText('Reader', { font, size: 24, x: 20, y: 70 });
    source.drawRectangle({ x: 20, y: 10, width: 150, height: 10, color: rgb(0, 0, 0) });
    loading = pdf.getDocument({
      data: await fixture.save(),
      CanvasFactory: Factory,
      standardFontDataUrl: join(process.cwd(), 'node_modules/pdfjs-dist/standard_fonts/'),
    });
    const document = await loading.promise,
      page = await document.getPage(1),
      list = await page.getOperatorList(),
      originalOps = structuredClone(list.argsArray),
      runs = bionicGlyphRuns(
        list,
        pdf.OPS,
        (id) => page.commonObjs.get(id),
        page.getViewport({ scale: 1 }),
      ),
      plan = bionicGlyphPlan(runs, { mode: 'fixed', fixedLength: 3 }),
      suffixX = runs[3].x + 1;
    const text = await page.getTextContent();
    for (const scale of [0.75, 1.5, 3]) {
      const viewport = page.getViewport({ scale });
      const render = async (bionicGlyphs) => {
        const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
        await page.render({ canvasContext: canvas.getContext('2d'), viewport, bionicGlyphs })
          .promise;
        return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      };
      const plain = await render(null),
        bold = await render(plan),
        empty = await render(new Map());
      assert.deepEqual(empty.data, plain.data, 'disabled hook keeps native rendering exact');
      let changed = 0;
      for (let y = 0; y < bold.height; y++)
        for (let x = 0; x < bold.width; x++) {
          const at = (y * bold.width + x) * 4;
          if (plain.data[at] === bold.data[at]) continue;
          changed++;
          assert.ok(x / scale < suffixX, 'plain suffix stays plain');
          assert.ok(y / scale < 70, 'non-text drawing stays intact');
          assert.ok(bold.data[at] <= plain.data[at], 'glyph strokes only add ink');
        }
      assert.ok(changed > 20, `fixations visibly painted at scale ${scale}`);
    }
    assert.deepEqual(list.argsArray, originalOps, 'shared PDF operators are untouched');
    assert.deepEqual(await page.getTextContent(), text, 'selection and search text are unchanged');
  } finally {
    await loading?.destroy();
    await rm(directory, { recursive: true, force: true });
  }
});
