import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Exercise the startup orchestration without starting Electron or a backend.
const source = await readFile(new URL('../../../electron/main.mjs', import.meta.url), 'utf8');
const start = source.indexOf(
  '      if (!smoke && !ciLaunchCheck && preferences.load().restoreDocuments)',
);
const end = source.indexOf('      backend = windows.get(window).backend;', start);
assert.ok(start >= 0 && end > start);
const restore = new Function(
  'context',
  `return (async () => {
    const { preferences, documentSession, validateSystemPDF, windowController, windows, console } = context;
    const smoke = false, ciLaunchCheck = false, externalLaunch = false;
    const openLaunchFiles = async () => {};
    let window;
    ${source.slice(start, end)}
    return window;
  })();`,
);

for (const stage of ['validation', 'open']) {
  test(`startup shows the start page after a ${stage} failure`, async () => {
    const windows = new Map();
    const blank = {};
    const errors = [];
    const result = await restore({
      preferences: { load: () => ({ restoreDocuments: true }) },
      documentSession: { restore: () => [{ path: '/locked.pdf' }] },
      validateSystemPDF: async () => {
        if (stage === 'validation') throw Error('File unavailable');
      },
      windowController: {
        openDocumentWindow: async () => {
          throw Error('Companion locked');
        },
        createWindow: async () => {
          windows.set(blank, {});
          return blank;
        },
      },
      windows,
      console: { warn: (...args) => errors.push(args) },
    });
    assert.equal(result, blank);
    assert.equal(errors.length, 1);
  });
}

test('startup shows the start page when reading the saved session fails', async () => {
  const windows = new Map();
  const blank = {};
  const errors = [];
  const result = await restore({
    preferences: { load: () => ({ restoreDocuments: true }) },
    documentSession: {
      restore: () => {
        throw Error('Session unavailable');
      },
    },
    windowController: {
      createWindow: async () => {
        windows.set(blank, {});
        return blank;
      },
    },
    windows,
    console: { warn: (...args) => errors.push(args) },
  });
  assert.equal(result, blank);
  assert.equal(errors.length, 1);
});

test('startup continues restoring other documents after one cannot open', async () => {
  const windows = new Map();
  const restored = {};
  const opened = [];
  const result = await restore({
    preferences: { load: () => ({ restoreDocuments: true }) },
    documentSession: { restore: () => [{ path: '/locked.pdf' }, { path: '/readable.pdf' }] },
    validateSystemPDF: async () => {},
    windowController: {
      openDocumentWindow: async (path) => {
        opened.push(path);
        if (path === '/locked.pdf') throw Error('Companion locked');
        windows.set(restored, {});
        return restored;
      },
      focusDocumentWindow: () => {},
      createWindow: async () => assert.fail('A restored document already has a window'),
    },
    windows,
    console: { warn: () => {} },
  });
  assert.equal(result, restored);
  assert.deepEqual(opened, ['/locked.pdf', '/readable.pdf']);
});
