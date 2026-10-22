import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const warm = fileURLToPath(new URL('../../../electron/app-icons/warm.png', import.meta.url));
const art = fileURLToPath(new URL('../../../electron/app-icons/art.png', import.meta.url));
import { createPersistentAppIcon } from '../../../electron/main/services/persistent-app-icon.mjs';

const app = { isPackaged: true, getPath: () => '/Applications/Reader.app/Contents/MacOS/Reader' };

test('persists the bundle icon, serializes changes, and skips successful duplicates', async () => {
  const calls = [];
  let running = false;
  const persist = createPersistentAppIcon({
    app,
    platform: 'darwin',
    run: async (command, args) => {
      assert.equal(running, false);
      running = true;
      await Promise.resolve();
      assert.deepEqual(await readFile(args.at(-1)), await readFile(calls.length ? art : warm));
      calls.push({ command, args });
      running = false;
    },
  });
  await Promise.all([persist(warm), persist(warm), persist(art)]);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].command, '/usr/bin/osascript');
  assert.deepEqual(calls[0].args.slice(-3, -1), ['--', '/Applications/Reader.app']);
  await assert.rejects(access(calls[0].args.at(-1)));
  await assert.rejects(access(calls[1].args.at(-1)));
});

test('retries failed writes and reports errors', async () => {
  let attempts = 0;
  const persist = createPersistentAppIcon({
    app,
    platform: 'darwin',
    run: async () => {
      if (++attempts === 1) throw Error('read-only');
    },
  });
  await assert.rejects(persist(warm), /read-only/);
  await persist(warm);
  assert.equal(attempts, 2);
});

test('does not customize Electron development or non-macOS apps', async () => {
  const run = async () => assert.fail('unexpected icon write');
  await createPersistentAppIcon({ app: { isPackaged: false }, platform: 'darwin', run })(
    '/icon.png',
  );
  await createPersistentAppIcon({ app, platform: 'win32', run })('/icon.png');
});
