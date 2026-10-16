import test from 'node:test';
import assert from 'node:assert/strict';
import { registerDocumentIPC } from '../../../electron/main/ipc/document-ipc.mjs';
function fixture(otherStates, options = {}) {
  const handlers = new Map(),
    current = { id: 1, isDestroyed: () => false };
  const state = {
    documentIdentity: 'current.pdf',
    performance: { hasDocument: true },
    documents: [],
  };
  const windows = new Map([
    [current, state],
    ...otherStates.map((other, i) => [
      { id: i + 2, isDestroyed: () => !!other.destroyed },
      { performance: { hasDocument: false }, documents: [], ...other },
    ]),
  ]);
  const closed = [];
  registerDocumentIPC({
    handle: (name, fn) => handlers.set(name, fn),
    trustedWindow: () => current,
    registry: { windows, stateFor: () => state },
    documentSession: {
      close: async (id) => {
        closed.push(id);
        options.order?.push('session');
      },
    },
    releaseCompanionDocument: async () => options.order?.push('release'),
  });
  return { close: () => handlers.get('documents:closed')({}), closed, state };
}
test('another document or queued document closes the current window after session persistence', async () => {
  for (const other of [{ documentIdentity: 'other.pdf' }, { documents: ['opening.pdf'] }]) {
    const f = fixture([other]);
    assert.deepEqual(await f.close(), { closeWindow: true });
    assert.deepEqual(f.closed, [1]);
    assert.equal(f.state.documentIdentity, null);
    assert.equal(f.state.performance.hasDocument, false);
  }
});
test('blank, settings, closing and destroyed windows do not remove the last document window', async () => {
  const f = fixture([
    {},
    { settingsOwner: {}, documentIdentity: 'settings' },
    { closing: true, documentIdentity: 'closing.pdf' },
    { destroyed: true, documentIdentity: 'gone.pdf' },
  ]);
  assert.deepEqual(await f.close(), { closeWindow: false });
  assert.deepEqual(f.closed, [1]);
});

test('desktop ownership releases after the persisted document session closes', async () => {
  const order = [];
  const f = fixture([], { order });
  await f.close();
  assert.deepEqual(order, ['session', 'release']);
});
