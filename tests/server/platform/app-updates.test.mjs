import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createAppUpdates,
  compareVersions,
  releaseLink,
  RELEASE_API,
  MAX_UPDATE_ERROR_DETAIL_LENGTH,
} from '../../../electron/main/services/app-updates.mjs';
const release = (version = 'v0.2.0') => ({
  tag_name: version,
  html_url: `https://github.com/PDFMathTranslate/PDFMathReader/releases/tag/${version}`,
  draft: false,
  prerelease: false,
  assets: [
    {
      name: 'PDFMathReader-darwin-arm64.zip',
      browser_download_url: `https://github.com/PDFMathTranslate/PDFMathReader/releases/download/${version}/PDFMathReader-darwin-arm64.zip`,
    },
  ],
});
const response = (status, data) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: new Headers({ etag: '"release-test"' }),
  json: async () => data,
});
test('empty release repository is a normal status; failures and invalid releases stay distinct', async () => {
  assert.equal(compareVersions('v1.10.0', '1.9.9'), 1);
  assert.equal(compareVersions('1.0.0', '1.0.0-beta.3'), 1);
  assert.equal(compareVersions('nightly', '0.1.0'), null);
  assert.equal(
    releaseLink('https://evil.test/PDFMathTranslate/PDFMathReader/releases/tag/v2'),
    null,
  );
  assert.equal(
    releaseLink('https://evil.test/PDFMathTranslate/PDFMathReader/releases/download/v2/app.zip', {
      download: true,
    }),
    null,
  );
  let next = response(404);
  const updates = await createAppUpdates({ currentVersion: '0.1.0', fetchImpl: async () => next });
  assert.equal((await updates.check()).status, 'no-release');
  next = response(429);
  assert.equal((await updates.check()).error, 'rate-limit');
  next = response(200, release('nightly'));
  assert.equal((await updates.check()).error, 'invalid-release');
  next = response(200, { ...release(), prerelease: true });
  assert.equal((await updates.check()).error, 'invalid-release');
  next = response(200, {
    ...release('v0.1.0'),
    html_url: 'https://evil.test/PDFMathTranslate/PDFMathReader/releases/tag/v0.1.0',
  });
  assert.equal((await updates.check()).error, 'invalid-release');
  next = response(200, release('v0.1.0'));
  assert.equal((await updates.check()).status, 'up-to-date');
  next = response(200, release('v0.0.9'));
  assert.equal((await updates.check()).status, 'up-to-date');
  updates.stop();
});
test('shares checks, selects architecture asset, persists and revalidates with ETag', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'reader-app-updates-')),
    path = join(folder, 'updates.json');
  try {
    let calls = 0,
      finish;
    const events = [];
    const updates = await createAppUpdates({
      currentVersion: '0.1.0',
      path,
      platform: 'darwin',
      arch: 'arm64',
      onChange: (state) => events.push(state),
      fetchImpl: async (url) => {
        assert.equal(url, RELEASE_API);
        calls++;
        return new Promise((resolve) => (finish = resolve));
      },
    });
    const first = updates.check(),
      second = updates.check();
    assert.equal(first, second);
    assert.equal(calls, 1);
    assert.equal(updates.status().status, 'checking');
    finish(response(200, release()));
    const state = await first;
    assert.equal(state.status, 'available');
    assert.match(state.downloadUrl, /darwin-arm64.zip$/);
    assert.equal(events.at(-1).latestVersion, '0.2.0');
    updates.stop();
    const restored = await createAppUpdates({
      currentVersion: '0.2.0',
      path,
      platform: 'win32',
      arch: 'x64',
      fetchImpl: async (_url, options) => {
        assert.equal(options.headers['If-None-Match'], '"release-test"');
        return response(304);
      },
    });
    assert.equal(restored.status().status, 'up-to-date');
    assert.equal(restored.status().downloadUrl, null);
    assert.equal((await restored.check()).status, 'up-to-date');
    restored.stop();
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test('automatic updates stage once and install only on normal quit', async () => {
  let prepares = 0,
    applies = 0;
  const updates = await createAppUpdates({
    currentVersion: '0.1.0',
    fetchImpl: async () => response(200, release()),
    installer: {
      supported: true,
      prepare: async (state, progress) => {
        prepares++;
        assert.equal(state.latestVersion, '0.2.0');
        progress(0.5);
      },
      installOnQuit: () => {
        applies++;
        return true;
      },
    },
  });
  assert.equal((await updates.check()).status, 'ready');
  assert.equal(applies, 0, 'open documents are not interrupted to install');
  await updates.check();
  assert.equal(prepares, 1);
  updates.stop();
  assert.equal(updates.installOnQuit(), true);
  assert.equal(applies, 1);
});

test('turning off automatic updates suppresses a staged automatic install; manual install still applies', async () => {
  let applies = 0;
  const updates = await createAppUpdates({
    currentVersion: '0.1.0',
    fetchImpl: async () => response(200, release()),
    installer: { supported: true, prepare: async () => {}, installOnQuit: () => ++applies },
  });
  await updates.check();
  updates.setAutomatic(false);
  assert.equal(updates.installOnQuit(), false);
  await updates.install();
  updates.installOnQuit();
  assert.equal(applies, 1);
});

test('failed preparation remains retryable, keeps a bounded diagnostic, and never installs an unverified update', async () => {
  let attempts = 0,
    applies = 0;
  const diagnostic = 'signature mismatch: ' + 'x'.repeat(MAX_UPDATE_ERROR_DETAIL_LENGTH * 2);
  const updates = await createAppUpdates({
    currentVersion: '0.1.0',
    automatic: false,
    fetchImpl: async () => response(200, release()),
    installer: {
      supported: true,
      prepare: async () => {
        if (++attempts === 1) throw Error(diagnostic);
      },
      installOnQuit: () => ++applies,
    },
  });
  assert.equal((await updates.check()).status, 'available');
  const failed = await updates.install();
  assert.equal(failed.error, 'install');
  assert.equal(failed.errorDetail.length, MAX_UPDATE_ERROR_DETAIL_LENGTH);
  assert.ok(failed.errorDetail.startsWith('signature mismatch: '));
  assert.equal(updates.installOnQuit(), false);
  assert.equal(applies, 0);
  const ready = await updates.install();
  assert.equal(ready.status, 'ready');
  assert.equal(ready.errorDetail, null);
});

test('restores a bounded persisted installer diagnostic for the About UI', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'reader-app-updates-result-')),
    resultPath = join(folder, 'last-update-result.json');
  try {
    const diagnostic = 'codesign failed: ' + 'x'.repeat(MAX_UPDATE_ERROR_DETAIL_LENGTH * 2);
    await writeFile(
      resultPath,
      JSON.stringify({
        status: 'error',
        code: 'UPDATE_INSTALL_FAILED',
        message: diagnostic,
        stack: diagnostic + '\n' + 'x'.repeat(MAX_UPDATE_ERROR_DETAIL_LENGTH * 4),
      }),
    );
    const updates = await createAppUpdates({
      currentVersion: '0.1.0',
      installer: { supported: true, resultPath },
    });
    const state = updates.status();
    assert.equal(state.status, 'error');
    assert.equal(state.error, 'install');
    assert.equal(state.errorDetail.length, MAX_UPDATE_ERROR_DETAIL_LENGTH);
    assert.ok(state.errorDetail.startsWith('codesign failed: '));
    updates.stop();
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});

test('disabling automatic updates cancels an in-flight background download', async () => {
  let started;
  const began = new Promise((resolve) => {
    started = resolve;
  });
  const updates = await createAppUpdates({
    currentVersion: '0.1.0',
    fetchImpl: async () => response(200, release()),
    installer: {
      supported: true,
      prepare: async (_state, _progress, signal) => {
        started();
        await new Promise((_resolve, reject) =>
          signal.addEventListener('abort', () => reject(signal.reason), { once: true }),
        );
      },
    },
  });
  const checking = updates.check();
  await began;
  updates.setAutomatic(false);
  assert.equal((await checking).status, 'available');
  assert.equal(updates.status().error, null);
});
