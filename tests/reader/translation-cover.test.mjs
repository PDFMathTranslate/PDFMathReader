import test from 'node:test';
import assert from 'node:assert/strict';
import {
  coverIndexes,
  coverRects,
  paperColor,
  createTranslationCover,
} from '../../src/features/reader/translation-cover.mjs';
import { ref } from 'vue';

const OPS = { paintImageXObject: 85, beginText: 31, showText: 44, beginMarkedContent: 69 };
const list = (fnArray, argsArray = []) => ({ fnArray, argsArray });

test('a page without images has nothing to cover', () => {
  assert.deepEqual(coverIndexes(list([31, 44, 31, 44]), OPS), []);
});

test('the cover goes before the first text object after the last image', () => {
  // OCR text, scan, figure, then the appended translation.
  assert.deepEqual(coverIndexes(list([31, 44, 85, 31, 44, 85, 31, 44, 31]), OPS), [6]);
});

test('each band of a compacted page gets its own cover', () => {
  const band = (n) => [{ name: 'CompactBand' + n }];
  const ops = [69, 85, 31, 44, 69, 85, 31, 44];
  const args = [band(0), null, null, null, band(1), null, null, null];
  assert.deepEqual(coverIndexes(list(ops, args), OPS), [2, 6]);
});

test('other marked content does not split the page', () => {
  const ops = [69, 85, 31, 69, 31];
  const args = [[{ name: 'Artifact' }], null, null, [{ name: 'P' }], null];
  assert.deepEqual(coverIndexes(list(ops, args), OPS), [2]);
});

test('covers span the source and translated boxes and skip unchanged paragraphs', () => {
  const rects = coverRects([
    {
      text: 'a',
      translation: 'b',
      fontSize: 10,
      sourceBox: { x: 10, y: 20, width: 100, height: 30 },
      translatedBox: { x: 5, y: 25, width: 90, height: 40 },
    },
    { text: 'same', translation: 'same', sourceBox: { x: 0, y: 0, width: 9, height: 9 } },
    { text: 'c', translation: '', sourceBox: { x: 0, y: 0, width: 9, height: 9 } },
  ]);
  assert.equal(rects.length, 1);
  const [r] = rects;
  assert.ok(Math.abs(r.x - (5 - 2.8)) < 1e-9);
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
  const preferences = { coverOriginalText: ref(false) };
  const cover = createTranslationCover({
    preferences,
    loadRuntime: async () => ({ OPS }),
  });
  const page = { getOperatorList: async () => list([85, 31, 44]) },
    plain = { getOperatorList: async () => list([31, 44]) },
    blocks = [{ text: 'a', translation: 'b', sourceBox: { x: 0, y: 0, width: 10, height: 10 } }];
  assert.equal(await cover.renderOptions(page, blocks), null);
  preferences.coverOriginalText.value = true;
  const options = await cover.renderOptions(page, blocks);
  assert.deepEqual(options.at, [1]);
  assert.equal(options.rects.length, 1);
  assert.equal(await cover.renderOptions(plain, blocks), null);
});
