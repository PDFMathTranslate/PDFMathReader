import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGalleryLayout } from '../../src/features/reader/page-gallery-layout.mjs';
import {
  arrangedPositions,
  deletePages,
  dropGap,
  menuGap,
  movePages,
  pastePages,
} from '../../src/features/reader/page-gallery-order.mjs';

test('moving pages places the block at the gap and skips unchanged orders', () => {
  assert.deepEqual(movePages(5, [4], 1), [1, 4, 2, 3, 5]);
  assert.deepEqual(movePages(5, [1, 2], 4), [3, 4, 1, 2, 5]);
  assert.deepEqual(movePages(5, [2, 4], 0), [2, 4, 1, 3, 5]);
  assert.deepEqual(movePages(5, [2, 4], 5), [1, 3, 5, 2, 4]);
  assert.equal(movePages(5, [2, 3], 1), null);
  assert.equal(movePages(5, [2, 3], 3), null);
  assert.equal(movePages(5, [], 2), null);
});

test('menu moves step one page and stop at the ends', () => {
  const move = (pages, action) => movePages(5, pages, menuGap(5, pages, action));
  assert.deepEqual(move([3], 'move-earlier'), [1, 3, 2, 4, 5]);
  assert.deepEqual(move([3], 'move-later'), [1, 2, 4, 3, 5]);
  assert.deepEqual(move([3, 4], 'move-first'), [3, 4, 1, 2, 5]);
  assert.deepEqual(move([3, 4], 'move-last'), [1, 2, 5, 3, 4]);
  assert.equal(move([1], 'move-earlier'), null);
  assert.equal(move([5], 'move-later'), null);
});

test('pasting inserts copies and tracks where originals land', () => {
  const order = pastePages(4, [1, 3], 2);
  assert.deepEqual(order, [1, 2, 1, 3, 3, 4]);
  assert.deepEqual(
    [...arrangedPositions(order)],
    [
      [1, 1],
      [2, 2],
      [3, 4],
      [4, 6],
    ],
  );
  assert.equal(pastePages(4, [], 2), null);
});

test('the drop gap follows the nearest cell edge', () => {
  const pages = Array.from({ length: 7 }, (_, index) => ({
      number: index + 1,
      width: 600,
      height: 800,
    })),
    layout = buildGalleryLayout(pages, 32 * 2 + 150 * 3 + 48 * 2),
    [first, second] = layout.frames;
  assert.equal(layout.columns, 3);
  assert.deepEqual(dropGap(layout, first.cellX + 5, 10), {
    gap: 0,
    x: first.cellX,
    top: 0,
    height: layout.rows[0].imageHeight,
  });
  assert.equal(dropGap(layout, second.cellX + second.cellWidth * 0.9, 10).gap, 2);
  const end = dropGap(layout, 9999, 10);
  assert.equal(end.gap, 3);
  assert.equal(end.x, layout.frames[2].cellX + layout.frames[2].cellWidth);
  assert.equal(dropGap(layout, 9999, layout.rows[1].top + 5).gap, 6);
  assert.equal(dropGap(layout, 9999, layout.height + 200).gap, 7);
});

test('deleting pages keeps at least one page', () => {
  assert.deepEqual(deletePages(5, [2, 4]), [1, 3, 5]);
  assert.deepEqual(deletePages(2, [1]), [2]);
  assert.equal(deletePages(3, [1, 2, 3]), null);
  assert.equal(deletePages(3, []), null);
  assert.equal(deletePages(3, [9]), null);
});
