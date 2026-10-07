import {
  normalizeTranslationServiceSchema,
  validServiceId,
} from '../../../shared/translation/service-schema.mjs';
export {
  normalizeTranslationServiceSchema,
  cloneTranslationServices,
} from '../../../shared/translation/service-schema.mjs';
const schemaCache = new Map();

export function loadTranslationServiceSchema(engine, version = '', fetcher = globalThis.fetch) {
  if (!validServiceId(engine)) return Promise.reject(Error('Invalid translation kernel.'));
  const key = `${engine}:${typeof version === 'string' ? version : ''}`;
  const cached = schemaCache.get(key);
  if (cached) return cached;
  if (typeof fetcher !== 'function')
    return Promise.reject(Error('Translation service catalog is unavailable.'));
  const task = Promise.resolve()
    .then(async () => {
      const response = await fetcher(`/api/engines/${encodeURIComponent(engine)}/services`);
      let body;
      try {
        body = await response.json();
      } catch {
        throw Error('Translation service catalog returned invalid data.');
      }
      if (!response.ok)
        throw Error(body?.error || body?.reason || 'Translation service catalog is unavailable.');
      const result = normalizeTranslationServiceSchema(body, engine, version);
      if (result.reason && schemaCache.get(key) === task) schemaCache.delete(key);
      return result;
    })
    .catch((error) => {
      if (schemaCache.get(key) === task) schemaCache.delete(key);
      throw error;
    });
  schemaCache.set(key, task);
  return task;
}

export function clearTranslationServiceSchemaCache(engine, version) {
  if (engine === undefined) {
    schemaCache.clear();
    return;
  }
  const prefix = `${engine}:`;
  for (const key of schemaCache.keys())
    if (key === `${engine}:${version || ''}` || (version === undefined && key.startsWith(prefix)))
      schemaCache.delete(key);
}
export function translationServiceSchemaCacheSize() {
  return schemaCache.size;
}
