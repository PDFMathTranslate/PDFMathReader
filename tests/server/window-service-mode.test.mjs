import test from 'node:test';
import assert from 'node:assert/strict';
import { createWindowServiceMode } from '../../electron/main/windows/window-service-mode.mjs';

const DELAY_MS = 5;

function fakeWindow({ minimized = false, visible = true, destroyed = false } = {}) {
  return {
    minimized,
    visible,
    destroyed,
    isDestroyed() {
      return this.destroyed;
    },
    isMinimized() {
      return this.minimized;
    },
    isVisible() {
      return this.visible;
    },
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function destroyedWindow() {
  const target = fakeWindow({ destroyed: true });
  target.isMinimized = () => {
    throw Error('destroyed window was inspected');
  };
  return target;
}

function harness(entries, options = {}) {
  const windows = new Map(entries);
  const registry = {
    windows,
    stateFor: (target) => windows.get(target),
  };
  const service = createWindowServiceMode({
    registry,
    activeFor: options.activeFor,
    prepare: options.prepare || (async () => ({ documentId: 'document-1' })),
    suspend: options.suspend || (() => {}),
    resume: options.resume || (() => {}),
    delayMs: DELAY_MS,
  });
  return { registry, service };
}

async function waitFor(predicate, timeoutMs = 300) {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for service-mode transition');
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}

async function observed(predicate, timeoutMs = 60) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  return false;
}

test('enters service mode only after every live window is minimized', async (t) => {
  const first = fakeWindow({ minimized: true });
  const second = fakeWindow({ minimized: false });
  let prepared = 0;
  const { service } = harness(
    [
      [first, {}],
      [second, {}],
    ],
    { prepare: async () => (++prepared, { documentId: 'document-1' }) },
  );
  t.after(() => service.stop());

  service.update();
  assert.equal(await observed(() => prepared > 0), false);

  second.minimized = true;
  service.update();
  await waitFor(() => prepared === 2);
  assert.equal(service.allMinimized(), true);
});

test('counts an inactive hidden tab through activeFor when its active tab is minimized', async (t) => {
  const active = fakeWindow({ minimized: true, visible: false });
  const inactive = fakeWindow({ minimized: false, visible: false });
  let prepared = 0;
  const { service } = harness([[inactive, {}]], {
    activeFor: (target) => (target === inactive ? active : target),
    prepare: async () => (++prepared, { documentId: 'tab-document' }),
  });
  t.after(() => service.stop());

  service.update();
  await waitFor(() => prepared === 1);
  assert.equal(service.allMinimized(), true);
});

test('does not count an ordinary hidden window as minimized', async (t) => {
  const hidden = fakeWindow({ minimized: false, visible: false });
  let prepared = 0;
  const { service } = harness([[hidden, {}]], {
    prepare: async () => (++prepared, { documentId: 'hidden-document' }),
  });
  t.after(() => service.stop());

  service.update();
  assert.equal(service.allMinimized(), false);
  assert.equal(await observed(() => prepared > 0), false);
});

test('ignores destroyed settings owners and active tabs when checking minimization', (t) => {
  const settingsOwner = destroyedWindow();
  const settingsWindow = fakeWindow({ visible: false });
  const settingsHarness = harness([[settingsWindow, { settingsOwner }]], {
    activeFor: (target) => (target === settingsOwner ? settingsOwner : target),
  });
  t.after(() => settingsHarness.service.stop());

  assert.equal(settingsHarness.service.allMinimized(), false);

  const activeTab = destroyedWindow();
  const ordinaryWindow = fakeWindow({ visible: false });
  const ordinaryHarness = harness([[ordinaryWindow, {}]], {
    activeFor: () => activeTab,
  });
  t.after(() => ordinaryHarness.service.stop());

  assert.equal(ordinaryHarness.service.allMinimized(), false);
});

test('a prepare failure leaves the window live and skips suspension', async (t) => {
  const target = fakeWindow({ minimized: true });
  const state = {};
  let prepared = 0;
  let suspended = 0;
  const { service } = harness([[target, state]], {
    prepare: async () => {
      prepared++;
      throw Error('save failed');
    },
    suspend: () => suspended++,
  });
  t.after(() => service.stop());

  service.update();
  await waitFor(() => prepared > 0 && state.serviceMode === null);
  service.stop();
  assert.equal(suspended, 0);
  assert.equal(state.serviceMode, null);
});

test('a rapid restore while prepare is unresolved cancels suspension', async (t) => {
  const target = fakeWindow({ minimized: true, visible: false });
  const state = {};
  const saving = deferred();
  let suspended = 0;
  let resumed = 0;
  const { service } = harness([[target, state]], {
    prepare: () => saving.promise,
    suspend: () => suspended++,
    resume: () => resumed++,
  });
  t.after(() => service.stop());

  service.update();
  await waitFor(() => state.serviceMode?.phase === 'saving');
  target.minimized = false;
  target.visible = true;
  service.update();
  saving.resolve({ documentId: 'late-document' });
  await waitFor(() => state.serviceMode === null);

  assert.equal(suspended, 0);
  assert.equal(resumed, 0);
});

test('suspends all windows and restores a visible window once with its snapshot', async (t) => {
  const target = fakeWindow({ minimized: true, visible: false });
  const other = fakeWindow({ minimized: true, visible: false });
  const snapshot = { documentId: 'retained-document', readingView: { page: 4 } };
  const otherSnapshot = { documentId: 'other-retained-document' };
  const state = {};
  const otherState = {};
  const suspended = [];
  const resumed = [];
  const { service } = harness(
    [
      [target, state],
      [other, otherState],
    ],
    {
      prepare: async (window) => (window === target ? snapshot : otherSnapshot),
      suspend: (window, savedSnapshot, savedState) =>
        suspended.push([window, savedSnapshot, savedState]),
      resume: (window, savedSnapshot) => resumed.push([window, savedSnapshot]),
    },
  );
  t.after(() => service.stop());

  service.update();
  await waitFor(() => suspended.length === 2);
  assert.deepEqual(suspended, [
    [target, snapshot, state],
    [other, otherSnapshot, otherState],
  ]);

  target.minimized = false;
  target.visible = true;
  service.update();
  await waitFor(() => resumed.length === 1);
  service.update();
  assert.equal(await observed(() => resumed.length > 1), false);

  assert.equal(resumed.length, 1);
  assert.equal(resumed[0][0], target);
  assert.equal(resumed[0][1], snapshot);
  assert.equal(state.serviceMode, null);
});

test('restores an unminimized window even while macOS reports it occluded', async (t) => {
  const active = fakeWindow({ minimized: true, visible: false });
  const inactive = fakeWindow({ minimized: false, visible: false });
  let suspended = 0;
  const resumed = [];
  const { service } = harness(
    [
      [active, {}],
      [inactive, {}],
    ],
    {
      activeFor: (target) => (target === inactive ? active : target),
      suspend: () => suspended++,
      resume: (window) => resumed.push(window),
    },
  );
  t.after(() => service.stop());

  service.update();
  await waitFor(() => suspended === 2);

  // Deminiaturized, but isVisible() is still false (occluded or another Space).
  active.minimized = false;
  service.update();
  await waitFor(() => resumed.length === 1);
  assert.deepEqual(resumed, [active]);
  // The hidden inactive tab keeps its suspension until it is selected.
  assert.equal(await observed(() => resumed.length > 1), false);
});

test('stopping during prepare cancels the pending suspension', async (t) => {
  const target = fakeWindow({ minimized: true, visible: false });
  const state = {};
  const saving = deferred();
  let suspended = 0;
  const { service } = harness([[target, state]], {
    prepare: () => saving.promise,
    suspend: () => suspended++,
  });
  t.after(() => service.stop());

  service.update();
  await waitFor(() => state.serviceMode?.phase === 'saving');
  service.stop();
  saving.resolve({ documentId: 'stopped-document' });
  await waitFor(() => state.serviceMode === null);

  assert.equal(suspended, 0);
});

test('a failed resume retains its snapshot for a later restore', async (t) => {
  const target = fakeWindow({ minimized: true, visible: false });
  const state = {};
  const snapshot = { documentId: 'retained-after-load-failure' };
  let attempts = 0;
  const { service } = harness([[target, state]], {
    prepare: async () => snapshot,
    resume: async () => {
      if (++attempts === 1) throw Error('transient load failure');
    },
  });
  t.after(() => service.stop());
  service.update();
  await waitFor(() => state.serviceMode?.phase === 'suspended');
  target.minimized = false;
  target.visible = true;
  service.update();
  await waitFor(() => attempts === 1 && state.serviceMode?.phase === 'suspended');
  assert.equal(state.serviceMode.snapshot, snapshot);
  service.update();
  await waitFor(() => attempts === 2 && state.serviceMode === null);
});
