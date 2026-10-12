import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const ARTIFACT_KEY = /^[0-9a-f]{64}$/;

// The exact key retains the original on-disk format. A separate pointer records
// the last compatible result without making provider credentials part of it.
// `compatibleKey` omits service and model, so a result produced by one service
// can be reused by another when the document, kernel, language and options match.
export function createTranslationCache({
  directory,
  keyFor,
  compatibleKey,
  readResult,
  fallbackKeyFors = [],
}) {
  const legacyPointer = join(directory, `${keyFor(undefined)}.translation.json`),
    pointer = compatibleKey ? join(directory, `${compatibleKey}.translation.json`) : legacyPointer;
  async function remember(model, key) {
    await mkdir(directory, { recursive: true });
    const temporary = `${pointer}.${randomUUID()}.tmp`;
    await writeFile(temporary, JSON.stringify({ model, key }));
    await rename(temporary, pointer);
  }
  async function readPointer(path, valid) {
    try {
      const saved = JSON.parse(await readFile(path, 'utf8'));
      if (typeof saved.model === 'string' && valid(saved))
        return { model: saved.model, key: saved.key };
    } catch {}
  }
  async function lookup(model, { reuseTranslations = false, forceRetranslation = false } = {}) {
    if (forceRetranslation) return null;
    const candidates = [{ model, key: keyFor(model) }];
    if (reuseTranslations) {
      if (compatibleKey)
        candidates.push(
          await readPointer(pointer, (saved) => ARTIFACT_KEY.test(String(saved.key))),
        );
      candidates.push(
        await readPointer(legacyPointer, (saved) => saved.key === keyFor(saved.model)),
      );
      // Existing caches predate the compatible-result pointer. Probe the shipped
      // providers using the unchanged exact key, then migrate successful hits.
      for (const candidate of ['gpt-4.1-mini', 'siliconflow-free'])
        candidates.push({ model: candidate, key: keyFor(candidate) });
    }
    const tried = new Set();
    for (const candidate of candidates) {
      if (!candidate || tried.has(candidate.key)) continue;
      tried.add(candidate.key);
      let result;
      try {
        result = await readResult(candidate.key);
      } catch {
        continue;
      }
      // An optional index write must never turn a valid cache hit into a retranslation.
      await remember(candidate.model, candidate.key).catch(() => {});
      return { result, ...candidate, reused: candidate.key !== candidates[0].key };
    }
    // Layout-only upgrades can retain prior translated PDFs when explicitly
    // allowed by the caller. Keep their original keys and layout metadata.
    if (reuseTranslations)
      for (const fallbackKeyFor of fallbackKeyFors) {
        const hit = await createTranslationCache({
          directory,
          keyFor: fallbackKeyFor,
          readResult,
        }).lookup(model);
        if (hit) return { ...hit, reused: true };
      }
    return null;
  }
  return { lookup, remember };
}
