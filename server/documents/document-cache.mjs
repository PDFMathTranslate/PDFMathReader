import { readFile, mkdir, writeFile, rename, rm, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const DOCUMENT_HASH_PATTERN = /^[0-9a-f]{64}$/;
const INTERNAL_DIRECTORY = '.cache-management';
const INDEX_FILE = 'document-index.json';
const MAX_DOCUMENT_NAME_LENGTH = 512;

function hashOf(hash) {
  if (typeof hash === 'string') {
    if (!DOCUMENT_HASH_PATTERN.test(hash)) throw Error('Invalid document cache id.');
    return hash;
  }
  if (!hash || typeof hash.copy !== 'function') throw Error('A document hash is required.');
  return hash.copy().digest('hex');
}

function validStoredName(name) {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name.length <= MAX_DOCUMENT_NAME_LENGTH &&
    !name.includes('\0') &&
    !/[\r\n]/.test(name)
  );
}

// Document names arrive in a header encoded by the caller. A malformed or
// empty value is deliberately treated as absent and never reaches a path.
export function decodeDocumentName(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return null;
  }
  if (!decoded.trim() || decoded.length > MAX_DOCUMENT_NAME_LENGTH || !validStoredName(decoded))
    return null;
  return decoded;
}

export function createDocumentCache(directory) {
  const hashPath = (id) => join(directory, 'documents', id);
  const generationPath = (id) => join(directory, 'documents', id + '.generation');
  const indexPath = join(directory, INTERNAL_DIRECTORY, INDEX_FILE);
  let indexWrites = Promise.resolve();

  async function ensureInternalDirectory() {
    const internal = join(directory, INTERNAL_DIRECTORY);
    await mkdir(internal, { recursive: true });
    const info = await lstat(internal);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw Error('Document cache metadata directory is not a safe directory.');
  }

  async function readNames() {
    try {
      const info = await lstat(indexPath);
      if (!info.isFile() || info.isSymbolicLink()) return new Map();
      const data = JSON.parse(await readFile(indexPath, 'utf8'));
      const names = new Map();
      for (const [id, entry] of Object.entries(data?.documents || {})) {
        if (DOCUMENT_HASH_PATTERN.test(id) && validStoredName(entry?.name))
          names.set(id, entry.name);
      }
      return names;
    } catch (error) {
      if (error?.code === 'ENOENT' || error instanceof SyntaxError) return new Map();
      throw error;
    }
  }

  async function writeNames(names) {
    await ensureInternalDirectory();
    const temporary = join(directory, INTERNAL_DIRECTORY, `${INDEX_FILE}.${randomUUID()}.tmp`);
    const documents = Object.fromEntries([...names].map(([id, name]) => [id, { name }]));
    try {
      await writeFile(temporary, JSON.stringify({ version: 1, documents }));
      await rename(temporary, indexPath);
    } finally {
      await rm(temporary, { force: true }).catch(() => {});
    }
  }

  async function ensureGeneration(id) {
    const root = join(directory, 'documents'),
      path = generationPath(id);
    await mkdir(root, { recursive: true });
    try {
      const info = await lstat(path);
      if (info.isFile() && !info.isSymbolicLink() && (await readFile(path, 'utf8')).trim()) return;
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    const temporary = path + '.' + randomUUID() + '.tmp';
    try {
      await writeFile(temporary, randomUUID());
      await rename(temporary, path);
    } finally {
      await rm(temporary, { force: true }).catch(() => {});
    }
  }

  async function register(hash, name) {
    const id = hashOf(hash),
      decoded = decodeDocumentName(name);
    indexWrites = indexWrites
      .catch(() => {})
      .then(async () => {
        const names = await readNames();
        // Empty and malformed headers must not erase a previously known filename.
        if (decoded !== null) {
          names.set(id, decoded);
          await writeNames(names);
        }
        if (names.has(id)) await ensureGeneration(id);
      });
    return indexWrites;
  }

  async function names() {
    await indexWrites;
    return readNames();
  }

  async function scope(hash) {
    const id = hashOf(hash);
    try {
      const path = generationPath(id),
        info = await lstat(path);
      if (!info.isFile() || info.isSymbolicLink()) return '';
      const generation = (await readFile(path, 'utf8')).trim();
      return generation ? id + ':' + generation : '';
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return '';
    }
  }

  async function removePath(path) {
    let info;
    try {
      info = await lstat(path);
    } catch (error) {
      if (error?.code === 'ENOENT') return false;
      throw error;
    }
    // Removing a symlink itself is safe; never recurse through it.
    await rm(
      path,
      info.isDirectory() && !info.isSymbolicLink()
        ? { recursive: true, force: true }
        : { force: true },
    );
    return true;
  }

  async function clearId(hash, { onlyIfPresent = false } = {}) {
    const id = hashOf(hash),
      documentPath = hashPath(id),
      generation = generationPath(id);
    let present = false;
    for (const path of [documentPath, generation]) {
      try {
        await lstat(path);
        present = true;
        break;
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
    }
    if (onlyIfPresent && !present) return false;
    await mkdir(join(directory, 'documents'), { recursive: true });
    const temporary = generation + '.' + randomUUID() + '.tmp';
    try {
      await writeFile(temporary, randomUUID());
      await rename(temporary, generation);
    } finally {
      await rm(temporary, { force: true }).catch(() => {});
    }
    await removePath(documentPath);
    return true;
  }

  async function clear(hash) {
    return clearId(hash);
  }
  return { scope, clear, clearId, register, names };
}
