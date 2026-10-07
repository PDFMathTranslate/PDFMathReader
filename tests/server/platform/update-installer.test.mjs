import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createUpdateInstaller } from '../../../electron/main/services/update-installer.mjs';

const assetUrl =
  'https://github.com/PDFMathTranslate/PDFMathReader/releases/download/v0.2.0/PDFMathReader-darwin-arm64.zip';

function appFixture(root) {
  return {
    getVersion: () => '0.1.0',
    getPath(name) {
      if (name === 'userData') return join(root, 'user-data');
      if (name === 'exe')
        return join(root, 'PDFMathReader.app', 'Contents', 'MacOS', 'PDFMathReader');
      throw Error('unexpected app path: ' + name);
    },
  };
}

function signatureCommand(output) {
  return (_command, args) => {
    if (args[0] === '-dv') return output;
    if (args[0] === '--verify') return '';
    if (args[0] === '-extract') return '0.2.0\n';
    throw Error('unexpected command: ' + args.join(' '));
  };
}

function downloadFixture() {
  const bytes = new Uint8Array([1, 2, 3, 4, 5]);
  const digest = createHash('sha256').update(bytes).digest('hex');
  return {
    bytes,
    metadata: {
      downloadUrl: assetUrl,
      latestVersion: '0.2.0',
      downloadDigest: 'sha256:' + digest,
      downloadSize: bytes.byteLength,
    },
  };
}

async function fakeVerificationTools(root) {
  const codesignPath = join(root, 'codesign-fixture.sh');
  const plutilPath = join(root, 'plutil-fixture.sh');
  await writeFile(
    codesignPath,
    `#!/bin/sh
if [ "$1" = "-dv" ]; then
  echo "Identifier=local.previewtranslate.reader"
  echo "TeamIdentifier=TEAM123"
  exit 0
fi
if [ "$1" = "--verify" ]; then
  if [ -n "$PDFMATHREADER_FAIL_TARGET" ] && [ "$4" = "$PDFMATHREADER_FAIL_TARGET" ] && [ -f "$4/FAIL" ]; then
    exit 1
  fi
  exit 0
fi
exit 2
`,
    { mode: 0o700 },
  );
  await writeFile(plutilPath, "#!/bin/sh\nprintf '0.2.0\\n'\n", { mode: 0o700 });
  await chmod(codesignPath, 0o700);
  await chmod(plutilPath, 0o700);
  return { codesignPath, plutilPath };
}

async function waitForResult(path, timeout = 3000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    try {
      return JSON.parse(await readFile(path, 'utf8'));
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
}

async function terminate(child) {
  if (!child || child.exitCode !== null || child.signalCode || child.killed) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill('SIGTERM');
  await exited;
}

test('unsupported platforms do not attempt to download or run an installer', async () => {
  let downloads = 0;
  const installer = createUpdateInstaller({
    platform: 'win32',
    arch: 'x64',
    app: {
      getVersion: () => '0.1.0',
      getPath: () => '/tmp/PDFMathReader.exe',
    },
    fetchImpl: async () => {
      downloads++;
      throw Error('download must not run');
    },
    environment: { PORTABLE_EXECUTABLE_FILE: '/Applications/PDFMathReader.exe' },
  });

  assert.equal(installer.supported, false);
  assert.match(installer.unsupportedReason, /portable executable/);
  await assert.rejects(
    installer.prepare({
      downloadUrl:
        'https://github.com/PDFMathTranslate/PDFMathReader/releases/download/v0.2.0/PDFMathReader-win32-x64.exe',
      latestVersion: '0.2.0',
      downloadDigest: 'sha256:' + 'a'.repeat(64),
      downloadSize: 1,
    }),
    { code: 'unsupported' },
  );
  assert.equal(downloads, 0);
});

test('macOS preparation validates the release, stages the app, and installs through a detached helper', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pdfmathreader-update-installer-'));
  try {
    const app = appFixture(root);
    const installedBundle = join(root, 'PDFMathReader.app');
    await mkdir(join(installedBundle, 'Contents', 'MacOS'), { recursive: true });
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const digest = createHash('sha256').update(bytes).digest('hex');
    const progress = [];
    const spawns = [];
    const installer = createUpdateInstaller({
      app,
      platform: 'darwin',
      arch: 'arm64',
      appBundlePath: installedBundle,
      fetchImpl: async (url) => {
        assert.equal(url, assetUrl);
        return new Response(bytes, {
          status: 200,
          headers: { 'content-length': String(bytes.byteLength) },
        });
      },
      runCommandSync: signatureCommand(
        'Identifier=local.previewtranslate.reader\nTeamIdentifier=TEAM123\n',
      ),
      extractZip: async (_archivePath, destination) => {
        const staged = join(destination, 'PDFMathReader.app');
        await mkdir(join(staged, 'Contents', 'MacOS'), { recursive: true });
      },
      readBundleVersion: async () => '0.2.0',
      processExecPath: '/tmp/Electron',
      parentPid: 8765,
      environment: { PATH: '/usr/bin' },
      spawnImpl: (executable, args, options) => {
        const child = {
          unrefCalled: false,
          unref() {
            this.unrefCalled = true;
          },
        };
        spawns.push({ executable, args, options, child });
        return child;
      },
    });

    assert.equal(installer.supported, true);
    const ready = await installer.prepare(
      {
        downloadUrl: assetUrl,
        latestVersion: '0.2.0',
        downloadDigest: 'sha256:' + digest,
        downloadSize: bytes.byteLength,
      },
      (event) => progress.push(event),
    );

    assert.equal(typeof ready, 'function');
    assert.equal(ready.installOnQuit, ready);
    assert.equal(progress.at(-1), 1);
    const manifest = JSON.parse(await readFile(ready.manifestPath, 'utf8'));
    assert.equal(manifest.expectedVersion, '0.2.0');
    assert.equal(manifest.targetPath, installedBundle);
    assert.equal(manifest.platform, 'darwin');
    assert.deepEqual(manifest.identity, {
      identifier: 'local.previewtranslate.reader',
      teamIdentifier: 'TEAM123',
    });
    assert.equal(manifest.resultPath, ready.resultPath);
    const helper = await readFile(ready.helperPath, 'utf8');
    assert.match(helper, /codesign/);
    assert.match(helper, /writeResult/);
    const syntax = spawnSync(process.execPath, ['--check', ready.helperPath], { encoding: 'utf8' });
    assert.equal(syntax.status, 0, syntax.stderr);
    assert.match(ready.helperPath, /user-data[\\/]updates[\\/]\.update-helper-/);

    const child = installer.installOnQuit();
    assert.equal(child, spawns[0].child);
    assert.equal(spawns.length, 1);
    assert.deepEqual(spawns[0].args, [ready.helperPath, ready.manifestPath, ready.resultPath]);
    assert.equal(spawns[0].options.detached, true);
    assert.equal(spawns[0].options.stdio, 'ignore');
    assert.equal(spawns[0].options.env.ELECTRON_RUN_AS_NODE, '1');
    assert.equal(spawns[0].child.unrefCalled, true);
    assert.equal(ready(), child);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('preparation rejects untrusted assets, missing digests, and truncated downloads', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pdfmathreader-update-installer-invalid-'));
  try {
    const app = appFixture(root);
    const installedBundle = join(root, 'PDFMathReader.app');
    const installer = createUpdateInstaller({
      app,
      platform: 'darwin',
      arch: 'arm64',
      appBundlePath: installedBundle,
      fetchImpl: async () => new Response(new Uint8Array([1, 2]), { status: 200 }),
      runCommandSync: signatureCommand(
        'Identifier=local.previewtranslate.reader\nTeamIdentifier=TEAM123\n',
      ),
      extractZip: async () => assert.fail('archive must not be extracted'),
    });

    await assert.rejects(
      installer.prepare({
        downloadUrl:
          'https://evil.test/PDFMathTranslate/PDFMathReader/releases/download/v0.2.0/PDFMathReader-darwin-arm64.zip',
        latestVersion: '0.2.0',
        downloadDigest: 'sha256:' + 'a'.repeat(64),
        downloadSize: 2,
      }),
      { code: 'INVALID_UPDATE' },
    );
    await assert.rejects(
      installer.prepare({
        downloadUrl: assetUrl,
        latestVersion: '0.2.0',
        downloadDigest: undefined,
        downloadSize: 2,
      }),
      { code: 'INVALID_UPDATE' },
    );
    await assert.rejects(
      installer.prepare({
        downloadUrl: assetUrl,
        latestVersion: '0.2.0',
        downloadDigest: 'sha256:' + 'a'.repeat(64),
        downloadSize: 3,
      }),
      { code: 'DOWNLOAD_FAILED' },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('preparation rejects a mismatched signing identity and a mismatched staged version', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pdfmathreader-update-installer-identity-'));
  try {
    const fixture = downloadFixture();
    const installedBundle = join(root, 'PDFMathReader.app');
    const app = appFixture(root);
    const common = {
      app,
      platform: 'darwin',
      arch: 'arm64',
      appBundlePath: installedBundle,
      fetchImpl: async () =>
        new Response(fixture.bytes, {
          status: 200,
          headers: { 'content-length': String(fixture.bytes.byteLength) },
        }),
      extractZip: async (_archivePath, destination) => {
        await mkdir(join(destination, 'PDFMathReader.app', 'Contents', 'MacOS'), {
          recursive: true,
        });
      },
    };
    const mismatchedIdentity = createUpdateInstaller({
      ...common,
      runCommandSync: (_command, args) => {
        if (args[0] === '-dv' && args.at(-1).includes('/extracted/'))
          return 'Identifier=local.previewtranslate.reader\nTeamIdentifier=OTHER\n';
        if (args[0] === '-dv')
          return 'Identifier=local.previewtranslate.reader\nTeamIdentifier=TEAM123\n';
        return '';
      },
      readBundleVersion: async () => '0.2.0',
    });
    await assert.rejects(mismatchedIdentity.prepare(fixture.metadata), {
      code: 'SIGNATURE_INVALID',
    });

    const mismatchedVersion = createUpdateInstaller({
      ...common,
      runCommandSync: signatureCommand(
        'Identifier=local.previewtranslate.reader\nTeamIdentifier=TEAM123\n',
      ),
      readBundleVersion: async () => '0.1.9',
    });
    await assert.rejects(mismatchedVersion.prepare(fixture.metadata), {
      code: 'INVALID_UPDATE',
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('detached helper waits for the parent, swaps the app, and records a durable success result', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pdfmathreader-update-installer-helper-'));
  const parent = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    stdio: 'ignore',
  });
  try {
    const fixture = downloadFixture();
    const installedBundle = join(root, 'PDFMathReader.app');
    const oldMarker = join(installedBundle, 'old.txt');
    await mkdir(join(installedBundle, 'Contents', 'MacOS'), { recursive: true });
    await writeFile(oldMarker, 'old');
    const tools = await fakeVerificationTools(root);
    const installer = createUpdateInstaller({
      app: appFixture(root),
      platform: 'darwin',
      arch: 'arm64',
      appBundlePath: installedBundle,
      codesignPath: tools.codesignPath,
      plutilPath: tools.plutilPath,
      fetchImpl: async () =>
        new Response(fixture.bytes, {
          status: 200,
          headers: { 'content-length': String(fixture.bytes.byteLength) },
        }),
      runCommandSync: signatureCommand(
        'Identifier=local.previewtranslate.reader\nTeamIdentifier=TEAM123\n',
      ),
      extractZip: async (_archivePath, destination) => {
        await mkdir(join(destination, 'PDFMathReader.app', 'Contents', 'MacOS'), {
          recursive: true,
        });
        await writeFile(join(destination, 'PDFMathReader.app', 'new.txt'), 'new');
      },
      readBundleVersion: async () => '0.2.0',
      parentPid: parent.pid,
      processExecPath: process.execPath,
      environment: {},
    });
    const ready = await installer.prepare(fixture.metadata);
    installer.installOnQuit();
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(await readFile(oldMarker, 'utf8'), 'old');
    await assert.rejects(readFile(installer.resultPath));

    await terminate(parent);
    const result = await waitForResult(installer.resultPath);
    assert.equal(result.status, 'installed');
    assert.equal(result.version, '0.2.0');
    assert.equal(await readFile(join(installedBundle, 'new.txt'), 'utf8'), 'new');
    const siblings = await readdir(root);
    assert.ok(siblings.some((entry) => entry.startsWith('PDFMathReader.app.previous-')));
    assert.equal(await readFile(ready.resultPath, 'utf8'), JSON.stringify(result));
  } finally {
    await terminate(parent);
    await rm(root, { recursive: true, force: true });
  }
});

test('helper rolls back the original app when final copied-app verification fails', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pdfmathreader-update-installer-rollback-'));
  const parent = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    stdio: 'ignore',
  });
  try {
    const fixture = downloadFixture();
    const installedBundle = join(root, 'PDFMathReader.app');
    const oldMarker = join(installedBundle, 'old.txt');
    await mkdir(join(installedBundle, 'Contents', 'MacOS'), { recursive: true });
    await writeFile(oldMarker, 'old');
    const tools = await fakeVerificationTools(root);
    const installer = createUpdateInstaller({
      app: appFixture(root),
      platform: 'darwin',
      arch: 'arm64',
      appBundlePath: installedBundle,
      codesignPath: tools.codesignPath,
      plutilPath: tools.plutilPath,
      fetchImpl: async () => new Response(fixture.bytes, { status: 200 }),
      runCommandSync: signatureCommand(
        'Identifier=local.previewtranslate.reader\nTeamIdentifier=TEAM123\n',
      ),
      extractZip: async (_archivePath, destination) => {
        await mkdir(join(destination, 'PDFMathReader.app', 'Contents', 'MacOS'), {
          recursive: true,
        });
        await writeFile(join(destination, 'PDFMathReader.app', 'FAIL'), 'fail');
      },
      readBundleVersion: async () => '0.2.0',
      parentPid: parent.pid,
      processExecPath: process.execPath,
      environment: { PDFMATHREADER_FAIL_TARGET: installedBundle },
    });
    await installer.prepare(fixture.metadata);
    installer.installOnQuit();
    await terminate(parent);
    const result = await waitForResult(installer.resultPath);
    assert.equal(result.status, 'error');
    assert.match(result.message, /exited with status 1/);
    assert.equal(await readFile(oldMarker, 'utf8'), 'old');
    await assert.rejects(readFile(join(installedBundle, 'FAIL')));
  } finally {
    await terminate(parent);
    await rm(root, { recursive: true, force: true });
  }
});
