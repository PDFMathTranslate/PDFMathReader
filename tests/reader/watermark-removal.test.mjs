import test from 'node:test';
import assert from 'node:assert/strict';
import { createWatermarkRemoval } from '../../src/features/reader/watermark-removal.mjs';

const OPS = { paintImageXObject: 1, paintInlineImageXObject: 2, paintImageMaskXObject: 3 };

function fixture(count) {
  const cleaned = [];
  const pages = Array.from({ length: count }, (_, i) => ({
    pageNumber: i + 1,
    view: [0, 0, 612, 792],
    getOperatorList: async () => ({ fnArray: [], argsArray: [] }),
    cleanup: () => cleaned.push(i + 1),
  }));
  const pdf = { numPages: count, getPage: async (n) => pages[n - 1] };
  const removal = createWatermarkRemoval({
    session: { pdf },
    preferences: { watermarkRemovalEnabled: { value: true } },
    loadRuntime: async () => ({ OPS }),
  });
  return { cleaned, pages, removal };
}

test('sample pages read only to learn what repeats release their decoded images', async () => {
  const { cleaned, pages, removal } = fixture(14);
  // Page 4 is one of the ten sampled pages of a 14-page document.
  assert.equal(await removal.renderOptions(pages[3]), null);
  assert.equal(cleaned.length, 9, 'every other sampled page is released after it is scanned');
  assert.ok(!cleaned.includes(4), 'the page being drawn keeps its parsed operators');
});

test('a small document releases nothing but its sampled neighbours of the drawn page', async () => {
  const { cleaned, pages, removal } = fixture(3);
  await removal.renderOptions(pages[0]);
  assert.deepEqual(cleaned.sort(), [2, 3]);
});
