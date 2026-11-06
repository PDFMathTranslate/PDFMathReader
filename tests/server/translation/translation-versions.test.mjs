import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createTranslationVersions,
  translationServiceLabel,
} from '../../../server/translation/translation-versions.mjs';

const hash = 'a'.repeat(64);

test('translation service metadata exposes labels, never provider identities', () => {
  assert.equal(translationServiceLabel({ id: 'openai', key: 'secret' }), 'OpenAI compatible');
  assert.equal(translationServiceLabel({ id: 'siliconflow-free' }), 'SiliconFlow free');
  assert.equal(translationServiceLabel({ id: 'custom-0a1b2c3d4e5f', key: 'secret' }), 'custom-0a1b2c3d4e5f');
  assert.equal(translationServiceLabel({ id: 'secret-value with spaces' }), undefined);
});

async function harness(options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'pdfmr-versions-'));
  let generation = 'g1',
    clock = 1000;
  const documentCache = { scope: async (h) => `${h}:${generation}` };
  const versions = createTranslationVersions({
    directory,
    documentCache,
    now: () => clock,
    ...options,
  });
  return {
    directory,
    versions,
    scope: () => `${hash}:${generation}`,
    advance: (ms) => (clock += ms),
    clear: () => (generation = 'g2'),
  };
}

test('translation versions list each kernel and language newest first', async (t) => {
  const h = await harness();
  t.after(() => rm(h.directory, { recursive: true, force: true }));
  await h.versions.record(h.scope(), { engine: 'pdf_inspector', language: 'Chinese' });
  h.advance(5000);
  await h.versions.record(h.scope(), { engine: 'pdf_math_fast', language: 'Chinese' });
  h.advance(5000);
  await h.versions.record(h.scope(), { engine: 'pdf_math_fast', language: 'Japanese' });
  h.advance(120000);
  await h.versions.record(h.scope(), { engine: 'pdf_inspector', language: 'Chinese' });
  const list = await h.versions.list(hash);
  assert.deepEqual(
    list.map((v) => `${v.engine}/${v.language}`),
    ['pdf_inspector/Chinese', 'pdf_math_fast/Japanese', 'pdf_math_fast/Chinese'],
  );
});

test('translation versions preserve service variants and strip private metadata', async (t) => {
  const h = await harness();
  t.after(() => rm(h.directory, { recursive: true, force: true }));
  await h.versions.record(h.scope(), {
    engine: 'pdf_math_fast',
    language: 'Chinese',
    service: 'OpenAI compatible',
  });
  await h.versions.record(h.scope(), {
    engine: 'pdf_math_fast',
    language: 'Chinese',
    service: { key: 'must-not-be-stored' },
  });
  h.advance(120_000);
  await h.versions.record(h.scope(), {
    engine: 'pdf_math_fast',
    language: 'Chinese',
    service: 'SiliconFlow free',
  });
  h.advance(120_000);
  await h.versions.record(h.scope(), { engine: 'pdf_math_fast', language: 'Chinese' });
  const path = join(h.directory, 'documents', hash, 'versions', 'g1.json');
  const saved = JSON.parse(await readFile(path, 'utf8'));
  saved.versions.push({
    engine: 'pdf_math_precise',
    language: 'Japanese',
    service: 'Safe label',
    key: 'secret-key',
    identity: { baseUrl: 'https://private.invalid' },
    updatedAt: 999999,
  });
  await writeFile(path, JSON.stringify(saved));

  assert.deepEqual(
    (await h.versions.list(hash)).map(({ engine, language, service }) => ({
      engine,
      language,
      ...(service ? { service } : {}),
    })),
    [
      { engine: 'pdf_math_precise', language: 'Japanese', service: 'Safe label' },
      { engine: 'pdf_math_fast', language: 'Chinese' },
      { engine: 'pdf_math_fast', language: 'Chinese', service: 'SiliconFlow free' },
      { engine: 'pdf_math_fast', language: 'Chinese', service: 'OpenAI compatible' },
    ],
  );
  assert.equal(JSON.stringify(await h.versions.list(hash)).includes('secret-key'), false);
  assert.equal(JSON.stringify(await h.versions.list(hash)).includes('private.invalid'), false);
  assert.equal(JSON.stringify(await h.versions.list(hash)).includes('must-not-be-stored'), false);
});

test('clearing a document starts a new generation without the old versions', async (t) => {
  const h = await harness();
  t.after(() => rm(h.directory, { recursive: true, force: true }));
  await h.versions.record(h.scope(), { engine: 'pdf_inspector', language: 'Chinese' });
  h.clear();
  assert.deepEqual(await h.versions.list(hash), []);
});

test('invalid versions and corrupt records are ignored', async (t) => {
  const h = await harness();
  t.after(() => rm(h.directory, { recursive: true, force: true }));
  await h.versions.record(h.scope(), { engine: 'unknown', language: 'Chinese' });
  await h.versions.record('not-a-scope', { engine: 'pdf_inspector', language: 'Chinese' });
  assert.deepEqual(await h.versions.list(hash), []);
  const folder = join(h.directory, 'documents', hash, 'versions');
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, 'g1.json'), '{broken');
  assert.deepEqual(await h.versions.list(hash), []);
  await h.versions.record(h.scope(), { engine: 'pdf_inspector', language: 'Chinese' });
  assert.equal(JSON.parse(await readFile(join(folder, 'g1.json'), 'utf8')).versions.length, 1);
});
