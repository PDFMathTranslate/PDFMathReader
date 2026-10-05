import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVersion, compareVersions, shouldRelease } from './release-version.mjs';
test('initial rollout and unchanged or lower versions never release', () => {
  assert.equal(shouldRelease('0.1.0', [{ tag_name: 'v0.1.0-beta.3', draft: false }]), false);
  for (const version of ['0.1.0', '0.1.1', '0.1.2-beta.1'])
    assert.equal(shouldRelease(version, [{ tag_name: 'v0.1.2', draft: false }]), false);
  assert.equal(shouldRelease('0.1.3', [{ tag_name: 'v0.1.2', draft: false }]), true);
});
test('semantic prerelease ordering and build metadata are respected', () => {
  const versions = ['0.2.0-alpha', '0.2.0-alpha.2', '0.2.0-alpha.10', '0.2.0-beta', '0.2.0'];
  for (let i = 1; i < versions.length; i++)
    assert(compareVersions(versions[i], versions[i - 1]) > 0);
  assert.equal(compareVersions('0.2.0+build.2', '0.2.0+build.1'), 0);
  assert.equal(shouldRelease('0.2.0-beta.2', [{ tag_name: 'v0.2.0-beta.1', draft: false }]), true);
});
test('all published versions gate releases, while drafts and unrelated tags do not', () => {
  assert.equal(
    shouldRelease('0.2.0', [
      { tag_name: 'v0.3.0', draft: false },
      { tag_name: 'v0.1.0', draft: false },
    ]),
    false,
  );
  assert.equal(
    shouldRelease('0.2.0', [
      { tag_name: 'v0.3.0', draft: true },
      { tag_name: 'nightly', draft: false },
    ]),
    true,
  );
});
test('invalid versions and command-like input are rejected', () => {
  for (const version of [
    '1.2',
    'v1.2.3',
    '01.2.3',
    '1.2.3-beta.01',
    '1.2.3\n--draft',
    '1.2.3;echo',
  ])
    assert.throws(() => parseVersion(version));
});
