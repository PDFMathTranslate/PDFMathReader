import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRecents, validateReadingView } from '../../electron/main/services/recents.mjs';

const baseView = {
  page: 1,
  offsetX: 0,
  offsetY: 0,
  zoom: 1,
  fit: 'width',
  direction: 'vertical',
  columns: 1,
  sidebar: false,
  showTranslations: false,
};

test('reading views validate and persist independent crop sides', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'reading-view-crop-')),
    storage = join(directory, 'recents.json'),
    pdf = join(directory, 'fixture.pdf');
  t.after(() => rm(directory, { recursive: true, force: true }));
  await writeFile(pdf, '%PDF fixture');
  const view = {
    ...baseView,
    cropX: 0.3,
    cropY: 0.4,
    cropLeft: 0.1,
    cropRight: 0.2,
    cropTop: 0.3,
    cropBottom: 0.1,
  };
  assert.deepEqual(validateReadingView(view), view);
  let recents = await createRecents(storage);
  const [{ id }] = await recents.remember(pdf);
  await recents.setView(id, view);
  recents = await createRecents(storage);
  assert.deepEqual(recents.list()[0].view, view);
  await assert.rejects(recents.setView(id, { ...view, cropLeft: 0.7, cropRight: 0.2 }));
});
