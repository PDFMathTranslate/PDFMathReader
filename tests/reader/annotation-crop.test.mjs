import assert from 'node:assert/strict';
import test from 'node:test';
import {
  annotationRailX,
  annotationNotePositions,
} from '../../src/features/annotations/annotation-display.mjs';

test('comment rail stays fully inside the cropped right edge at different zoom levels', () => {
  for (const zoom of [0.5, 1, 2, 4]) {
    const crop = { x: 0.5, y: 0.2 },
      width = 600;
    const x = annotationRailX(width, 590, zoom, crop);
    assert.equal((width * (1 - crop.x / 2) - x) * zoom, 42);
    assert.ok(x >= (width * crop.x) / 2);
    assert.equal(
      annotationRailX(width, 100, zoom, crop),
      x,
      'all comments share the cropped right rail',
    );
  }
});

test('uncropped comment rail still follows text and respects page edge', () => {
  assert.equal(annotationRailX(600, 400, 1), 408);
  assert.equal(annotationRailX(600, 590, 1), 558);
});

test('comment markers remain inside vertical crop and retain their spacing', () => {
  const positions = annotationNotePositions(
    [
      { id: 'top', y: 0 },
      { id: 'middle', y: 500 },
      { id: 'bottom', y: 790 },
    ],
    800,
    1,
    0.5,
  );
  assert.equal(positions.get('top'), 200);
  assert.equal(positions.get('bottom'), 566);
  assert.ok(positions.get('middle') >= 200);
  assert.ok(positions.get('middle') + 40 <= positions.get('bottom'));
});
