import assert from 'node:assert/strict';
import { app, Menu } from 'electron';
import { PDFDocument } from 'pdf-lib';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Page widths identify the pages: 600, 500, 400 and 300 points.
export async function verifyPageGallery(window, recents) {
  const run = (code) => window.webContents.executeJavaScript(code);
  async function wait(code) {
    for (let i = 0; i < 300; i++) {
      if (await run(code)) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw Error(
      'Page gallery smoke timeout: ' +
        code +
        ' ' +
        JSON.stringify(
          await run(
            '({d:window.previewRenderDiagnostics?.(),text:document.body.innerText.slice(0,400)})',
          ),
        ),
    );
  }
  const folder = await mkdtemp(join(tmpdir(), 'page-gallery-smoke-'));
  const path = join(folder, 'Portrait and landscape.pdf');
  const widths = async () =>
    (await PDFDocument.load(await readFile(path))).getPages().map((page) => page.getWidth());
  async function saved(expected) {
    for (let i = 0; i < 200; i++) {
      if (JSON.stringify(await widths()) === JSON.stringify(expected)) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.deepEqual(await widths(), expected);
    await wait(
      `!!document.querySelector('.page-gallery:not(.busy)')&&document.querySelectorAll('.page-gallery-tile').length===${expected.length}`,
    );
  }
  const tile = (number) => `document.querySelector('[data-gallery-page="${number}"]')`;
  const key = (letter, metaKey = true) =>
    run(
      `document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'${letter}',metaKey:${metaKey},bubbles:true,cancelable:true}))`,
    );
  const popup = Menu.prototype.popup;
  try {
    await wait('window.previewReady');
    await run(
      'window.previewPreferences.save({automatic:false,documentOpenMode:"original",uiLanguage:"en",interfaceStyle:"default"})',
    );
    const pdf = await PDFDocument.create();
    for (const width of [600, 500, 400, 300]) pdf.addPage([width, 800]);
    await writeFile(path, await pdf.save());
    await recents.remember(path);
    const id = recents.list()[0].id;
    await new Promise((r) => {
      window.webContents.once('did-finish-load', r);
      window.webContents.reload();
    });
    await wait('window.previewReady');
    await run(`document.querySelector('[data-recent-id="${id}"]').click()`);
    await wait(
      `window.previewRenderDiagnostics().totalPages===4&&!window.previewRenderDiagnostics().opening`,
    );
    await run(
      `document.querySelector('.thumb')||document.querySelector('[aria-label="Toggle thumbnails"]').click();true`,
    );
    await wait(`!!document.querySelector('.thumb[data-page-number="1"]')`);
    await run(
      `document.querySelector('.thumb[data-page-number="1"]').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`,
    );
    await wait(`document.querySelectorAll('.page-gallery-tile canvas').length===4`);
    await wait(`[...document.querySelectorAll('.page-gallery-tile canvas')].every(c=>c.width>0)`);

    // Copy page 1, select page 3 and paste after it.
    await run(`${tile(1)}.focus()`);
    await key('c');
    await run(`${tile(3)}.click()`);
    await key('d');
    await saved([600, 500, 400, 600, 300]);
    assert.equal(await run(`${tile(4)}.getAttribute('aria-selected')`), 'true');

    // The context menu moves the last page to the beginning.
    let items;
    Menu.prototype.popup = function (options) {
      items = this.items.map(({ label, enabled }) => ({ label, enabled }));
      this.items.find((item) => item.label === 'Move to Beginning').click();
      options.callback?.();
    };
    await run(
      `${tile(5)}.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))`,
    );
    await saved([300, 600, 500, 400, 600]);
    Menu.prototype.popup = popup;
    assert.deepEqual(
      items.filter(({ label }) => label).map(({ label, enabled }) => `${label}:${enabled}`),
      [
        'Copy Page:true',
        'Paste Page:true',
        'Move to Beginning:true',
        'Move Earlier:true',
        'Move Later:false',
        'Move to End:false',
        'Delete Page:true',
      ],
    );
    assert.equal(await run(`${tile(1)}.getAttribute('aria-selected')`), 'true');

    // Drag page 1 past page 3.
    const point = (number, side) =>
      run(
        `(()=>{const r=${tile(number)}.querySelector('.page-gallery-frame').getBoundingClientRect();return {x:Math.round(r.left+r.width*${side}),y:Math.round(r.top+r.height/2)}})()`,
      );
    window.show();
    window.focus();
    const from = await point(1, 0.5),
      to = await point(3, 0.9);
    const mouse = (type, { x, y }, extra = {}) =>
      window.webContents.sendInputEvent({ type, x, y, button: 'left', clickCount: 1, ...extra });
    mouse('mouseDown', from);
    for (let step = 1; step <= 12; step++) {
      mouse('mouseMove', {
        x: Math.round(from.x + ((to.x - from.x) * step) / 12),
        y: Math.round(from.y + ((to.y - from.y) * step) / 12),
      });
      await new Promise((r) => setTimeout(r, 16));
    }
    await wait(
      `!!document.querySelector('.page-gallery-caret')&&!!document.querySelector('.page-gallery-ghost')`,
    );
    mouse('mouseUp', to);
    await saved([600, 500, 300, 400, 600]);
    assert.equal(await run(`${tile(3)}.getAttribute('aria-selected')`), 'true');
    await wait(`!document.querySelector('.page-gallery-ghost')`);
    await wait(`[...document.querySelectorAll('.page-gallery-tile canvas')].every(c=>c.width>0)`);

    // Delete with the key and from the menu, then undo back to the dragged order.
    await key('Backspace', false);
    await saved([600, 500, 400, 600]);
    assert.equal(await run(`${tile(3)}.getAttribute('aria-selected')`), 'true');
    Menu.prototype.popup = function (options) {
      this.items.find((item) => item.label === 'Delete Page').click();
      options.callback?.();
    };
    await run(
      `${tile(1)}.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))`,
    );
    await saved([500, 400, 600]);
    Menu.prototype.popup = popup;
    await key('z');
    await saved([600, 500, 400, 600]);
    assert.equal(await run(`${tile(1)}.getAttribute('aria-selected')`), 'true');
    await key('z');
    await saved([600, 500, 300, 400, 600]);
    assert.equal(await run(`${tile(3)}.getAttribute('aria-selected')`), 'true');
    await key('z');
    await saved([300, 600, 500, 400, 600]);
    await wait(`[...document.querySelectorAll('.page-gallery-tile canvas')].every(c=>c.width>0)`);

    // A copied page that was deleted pastes back from the shared page clipboard, the path
    // pages copied in another document take; undo removes it again.
    await run(`${tile(1)}.focus();${tile(1)}.click()`);
    await key('c');
    await key('Backspace', false);
    await saved([600, 500, 400, 600]);
    await key('v');
    await saved([600, 300, 500, 400, 600]);
    assert.equal(await run(`${tile(2)}.getAttribute('aria-selected')`), 'true');
    await wait(`[...document.querySelectorAll('.page-gallery-tile canvas')].every(c=>c.width>0)`);
    await key('z');
    await saved([600, 500, 400, 600]);
    console.log(
      'Page gallery copy, paste, shared-clipboard paste, context-menu move, drag, delete and undo passed.',
    );
    app.exit(0);
  } finally {
    Menu.prototype.popup = popup;
    await rm(folder, { recursive: true, force: true });
  }
}
