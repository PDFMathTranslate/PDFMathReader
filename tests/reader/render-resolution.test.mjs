import assert from 'node:assert/strict';
import test from 'node:test';
import { renderFrame, renderPixelRatio } from '../../src/features/reader/render-resolution.mjs';

const fullPage = {
  fullWidth: 3000,
  fullHeight: 5000,
};

test('renderFrame preserves full-page coordinates when crop is zero', () => {
  const expected = {
    x: 0,
    y: 0,
    width: fullPage.fullWidth,
    height: fullPage.fullHeight,
    ...fullPage,
  };

  assert.deepEqual(renderFrame(fullPage.fullWidth, fullPage.fullHeight), expected);
  assert.deepEqual(renderFrame(fullPage.fullWidth, fullPage.fullHeight, { x: 0, y: 0 }), expected);
});

test('renderFrame returns the centered retained area in original page coordinates', () => {
  assert.deepEqual(renderFrame(fullPage.fullWidth, fullPage.fullHeight, { x: 0.5, y: 0.2 }), {
    x: 750,
    y: 500,
    width: 1500,
    height: 4000,
    ...fullPage,
  });
});

test('renderFrame clamps finite crop fractions to the supported range', () => {
  const lowHigh = renderFrame(fullPage.fullWidth, fullPage.fullHeight, { x: -0.1, y: 1.1 });
  assert.deepEqual(
    { x: lowHigh.x, y: lowHigh.y, width: lowHigh.width },
    { x: 0, y: 2000, width: 3000 },
  );
  assert.ok(Math.abs(lowHigh.height - 1000) < 1e-9);

  const capped = renderFrame(fullPage.fullWidth, fullPage.fullHeight, { x: 0.8, y: 0.8 });
  assert.deepEqual({ x: capped.x, y: capped.y }, { x: 1200, y: 2000 });
  assert.ok(Math.abs(capped.width - 600) < 1e-9);
  assert.ok(Math.abs(capped.height - 1000) < 1e-9);
});

test('cropping raises the bitmap DPR available under the 64 MiB visible-page budget', () => {
  const full = renderFrame(fullPage.fullWidth, fullPage.fullHeight, { x: 0, y: 0 });
  const cropped = renderFrame(fullPage.fullWidth, fullPage.fullHeight, { x: 0.5, y: 0.2 });
  const fullDpr = renderPixelRatio(full.width, full.height, 2, true);
  const croppedDpr = renderPixelRatio(cropped.width, cropped.height, 2, true);
  const budget = 64 * 1024 * 1024;
  const bytes = (frame, dpr) => frame.width * frame.height * dpr * dpr * 4;

  assert.deepEqual(renderFrame(fullPage.fullWidth, fullPage.fullHeight, { x: 0, y: 0 }), full);
  assert.equal(fullDpr, renderPixelRatio(fullPage.fullWidth, fullPage.fullHeight, 2, true));
  assert.ok(croppedDpr > fullDpr, `${croppedDpr} should exceed ${fullDpr}`);
  assert.ok(bytes(full, fullDpr) <= budget * 1.000001);
  assert.ok(bytes(cropped, croppedDpr) <= budget * 1.000001);
});
