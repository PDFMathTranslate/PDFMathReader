import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GALLERY_PADDING,
  buildGalleryLayout,
  galleryStep,
  visibleGalleryRows,
} from '../../src/features/reader/page-gallery-layout.mjs';

const portrait = (count) =>
  Array.from({ length: count }, (_, i) => ({ number: i + 1, width: 600, height: 800 }));

test('gallery spreads columns across the width and centres each page in its cell', () => {
  const layout = buildGalleryLayout(portrait(10), 1000);
  assert.equal(layout.columns, 4);
  assert.equal(layout.rows.length, 3);
  const first = layout.frames[0];
  assert.equal(first.width, 150);
  assert.equal(first.height, 200);
  assert.equal(first.cellX, GALLERY_PADDING);
  assert.equal(first.x - first.cellX, (layout.cell - first.width) / 2);
  assert.equal(buildGalleryLayout(portrait(3), 40).columns, 1);
});

test('gallery rows bottom-align mixed page shapes so numbers line up', () => {
  const pages = [
    { number: 1, width: 600, height: 800 },
    { number: 2, width: 800, height: 600 },
  ];
  const { frames, rows } = buildGalleryLayout(pages, 1000);
  assert.equal(rows[0].imageHeight, 200);
  assert.equal(frames[0].y + frames[0].height, frames[1].y + frames[1].height);
  assert.ok(frames[1].y > frames[0].y);
});

test('only rows near the viewport are mounted', () => {
  const layout = buildGalleryLayout(portrait(400), 1000);
  const rowHeight = layout.rows[1].top;
  assert.deepEqual(visibleGalleryRows(layout, 0, rowHeight, 0), { first: 0, last: 0 });
  const { first, last } = visibleGalleryRows(layout, rowHeight * 50, rowHeight * 2, rowHeight);
  assert.equal(first, 49);
  assert.equal(last, 52);
  assert.deepEqual(visibleGalleryRows(buildGalleryLayout([], 1000), 0, 500), {
    first: 0,
    last: -1,
  });
});

test('arrow keys move through the grid without wrapping past either end', () => {
  const layout = buildGalleryLayout(portrait(10), 1000);
  assert.equal(galleryStep(layout, 1, 'ArrowLeft'), 1);
  assert.equal(galleryStep(layout, 2, 'ArrowUp'), 2);
  assert.equal(galleryStep(layout, 2, 'ArrowDown'), 6);
  assert.equal(galleryStep(layout, 4, 'ArrowRight'), 5);
  // Page 8 sits above an empty slot in the short last row.
  assert.equal(galleryStep(layout, 8, 'ArrowDown'), 10);
  assert.equal(galleryStep(layout, 10, 'ArrowDown'), 10);
  assert.equal(galleryStep(layout, 10, 'ArrowRight'), 10);
  assert.equal(galleryStep(layout, 5, 'Home'), 1);
  assert.equal(galleryStep(layout, 5, 'End'), 10);
  assert.equal(galleryStep(layout, 5, 'Tab'), 5);
});
