import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installUvRuntime } from '../../../server/kernels/install-uv.mjs';

test('existing uv skips downloading and running an installer', async () => {
  const state = { available: true, version: 'uv 1' };
  assert.equal(
    await installUvRuntime({
      detect: async () => state,
      fetchImpl: () => assert.fail('download'),
      run: () => assert.fail('run'),
    }),
    state,
  );
});
for (const platform of ['darwin', 'linux', 'win32']) {
  test(`missing uv installs and verifies on ${platform} without changing shell profiles`, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'uv-guide-test-'));
    let installed = false,
      scriptPath;
    try {
      const result = await installUvRuntime({
        directory,
        platform,
        detect: async () => ({ available: installed }),
        fetchImpl: async (url) => {
          assert.equal(url, `https://astral.sh/uv/install.${platform === 'win32' ? 'ps1' : 'sh'}`);
          return new Response('test installer');
        },
        run: async (command, args, options) => {
          assert.equal(command, platform === 'win32' ? 'powershell.exe' : '/bin/sh');
          scriptPath = args.at(-1);
          assert.equal(await readFile(scriptPath, 'utf8'), 'test installer');
          assert.equal(options.env.UV_INSTALL_DIR, directory);
          assert.equal(options.env.UV_NO_MODIFY_PATH, '1');
          installed = true;
        },
      });
      assert.equal(result.available, true);
      await assert.rejects(access(scriptPath));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}
test('installer success alone does not report an available runtime', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'uv-guide-failure-'));
  try {
    await assert.rejects(
      installUvRuntime({
        directory,
        detect: async () => ({ available: false }),
        fetchImpl: async () => new Response('test'),
        run: async () => {},
      }),
      /verified/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
