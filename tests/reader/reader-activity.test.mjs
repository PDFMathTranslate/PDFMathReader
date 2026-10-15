import test from 'node:test';
import assert from 'node:assert/strict';
import { createReaderActivity } from '../../src/features/reader/reader-activity.mjs';

function fixture(t) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const previousWindow = globalThis.window;
  const previousCancel = globalThis.cancelAnimationFrame;
  globalThis.window = {};
  globalThis.cancelAnimationFrame = () => {};
  t.after(() => {
    globalThis.window = previousWindow;
    globalThis.cancelAnimationFrame = previousCancel;
    t.mock.timers.reset();
  });
  const activity = {
    foreground: { value: true },
    activityActive: { value: true },
    performanceRecorder: { setActive() {} },
  };
  const preferences = { reduceResourceUsage: { value: true } };
  const calls = { suspend: 0, release: 0, resume: 0, save: 0, pump: 0 };
  const runtime = {};
  const reader = createReaderActivity({
    session: {},
    preferences,
    activity,
    translationState: {},
    renderState: {},
    feedback: { reading: { value: '' } },
    runtime,
    actions: {
      rootActions: {
        pageHidden: () => false,
        stopRecentPreviews() {},
        scheduleRecentPreviews() {},
      },
      readerFit: { cancelResize() {} },
      readingPosition: { saveReadingView: async () => calls.save++ },
      canvasRendering: {
        suspendRendering: () => calls.suspend++,
        resetBitmaps: () => calls.release++,
      },
      readerViewport: { scheduleViewport: () => calls.resume++ },
      thumbnails: { observeThumbnails() {} },
      readerScroll: { settle() {} },
      translationQueue: { pumpPages: () => calls.pump++, pump() {} },
    },
  });
  return { reader, activity, preferences, calls, runtime };
}

test('duplicate inactivity events keep the original eviction deadline', (t) => {
  const f = fixture(t);
  f.activity.activityActive.value = false;
  f.reader.visibility();
  t.mock.timers.tick(800);
  f.reader.visibility();
  t.mock.timers.tick(200);
  assert.equal(f.calls.suspend, 1);
  assert.equal(f.calls.save, 1);
  assert.equal(f.calls.release, 1);
  assert.equal(f.runtime.resourceReleaseTimer, undefined);
  f.activity.activityActive.value = true;
  f.reader.visibility();
  f.reader.visibility();
  assert.equal(f.calls.resume, 1);
  assert.equal(f.calls.pump, 1);
});

test('quick switches cancel eviction and disabling resource saving resumes an inactive reader', (t) => {
  const f = fixture(t);
  f.activity.activityActive.value = false;
  f.reader.visibility();
  t.mock.timers.tick(500);
  f.activity.activityActive.value = true;
  f.reader.visibility();
  t.mock.timers.tick(500);
  assert.equal(f.calls.release, 0);
  f.activity.activityActive.value = false;
  f.reader.visibility();
  f.preferences.reduceResourceUsage.value = false;
  f.reader.visibility();
  t.mock.timers.tick(1000);
  assert.equal(f.calls.release, 0);
  assert.equal(f.activity.foreground.value, true);
});
