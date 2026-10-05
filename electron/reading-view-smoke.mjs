import assert from 'node:assert/strict';
import { app, Menu } from 'electron';
import { PDFDocument, rgb } from 'pdf-lib';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRecents } from './recents.mjs';
export async function verifyReadingView(window, recents) {
  const evaluate = (code) => window.webContents.executeJavaScript(code),
    pause = (ms) => new Promise((r) => setTimeout(r, ms));
  async function wait(code) {
    for (let n = 0; n < 150; n++) {
      if (await evaluate(code)) return;
      await pause(75);
    }
    throw Error(
      'Reading view timeout: ' +
        code +
        ' ' +
        JSON.stringify(await evaluate('window.previewRenderDiagnostics?.()')),
    );
  }
  const folder = await mkdtemp(join(tmpdir(), 'reader-position-'));
  const pdf = await PDFDocument.create();
  for (let n = 0; n < 40; n++)
    pdf
      .addPage([612, 792])
      .drawRectangle({ x: 260, y: 350, width: 90, height: 90, color: rgb(0, 0, 0) });
  const bytes = await pdf.save();
  await mkdir(join(folder, 'other'));
  const first = join(folder, 'Portrait and landscape.pdf'),
    second = join(folder, 'other', 'Portrait and landscape.pdf');
  await writeFile(first, bytes);
  await writeFile(second, bytes);
  await recents.remember(first);
  const id = recents.list()[0].id;
  await recents.remember(second);
  const other = recents.list()[0].id;
  await window.webContents.reload();
  await wait(`!!document.querySelector('[data-recent-id="${id}"]')`);
  const snapshot = () =>
    evaluate(
      `(()=>{const d=window.previewRenderDiagnostics(),r=document.querySelector('.reader'),p=document.querySelector('.page[data-page="'+d.readingView.page+'"]');return {view:d.readingView,top:r.scrollTop,left:r.scrollLeft,width:p.getBoundingClientRect().width,height:p.getBoundingClientRect().height};})()`,
    );
  async function open(docId) {
    await evaluate(`document.querySelector('[data-recent-id="${docId}"]').click();true`);
    await wait(
      `(()=>{const d=window.previewRenderDiagnostics();return d.recentId==='${docId}'&&!d.opening&&d.pages.length>0;})()`,
    );
    await pause(300);
  }
  async function close() {
    const menu = Menu.getApplicationMenu()
      .items.find((i) => i.label === 'File')
      .submenu.items.find((i) => i.label === 'Close Document');
    menu.click();
    await wait(`!!document.querySelector('.empty')&&!window.previewRenderDiagnostics().recentId`);
  }
  function sameView(actual, expected, label) {
    for (const key of ['page', 'fit', 'direction', 'columns', 'sidebar', 'showTranslations'])
      assert.equal(actual.view[key], expected.view[key], label + ' ' + key);
    assert.ok(Math.abs(actual.view.zoom - expected.view.zoom) < 0.001, label + ' zoom');
    assert.ok(
      Math.abs(actual.top - expected.top) <= 2,
      label + ' vertical position ' + actual.top + ' vs ' + expected.top,
    );
    assert.ok(
      Math.abs(actual.left - expected.left) <= 2,
      label + ' horizontal position ' + actual.left + ' vs ' + expected.left,
    );
  }
  await open(id);
  Menu.getApplicationMenu().getMenuItemById('columns-2').click();
  await pause(500);
  await evaluate(
    `document.querySelector('[aria-label="Toggle thumbnails"]').click();document.querySelector('.translation-toggle').click();true`,
  );
  await pause(350);
  await evaluate(
    `(()=>{const z=document.querySelector('[aria-label="Zoom"]');z.value='1.25';z.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`,
  );
  await pause(350);
  window.webContents.send('reader:action', 'percent:50');
  await pause(500);
  await evaluate(`document.querySelector('.reader').scrollTop+=150;true`);
  await pause(100);
  const original = await snapshot();
  assert.equal(original.view.fit, 'manual');
  assert.equal(original.view.zoom, 1.25);
  assert.equal(original.view.columns, 2);
  assert.equal(original.view.sidebar, false);
  assert.equal(original.view.showTranslations, false);
  assert.ok(original.view.page >= 19);
  await close();
  assert.deepEqual(
    recents.list().find((e) => e.id === id).view,
    original.view,
    'close commits without waiting for debounce',
  );
  const disk = await createRecents(join(app.getPath('userData'), 'recent-documents.json'));
  assert.deepEqual(
    disk.list().find((e) => e.id === id).view,
    original.view,
    'reading view reached disk',
  );
  await open(id);
  sameView(await snapshot(), original, 'vertical reopen');
  await close();
  await window.webContents.reload();
  await wait(`!!document.querySelector('[data-recent-id="${id}"]')`);
  await open(id);
  sameView(await snapshot(), original, 'renderer restart');
  Menu.getApplicationMenu().getMenuItemById('layout-horizontal').click();
  await pause(500);
  await evaluate(
    `(()=>{const z=document.querySelector('[aria-label="Zoom"]');z.value='0.75';z.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`,
  );
  await pause(350);
  window.webContents.send('reader:action', 'percent:70');
  await pause(500);
  await evaluate(`document.querySelector('.reader').scrollLeft+=100;true`);
  await pause(100);
  const horizontal = await snapshot();
  await close();
  await open(id);
  sameView(await snapshot(), horizontal, 'horizontal reopen');
  await close();
  const otherView = {
    page: 5,
    offsetX: 0,
    offsetY: 0.2,
    zoom: 1,
    fit: 'manual',
    direction: 'vertical',
    columns: 1,
    sidebar: true,
    showTranslations: true,
  };
  await recents.setView(other, otherView);
  await open(other);
  const otherState = await snapshot();
  assert.equal(otherState.view.page, 5);
  assert.equal(otherState.view.sidebar, true);
  assert.equal(otherState.view.showTranslations, true);
  await close();
  await open(id);
  sameView(await snapshot(), horizontal, 'independent documents');
  await close();
  const fitted = {
    ...original.view,
    fit: 'width',
    page: 15,
    offsetX: 0,
    offsetY: 0.25,
    columns: 1,
    sidebar: false,
  };
  await recents.setView(id, fitted);
  window.setContentSize(900, 700);
  await open(id);
  const narrow = await snapshot();
  assert.equal(narrow.view.page, 15);
  assert.equal(narrow.view.fit, 'width');
  assert.ok(Math.abs(narrow.view.offsetY - 0.25) < 0.005);
  await close();
  window.setContentSize(1300, 900);
  await open(id);
  const wide = await snapshot();
  assert.equal(wide.view.page, 15);
  assert.ok(wide.view.zoom > narrow.view.zoom);
  assert.ok(Math.abs(wide.view.offsetY - 0.25) < 0.005);
  await close();
  await recents.setView(id, { ...fitted, page: 999, offsetY: 0 });
  await open(id);
  assert.equal((await snapshot()).view.page, 40, 'outdated page count clamps to last page');
  // Closing a native window must commit its latest scroll before destruction.
  await evaluate(`document.querySelector('.reader').scrollTop-=120;true`);
  const closing = await snapshot();
  const closed = new Promise((resolve, reject) =>
    window.once('closed', () => {
      try {
        assert.deepEqual(recents.list().find((e) => e.id === id).view, closing.view);
        resolve();
      } catch (error) {
        reject(error);
      }
    }),
  );
  window.close();
  await closed;
  console.log(
    JSON.stringify({
      readingViewRestored: true,
      manualZoom: true,
      verticalAndHorizontal: true,
      pageOffsets: true,
      sidebarAndTranslation: true,
      restartPersistence: true,
      documentIsolation: true,
      fitAdaptsToWindow: true,
      pageCountClamp: true,
      immediateDocumentCloseSave: true,
      nativeWindowCloseSave: true,
    }),
  );
  await rm(folder, { recursive: true, force: true });
}
