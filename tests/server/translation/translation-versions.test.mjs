import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createTranslationVersions } from '../../../server/translation/translation-versions.mjs';

const hash = 'a'.repeat(64);

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
