import test from 'node:test';
import assert from 'node:assert/strict';
import { magicZoomLayout } from '../../src/features/library/recent-magic-zoom.mjs';

const row = (count, width = 140, gap = 18) =>
  Array.from({ length: count }, (_, i) => ({ center: i * (width + gap) + width / 2, width }));

test('item under the pointer is largest and distant items stay untouched', () => {
  const items = row(10);
  const layout = magicZoomLayout(items, items[4].center);
  assert.equal(Math.max(...layout.map((l) => l.scale)), layout[4].scale);
  assert.ok(layout[4].scale > 1.4);
  assert.equal(layout[0].scale, 1);
  assert.equal(layout[9].scale, 1);
});

test('nearby items zoom like the Dock, fading out over a few covers', () => {
  const items = row(11);
  const layout = magicZoomLayout(items, items[5].center);
  const scale = (offset) => layout[5 + offset].scale;
  assert.ok(scale(1) > 1.25 && scale(-1) > 1.25);
  assert.ok(scale(2) > 1.1 && scale(-2) > 1.1);
  assert.ok(scale(3) > 1 && scale(3) < 1.06);
  assert.ok(scale(0) > scale(1) && scale(1) > scale(2) && scale(2) > scale(3));
  assert.ok(Math.abs(scale(1) - scale(-1)) < 1e-9);
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
  assert.ok(only.scale > 1.4 && Math.abs(only.shift) < 1e-9);
});
