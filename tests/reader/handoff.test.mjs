import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import {
  createHandoff,
  readingActivity,
  READING_ACTIVITY,
} from '../../electron/platform/macos/handoff.mjs';

function fixture(platform = 'darwin') {
  const app = new EventEmitter();
  const published = [],
    resumed = [],
    continued = [],
    errors = [];
  let invalidated = 0;
  let current = {
    version: 1,
    documentID: 'known-id',
    page: 3,
    serverURL: 'http://mac.local:3000',
    token: 'secret',
  };
  app.setUserActivity = (...args) => published.push(args);
  app.invalidateCurrentActivity = () => invalidated++;
  const handoff = createHandoff({
    app,
    platform,
    current: () => current,
    resume: (value) => resumed.push(value),
    onActivityWasContinued: (value) => continued.push(value),
    onError: (error) => errors.push(error),
  });
  return {
    app,
    handoff,
    published,
    resumed,
    continued,
    errors,
    invalidated: () => invalidated,
    setCurrent: (value) => {
      current = value;
    },
  };
}

test('publishes minimal activity, updates pages, and clears inactive documents', () => {
  const f = fixture();
  f.handoff.ready();
  assert.deepEqual(f.published, [
    [
      READING_ACTIVITY,
      { version: 1, documentID: 'known-id', page: 3, serverURL: 'http://mac.local:3000' },
    ],
  ]);
  f.handoff.refresh();
  assert.equal(f.published.length, 1);
  f.setCurrent(null);
  f.handoff.refresh();
  assert.equal(f.invalidated(), 1);
  f.handoff.close();
  f.app.emit('browser-window-focus');
  assert.equal(f.published.length, 1);
});

test('queues cold launch and drops untrusted fields before resuming', async () => {
  const f = fixture();
  let prevented = 0;
  f.app.emit('continue-activity', { preventDefault: () => prevented++ }, READING_ACTIVITY, {
    version: 1,
    documentID: 'known-id',
    page: 7,
    path: '/private/file',
    serverURL: 'http://untrusted',
  });
  assert.equal(f.resumed.length, 0);
  f.handoff.ready();
  await new Promise(setImmediate);
  assert.equal(prevented, 1);
  assert.deepEqual(f.resumed, [{ version: 1, documentID: 'known-id', page: 7 }]);
});

test('rejects malformed activities and ignores unrelated types', () => {
  for (const value of [
    null,
    {},
    { version: 1, documentID: '../file', page: 1 },
    { version: 1, documentID: 'id', page: 0 },
    { version: 1, documentID: 'id', page: 1.5 },
  ])
    assert.equal(readingActivity(value), null);
  const f = fixture();
  f.app.emit(
    'continue-activity',
    {
      preventDefault() {
        throw Error('unrelated activity intercepted');
      },
    },
    'other',
    {},
  );
  f.app.emit('continue-activity', { preventDefault() {} }, READING_ACTIVITY, {});
  assert.equal(f.errors.length, 1);
});

test('does not call macOS APIs on other platforms', () => {
  const f = fixture('win32');
  f.handoff.ready();
  f.handoff.refresh();
  f.handoff.close();
  assert.equal(f.published.length, 0);
  assert.equal(f.invalidated(), 0);
});

test('keeps activity across Dock switching and reports native continuation errors', () => {
  const f = fixture();
  f.handoff.ready();
  f.setCurrent(null);
  f.app.emit('browser-window-blur');
  assert.equal(f.invalidated(), 0);
  f.app.emit('continue-activity-error', {}, 'other', 'ignored');
  assert.equal(f.errors.length, 0);
  f.app.emit('continue-activity-error', {}, READING_ACTIVITY, 'Device unavailable');
  assert.equal(f.errors[0].message, 'Device unavailable');
});

test('flushes the source activity after native Handoff continuation', async () => {
  const f = fixture();
  f.app.emit('activity-was-continued', {}, READING_ACTIVITY, {
    version: 1,
    documentID: 'known-id',
    page: 9,
    serverURL: 'ignored-by-receiver',
  });
  await new Promise(setImmediate);
  assert.deepEqual(f.continued, [{ version: 1, documentID: 'known-id', page: 9 }]);
  f.app.emit('activity-was-continued', {}, READING_ACTIVITY, {
    version: 1,
    documentID: '../private-file',
    page: 1,
  });
  assert.equal(f.errors.length, 1);
});
