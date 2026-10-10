import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { reactive, shallowRef, watch, nextTick } from 'vue';

const sourceURL = new URL(
  '../../electron/main/services/document-file-actions.mjs',
  import.meta.url,
);
const source = (await readFile(sourceURL, 'utf8'))
  .replace("import { shell } from 'electron';", 'const shell = {};')
  .replace(
    "import { shareWindowsFile } from './windows-file-share.mjs';",
    'const shareWindowsFile = () => {};',
  )
  .replace("'pdf-lib'", JSON.stringify(import.meta.resolve('pdf-lib')));
const { createDocumentFileActions } = await import(
  'data:text/javascript;base64,' + Buffer.from(source).toString('base64')
);

test('Windows reveals and shares a partially translated PDF with original pages preserved', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'translated-file-'));
  try {
    const original = await PDFDocument.create();
    for (const width of [100, 200, 300]) original.addPage([width, 400]);
    const path = join(directory, '中文 original.pdf');
    await writeFile(path, await original.save());
    const translated = await PDFDocument.create();
    translated.addPage([250, 400]);
    let pages = [null, Array.from(await translated.save()), null];
    const target = {
      isDestroyed: () => false,
      webContents: { executeJavaScript: async () => pages },
    };
    const state = { unkeyedAnnotationSource: { path, reliable: true } };
    let revealed, shared;
    const actions = createDocumentFileActions({
      app: { getPath: () => directory },
      platform: 'win32',
      registry: { stateFor: () => state },
      documentPath: () => path,
      validateSystemPDF: async () => {},
      reveal: (value) => {
        revealed = value;
      },
      shareWindows: async (_target, value) => {
        shared = value;
      },
    });
    await actions.perform(target, 'translated', 'reveal');
    const exported = await PDFDocument.load(await readFile(revealed));
    assert.deepEqual(
      exported.getPages().map((page) => page.getWidth()),
      [100, 250, 300],
    );
    await actions.perform(target, 'translated', 'share');
    assert.equal(shared, revealed);
    pages = [null, null, null];
    await assert.rejects(
      actions.perform(target, 'translated', 'reveal'),
      /Translate at least one page/,
    );
    pages = [Array.from(await translated.save()), null];
    await assert.rejects(actions.perform(target, 'translated', 'reveal'), /page count has changed/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('file menu readiness follows the first translated page and resets when cleared', async () => {
  const source = await readFile(
    new URL('../../src/app/useReaderWindow.mjs', import.meta.url),
    'utf8',
  );
  const expression = source.match(/watch\(\s*\(\) => (pages\.value\.[^\n]+),/)[1];
  const pages = shallowRef([reactive({ mathDocument: null }), reactive({ mathDocument: null })]);
  const states = [];
  const stop = watch(
    () => new Function('pages', `return ${expression}`)(pages),
    (ready) => states.push(ready),
    { immediate: true },
  );
  try {
    pages.value[1].mathDocument = {};
    await nextTick();
    pages.value[1].mathDocument = null;
    await nextTick();
    assert.deepEqual(states, [false, true, false]);
  } finally {
    stop();
  }
});

test('Linux sharing selects the exported file in the system file manager', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'linux-file-share-'));
  try {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const bytes = await pdf.save();
    const original = join(directory, "中文 ' $value original.pdf");
    await writeFile(original, bytes);
    const state = { unkeyedAnnotationSource: { path: original } };
    const target = {
      isDestroyed: () => false,
      webContents: { executeJavaScript: async () => [Array.from(bytes)] },
    };
    const revealed = [];
    const actions = createDocumentFileActions({
      app: { getPath: () => directory },
      platform: 'linux',
      registry: { stateFor: () => state },
      documentPath: () => original,
      validateSystemPDF: async () => {},
      reveal: async (path) => revealed.push(path),
      shareWindows: () => assert.fail('Linux must use its system file manager'),
    });
    await actions.perform(target, 'original', 'share');
    assert.equal(revealed[0], original);
    await actions.perform(target, 'translated', 'share');
    assert.notEqual(revealed[1], original);
    assert.equal((await PDFDocument.load(await readFile(revealed[1]))).getPageCount(), 1);
    await assert.rejects(actions.perform(target, 'original', 'airdrop'), /Unsupported/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
