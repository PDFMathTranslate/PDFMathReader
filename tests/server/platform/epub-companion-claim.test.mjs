import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isEPUBPath } from '../../../electron/main/services/documents.mjs';

// Exercise the composition root's real claim entry points without starting Electron.
const source = await readFile(new URL('../../../electron/main.mjs', import.meta.url), 'utf8');
const claims = source.slice(
  source.indexOf('  const claimCompanionID ='),
  source.indexOf('  const companionOwnership ='),
);
const createClaims = new Function(
  'isEPUBPath',
  'recents',
  'companion',
  `
  const windows = new Map(), desktopClaimsInFlight = new Map();
  const registry = { stateFor: () => undefined };
  const desktopSessionID = () => 'session';
  const handoffLockWaitMs = 30000;
  const recentIDForPath = path => recents.path('recent') === path ? 'recent' : undefined;
  const notifyCompanionLock = () => {};
  ${claims}
  return { byID: claimCompanionID, byPath: claimCompanionPath };
`,
);

test('EPUB launch and recent opens bypass PDF-only companion claims', async () => {
  for (const path of ['/books/new.epub', '/books/RECENT.EPUB']) {
    const recents = { path: () => path, prepare: () => assert.fail('prepared EPUB for companion') };
    const companion = { claimDesktopDocument: () => assert.fail('claimed EPUB as PDF') };
    const claim = createClaims(isEPUBPath, recents, companion);
    assert.deepEqual(await claim.byPath(path, {}), { available: false });
    assert.deepEqual(await claim.byID('recent', {}), { available: false });
  }
});

test('PDF opens still claim companion ownership', async () => {
  const calls = [];
  const claim = createClaims(
    isEPUBPath,
    { path: () => '/books/book.pdf' },
    {
      claimDesktopDocument: async (...args) => {
        calls.push(args);
        return { claimed: true };
      },
    },
  );
  assert.deepEqual(await claim.byPath('/books/book.pdf', {}), { claimed: true });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ['recent', 'session', 'This Mac']);
});
