import assert from 'node:assert/strict';
import test from 'node:test';
import {
  scheduleTaskCleanup,
  yieldToPaint,
} from '../../src/features/reader/document-scheduling.mjs';

test('yieldToPaint bounds a paused frame and cancels the frame handle', async () => {
  let frameCallback;
  const cancelledFrames = [];
  const timers = new Map();
  let nextTimer = 0;
  const pending = yieldToPaint({
    requestFrame(callback) {
      frameCallback = callback;
      return 17;
    },
    cancelFrame(id) {
      cancelledFrames.push(id);
    },
    setTimer(callback) {
      const id = ++nextTimer;
      timers.set(id, callback);
      return id;
    },
    clearTimer(id) {
      timers.delete(id);
    },
    timeoutMs: 50,
  });

  assert.equal(typeof frameCallback, 'function');
  assert.equal(timers.size, 1);
  timers.values().next().value();
  await pending;
  assert.deepEqual(cancelledFrames, [17]);
  assert.equal(timers.size, 0);
});

test('scheduleTaskCleanup waits until after the committed paint boundary', async () => {
  let frameCallback;
  const timers = new Map();
  let nextTimer = 0;
  let destroyed = 0;
  let committed = 0;
  const task = { destroy: () => ++destroyed };
  const pending = scheduleTaskCleanup([task, task], {
    afterCommit: () => ++committed,
    requestFrame(callback) {
      frameCallback = callback;
      return 23;
    },
    cancelFrame() {},
    setTimer(callback) {
      const id = ++nextTimer;
      timers.set(id, callback);
      return id;
    },
    clearTimer(id) {
      timers.delete(id);
    },
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(committed, 1);
  assert.equal(destroyed, 0);
  frameCallback();
  assert.equal(destroyed, 0);
  [...timers.values()].at(-1)();
  await pending;
  assert.equal(destroyed, 1);
});
