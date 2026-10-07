import assert from 'node:assert/strict';
import test from 'node:test';
import { createPerformanceRecorder } from '../../src/features/developer/performance-recorder.mjs';

const stats = (requests) => ({
  requests,
  requestBodyBytes: requests * 10,
  responseBodyBytes: requests * 20,
  uploadBytes: requests * 10,
});

test('a baseline that finishes after upload stays window scoped', async () => {
  let resolveBaseline;
  let calls = 0;
  const baseline = new Promise((resolve) => {
    resolveBaseline = resolve;
  });
  const recorder = createPerformanceRecorder({
    native: { reset: async () => {}, sample: async () => null },
    fetchStats: async () => (++calls === 1 ? baseline : stats(12)),
  });

  recorder.start(100);
  recorder.beginTransport();
  resolveBaseline(stats(5));
  const report = await recorder.snapshot();

  assert.equal(report.transport.scope, 'window-session');
  assert.equal(report.transport.requests, 12);
  await recorder.finish();
});

test('finish freezes a closed state before a new document starts', async () => {
  let resolveOldBaseline;
  let calls = 0;
  const oldBaseline = new Promise((resolve) => {
    resolveOldBaseline = resolve;
  });
  const events = [];
  const recorder = createPerformanceRecorder({
    native: {
      reset: async () => events.push('reset'),
      sample: async () => null,
      save: (report) => events.push(`save:${report.fileBytes}`),
      end: () => events.push('end'),
    },
    fetchStats: async () => (++calls === 1 ? oldBaseline : stats(4)),
  });

  recorder.start(1);
  const oldFinish = recorder.finish();
  recorder.start(2);
  resolveOldBaseline(stats(3));
  await oldFinish;
  const current = await recorder.snapshot();

  assert.equal(current.fileBytes, 2);
  assert.equal(events.indexOf('end') < events.indexOf('reset'), true);
  await recorder.finish();
});
