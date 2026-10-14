import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// The document-frequency cache behind TF-IDF font weighting: for each opened
// document, the distinct terms of a random sample of its pages. Only terms are
// kept, never text or file names, and the cache is local to this machine.
const FILE = 'document-frequency.json';
const DOCUMENT_ID = /^[0-9a-f]{32,64}$/;
const MAX_TERM_LENGTH = 256;
// Distinct terms one frequency lookup may ask about (a dense page has ~1000).
export const MAX_LOOKUP_TERMS = 20000;

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

export const isTermDocumentId = (id) => typeof id === 'string' && DOCUMENT_ID.test(id);

function validTerms(terms, limit) {
  if (!Array.isArray(terms) || terms.length > limit) throw badRequest('Invalid terms');
  for (const term of terms)
    if (typeof term !== 'string' || !term || term.length > MAX_TERM_LENGTH)
      throw badRequest('Invalid terms');
  return terms;
}

export function createTermCorpus({
  directory,
  maxDocuments = 300,
  maxTerms = 3000,
  random = Math.random,
  now = Date.now,
}) {
  const path = join(directory, FILE);
  // id -> { seen, terms: Set }, and term -> number of documents holding it.
  const documents = new Map(),
    frequency = new Map();
  let loading,
    saving = Promise.resolve();

  function count(terms, delta) {
    for (const term of terms) {
      const next = (frequency.get(term) || 0) + delta;
      if (next > 0) frequency.set(term, next);
      else frequency.delete(term);
    }
  }

  function forget(id) {
    const entry = documents.get(id);
    if (!entry) return;
    count(entry.terms, -1);
    documents.delete(id);
  }

  function load() {
    loading ??= (async () => {
      let stored;
      try {
        stored = JSON.parse(await readFile(path, 'utf8'));
      } catch (error) {
        if (error?.code === 'ENOENT' || error instanceof SyntaxError) return;
        throw error;
      }
      for (const [id, entry] of Object.entries(stored?.documents || {})) {
        if (!isTermDocumentId(id) || !Array.isArray(entry?.terms)) continue;
        const terms = new Set(
          entry.terms.filter((t) => typeof t === 'string' && t && t.length <= MAX_TERM_LENGTH),
        );
        documents.set(id, { seen: Number(entry.seen) || 0, terms });
        count(terms, 1);
      }
    })();
    return loading;
  }

  function save() {
    const snapshot = JSON.stringify({
      version: 1,
      documents: Object.fromEntries(
        [...documents].map(([id, { seen, terms }]) => [id, { seen, terms: [...terms] }]),
      ),
    });
    // Writes run one after another so an older snapshot never lands last.
    saving = saving
      .catch(() => {})
      .then(async () => {
        await mkdir(directory, { recursive: true });
        const temporary = `${path}.${randomUUID()}.tmp`;
        try {
          await writeFile(temporary, snapshot);
          await rename(temporary, path);
        } finally {
          await rm(temporary, { force: true }).catch(() => {});
        }
      });
    return saving;
  }

  /** Notes that a document was opened; `known` says whether it is already sampled. */
  async function touch(id) {
    if (!isTermDocumentId(id)) throw badRequest('Invalid document id');
    await load();
    const entry = documents.get(id);
    if (!entry) return { known: false };
    entry.seen = now();
    await save();
    return { known: true };
  }

  /** Stores a document's sampled terms, replacing any earlier sample of it. */
  async function add(id, terms) {
    if (!isTermDocumentId(id)) throw badRequest('Invalid document id');
    const distinct = [...new Set(validTerms(terms, MAX_LOOKUP_TERMS))];
    // An unusually wordy sample keeps a uniform random subset of its terms.
    for (let i = 0; i < Math.min(maxTerms, distinct.length); i++) {
      const j = i + Math.floor(random() * (distinct.length - i));
      [distinct[i], distinct[j]] = [distinct[j], distinct[i]];
    }
    await load();
    forget(id);
    const entry = { seen: now(), terms: new Set(distinct.slice(0, maxTerms)) };
    documents.set(id, entry);
    count(entry.terms, 1);
    // The least recently opened documents leave first.
    if (documents.size > maxDocuments)
      for (const [old] of [...documents]
        .filter(([other]) => other !== id)
        .sort((a, b) => a[1].seen - b[1].seen)
        .slice(0, documents.size - maxDocuments))
        forget(old);
    await save();
    return { documents: documents.size, terms: entry.terms.size };
  }

  /** Document frequencies of terms among the cached documents other than `exclude`. */
  async function frequencies(exclude, terms) {
    if (exclude !== undefined && exclude !== null && !isTermDocumentId(exclude))
      throw badRequest('Invalid document id');
    validTerms(terms, MAX_LOOKUP_TERMS);
    await load();
    const own = documents.get(exclude)?.terms;
    return {
      documents: documents.size - (own ? 1 : 0),
      frequencies: terms.map((term) => (frequency.get(term) || 0) - (own?.has(term) ? 1 : 0)),
    };
  }

  return { touch, add, frequencies, flush: () => saving };
}
