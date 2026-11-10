import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PDFDict, PDFDocument, PDFName, StandardFonts } from 'pdf-lib';
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
    const arranged = await store.editPages(
      {
        key: 'document',
        action: 'arrange',
        order: [3, 1, 2, 3],
        annotations: rotated.annotations,
        nativeRefs: [],
      },
      { path, reliable: true },
    );
    const reordered = await PDFDocument.load(await readFile(path));
    assert.equal(reordered.getPageCount(), 4);
    assert.equal(reordered.getPage(0).getRotation().angle, 90);
    assert.equal(reordered.getPage(3).getRotation().angle, 90);
    assert.equal(reordered.getPage(1).getRotation().angle, 0);
    assert.deepEqual(
      arranged.annotations.map(({ page }) => page),
      [1, 4],
    );
    assert.equal(arranged.annotations[0].id, 'note');
    assert.notEqual(arranged.annotations[1].id, 'note');
    assert.deepEqual(arranged.annotations[1].rects, arranged.annotations[0].rects);
    const embedded = (await importPDFAnnotations(await readFile(path))).annotations;
    assert.deepEqual(embedded.map(({ page }) => page).sort(), [1, 4]);
    const kept = await readFile(path);
    for (const order of [[], [0, 1], [1, 2, 3, 4, 99], 'nope'])
      await assert.rejects(
        store.editPages(
          {
            key: 'document',
            action: 'arrange',
            order,
            annotations: arranged.annotations,
            nativeRefs: [],
          },
          { path, reliable: true },
        ),
      );
    assert.deepEqual(await readFile(path), kept);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('deleted pages leave the file and undo restores the previous PDF and annotations', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pdf-page-undo-'));
  try {
    const pdf = await PDFDocument.create();
    pdf.addPage([600, 800]);
    const secret = pdf.addPage([600, 800]);
    secret.drawText('Delete me', { font: await pdf.embedFont(StandardFonts.Courier) });
    pdf.addPage([300, 400]);
    const path = join(root, 'original.pdf');
    await writeFile(path, await pdf.save());
    const store = await createAnnotationStore(join(root, 'metadata'));
    const source = { path, reliable: true };
    const note = (id, page) => ({
      id,
      page,
      kind: 'highlight',
      origin: 'source',
      color: '#FFFF00',
      text: id,
      comment: '',
      rects: [{ x: 20, y: 40, width: 50, height: 10 }],
      createdAt: '2026-11-10T00:00:00Z',
    });
    const notes = [note('second', 2), note('third', 3)];
    await store.save({ key: 'document', annotations: notes, nativeRefs: [] }, source);
    const saved = await readFile(path);
    const usesCourier = async (bytes) =>
      [...(await PDFDocument.load(bytes)).context.enumerateIndirectObjects()].some(
        ([, object]) =>
          object instanceof PDFDict &&
          object.get(PDFName.of('BaseFont'))?.toString() === '/Courier',
      );
    assert.equal(await usesCourier(saved), true);

    const deleted = await store.editPages(
      { key: 'document', action: 'arrange', order: [1, 3], annotations: notes, nativeRefs: [] },
      source,
    );
    assert.equal((await PDFDocument.load(await readFile(path))).getPageCount(), 2);
    assert.deepEqual(
      deleted.annotations.map(({ id, page }) => [id, page]),
      [['third', 2]],
    );
    assert.equal(await usesCourier(await readFile(path)), false);

    const undone = await store.undoPageEdit({ key: 'document' }, source);
    assert.equal(undone.undone, true);
    assert.deepEqual(undone.order, [1, 3]);
    const restored = await PDFDocument.load(await readFile(path));
    assert.equal(restored.getPageCount(), 3);
    assert.equal(await usesCourier(await readFile(path)), true);
    assert.deepEqual(undone.annotations, notes);
    assert.deepEqual(await store.load('document'), notes);
    assert.deepEqual(
      (await importPDFAnnotations(await readFile(path))).annotations.map(({ page }) => page).sort(),
      [2, 3],
    );
    assert.deepEqual(await store.undoPageEdit({ key: 'document' }, source), { undone: false });

    await store.editPages(
      { key: 'document', action: 'arrange', order: [3, 1, 2], annotations: notes, nativeRefs: [] },
      source,
    );
    const moved = await store.load('document');
    await store.save(
      { key: 'document', annotations: [...moved, note('later', 1)], nativeRefs: [] },
      source,
    );
    const changed = await readFile(path);
    assert.deepEqual(await store.undoPageEdit({ key: 'document' }, source), {
      undone: false,
      stale: true,
    });
    assert.deepEqual(await readFile(path), changed);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('copied pages paste into another document with their annotations and undo', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pdf-page-clipboard-'));
  try {
    const note = (id, page) => ({
      id,
      page,
      kind: 'highlight',
      origin: 'source',
      color: '#FFFF00',
      text: id,
      comment: '',
      rects: [{ x: 20, y: 40, width: 50, height: 10 }],
      createdAt: '2026-11-10T00:00:00Z',
    });
    const write = async (name, sizes) => {
      const pdf = await PDFDocument.create();
      for (const size of sizes) pdf.addPage(size);
      const path = join(root, name);
      await writeFile(path, await pdf.save());
      return { path, reliable: true };
    };
    const first = await write('first.pdf', [
      [600, 800],
      [300, 400],
      [500, 500],
    ]);
    const second = await write('second.pdf', [
      [612, 792],
      [612, 792],
    ]);
    const store = await createAnnotationStore(join(root, 'metadata'));
    const firstNotes = [note('kept', 1), note('copied', 3)];
    const secondNotes = [note('own', 2)];
    await store.save({ key: 'first', annotations: firstNotes, nativeRefs: [] }, first);
    await store.save({ key: 'second', annotations: secondNotes, nativeRefs: [] }, second);
    assert.equal(store.pageClipboardInfo(), null);

    const info = await store.copyPages(
      { key: 'first', pages: [3, 2], annotations: firstNotes, nativeRefs: [] },
      first,
    );
    assert.deepEqual(info.sizes, [
      { width: 500, height: 500 },
      { width: 300, height: 400 },
    ]);
    assert.equal(info.count, 2);
    assert.deepEqual(store.pageClipboardInfo(), info);

    const pasted = await store.editPages(
      {
        key: 'second',
        action: 'insert',
        at: 1,
        clipboard: info.id,
        annotations: secondNotes,
        nativeRefs: [],
      },
      second,
    );
    const disk = await PDFDocument.load(await readFile(second.path));
    assert.deepEqual(
      disk.getPages().map((page) => [page.getWidth(), page.getHeight()]),
      [
        [612, 792],
        [500, 500],
        [300, 400],
        [612, 792],
      ],
    );
    assert.deepEqual(
      pasted.annotations.map(({ text, page }) => [text, page]),
      [
        ['own', 4],
        ['copied', 2],
      ],
    );
    assert.notEqual(pasted.annotations[1].id, 'copied');
    assert.deepEqual(
      (await importPDFAnnotations(await readFile(second.path))).annotations
        .map(({ page }) => page)
        .sort(),
      [2, 4],
    );
    assert.equal((await PDFDocument.load(await readFile(first.path))).getPageCount(), 3);

    const undone = await store.undoPageEdit({ key: 'second' }, second);
    assert.deepEqual(undone.order, [1, null, null, 2]);
    assert.deepEqual(undone.annotations, secondNotes);
    assert.equal((await PDFDocument.load(await readFile(second.path))).getPageCount(), 2);

    const kept = await readFile(second.path);
    await assert.rejects(
      store.editPages(
        {
          key: 'second',
          action: 'insert',
          at: 0,
          clipboard: 'stale',
          annotations: secondNotes,
          nativeRefs: [],
        },
        second,
      ),
    );
    for (const at of [-1, 3, 1.5])
      await assert.rejects(
        store.editPages(
          {
            key: 'second',
            action: 'insert',
            at,
            clipboard: info.id,
            annotations: secondNotes,
            nativeRefs: [],
          },
          second,
        ),
      );
    assert.deepEqual(await readFile(second.path), kept);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
