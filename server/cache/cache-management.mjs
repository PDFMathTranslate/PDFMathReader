import { mkdir, readdir, stat, lstat, rm, unlink, writeFile, rename } from 'node:fs/promises';
import { mkdirSync, writeFileSync, unlinkSync, utimesSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';

export const CACHE_LIMITS_MB = Object.freeze([512, 1024, 2048, 5120, 10240]);
export const CACHE_BYTES_PER_MB = 1024 * 1024;
const DEFAULT_SWEEP_INTERVAL_MS = 60_000;
const DEFAULT_RECENT_WRITE_MS = 30_000;
const LOCK_STALE_MS = 5 * 60_000;
const LEASE_STALE_MS = 10 * 60_000;
const INTERNAL_DIRECTORY = '.cache-management';
const LOCK_DIRECTORY = '.sweep-lock';
const LEASE_SUFFIX = '.lease';
const TEMP_SUFFIX = '.tmp';
const DOCUMENT_HASH_PATTERN = /^[0-9a-f]{64}$/;

export function validateCacheLimitMB(value) {
  if (value === null) return null;
  if (CACHE_LIMITS_MB.includes(value)) return value;
  const error = Error(`limitMB must be one of ${CACHE_LIMITS_MB.join(', ')} or null.`);
  error.code = 'INVALID_CACHE_LIMIT';
  error.status = 400;
  throw error;
}

export class CacheBusyError extends Error {
  constructor(
    message = 'Cache is in use by an active translation or layout task. Try again after it finishes.',
  ) {
    super(message);
    this.name = 'CacheBusyError';
    this.code = 'CACHE_BUSY';
    this.status = 409;
  }
}

const inside = (root, path) => path === root || path.startsWith(root + sep);
const isMissing = (error) => error?.code === 'ENOENT';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function isDocumentCacheId(value) {
  return typeof value === 'string' && DOCUMENT_HASH_PATTERN.test(value);
}

function documentIdForFile(root, path) {
  const parts = relative(root, path).split(sep);
  if (parts[0] !== 'documents') return null;
  const candidate = parts[1] || '';
  return parts.length > 2 && isDocumentCacheId(candidate) ? candidate : null;
}

function artifactStem(name) {
  let stem = name;
  if (stem.endsWith(TEMP_SUFFIX)) {
    stem = stem.slice(0, -TEMP_SUFFIX.length);
    const separator = stem.lastIndexOf('.');
    if (separator > 0) stem = stem.slice(0, separator);
  }
  for (const suffix of ['.translation.json', '.layout.json', '.pdf', '.json'])
    if (stem.endsWith(suffix)) return stem.slice(0, -suffix.length);
  return stem;
}

function groupKey(file) {
  return `${dirname(file.path)}\0${artifactStem(basename(file.path))}`;
}

export function createCacheManager({
  directory,
  limitMB = null,
  isBusy = () => false,
  sweepIntervalMs = DEFAULT_SWEEP_INTERVAL_MS,
  recentWriteMs = DEFAULT_RECENT_WRITE_MS,
  documentCache = null,
  documentNames,
} = {}) {
  if (typeof directory !== 'string' || !directory.trim())
    throw Error('A cache directory is required.');
  if (!Number.isInteger(sweepIntervalMs) || sweepIntervalMs < 0)
    throw Error('Invalid cache sweep interval.');
  if (!Number.isFinite(recentWriteMs) || recentWriteMs < 0)
    throw Error('Invalid recent cache write window.');
  const root = resolve(directory),
    internal = join(root, INTERNAL_DIRECTORY),
    lock = join(internal, LOCK_DIRECTORY);
  let currentLimitMB = validateCacheLimitMB(limitMB),
    started = false,
    closed = false,
    interval = null,
    localActive = 0;
  const leases = new Map();

  async function ensureDirectories() {
    await mkdir(internal, { recursive: true });
    const info = await lstat(internal);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw Error('Cache maintenance directory is not a safe directory.');
  }

  async function collectFiles(directoryPath, files = []) {
    let entries;
    try {
      entries = await readdir(directoryPath, { withFileTypes: true });
    } catch (error) {
      if (isMissing(error)) return files;
      throw error;
    }
    for (const entry of entries) {
      const path = join(directoryPath, entry.name);
      if (path === internal || inside(internal, path)) continue;
      // Never follow links from the cache tree. A link can point to engines,
      // runtime homes, preferences, or a source document outside cacheDir.
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        await collectFiles(path, files);
        continue;
      }
      if (!entry.isFile()) continue;
      // Generation markers are document-cache control state, not evictable
      // artifacts. Removing one would send a named document back to global cache.
      if (entry.name.endsWith('.generation')) continue;
      try {
        const info = await lstat(path);
        if (info.isFile()) files.push({ path, size: info.size, mtimeMs: info.mtimeMs });
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
    }
    return files;
  }

  async function snapshot() {
    const files = await collectFiles(root),
      bytes = files.reduce((total, file) => total + file.size, 0);
    return { files, bytes };
  }

  async function activeLeasePaths() {
    let entries;
    try {
      entries = await readdir(internal, { withFileTypes: true });
    } catch (error) {
      if (isMissing(error)) return [];
      throw error;
    }
    const now = Date.now(),
      active = [];
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(LEASE_SUFFIX)) continue;
      const path = join(internal, entry.name);
      try {
        const info = await stat(path);
        if (now - info.mtimeMs > LEASE_STALE_MS) {
          await unlink(path).catch(() => {});
          continue;
        }
        active.push(path);
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
    }
    return active;
  }

  async function busy() {
    if (localActive > 0) return true;
    try {
      if (await isBusy()) return true;
    } catch {
      return true;
    }
    return (await activeLeasePaths()).length > 0;
  }

  async function acquireLock({ waitForLock = false } = {}) {
    await ensureDirectories();
    const attempts = waitForLock ? 20 : 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        await mkdir(lock);
        return true;
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error;
        try {
          const info = await stat(lock);
          if (Date.now() - info.mtimeMs > LOCK_STALE_MS)
            await rm(lock, { recursive: true, force: true });
        } catch (lockError) {
          if (!isMissing(lockError)) throw lockError;
        }
        if (attempt + 1 < attempts) await wait(25);
      }
    }
    return false;
  }

  async function releaseLock() {
    await rm(lock, { recursive: true, force: true }).catch(() => {});
  }

  async function waitForSweep() {
    // Own a lease before taking the gate. If maintenance already holds it, the
    // task waits; once the gate is released, later clears see this lease.
    for (;;) {
      const locked = await acquireLock();
      if (locked) {
        await releaseLock();
        return;
      }
      await wait(25);
    }
  }

  function beginTask(label = 'cache-task') {
    localActive++;
    const lease = join(
      internal,
      `${process.pid}-${randomUUID()}.${String(label).replace(/[^a-z0-9_-]/gi, '_')}${LEASE_SUFFIX}`,
    );
    try {
      mkdirSync(internal, { recursive: true });
      writeFileSync(lease, JSON.stringify({ pid: process.pid, label, startedAt: Date.now() }), {
        flag: 'wx',
      });
    } catch {}
    const heartbeat = setInterval(
      () => {
        try {
          utimesSync(lease, new Date(), new Date());
        } catch {}
      },
      Math.min(30_000, Math.max(1_000, Math.floor(LEASE_STALE_MS / 3))),
    );
    heartbeat.unref?.();
    leases.set(lease, { heartbeat });
    let released = false;
    return () => {
      if (released) return;
      released = true;
      clearInterval(heartbeat);
      leases.delete(lease);
      localActive = Math.max(0, localActive - 1);
      try {
        unlinkSync(lease);
      } catch {}
      if (localActive === 0 && !closed)
        queueMicrotask(() => {
          void sweep().catch(() => {});
        });
    };
  }

  async function runTask(label, task) {
    const release = beginTask(label);
    try {
      await waitForSweep();
      return await task();
    } finally {
      release();
    }
  }

  function tempProtected(group, allFiles) {
    const key = groupKey(group.files[0]);
    return (
      allFiles.some((file) => file.path.endsWith(TEMP_SUFFIX) && groupKey(file) === key) ||
      group.files.some((file) => {
        const directoryPath = dirname(file.path),
          prefix = basename(file.path) + '.';
        return allFiles.some(
          (candidate) =>
            candidate.path !== file.path &&
            dirname(candidate.path) === directoryPath &&
            candidate.path.endsWith(TEMP_SUFFIX) &&
            basename(candidate.path).startsWith(prefix),
        );
      })
    );
  }

  async function removeGroup(group) {
    // Recheck every member before unlinking. Atomic writers may have replaced a
    // PDF or its layout metadata after the sweep snapshot was taken.
    for (const file of group.files) {
      try {
        const info = await lstat(file.path);
        if (!info.isFile() || info.size !== file.size || info.mtimeMs !== file.mtimeMs) return 0;
      } catch (error) {
        if (isMissing(error)) continue;
        return 0;
      }
    }
    let removed = 0;
    for (const file of group.files) {
      try {
        await unlink(file.path);
        removed += file.size;
      } catch (error) {
        if (!isMissing(error)) continue;
      }
    }
    return removed;
  }

  async function sweep() {
    if (closed) return { bytes: 0, limitMB: currentLimitMB, busy: false };
    if (currentLimitMB === null || (await busy())) return stats();
    const locked = await acquireLock();
    if (!locked) return stats();
    try {
      if (await busy()) return stats();
      const { files, bytes } = await snapshot(),
        limitBytes = currentLimitMB * CACHE_BYTES_PER_MB;
      if (bytes <= limitBytes) return stats();
      const now = Date.now(),
        groups = new Map();
      for (const file of files) {
        const key = groupKey(file),
          group = groups.get(key) || { files: [], bytes: 0, mtimeMs: file.mtimeMs };
        group.files.push(file);
        group.bytes += file.size;
        group.mtimeMs = Math.min(group.mtimeMs, file.mtimeMs);
        groups.set(key, group);
      }
      const candidates = [...groups.values()]
        .filter(
          (group) =>
            group.files.every((file) => now - file.mtimeMs >= recentWriteMs) &&
            !tempProtected(group, files),
        )
        .sort((left, right) => left.mtimeMs - right.mtimeMs);
      let remaining = bytes;
      for (const group of candidates) {
        if (remaining <= limitBytes) break;
        if (await busy()) break;
        remaining -= await removeGroup(group);
      }
      return stats();
    } finally {
      await releaseLock();
    }
  }

  async function documentStats(files) {
    const names =
      typeof documentNames === 'function'
        ? await documentNames()
        : typeof documentCache?.names === 'function'
          ? await documentCache.names()
          : new Map();
    const totals = new Map();
    for (const file of files) {
      const id = documentIdForFile(root, file.path);
      if (!id) continue;
      totals.set(id, (totals.get(id) || 0) + file.size);
    }
    return [...totals]
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .slice(0, 5)
      .map(([id, bytes]) => ({ id, name: names.get(id) ?? null, bytes }));
  }

  async function stats() {
    const snapshotResult = await snapshot();
    return {
      bytes: snapshotResult.bytes,
      limitMB: currentLimitMB,
      busy: await busy(),
      documents: await documentStats(snapshotResult.files),
    };
  }

  async function setLimit(value) {
    currentLimitMB = validateCacheLimitMB(value);
    await sweep();
    return stats();
  }

  async function withMaintenance(task) {
    if (await busy()) throw new CacheBusyError();
    const locked = await acquireLock({ waitForLock: true });
    if (!locked)
      throw new CacheBusyError(
        'Cache is being maintained by another backend. Try again after it finishes.',
      );
    try {
      if (await busy()) throw new CacheBusyError();
      return await task();
    } finally {
      await releaseLock();
    }
  }

  async function removeCachePath(path) {
    let info;
    try {
      info = await lstat(path);
    } catch (error) {
      if (isMissing(error)) return false;
      throw error;
    }
    await rm(
      path,
      info.isDirectory() && !info.isSymbolicLink()
        ? { recursive: true, force: true }
        : { force: true },
    );
    return true;
  }

  async function clearDocumentTree(id) {
    const documentsRoot = join(root, 'documents'),
      documentPath = join(documentsRoot, id),
      generation = join(documentsRoot, id + '.generation');
    let present = false;
    for (const path of [documentPath, generation]) {
      try {
        await lstat(path);
        present = true;
        break;
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
    }
    if (!present) return false;
    await mkdir(documentsRoot, { recursive: true });
    const temporary = generation + '.' + randomUUID() + TEMP_SUFFIX;
    try {
      await writeFile(temporary, randomUUID());
      await rename(temporary, generation);
    } finally {
      await rm(temporary, { force: true }).catch(() => {});
    }
    await removeCachePath(documentPath);
    return true;
  }

  async function clearDocument(id) {
    if (!isDocumentCacheId(id)) {
      const error = Error('Invalid document cache id.');
      error.status = 400;
      throw error;
    }
    return withMaintenance(async () => {
      const cleared =
        typeof documentCache?.clearId === 'function'
          ? await documentCache.clearId(id, { onlyIfPresent: true })
          : await clearDocumentTree(id);
      if (!cleared) {
        const error = Error('Cached document was not found.');
        error.status = 404;
        throw error;
      }
      return stats();
    });
  }

  async function clear() {
    return withMaintenance(async () => {
      let entries = [];
      try {
        entries = await readdir(root, { withFileTypes: true });
      } catch (error) {
        if (!isMissing(error)) throw error;
      }
      for (const entry of entries) {
        if (entry.name === INTERNAL_DIRECTORY) continue;
        await removeCachePath(join(root, entry.name));
      }
      return stats();
    });
  }

  async function start() {
    if (started) return stats();
    await ensureDirectories();
    started = true;
    if (sweepIntervalMs > 0) {
      interval = setInterval(() => {
        void sweep().catch(() => {});
      }, sweepIntervalMs);
      interval.unref?.();
    }
    await sweep();
    return stats();
  }

  async function close() {
    if (closed) return;
    closed = true;
    if (interval) clearInterval(interval);
    interval = null;
    for (const [lease, { heartbeat }] of leases) {
      clearInterval(heartbeat);
      try {
        unlinkSync(lease);
      } catch {}
    }
    leases.clear();
    localActive = 0;
  }

  return {
    directory: root,
    start,
    close,
    stats,
    sweep,
    setLimit,
    clear,
    clearDocument,
    withMaintenance,
    beginTask,
    runTask,
    get limitMB() {
      return currentLimitMB;
    },
  };
}
