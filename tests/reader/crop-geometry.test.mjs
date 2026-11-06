import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cropFromView,
  cropViewFields,
  normalizeCrop,
  setCropAxis,
} from '../../shared/reader/crop-geometry.mjs';
import { renderFrame } from '../../src/features/reader/render-resolution.mjs';

test('legacy crop totals remain symmetric aliases', () => {
  assert.deepEqual(normalizeCrop({ x: 0.5, y: 0.2 }), {
    left: 0.25,
    right: 0.25,
    top: 0.1,
    bottom: 0.1,
    x: 0.5,
    y: 0.2,
  });
  assert.deepEqual(cropFromView({ cropX: 0.5, cropY: 0.2 }), normalizeCrop({ x: 0.5, y: 0.2 }));
});

test('renderFrame and reading-view fields retain independent edges', () => {
  const crop = { left: 0.1, right: 0.2, top: 0.3, bottom: 0.1 };
  assert.deepEqual(renderFrame(1000, 2000, crop), {
    x: 100,
    y: 600,
    width: 700,
    height: 1200,
    fullWidth: 1000,
    fullHeight: 2000,
  });
  assert.deepEqual(cropViewFields(crop), {
    cropX: 0.3,
    cropY: 0.4,
    cropLeft: 0.1,
    cropRight: 0.2,
    cropTop: 0.3,
    cropBottom: 0.1,
  });
  assert.deepEqual(cropFromView(cropViewFields(crop)), normalizeCrop(crop));
});

test('legacy axis commands change totals without erasing an asymmetric split', () => {
  assert.deepEqual(setCropAxis({ left: 0.1, right: 0.2 }, 'x', 0.6), {
    left: 0.2,
    right: 0.4,
    top: 0,
    bottom: 0,
    x: 0.6,
    y: 0,
  });
  assert.deepEqual(setCropAxis({}, 'y', 0.4), {
    left: 0,
    right: 0,
    top: 0.2,
    bottom: 0.2,
    x: 0,
    y: 0.4,
  });
});
