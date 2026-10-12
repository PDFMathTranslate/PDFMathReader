import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createTranslationCache } from '../../../server/translation/translation-cache.mjs';

const digest = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function cacheFor(directory, service) {
  const keyFor = (model, serviceBound = true) =>
    digest({ text: 'paragraph', model, ...(serviceBound ? { service } : { compatible: 1 }) });
  return createTranslationCache({
    directory,
    keyFor,
    compatibleKey: keyFor(undefined, false),
    readResult: async (key) => JSON.parse(await readFile(join(directory, `${key}.json`), 'utf8')),
  });
}

test('compatible pointer reuses another service only when reuse is enabled', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'translation-cache-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const first = cacheFor(directory, 'service-a');
  const key = digest({ text: 'paragraph', model: 'model-a', service: 'service-a' });
  await writeFile(join(directory, `${key}.json`), JSON.stringify({ translation: 'A' }));
  await first.remember('model-a', key);

  const second = cacheFor(directory, 'service-b');
  assert.equal(await second.lookup('model-b'), null);
  assert.equal(await second.lookup('model-a'), null);
  const hit = await second.lookup('model-b', { reuseTranslations: true });
  assert.deepEqual(hit, { result: { translation: 'A' }, model: 'model-a', key, reused: true });
  assert.equal(
    await second.lookup('model-b', { reuseTranslations: true, forceRetranslation: true }),
    null,
  );
  const own = await first.lookup('model-a');
  assert.equal(own.reused, false);
});
