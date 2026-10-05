import assert from 'node:assert/strict';
import { app } from 'electron';
import { PDFDocument } from 'pdf-lib';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
export async function verifyPDFNavigation(window, recents) {
  const run = async (code) => {
    try {
      return await window.webContents.executeJavaScript(code);
    } catch (e) {
      throw Error(code + ' ' + e.message);
    }
  };
  async function wait(code) {
    for (let i = 0; i < 200; i++) {
      if (await run(code)) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw Error(
      'Navigation timeout: ' +
        code +
        ' ' +
        JSON.stringify(
          await run(
            '({text:document.body.innerText,links:document.querySelectorAll(".reading-links").length,textLayers:document.querySelectorAll(".reading-text-layer").length,diagnostics:window.previewRenderDiagnostics?.()})',
          ),
        ),
    );
  }
  window.webContents.on('console-message', (_e, ...args) => console.log('renderer', ...args));
  const folder = await mkdtemp(join(tmpdir(), 'pdf-navigation-'));
  try {
    await wait('window.previewReady');
    await run(`window.previewPreferences.save({interactionMode:'reading',automatic:false})`);
    const pdf = await PDFDocument.create();
    for (let i = 0; i < 5; i++) {
      const p = pdf.addPage(i === 2 ? [650, 900] : i === 4 ? [400, 750] : [500, 700]);
      p.drawText('Page ' + (i + 1), { x: 60, y: 620 });
    }
    for (const [index, dest] of [
      [0, [pdf.getPage(2).ref, 'XYZ', 0, 500, null]],
      [2, [pdf.getPage(4).ref, 'FitH', 650]],
    ]) {
      const link = pdf.context.register(
        pdf.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [50, 590, 200, 650], Dest: dest }),
      );
      pdf
        .getPage(index)
        .node.set((await import('pdf-lib')).PDFName.of('Annots'), pdf.context.obj([link]));
    }
    const path = join(folder, 'Portrait and landscape.pdf');
    await writeFile(path, await pdf.save());
    await recents.remember(path);
    const id = recents.list()[0].id;
    await new Promise((resolve) => {
      window.webContents.once('did-finish-load', resolve);
      window.webContents.reload();
    });
    await wait('window.previewReady');
    await run(`document.querySelector('[data-recent-id="${id}"]').click()`);
    await wait(
      '!window.previewRenderDiagnostics().opening&&!!document.querySelector(".translation-toggle")',
    );
    if (await run('window.previewRenderDiagnostics().readingView.showTranslations'))
      await run('document.querySelector(".translation-toggle").click()');
    await wait('!!document.querySelector(".page-wrap:nth-child(1) .reading-links a")');
    await run('document.querySelector(".reader").scrollTop+=90');
    await new Promise((r) => setTimeout(r, 300));
    const origin = await run('window.previewRenderDiagnostics().readingView');
    await run('document.querySelector(".page-wrap:nth-child(1) .reading-links a").click()');
    await wait(
      '!!document.querySelector(".reference-return-button")&&window.previewRenderDiagnostics().active===3',
    );
    assert.ok(await run('document.querySelector(".reference-return-button").title.includes("⌘⌫")'));
    assert.equal(
      await run(
        'getComputedStyle(document.querySelector(".reference-return-button")).transitionDuration',
      ),
      '0.2s',
    );
    async function verifyPlacement() {
      const geometry = await run(
        `(()=>{const b=document.querySelector('.reference-return-button').getBoundingClientRect(),r=document.querySelector('.reader').getBoundingClientRect();return {left:b.left-r.left,bottom:r.bottom-b.bottom,inside:b.left>=r.left&&b.right<=r.right&&b.top>=r.top&&b.bottom<=r.bottom};})()`,
      );
      assert.equal(geometry.inside, true);
      assert.ok(Math.abs(geometry.left - 22) < 2);
      assert.ok(Math.abs(geometry.bottom - 22) < 2);
    }
    await verifyPlacement();
    await run(`document.querySelector('[aria-label="Toggle thumbnails"]').click()`);
    await new Promise((r) => setTimeout(r, 400));
    await verifyPlacement();
    await run(`document.querySelector('[aria-label="Toggle thumbnails"]').click()`);
    await new Promise((r) => setTimeout(r, 400));
    await verifyPlacement();

    await run('document.querySelector(".reference-return-button").click()');
    await wait(
      'window.previewRenderDiagnostics().active===1&&!document.querySelector(".reference-return-button")',
    );
    const returned = await run('window.previewRenderDiagnostics().readingView');
    assert.ok(Math.abs(returned.offsetY - origin.offsetY) < 0.005, 'restore precise position');
    await run('document.querySelectorAll(".thumb")[2].click()');
    await wait(
      'window.previewRenderDiagnostics().active===3&&!!document.querySelector(".reference-return-button")',
    );
    await verifyPlacement();
    await run('document.querySelector(".reference-return-button").click()');
    await wait(
      'window.previewRenderDiagnostics().active===1&&!document.querySelector(".reference-return-button")',
    );
    const sidebarReturned = await run('window.previewRenderDiagnostics().readingView');
    assert.ok(
      Math.abs(sidebarReturned.offsetY - origin.offsetY) < 0.005,
      'sidebar restores precise position',
    );
    assert.equal(sidebarReturned.zoom, origin.zoom);
    await run('document.querySelector(".page-wrap:nth-child(1) .reading-links a").click()');
    await wait('!!document.querySelector(".page-wrap:nth-child(3) .reading-links a")');
    await run('document.querySelector(".page-wrap:nth-child(3) .reading-links a").click()');
    await wait(
      'window.previewRenderDiagnostics().active===5&&document.querySelector(".reference-return-button")?.textContent.includes("3")',
    );
    await new Promise((r) => setTimeout(r, 300));
    await run(
      'document.activeElement?.blur();document.dispatchEvent(new KeyboardEvent("keydown",{key:"Backspace",metaKey:true,bubbles:true,cancelable:true}))',
    );
    await wait(
      'window.previewRenderDiagnostics().active===3&&!document.querySelector(".reference-return-button")',
    );
    await run('document.querySelector(".page-wrap:nth-child(3) .reading-links a").click()');
    await wait('!!document.querySelector(".reference-return-button")');
    await run('document.querySelector(".reader").scrollTop=0');
    await wait('!document.querySelector(".reference-return-button")');
    const unbound = await run(
      '(()=>{const e=new KeyboardEvent("keydown",{key:"Backspace",metaKey:true,bubbles:true,cancelable:true});document.dispatchEvent(e);return !e.defaultPrevented})()',
    );
    assert.equal(unbound, true);
    for (const mode of ['width', 'height']) {
      window.webContents.send('reader:action', 'percent:20');
      await wait('window.previewRenderDiagnostics().active===1');
      window.webContents.send('reader:action', 'fit-' + mode);
      await new Promise((r) => setTimeout(r, 400));
      const before = await run('window.previewRenderDiagnostics().readingView');
      await wait(`!!document.querySelector('.page[data-page="1"] .reading-links a')`);
      await run(`document.querySelector('.page[data-page="1"] .reading-links a').click()`);
      await wait(
        'window.previewRenderDiagnostics().active===3&&!!document.querySelector(".reference-return-button")',
      );
      const geometry = await run(
        `(()=>{const d=window.previewRenderDiagnostics(),r=document.querySelector('.reader'),s=getComputedStyle(r),p=document.querySelector('.page[data-page="3"]'),b=p.getBoundingClientRect();return {fit:d.readingView.fit,zoom:d.readingView.zoom,width:b.width,height:b.height,availableWidth:r.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight),availableHeight:r.clientHeight-parseFloat(s.paddingTop)-parseFloat(s.paddingBottom),targetTop:b.top+(900-500)*d.readingView.zoom-r.getBoundingClientRect().top-r.clientTop};})()`,
      );
      assert.equal(geometry.fit, mode, 'internal link keeps fit mode');
      assert.ok(
        Math.abs(
          mode === 'width'
            ? geometry.width - geometry.availableWidth
            : geometry.height - geometry.availableHeight,
        ) < 2,
        'destination fits its own dimensions',
      );
      assert.ok(Math.abs(geometry.targetTop) < 2, 'destination coordinates use the fitted scale');
      await run('document.querySelector(".reference-return-button").click()');
      await wait(
        'window.previewRenderDiagnostics().active===1&&!document.querySelector(".reference-return-button")',
      );
      const after = await run('window.previewRenderDiagnostics().readingView');
      assert.equal(after.fit, mode);
      assert.ok(Math.abs(after.zoom - before.zoom) < 0.0001);
      assert.ok(Math.abs(after.offsetY - before.offsetY) < 0.005);
    }
    console.log(
      JSON.stringify({
        readerViewportPlacement: true,
        sidebarPlacement: true,
        internalLinks: true,
        preciseReturn: true,
        nestedJump: true,
        commandBackspace: true,
        hoverHint: true,
        fade200ms: true,
        offscreenDismissal: true,
        shortcutUnbound: true,
      }),
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
    app.quit();
  }
}
