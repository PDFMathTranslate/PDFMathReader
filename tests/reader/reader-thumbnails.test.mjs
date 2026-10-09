import test from 'node:test';
import assert from 'node:assert/strict';
import { createThumbnails } from '../../src/features/reader/reader-thumbnails.mjs';
function fixture(getPage) {
  const painted = [];
  const renderState = {
    thumbnailEpoch: 0,
    previewScrolling: true,
    visibleThumbnails: new Set([106, 107, 108]),
    thumbEls: new Map([106, 107, 108].map((n) => [n, { number: n }])),
  };
  const session = {
    epoch: 1,
    pdf: { getPage },
    pages: { value: Array.from({ length: 526 }, () => ({ width: 514, height: 726 })) },
  };
  const thumbnails = createThumbnails({
    renderState,
    session,
    motion: {},
    activity: { foreground: { value: true } },
    actions: { canvasRendering: { draw: async (_, canvas) => painted.push(canvas.number) } },
  });
  return { renderState, session, painted, thumbnails };
}
test('slow scanned thumbnail does not block neighbours during reader scrolling', async () => {
  let resume;
  const gate = new Promise((resolve) => {
    resume = resolve;
  });
  const f = fixture(async (n) => {
    if (n === 106) await gate;
    return { n };
  });
  const rendering = f.thumbnails.renderThumbnails();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(f.painted, [107, 108]);
  resume();
  await rendering;
  assert.deepEqual(f.painted, [107, 108, 106]);
});
test('a replaced document never receives stale thumbnail frames', async () => {
  let resume;
  const gate = new Promise((resolve) => {
    resume = resolve;
  });
  const f = fixture(async (n) => {
    await gate;
    return { n };
  });
  const rendering = f.thumbnails.renderThumbnails();
  f.session.epoch++;
  resume();
  await rendering;
  assert.deepEqual(f.painted, []);
});
