import test from 'node:test';
import assert from 'node:assert/strict';
import {
  magicZoomLayout,
  revealScrollTarget,
} from '../../src/features/library/recent-magic-zoom.mjs';

const row = (count, width = 140, gap = 18) =>
  Array.from({ length: count }, (_, i) => ({ center: i * (width + gap) + width / 2, width }));

test('item under the pointer is largest and distant items stay untouched', () => {
  const items = row(14);
  const layout = magicZoomLayout(items, items[6].center);
  assert.equal(Math.max(...layout.map((l) => l.scale)), layout[6].scale);
  assert.ok(layout[6].scale > 2.39);
  assert.equal(layout[0].scale, 1);
  assert.equal(layout[13].scale, 1);
});

test('the focal cover reaches 2.4x, its direct neighbours grow, and covers two places away stay raw', () => {
  const items = row(15);
  const layout = magicZoomLayout(items, items[7].center);
  const scale = (offset) => layout[7 + offset].scale;
  assert.ok(Math.abs(scale(0) - 2.4) < 1e-9);
  assert.ok(scale(1) > 1.3 && scale(1) < 1.8 && scale(1) < scale(0));
  assert.ok(Math.abs(scale(1) - scale(-1)) < 1e-9);
  assert.equal(scale(2), 1);
  assert.equal(scale(-2), 1);
});

test('neighbours are pushed away from the hovered item', () => {
  const items = row(9);
  const layout = magicZoomLayout(items, items[4].center);
  assert.ok(Math.abs(layout[4].shift) < 1e-9);
  assert.ok(layout[3].shift < 0 && layout[5].shift > 0);
  assert.ok(layout[0].shift < layout[3].shift);
  assert.ok(layout[8].shift > layout[5].shift);
});

test('magnified neighbours never overlap', () => {
  const items = row(9);
  for (let x = items[2].center; x <= items[6].center; x += 7) {
    const layout = magicZoomLayout(items, x);
    for (let i = 1; i < items.length; i += 1) {
      const left =
        items[i - 1].center + layout[i - 1].shift + (items[i - 1].width * layout[i - 1].scale) / 2;
      const right = items[i].center + layout[i].shift - (items[i].width * layout[i].scale) / 2;
      assert.ok(right >= left - 1e-6, `items ${i - 1} and ${i} overlap at ${x}`);
    }
  }
});

test('the point under the pointer does not move', () => {
  const items = row(9);
  const x = (items[3].center + items[4].center) / 2;
  const layout = magicZoomLayout(items, x);
  const midShift = (layout[3].shift + layout[4].shift) / 2;
  assert.ok(Math.abs(midShift) < 1e-6);
});

test('empty and single-item galleries are handled', () => {
  assert.deepEqual(magicZoomLayout([], 10), []);
  const [only] = magicZoomLayout(row(1), 70);
  assert.ok(only.scale > 2.39 && Math.abs(only.shift) < 1e-9);
});

test('end covers grow into the row instead of past the gallery edge', () => {
  const items = row(8);
  const room = { leftRoom: 4, rightRoom: 4 };
  const edges = (layout, index) => {
    const { center, width } = items[index];
    const half = (layout[index].scale * width) / 2;
    return [center + layout[index].shift - half, center + layout[index].shift + half];
  };
  const first = magicZoomLayout(items, items[0].center, room);
  assert.ok(edges(first, 0)[0] >= items[0].center - 70 - 4 - 1e-9);
  const last = magicZoomLayout(items, items[7].center, room);
  assert.ok(edges(last, 7)[1] <= items[7].center + 70 + 4 + 1e-9);
  // Away from the ends the room does not matter.
  const middle = items[4].center;
  assert.deepEqual(magicZoomLayout(items, middle, room), magicZoomLayout(items, middle));
});

test('covers cut off at either edge scroll into view, with room for the zoom', () => {
  const view = { viewWidth: 800, scrollWidth: 2000, margin: 100 };
  // Cut off on the left: bring it back with the margin on its left.
  assert.equal(revealScrollTarget({ ...view, left: 450, width: 140, scrollLeft: 500 }), 350);
  // Cut off on the right: bring it back with the margin on its right.
  assert.equal(revealScrollTarget({ ...view, left: 1200, width: 140, scrollLeft: 500 }), 640);
  // Already comfortably visible.
  assert.equal(revealScrollTarget({ ...view, left: 700, width: 140, scrollLeft: 500 }), null);
});

test('reveal never scrolls past the ends of the gallery', () => {
  const view = { viewWidth: 800, scrollWidth: 1000, margin: 100 };
  assert.equal(revealScrollTarget({ ...view, left: 20, width: 140, scrollLeft: 60 }), 0);
  assert.equal(revealScrollTarget({ ...view, left: 860, width: 140, scrollLeft: 150 }), 200);
  // Nothing to gain when already at the end.
  assert.equal(revealScrollTarget({ ...view, left: 860, width: 140, scrollLeft: 200 }), null);
});
