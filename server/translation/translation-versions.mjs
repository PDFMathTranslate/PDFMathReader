import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const ENGINES = new Set(['pdf_inspector', 'pdf_math_fast', 'pdf_math_precise']);
const DOCUMENT_HASH = /^[0-9a-f]{64}$/;
const GENERATION = /^[a-z0-9-]+$/i;
const MAX_LANGUAGE_LENGTH = 100;
const MAX_VERSIONS = 24;
// A cache hit refreshes the entry, but not on every paragraph.
const REFRESH_MS = 60_000;

const valid = (value) =>
  value &&
  ENGINES.has(value.engine) &&
  typeof value.language === 'string' &&
  value.language.length > 0 &&
  value.language.length <= MAX_LANGUAGE_LENGTH &&
  Number.isFinite(value.updatedAt);

// Records which kernel and language pairs hold cached translations for a document.
// The file lives under the document's cache scope, so clearing that document (which
// starts a new generation) or the whole cache discards the record with the pages.
export function createTranslationVersions({ directory, documentCache, now = () => Date.now() }) {
  let writes = Promise.resolve();
  const refreshed = new Map();

  function pathFor(scope) {
    const separator = typeof scope === 'string' ? scope.indexOf(':') : -1;
    if (separator <= 0) return null;
    const hash = scope.slice(0, separator),
      generation = scope.slice(separator + 1);
    return DOCUMENT_HASH.test(hash) && GENERATION.test(generation)
      ? join(directory, 'documents', hash, 'versions', `${generation}.json`)
      : null;
  }

  async function read(path) {
    try {
      const saved = JSON.parse(await readFile(path, 'utf8'));
      return Array.isArray(saved?.versions) ? saved.versions.filter(valid) : [];
    } catch {
      return [];
    }
  }

  async function write(path, versions) {
    const temporary = `${path}.${randomUUID()}.tmp`;
    try {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(temporary, JSON.stringify({ version: 1, versions }));
      await rename(temporary, path);
    } finally {
      await rm(temporary, { force: true }).catch(() => {});
    }
  }

  function record(scope, { engine, language }) {
    const path = pathFor(scope);
    if (!path || !valid({ engine, language, updatedAt: 0 })) return Promise.resolve();
    const key = `${path}\0${engine}\0${language}`,
      time = now();
    if (time - (refreshed.get(key) ?? -Infinity) < REFRESH_MS) return Promise.resolve();
    refreshed.set(key, time);
    writes = writes
      .catch(() => {})
      .then(async () => {
        const others = (await read(path)).filter(
          (item) => item.engine !== engine || item.language !== language,
        );
        await write(
          path,
          [{ engine, language, updatedAt: time }, ...others]
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .slice(0, MAX_VERSIONS),
        );
      })
      .catch(() => refreshed.delete(key));
    return writes;
  }

  async function list(documentHash) {
    await writes;
    const path = pathFor(await documentCache.scope(documentHash));
    return path ? (await read(path)).sort((a, b) => b.updatedAt - a.updatedAt) : [];
  }

  return { record, list };
}
