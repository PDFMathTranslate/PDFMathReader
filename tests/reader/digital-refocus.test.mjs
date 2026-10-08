import test from 'node:test';
import assert from 'node:assert/strict';
import { refocusRegions } from '../../src/ui/motion/digital-refocus.mjs';

test('refocus uses paragraph regions and clamps them to the page', () => {
  assert.deepEqual(
    refocusRegions(
      [
        { x: -5, y: 20, width: 45, height: 30 },
        { x: 60, y: 80, width: 60, height: 40 },
      ],
      100,
      100,
    ),
    [
      { x: 0, y: 20, width: 40, height: 30 },
      { x: 60, y: 80, width: 40, height: 20 },
    ],
  );
});
test('refocus falls back to the complete page without valid paragraphs', () => {
  for (const boxes of [
    undefined,
    [],
    [{ x: NaN, y: 1, width: 20, height: 30 }],
    [{ x: 120, y: 10, width: 20, height: 30 }],
  ]) {
    assert.deepEqual(refocusRegions(boxes, 100, 200), [{ x: 0, y: 0, width: 100, height: 200 }]);
  }
});

test('PDF refocus releases overlays and texture memory when interrupted', async (t) => {
  const { refocusPDF } = await import('../../src/ui/motion/digital-refocus.mjs');
  const elements = [],
    animations = [];
  const saved = new Map(['document', 'window', 'matchMedia'].map((key) => [key, globalThis[key]]));
  t.after(() => {
    for (const [key, value] of saved) {
      if (value === undefined) delete globalThis[key];
      else globalThis[key] = value;
    }
  });
  globalThis.window = {};
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.document = {
    hidden: false,
    documentElement: { dataset: {} },
    createElement(tag) {
      const el = {
        tag,
        style: {},
        children: [],
        width: 0,
        height: 0,
        setAttribute() {},
        append(child) {
          this.children.push(child);
        },
        remove() {
          this.removed = true;
        },
        getContext() {
          return { drawImage() {} };
        },
        animate() {
          let resolve;
          const a = {
            finished: new Promise((r) => {
              resolve = r;
            }),
            cancel() {
              resolve();
            },
          };
          animations.push(a);
          return a;
        },
      };
      elements.push(el);
      return el;
    },
  };
  const host = {
    isConnected: true,
    append(el) {
      this.layer = el;
    },
  };
  const controller = new AbortController();
  const pending = refocusPDF({
    canvas: { width: 200, height: 400 },
    page: { getViewport: () => ({ width: 100, height: 200 }) },
    scale: 1,
    host,
    boxes: [],
    signal: controller.signal,
  });
  assert.equal(animations.length, 1);
  assert.equal(host.layer.children[0].style.width, '100px');
  controller.abort();
  await pending;
  assert.equal(host.layer.removed, true);
  for (const texture of elements.filter((e) => e.tag === 'canvas'))
    assert.equal(texture.width + texture.height, 0);
});
