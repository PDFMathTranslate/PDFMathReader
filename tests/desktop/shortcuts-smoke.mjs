import assert from 'node:assert/strict';
import { app, Menu } from 'electron';
import { PDFDocument } from 'pdf-lib';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function verifyShortcuts(window, createWindow) {
  const run = (code) => window.webContents.executeJavaScript(code);
  async function wait(code, target = window) {
    for (let i = 0; i < 200; i++) {
      if (await target.webContents.executeJavaScript(code)) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw Error(
      'Shortcut check timed out: ' +
        code +
        ' ' +
        JSON.stringify(
          await target.webContents.executeJavaScript(
            '({diagnostics:window.previewRenderDiagnostics?.(),text:document.body.innerText.slice(0,1500)})',
          ),
        ),
    );
  }
  await wait('window.previewReady');
  const initial = await run('window.previewShortcuts.load()');
  const open = initial.catalog.find((entry) => entry.label === 'Open PDF…');
  const next = initial.catalog.find((entry) => entry.label === 'Next Page');
  assert.ok(open && next);
  const other = await createWindow();
  await wait('window.previewReady', other);
  window.show();
  window.focus();
  await run(`document.querySelector('[aria-label="Translation settings"]').click()`);
  await wait(`!!document.querySelector('[data-settings-category="shortcuts"]')`);
  await run(`document.querySelector('[data-settings-category="shortcuts"]').click()`);
  await wait(`!!document.querySelector('[data-shortcut-record="${open.id}"]')`);
  await run(`document.querySelector('[data-shortcut-record="${open.id}"]').click()`);
  await wait(
    `document.querySelector('[data-shortcut-record="${open.id}"]').getAttribute('aria-pressed')==='true'`,
  );
  const modifiers = process.platform === 'darwin' ? ['meta', 'shift'] : ['control', 'shift'];
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'U', modifiers });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'U', modifiers });
  await wait(
    `(async()=>Object.hasOwn((await window.previewShortcuts.load()).overrides,${JSON.stringify(open.id)}))()`,
  );
  const saved = await run('window.previewShortcuts.load()');
  assert.equal(saved.bindings[open.id].length, 1);
  assert.deepEqual(
    await other.webContents.executeJavaScript(
      `(async()=> (await window.previewShortcuts.load()).bindings[${JSON.stringify(open.id)}])()`,
    ),
    saved.bindings[open.id],
  );
  const menuOpen = Menu.getApplicationMenu()?.getMenuItemById('file-open');
  if (menuOpen) assert.equal(menuOpen.accelerator, saved.bindings[open.id][0]);
  await assert.rejects(
    run(
      `window.previewShortcuts.save(${JSON.stringify(next.id)},${JSON.stringify(saved.bindings[open.id][0])})`,
    ),
  );
  assert.deepEqual(
    (await run('window.previewShortcuts.load()')).bindings[next.id],
    initial.bindings[next.id],
  );
  await run(`window.previewShortcuts.save(${JSON.stringify(next.id)},null)`);
  assert.deepEqual((await run('window.previewShortcuts.load()')).bindings[next.id], []);
  await run(`window.previewShortcuts.reset(${JSON.stringify(next.id)})`);
  assert.deepEqual(
    (await run('window.previewShortcuts.load()')).bindings[next.id],
    initial.bindings[next.id],
  );
  await run(`document.querySelector('[data-shortcut-record="${open.id}"]').click()`);
  await wait(
    `document.querySelector('[data-shortcut-record="${open.id}"]').getAttribute('aria-pressed')==='true'`,
  );
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
  await wait(
    `document.querySelector('[data-shortcut-record="${open.id}"]').getAttribute('aria-pressed')==='false'`,
  );
  assert.ok(await run(`!!document.querySelector('.shortcut-settings')`));
  await run('window.previewShortcuts.reset()');
  assert.deepEqual((await run('window.previewShortcuts.load()')).bindings, initial.bindings);
  other.close();
  const folder = await mkdtemp(join(tmpdir(), 'shortcut-document-'));
  try {
    const pdf = await PDFDocument.create();
    for (let i = 0; i < 3; i++)
      pdf.addPage([500, 700]).drawText(`Shortcut page ${i + 1}`, { x: 50, y: 600 });
    const path = join(folder, 'Portrait and landscape.pdf');
    await writeFile(path, await pdf.save());
    await run(
      `window.previewPreferences.save({automatic:false,documentOpenMode:'original',reduceMotion:true})`,
    );
    window = await createWindow(path);
    await wait('window.previewReady');
    await wait(
      `!window.previewRenderDiagnostics().opening&&window.previewRenderDiagnostics().pages.length>0`,
    );
    const primary = process.platform === 'darwin' ? 'Command' : 'Control';
    await run(`window.previewShortcuts.save('page-next','${primary}+Shift+J')`);
    window.focus();
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'J', modifiers });
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'J', modifiers });
    await wait('window.previewRenderDiagnostics().active===2');
    await run(
      `document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',code:'ArrowRight',shiftKey:true,bubbles:true,cancelable:true}))`,
    );
    assert.equal(
      await run('window.previewRenderDiagnostics().active'),
      2,
      'old navigation alias no longer dispatches',
    );
    await run(`window.previewShortcuts.save('zoom-in','${primary}+Shift+U')`);
    const before = await run('window.previewRenderDiagnostics().readingView.zoom');
    window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'U', modifiers });
    window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'U', modifiers });
    await wait(`window.previewRenderDiagnostics().readingView.zoom>${before}`);
    await run('window.previewShortcuts.reset()');
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
  console.log(
    'Shortcuts passed: UI recording, Escape cancellation, menu synchronization, multi-window persistence, conflict rejection, clear and restore, real page navigation and zoom with remapped keys.',
  );
  app.quit();
}
