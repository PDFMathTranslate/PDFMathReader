import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { createRecents } from '../../electron/main/services/recents.mjs';
import { createCompanionDocumentStore } from '../../server/documents/companion-document-store.mjs';

async function fixture() {
  const directory = await mkdtemp(join(tmpdir(), 'pdfmath-companion-first-open-'));
  const pdfPath = join(directory, 'first-open.pdf');
  const recentsPath = join(directory, 'recent-documents.json');
  const statePath = join(directory, 'companion-documents.json');
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 792]);
  await writeFile(pdfPath, await pdf.save({ useObjectStreams: false }));
  return { directory, pdfPath, recentsPath, statePath };
}

test('publishes a newly prepared recent before the first companion desktop claim', async () => {
  const fixtureState = await fixture();
  try {
    const recents = await createRecents(fixtureState.recentsPath);
    const prepared = recents.prepare(fixtureState.pdfPath);
    assert.equal(prepared.created, true);

    await recents.persistPrepared(prepared.id);
    const published = JSON.parse(await readFile(fixtureState.recentsPath, 'utf8'));
    assert.equal(published[0].id, prepared.id);
    assert.equal(published[0].path, fixtureState.pdfPath);

    const store = await createCompanionDocumentStore({
      recentsPath: fixtureState.recentsPath,
      statePath: fixtureState.statePath,
    });
    const claimed = await store.claimDesktop(prepared.id, 'desktop-session-1', 'This Mac');
    assert.equal(claimed.claimed, true);
    assert.equal(claimed.resumed, false);
    assert.equal(claimed.sessionID, 'desktop-session-1');
  } finally {
    await rm(fixtureState.directory, { recursive: true, force: true });
  }
});

test('desktop can claim, resume, and release an owner-protected PDF', async () => {
  const { directory, pdfPath, recentsPath, statePath } = await fixture();
  try {
    const bytes = await readFile(new URL('../fixtures/owner-protected.pdf', import.meta.url));
    await writeFile(pdfPath, bytes);
    const revision = createHash('sha256').update(bytes).digest('hex');
    const recents = await createRecents(recentsPath);
    const { id } = recents.prepare(pdfPath);
    await recents.persistPrepared(id);
    const store = await createCompanionDocumentStore({ recentsPath, statePath });

    assert.deepEqual(await store.claimDesktop(id, 'first-session'), {
      claimed: true,
      resumed: false,
      sessionID: 'first-session',
      revision,
    });
    assert.deepEqual(await store.claimDesktop(id, 'reopened-session'), {
      claimed: true,
      resumed: true,
      sessionID: 'reopened-session',
      revision,
    });
    assert.deepEqual(await store.releaseDesktop(id, 'reopened-session'), {
      released: true,
      revision,
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
