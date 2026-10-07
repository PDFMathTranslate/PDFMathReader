import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PDFDocument } from 'pdf-lib';
import { createAnnotationStore } from '../../../electron/main/services/annotations.mjs';
import { importPDFAnnotations } from '../../../electron/main/services/annotation-import.mjs';
test('page edits persist to the original PDF and annotation metadata before resolving', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pdf-page-edit-'));
  try {
    const pdf = await PDFDocument.create();
    pdf.addPage([600, 800]);
    pdf.addPage([600, 800]);
    pdf.addPage([300, 400]);
    const path = join(root, 'original.pdf');
    await writeFile(path, await pdf.save());
    const store = await createAnnotationStore(join(root, 'metadata'));
    const note = {
      id: 'note',
      page: 3,
      kind: 'highlight',
      origin: 'source',
      color: '#FFFF00',
      text: 'Keep this note',
      comment: '',
      rects: [{ x: 20, y: 40, width: 50, height: 10 }],
      createdAt: '2026-10-04T00:00:00Z',
    };
    await store.save(
      { key: 'document', annotations: [note], nativeRefs: [] },
      { path, reliable: true },
    );
    const result = await store.editPages(
      { key: 'document', action: 'align-width', annotations: [note], nativeRefs: [] },
      { path, reliable: true },
    );
    const disk = await PDFDocument.load(await readFile(path));
    assert.equal(disk.getPage(2).getWidth(), 600);
    assert.equal(disk.getPage(2).getHeight(), 800);
    assert.deepEqual(result.annotations[0].rects, [{ x: 40, y: 80, width: 100, height: 20 }]);
    assert.deepEqual((await store.load('document'))[0].rects, result.annotations[0].rects);
    assert.deepEqual(
      (await importPDFAnnotations(await readFile(path))).annotations[0].rects,
      result.annotations[0].rects,
    );
    const rotated = await store.editPages(
      {
        key: 'document',
        action: 'rotate',
        page: 3,
        annotations: result.annotations,
        nativeRefs: [],
      },
      { path, reliable: true },
    );
    assert.equal((await PDFDocument.load(await readFile(path))).getPage(2).getRotation().angle, 90);
    assert.deepEqual(rotated.annotations[0].rects, [{ x: 700, y: 40, width: 20, height: 100 }]);
    const before = await readFile(path);
    await assert.rejects(
      store.editPages(
        {
          key: 'document',
          action: 'rotate',
          page: 99,
          annotations: rotated.annotations,
          nativeRefs: [],
        },
        { path, reliable: true },
      ),
    );
    assert.deepEqual(await readFile(path), before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
