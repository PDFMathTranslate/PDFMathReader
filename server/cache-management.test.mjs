import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, readFile, rm, symlink, writeFile, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createCacheManager } from './cache-management.mjs';

const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

test('protects active work and clears scoped cache files without following links', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cache-management-clear-')),
    cache = join(root, 'translations'),
    outside = join(root, 'source');
  const scoped = join(cache, 'documents', 'a'.repeat(64));
  await mkdir(join(scoped, 'paragraphs', 'generation'), { recursive: true });
  await mkdir(outside, { recursive: true });
  const outsideFile = join(outside, 'source.pdf');
  await writeFile(outsideFile, 'source');
  await writeFile(join(scoped, 'a.generation'), 'generation');
  await writeFile(join(scoped, 'paragraphs', 'generation', 'result.json'), 'translation');
  await symlink(outside, join(cache, 'outside-link'), 'dir');
  const manager = createCacheManager({ directory: cache, limitMB: null, sweepIntervalMs: 0 });
  try {
    await manager.start();
    const release = manager.beginTask('translation');
    await assert.rejects(
      manager.clear(),
      (error) => error?.status === 409 && /in use/.test(error.message),
    );
    assert.equal((await manager.stats()).busy, true);
    release();
    const result = await manager.clear();
    assert.equal(result.bytes, 0);
    assert.equal(result.busy, false);
    assert.equal(await exists(join(cache, 'documents')), false);
    assert.equal(await exists(join(cache, 'outside-link')), false);
    assert.equal(await readFile(outsideFile, 'utf8'), 'source');
  } finally {
    await manager.close();
    await rm(root, { recursive: true, force: true });
  }
});
