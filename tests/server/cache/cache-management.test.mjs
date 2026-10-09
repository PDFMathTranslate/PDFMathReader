import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  access,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
  mkdtemp,
  truncate,
  utimes,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createCacheManager,
  cacheEvictionCandidates,
} from '../../../server/cache/cache-management.mjs';

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

test('eviction indexes atomic writes and preserves complete PDF/layout groups', () => {
  const file = (name, mtimeMs = 0) => ({ path: join('/cache', name), size: 1, mtimeMs });
  const files = [
    file('old.pdf'),
    file('old.layout.json'),
    file('pending.pdf'),
    file('pending.layout.json'),
    file('pending.pdf.uuid.tmp'),
    file('control.json'),
    file('control.json.uuid.extra.tmp'),
    file('fresh.pdf', 99_999),
    file('other/old.pdf'),
  ];
  const candidates = cacheEvictionCandidates(files, { now: 100_000, recentWriteMs: 30_000 });
  assert.deepEqual(candidates.flatMap((group) => group.files.map((file) => file.path)).sort(), [
    '/cache/old.layout.json',
    '/cache/old.pdf',
    '/cache/other/old.pdf',
  ]);
});

test('large inventories do not repeatedly traverse files for each eviction group', () => {
  let reads = 0;
  const files = Array.from({ length: 50_000 }, (_, index) => ({
    get path() {
      reads++;
      return `/cache/${index}.pdf`;
    },
    size: 1,
    mtimeMs: 0,
  }));
  assert.equal(cacheEvictionCandidates(files, { now: 100_000 }).length, files.length);
  assert.ok(reads < files.length * 10, `File paths were read ${reads} times`);
});

test('over-limit sweep evicts old complete artifacts and protects pending writes', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'cache-sweep-'));
  const manager = createCacheManager({
    directory: root,
    limitMB: 512,
    sweepIntervalMs: 0,
    recentWriteMs: 0,
    idleDelayMs: 0,
  });
  t.after(async () => {
    await manager.close();
    await rm(root, { recursive: true, force: true });
  });
  await manager.start({ deferSweep: true });
  const old = join(root, 'old.pdf'),
    pending = join(root, 'pending.pdf');
  await writeFile(old, '');
  await truncate(old, 513 * 1024 * 1024);
  await writeFile(join(root, 'old.layout.json'), '{}');
  await writeFile(pending, 'pending');
  await writeFile(pending + '.uuid.tmp', 'writing');
  const result = await manager.sweep();
  assert.equal(await exists(old), false);
  assert.equal(await exists(join(root, 'old.layout.json')), false);
  assert.equal(await readFile(pending, 'utf8'), 'pending');
  assert.equal(await readFile(pending + '.uuid.tmp', 'utf8'), 'writing');
  assert.ok(result.bytes < 512 * 1024 * 1024);
  await manager.runTask('translation', async () =>
    assert.equal(await exists(join(root, '.cache-management', '.sweep-lock')), false),
  );
});

test('automatic cleanup waits for 30 seconds of idle time after foreground work', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'cache-idle-'));
  let clock = 100_000;
  const manager = createCacheManager({
    directory: root,
    limitMB: 512,
    sweepIntervalMs: 0,
    recentWriteMs: 0,
    now: () => clock,
  });
  t.after(async () => {
    await manager.close();
    await rm(root, { recursive: true, force: true });
  });
  await manager.start({ deferSweep: true });
  const artifact = join(root, 'old.pdf');
  await writeFile(artifact, '');
  await truncate(artifact, 513 * 1024 * 1024);
  assert.equal((await manager.sweep()).deferred, true, 'Startup must not clean the cache');
  assert.equal(await exists(artifact), true);
  await manager.runTask('document-layout', async () => {
    assert.equal((await manager.sweep()).deferred, true);
    assert.equal(await exists(artifact), true);
  });
  clock += 29_000;
  assert.equal((await manager.sweep()).deferred, true);
  clock += 2_000;
  const oldTime = new Date(Date.now() - 31_000);
  await utimes(join(root, '.cache-management', '.activity'), oldTime, oldTime);
  await manager.sweep();
  assert.equal(await exists(artifact), false, 'Evict only once the reader is idle');
});

test('browsing activity in another window defers cleanup for all backends', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'cache-shared-idle-'));
  let clock = 100_000;
  const options = {
    directory: root,
    limitMB: 512,
    sweepIntervalMs: 0,
    recentWriteMs: 0,
    now: () => clock,
  };
  const first = createCacheManager(options),
    second = createCacheManager(options);
  t.after(async () => {
    await first.close();
    await second.close();
    await rm(root, { recursive: true, force: true });
  });
  await first.start({ deferSweep: true });
  await second.start({ deferSweep: true });
  const artifact = join(root, 'old.pdf');
  await writeFile(artifact, '');
  await truncate(artifact, 513 * 1024 * 1024);
  clock += 31_000;
  const oldTime = new Date(Date.now() - 31_000);
  await utimes(join(root, '.cache-management', '.activity'), oldTime, oldTime);
  second.noteActivity();
  assert.equal((await first.sweep()).deferred, true);
  assert.equal(await exists(artifact), true);
});

test('closing a backend preserves leases until its active task finishes', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'cache-shutdown-lease-'));
  const first = createCacheManager({ directory: root, sweepIntervalMs: 0, idleDelayMs: 0 });
  const second = createCacheManager({
    directory: root,
    sweepIntervalMs: 0,
    limitMB: 512,
    recentWriteMs: 0,
    idleDelayMs: 0,
  });
  t.after(async () => {
    await first.close();
    await second.close();
    await rm(root, { recursive: true, force: true });
  });
  await first.start({ deferSweep: true });
  await second.start({ deferSweep: true });
  const artifact = join(root, 'active.pdf');
  await writeFile(artifact, '');
  await truncate(artifact, 513 * 1024 * 1024);
  let finish, started;
  const entered = new Promise((resolve) => {
    started = resolve;
  });
  const work = first.runTask(
    'translation',
    () =>
      new Promise((resolve) => {
        finish = resolve;
        started();
      }),
  );
  await entered;
  await first.close();
  await second.sweep();
  assert.equal(await exists(artifact), true);
  assert.equal((await second.stats()).busy, true);
  finish();
  await work;
  assert.equal((await second.stats()).busy, false);
  await second.sweep();
  assert.equal(await exists(artifact), false);
});
