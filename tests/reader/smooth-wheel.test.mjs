import test from 'node:test';
import assert from 'node:assert/strict';
import { ref } from 'vue';
import {
  chaseStep,
  createSmoothWheel,
  nestedScroller,
  wheelPixels,
} from '../../src/features/reader/smooth-wheel.mjs';

test('line and page deltas become pixels', () => {
  const el = { clientWidth: 800, clientHeight: 600 };
  assert.deepEqual(wheelPixels({ deltaMode: 0, deltaX: 0, deltaY: 120 }, el), { x: 0, y: 120 });
  assert.deepEqual(wheelPixels({ deltaMode: 1, deltaX: 1, deltaY: 3 }, el), { x: 16, y: 48 });
  assert.deepEqual(wheelPixels({ deltaMode: 2, deltaX: 0, deltaY: -1 }, el), { x: 0, y: -600 });
});

test('the chase approaches the target without overshoot and ignores negative time', () => {
  let position = 0;
  for (let i = 0; i < 30; i++) {
    const next = chaseStep(position, 100, 16);
    assert.ok(next > position && next < 100);
    position = next;
  }
  assert.ok(position > 99);
  assert.equal(chaseStep(40, 100, -5), 40);
});

test('a nested scroller that can still move in the wheel direction keeps the wheel', () => {
  const root = { nodeType: 1 };
  const panel = {
    nodeType: 1,
    parentElement: root,
    scrollTop: 0,
    scrollHeight: 500,
    clientHeight: 200,
    scrollWidth: 200,
    clientWidth: 200,
  };
  const child = { nodeType: 1, parentElement: panel };
  const style = (node) =>
    node === panel
      ? { overflowX: 'hidden', overflowY: 'auto' }
      : { overflowX: 'visible', overflowY: 'visible' };
  assert.equal(nestedScroller(child, root, 0, 40, style), panel);
  // At the top edge, scrolling up passes through to the reader.
  assert.equal(nestedScroller(child, root, 0, -40, style), null);
  assert.equal(nestedScroller(child, root, 40, 0, style), null);
});

test('wheel steps are taken over and glide to the accumulated target', () => {
  const frames = [];
  globalThis.requestAnimationFrame = (fn) => frames.push(fn);
  globalThis.cancelAnimationFrame = () => {};
  globalThis.matchMedia = () => ({ matches: false });
  globalThis.getComputedStyle = () => ({ overflowX: 'visible', overflowY: 'visible' });
  const el = {
    nodeType: 1,
    scrollLeft: 0,
    scrollTop: 0,
    scrollWidth: 800,
    clientWidth: 800,
    scrollHeight: 5000,
    clientHeight: 600,
  };
  const preferences = { forceSmoothScrolling: ref(true), reduceMotion: ref(false) };
  const motion = { pageJumping: false, pinching: ref(false) };
  const { smoothWheel } = createSmoothWheel({ motion, preferences, view: { reader: ref(el) } });
  let prevented = 0;
  const wheel = (deltaY, extra = {}) =>
    smoothWheel({
      deltaMode: 0,
      deltaX: 0,
      deltaY,
      target: el,
      preventDefault: () => prevented++,
      ...extra,
    });
  wheel(100);
  wheel(100);
  assert.equal(prevented, 2);
  assert.equal(frames.length, 1);
  let now = performance.now();
  let previous = 0;
  while (frames.length) {
    now += 16;
    frames.shift()(now);
    assert.ok(el.scrollTop >= previous);
    previous = el.scrollTop;
  }
  assert.equal(el.scrollTop, 200);
  // Pinch, disabled preference, and Reduce Motion fall back to native scrolling.
  wheel(100, { ctrlKey: true });
  preferences.forceSmoothScrolling.value = false;
  wheel(100);
  preferences.forceSmoothScrolling.value = true;
  preferences.reduceMotion.value = true;
  wheel(100);
  assert.equal(prevented, 2);
});

test('a glide stops when something else moves the view', () => {
  const frames = [];
  globalThis.requestAnimationFrame = (fn) => frames.push(fn);
  const el = {
    nodeType: 1,
    scrollLeft: 0,
    scrollTop: 0,
    scrollWidth: 800,
    clientWidth: 800,
    scrollHeight: 5000,
    clientHeight: 600,
  };
  const preferences = { forceSmoothScrolling: ref(true), reduceMotion: ref(false) };
  const { smoothWheel } = createSmoothWheel({
    motion: { pageJumping: false, pinching: ref(false) },
    preferences,
    view: { reader: ref(el) },
  });
  smoothWheel({ deltaMode: 0, deltaX: 0, deltaY: 300, target: el, preventDefault() {} });
  frames.shift()(performance.now() + 16);
  el.scrollTop = 2000;
  frames.shift()(performance.now() + 32);
  assert.equal(el.scrollTop, 2000);
  assert.equal(frames.length, 0);
});

test('mouse-wheel detection ignores trackpad streams', async () => {
  const { isMouseWheel } = await import('../../src/features/reader/smooth-wheel.mjs');
  const notch = { deltaMode: 0, deltaX: 0, deltaY: 100, wheelDeltaY: -120 };
  assert.equal(isMouseWheel(notch, 10000), true);
  assert.equal(
    isMouseWheel({ deltaMode: 0, deltaX: 2, deltaY: 7.5, wheelDeltaY: -22 }, 20000),
    false,
  );
  assert.equal(isMouseWheel(notch, 20100), false);
  assert.equal(isMouseWheel(notch, 20500), true);
});
