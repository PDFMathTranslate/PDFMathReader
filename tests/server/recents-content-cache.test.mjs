import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRecents } from '../../electron/main/services/recents.mjs';
const status = {
  totalPages: 2,
  completedPages: 2,
  partialPages: 0,
  failedPages: 0,
  engine: 'pdf_math_fast',
  language: 'Chinese',
  updatedAt: 1,
};
const view = {
  page: 2,
  offsetX: 0,
  offsetY: 0,
  zoom: 1,
  fit: 'width',
  direction: 'vertical',
  columns: 1,
  sidebar: true,
  showTranslations: true,
};

test('same content restores cached state across renamed paths and restart, and remains writable', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'recent-content-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const storage = join(dir, 'recents.json'),
    original = join(dir, 'original.pdf'),
    moved = join(dir, 'moved.pdf');
  await writeFile(original, '%PDF fixture');
  let recents = await createRecents(storage);
  const [{ id }] = await recents.remember(original);
  await recents.setView(id, view);
  await recents.setTranslationStatus(id, status);
  await rename(original, moved);
  recents = await createRecents(storage);
  const [entry] = await recents.remember(moved);
  assert.equal(entry.id, id);
  assert.deepEqual(entry.view, view);
  assert.deepEqual(entry.translationStatus, status);
  assert.equal(recents.path(id), moved);
  await recents.setTranslationStatus(id, { ...status, updatedAt: 2 });
  assert.equal((await createRecents(storage)).list()[0].translationStatus.updatedAt, 2);
  await writeFile(moved, '%PDF different content');
  const [changed] = await recents.remember(moved);
  assert.equal(changed.id, id);
  assert.equal(changed.translationStatus, undefined);
  assert.equal(changed.view, undefined);
});

test('legacy path history is backfilled for identical copies without merging different contents', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'recent-legacy-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const original = join(dir, 'original.pdf'),
    copy = join(dir, 'copy.pdf'),
    other = join(dir, 'other.pdf'),
    storage = join(dir, 'recents.json');
  await writeFile(original, '%PDF same');
  await writeFile(copy, '%PDF same');
  await writeFile(other, '%PDF different');
  await writeFile(
    storage,
    JSON.stringify([{ id: 'legacy', path: original, view, translationStatus: status }]),
  );
  const recents = await createRecents(storage);
  const [entry] = await recents.remember(copy);
  assert.equal(entry.id, 'legacy');
  assert.deepEqual(entry.translationStatus, status);
  const [different] = await recents.remember(other);
  assert.notEqual(different.id, 'legacy');
  assert.equal(different.translationStatus, undefined);
});
