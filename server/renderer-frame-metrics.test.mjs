import test from 'node:test';
import assert from 'node:assert/strict';
import {startRendererFrameMetrics} from '../src/renderer-frame-metrics.mjs';

function createHarness({enabled = false, initialEnabled} = {}) {
  let clock = 0;
  let nextFrameId = 0;
  let changeListener = null;
  let initialValue = initialEnabled === undefined ? enabled : initialEnabled;
  const frames = new Map();
  const listeners = new Map();
  const documentRef = {
    hidden: false,
    addEventListener(type, listener) { listeners.set(type, listener); },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
  };
  const windowRef = {
    document: documentRef,
    performance: {now: () => clock},
    requestAnimationFrame(callback) {
      const id = ++nextFrameId;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) { frames.delete(id); },
    previewDeveloper: {
      enabled: () => initialValue,
      onChange(listener) {
        changeListener = listener;
        return () => { changeListener = null; };
      },
    },
  };
  return {
    windowRef,
    documentRef,
    setInitialValue(value) { initialValue = value; },
    change(value) { changeListener?.(value); },
    setClock(value) { clock = value; },
    fire(timestamp, callbackTime = timestamp) {
      const [id, callback] = frames.entries().next().value || [];
      assert.notEqual(id, undefined, 'a RAF callback should be scheduled');
      frames.delete(id);
      clock = callbackTime;
      callback(timestamp);
    },
    pending() { return frames.size; },
    visibilityChange() { listeners.get('visibilitychange')?.(); },
  };
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0));

test('renderer frame metrics wait for developer mode and discard stale enabled races', async() => {
  let resolveInitial;
  const harness = createHarness({initialEnabled: new Promise(resolve => { resolveInitial = resolve; })});
  const stop = startRendererFrameMetrics({windowRef: harness.windowRef});

  harness.change(false);
  await settle();
  resolveInitial(true);
  await settle();
  assert.equal(harness.pending(), 0);
  assert.deepEqual(harness.windowRef.previewRendererFrameMetrics, {
    fps: null,
    frameIntervalMs: null,
    latencyMs: null,
    sampledAt: null,
    hidden: false,
  });
  stop();
});

test('renderer frame metrics measure RAF timing, clamp lateness, and stop on disable', async() => {
  const harness = createHarness({enabled: true});
  const stop = startRendererFrameMetrics({windowRef: harness.windowRef});
  await settle();
  assert.equal(harness.pending(), 1);

  harness.fire(100, 95);
  harness.fire(116, 116);
  const snapshot = harness.windowRef.previewRendererFrameMetrics;
  assert.equal(snapshot.frameIntervalMs, 16);
  assert.equal(snapshot.fps, 62.5);
  assert.equal(snapshot.latencyMs, 0);
  assert.equal(snapshot.hidden, false);

  harness.change(false);
  await settle();
  assert.equal(harness.pending(), 0);
  assert.equal(harness.windowRef.previewRendererFrameMetrics.fps, null);
  stop();
});

test('visibility changes reset the interval baseline before resuming RAF samples', async() => {
  const harness = createHarness({enabled: true});
  const stop = startRendererFrameMetrics({windowRef: harness.windowRef});
  await settle();
  harness.fire(100);
  harness.fire(116);
  assert.equal(harness.windowRef.previewRendererFrameMetrics.frameIntervalMs, 16);

  harness.documentRef.hidden = true;
  harness.visibilityChange();
  assert.equal(harness.windowRef.previewRendererFrameMetrics.hidden, true);
  assert.equal(harness.windowRef.previewRendererFrameMetrics.frameIntervalMs, null);
  harness.fire(5016);
  assert.equal(harness.windowRef.previewRendererFrameMetrics.frameIntervalMs, null);
  harness.fire(5032);
  assert.equal(harness.windowRef.previewRendererFrameMetrics.frameIntervalMs, 16);
  stop();
});
