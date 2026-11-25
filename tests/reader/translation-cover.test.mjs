import test from 'node:test';
import assert from 'node:assert/strict';
import {
  coverImages,
  coverPlan,
  paperColor,
  createTranslationCover,
} from '../../src/features/reader/translation-cover.mjs';
import { ref } from 'vue';

const loadRuntime = () => import('pdfjs-dist/legacy/build/pdf.mjs');
const viewport = { transform: [1, 0, 0, -1, 0, 100] };
const list = (OPS, ops) => ({
  fnArray: ops.map(([name]) => OPS[name]),
  argsArray: ops.map(([, ...args]) => args),
});
const paragraph = {
  text: 'original',
  translation: 'translated',
  sourceBox: { x: 5, y: 5, width: 80, height: 20 },
};

test('a late figure does not cover translation that was already painted above it', async () => {
  const runtime = await loadRuntime();
  const ops = [
    ['beginText'],
    ['showText'],
    ['endText'],
    ['save'],
    ['transform', 100, 0, 0, 40, 0, 0],
    ['paintImageXObject'],
    ['restore'],
    ['beginText'],
    ['showText'],
  ];
  const images = coverImages(list(runtime.OPS, ops), runtime, viewport);
  assert.deepEqual(images, [{ index: 5, bounds: [0, 60, 100, 100] }]);
  assert.equal(coverPlan(images, [paragraph]).size, 0);
});

test('a scan is covered before its translated text even when a figure comes later', async () => {
  const runtime = await loadRuntime();
  const ops = [
    ['save'],
    ['transform', 100, 0, 0, 100, 0, 0],
    ['paintImageXObject'],
    ['restore'],
    ['beginText'],
    ['showText'],
    ['endText'],
    ['save'],
    ['transform', 100, 0, 0, 40, 0, 0],
    ['paintInlineImageXObject'],
    ['restore'],
    ['beginText'],
    ['showText'],
  ];
  const images = coverImages(list(runtime.OPS, ops), runtime, viewport);
  assert.deepEqual([...coverPlan(images, [paragraph]).keys()], [3]);
});

test('each embedded band uses its own image placement on compacted pages', async () => {
  const runtime = await loadRuntime();
  const band = (offset) => [
    ['paintFormXObjectBegin', [1, 0, 0, 1, 0, offset]],
    ['transform', 100, 0, 0, 35, 0, 0],
    ['paintImageXObject'],
    ['paintFormXObjectEnd'],
    ['showText'],
  ];
  const images = coverImages(list(runtime.OPS, [...band(65), ...band(15)]), runtime, viewport);
  assert.deepEqual(images, [
    { index: 2, bounds: [0, 0, 100, 35] },
    { index: 7, bounds: [0, 50, 100, 85] },
  ]);
  const lower = { ...paragraph, sourceBox: { ...paragraph.sourceBox, y: 55 } };
  assert.deepEqual([...coverPlan(images, [paragraph, lower]).keys()], [3, 8]);
});

test('covers span source and translated boxes inside the scan and skip unchanged paragraphs', () => {
  const rects = coverPlan(
    [{ index: 0, bounds: [8, 0, 200, 100] }],
    [
      {
        ...paragraph,
        fontSize: 10,
        sourceBox: { x: 10, y: 20, width: 100, height: 30 },
        translatedBox: { x: 5, y: 25, width: 90, height: 40 },
      },
      { ...paragraph, translation: paragraph.text },
      { ...paragraph, translation: '' },
    ],
  ).get(1);
  assert.equal(rects.length, 1);
  const [r] = rects;
  assert.equal(r.x, 8);
  assert.ok(Math.abs(r.y - (20 - 2.8)) < 1e-9);
  assert.ok(Math.abs(r.x + r.width - (110 + 2.8)) < 1e-9);
  assert.ok(Math.abs(r.y + r.height - (65 + 2.8)) < 1e-9);
});

test('the paper colour ignores dark text pixels around a paragraph', () => {
  const width = 20,
    height = 20,
    data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const dark = i % 3 === 0;
    data.set(dark ? [20, 20, 20, 255] : [240, 230, 210, 255], i * 4);
  }
  assert.equal(
    paperColor(data, width, height, { x: 5, y: 5, width: 10, height: 10 }),
    'rgb(240, 230, 210)',
  );
  assert.equal(
    paperColor(new Uint8ClampedArray(16), 2, 2, { x: 0, y: 0, width: 1, height: 1 }),
    '#fff',
  );
});

test('render options exist only while enabled and for pages with a scan', async () => {
  const { OPS } = await loadRuntime();
  const preferences = { coverOriginalText: ref(false) };
  const cover = createTranslationCover({ preferences, loadRuntime });
  const makePage = (ops) => ({
    getViewport: () => viewport,
    getOperatorList: async () => list(OPS, ops),
  });
  const page = makePage([
      ['transform', 100, 0, 0, 100, 0, 0],
      ['paintImageXObject'],
      ['beginText'],
      ['showText'],
    ]),
    plain = makePage([['beginText'], ['showText']]),
    rasterOnly = makePage([['transform', 100, 0, 0, 100, 0, 0], ['paintImageXObject']]),
    blocks = [paragraph];
  assert.equal(await cover.renderOptions(page, blocks), null);
  preferences.coverOriginalText.value = true;
  const options = await cover.renderOptions(page, blocks);
  assert.deepEqual([...options.plan.keys()], [2]);
  assert.equal(options.plan.get(2).length, 1);
  assert.equal(await cover.renderOptions(plain, blocks), null);
  assert.equal(await cover.renderOptions(rasterOnly, blocks), null);
});
