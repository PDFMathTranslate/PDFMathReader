import assert from 'node:assert/strict';
import { app } from 'electron';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createDocumentSession } from '../../electron/main/services/document-session.mjs';
export async function verifySession(first, windows, createWindow) {
  const wait = async (target, expression) => {
    for (let i = 0; i < 200; i++) {
      if (await target.webContents.executeJavaScript(expression)) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    throw Error(expression);
  };
  const dir = await mkdtemp(join(tmpdir(), 'reader-session-smoke-')),
    store = join(app.getPath('userData'), 'document-session.json');
  try {
    await wait(first, 'window.previewReady');
    const bytes = await first.webContents.executeJavaScript(
      "fetch('/sample.pdf').then(r=>r.arrayBuffer()).then(b=>Array.from(new Uint8Array(b)))",
    );
    const a = join(dir, 'A quieter way to read.pdf'),
      b = join(dir, 'Portrait and landscape.pdf');
    await writeFile(a, new Uint8Array(bytes));
    await writeFile(b, new Uint8Array(bytes));
    const view = {
      page: 2,
      offsetX: 0,
      offsetY: 0.2,
      zoom: 1,
      fit: 'width',
      direction: 'vertical',
      columns: 1,
      sidebar: false,
      showTranslations: false,
    };
    const second = await createWindow(a, view);
    await wait(second, 'window.previewReady');
    second.show();
    second.focus();
    for (let i = 0; i < 100 && !second.isFocused(); i++)
      await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(second.isFocused(), true);
    const third = await createWindow(b, undefined, null, 'general', false);
    await wait(third, 'window.previewReady');
    for (let i = 0; i < 100 && !third.isVisible(); i++)
      await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(third.isVisible(), true);
    assert.equal(third.isFocused(), false);
    assert.equal(second.isFocused(), true);
    const otherWindowState = await first.webContents.executeJavaScript(
      "({totalPages: window.previewRenderDiagnostics().totalPages, empty: !!document.querySelector('.empty')})",
    );
    await second.webContents.executeJavaScript('window.previewSaveReadingView()');
    await third.webContents.executeJavaScript('window.previewSaveReadingView()');
    const restored = (await createDocumentSession(store)).restore();
    assert.equal(restored.length, 2);
    assert.equal(restored.find((e) => e.path === a).view.page, 2);
    const secondClosed = new Promise((resolve) => second.once('closed', resolve));
    second.webContents.send('reader:action', 'close-document');
    await secondClosed;
    assert.equal(second.isDestroyed(), true);
    assert.equal(windows.has(second), false);
    assert.deepEqual(
      (await createDocumentSession(store)).restore().map((e) => e.path),
      [b],
    );
    assert.deepEqual(
      await first.webContents.executeJavaScript(
        "({totalPages: window.previewRenderDiagnostics().totalPages, empty: !!document.querySelector('.empty')})",
      ),
      otherWindowState,
    );
    third.webContents.send('reader:action', 'close-document');
    await wait(
      third,
      "window.previewRenderDiagnostics().totalPages===0 && !!document.querySelector('.empty')",
    );
    assert.equal(third.isDestroyed(), false);
    assert.equal(windows.has(third), true);
    assert.deepEqual((await createDocumentSession(store)).restore(), []);
    assert.deepEqual(
      await first.webContents.executeJavaScript(
        "({totalPages: window.previewRenderDiagnostics().totalPages, empty: !!document.querySelector('.empty')})",
      ),
      otherWindowState,
    );
    await first.webContents.executeJavaScript(
      'window.previewPreferences.save({restoreDocuments:false})',
    );
    assert.equal(
      await first.webContents.executeJavaScript(
        'window.previewPreferences.load().then(p=>p.restoreDocuments)',
      ),
      false,
    );
    console.log(
      JSON.stringify({
        passed: true,
        multipleDocuments: true,
        backgroundRestorePreservesFocus: true,
        restoredPosition: true,
        allDocumentsClosed: true,
        documentWindowClosed: true,
        lastDocumentReturnsToStartPage: true,
        otherWindowUnchanged: true,
        sharedOptOut: true,
      }),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  app.quit();
}
