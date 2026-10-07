import assert from 'node:assert/strict';
import { app, Menu, clipboard, shell } from 'electron';
import { PDFDocument } from 'pdf-lib';
import { mkdtemp, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
export async function verifyRecentMenu(window, recents) {
  const dir = await mkdtemp(join(tmpdir(), 'recent-menu-')),
    path = join(dir, 'Portrait and landscape.pdf');
  const pdf = await PDFDocument.create();
  pdf.addPage();
  await writeFile(path, await pdf.save());
  const evaluate = (code) => window.webContents.executeJavaScript(code);
  const wait = async (code) => {
    for (let i = 0; i < 200; i++) {
      if (await evaluate(code)) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw Error('Recent menu timed out: ' + code);
  };
  const popup = Menu.prototype.popup,
    reveal = shell.showItemInFolder;
  let selected = 0,
    labels = [],
    revealed = null;
  Menu.prototype.popup = function (options) {
    labels = this.items.filter((item) => item.type !== 'separator').map((item) => item.label);
    const item = this.items.filter((item) => item.type !== 'separator')[selected];
    item.click(item, options.window);
    options.callback?.();
  };
  shell.showItemInFolder = (value) => {
    revealed = value;
  };
  const context = () =>
    evaluate(
      `document.querySelector('.recent-document').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}));true`,
    );
  try {
    await recents.remember(path);
    const id = recents.list()[0].id;
    await recents.setTranslationStatus(id, {
      totalPages: 1,
      completedPages: 1,
      partialPages: 0,
      failedPages: 0,
      engine: 'pdf_inspector',
      language: 'Chinese',
      updatedAt: Date.now(),
    });
    await window.webContents.reload();
    await wait('window.previewReady && !!document.querySelector(".recent-document")');
    selected = 4;
    await context();
    await wait('document.querySelector(".recent-status-dialog")?.open');
    assert.equal(labels.length, 5);
    assert.match(
      await evaluate('document.querySelector(".recent-status-dialog").textContent'),
      /Completed/,
    );
    await evaluate('document.querySelector(".recent-status-dialog form button").click()');
    await wait('!document.querySelector(".recent-status-dialog")');
    selected = 2;
    await context();
    await wait(`true`);
    for (let i = 0; i < 100 && (await clipboard.readText()) !== path; i++)
      await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(await clipboard.readText(), path);
    selected = 3;
    await context();
    for (let i = 0; i < 100 && revealed !== path; i++)
      await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(revealed, path);
    selected = 0;
    await context();
    await wait(
      'window.previewRenderDiagnostics?.().totalPages===1 && !window.previewRenderDiagnostics().opening',
    );
    window.webContents.send('reader:action', 'close-document');
    await wait('!!document.querySelector(".recent-document")');
    assert.equal(recents.list()[0].translationStatus.totalPages, 1);
    selected = 1;
    await context();
    await wait('!document.querySelector(".recent-document")');
    assert.deepEqual(recents.list(), []);
    await access(path);
    await window.webContents.reload();
    await wait('window.previewReady');
    assert.equal(await evaluate('document.querySelectorAll(".recent-document").length'), 0);
    console.log(
      'Recent menu smoke passed: open, persistent hide, clipboard path, reveal dispatch, translation dialog.',
    );
  } finally {
    Menu.prototype.popup = popup;
    shell.showItemInFolder = reveal;
    await rm(dir, { recursive: true, force: true });
  }
  app.exit(0);
}
