import assert from 'node:assert/strict';
import { app } from 'electron';
import { PDFDocument, PDFName, PDFHexString } from 'pdf-lib';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
export async function verifySidebar(window, recents) {
  const run = (code) =>
    window.webContents.executeJavaScript(code).catch((error) => {
      throw Error('Sidebar script failed: ' + code, { cause: error });
    });
  async function wait(code) {
    for (let i = 0; i < 200; i++) {
      if (await run(code)) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw Error(
      'Sidebar timeout: ' +
        code +
        ' ' +
        JSON.stringify(
          await run(
            `({focus:document.activeElement?.className,text:document.body.innerText,diagnostics:window.previewRenderDiagnostics()})`,
          ),
        ),
    );
  }
  const folder = await mkdtemp(join(tmpdir(), 'sidebar-smoke-'));
  try {
    await wait('window.previewReady');
    await run(
      `window.previewPreferences.save({interactionMode:'reading',automatic:false,uiLanguage:'en'})`,
    );
    const pdf = await PDFDocument.load(
      await readFile(new URL('../../public/sample.pdf', import.meta.url)),
    );
    if (process.argv.includes('--smoke-test=sidebar-keys'))
      for (let i = 0; i < 38; i++) pdf.addPage([612, 792]);
    const root = pdf.context.obj({ Type: 'Outlines' }),
      rootRef = pdf.context.register(root);
    const item = pdf.context.obj({
        Title: PDFHexString.fromText('Original chapter'),
        Parent: rootRef,
        Dest: pdf.context.obj([pdf.getPage(1).ref, 'Fit']),
      }),
      itemRef = pdf.context.register(item);
    const child = pdf.context.obj({
        Title: PDFHexString.fromText('Nested section'),
        Parent: itemRef,
        Dest: pdf.context.obj([pdf.getPage(0).ref, 'Fit']),
      }),
      childRef = pdf.context.register(child);
    item.set(PDFName.of('First'), childRef);
    item.set(PDFName.of('Last'), childRef);
    item.set(PDFName.of('Count'), pdf.context.obj(1));
    root.set(PDFName.of('First'), itemRef);
    root.set(PDFName.of('Last'), itemRef);
    root.set(PDFName.of('Count'), pdf.context.obj(1));
    pdf.catalog.set(PDFName.of('Outlines'), rootRef);
    const path = join(folder, 'Portrait and landscape.pdf');
    await writeFile(path, await pdf.save());
    await recents.remember(path);
    const id = recents.list()[0].id;
    await run(
      `window.previewAnnotations.save({key:${JSON.stringify(id)},nativeRefs:[],annotations:[{id:'source-note',page:1,kind:'comment',origin:'source',text:'Source selection',comment:'Source comment '+('Long comment content '.repeat(90)),color:'#FFFF00',rects:[{x:50,y:80,width:160,height:20}],createdAt:'2026-01-01T00:00:00Z'},{id:'translation-note',page:2,kind:'highlight',origin:'translation',text:'Translated selection',comment:'',color:'#00FFFF',rects:[{x:50,y:80,width:160,height:20}],createdAt:'2026-01-01T00:00:00Z'}]})`,
    );
    await new Promise((resolve) => {
      window.webContents.once('did-finish-load', resolve);
      window.webContents.reload();
    });
    await wait('window.previewReady');
    await run(`document.querySelector('[data-recent-id="${id}"]').click()`);
    await wait(
      `!window.previewRenderDiagnostics().opening&&document.querySelectorAll('.sidebar-navigation-switch :is(button,fluent-tab)').length===3`,
    );
    if (await run(`window.previewAppearance.platform==='win32'`)) {
      window.show();
      window.focus();
      window.webContents.focus();
      await new Promise((resolve) => setTimeout(resolve, 350));
      assert.equal(
        await run(
          `getComputedStyle(document.querySelector('.sidebar-navigation-switch fluent-tab')).getPropertyValue('-webkit-app-region')`,
        ),
        'no-drag',
      );
      const point = await run(
        `(()=>{const r=document.querySelectorAll('.sidebar-navigation-switch fluent-tab')[1].getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`,
      );
      window.webContents.sendInputEvent({ type: 'mouseMove', ...point });
      await new Promise((resolve) => setTimeout(resolve, 30));
      window.webContents.sendInputEvent({
        type: 'mouseDown',
        button: 'left',
        clickCount: 1,
        ...point,
      });
      window.webContents.sendInputEvent({
        type: 'mouseUp',
        button: 'left',
        clickCount: 1,
        ...point,
      });
      await wait(
        `document.querySelectorAll('.sidebar-navigation-switch fluent-tab')[1].dataset.state==='on'`,
      );
      await run(`document.querySelectorAll('.sidebar-navigation-switch fluent-tab')[0].click()`);
      await wait(
        `document.querySelectorAll('.sidebar-navigation-switch fluent-tab')[0].dataset.state==='on'`,
      );
    }
    async function verifyKeys() {
      // Arrow navigation follows clicked items, not the reader's scroll position.
      await run(
        `document.querySelectorAll('.sidebar-navigation-switch :is(button,fluent-tab)')[0].click()`,
      );
      await wait(`!!document.querySelector('.thumb[data-page-number="1"]')`);
      await run(`document.querySelector('.thumb[data-page-number="1"]').click()`);
      await wait(`document.activeElement?.dataset.pageNumber==='1'`);
      await run(
        `document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}))`,
      );
      await wait(
        `document.activeElement?.dataset.pageNumber==='2'&&window.previewRenderDiagnostics().active===2`,
      );
      await run(
        `document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true}))`,
      );
      await wait(
        `document.activeElement?.dataset.pageNumber==='1'&&window.previewRenderDiagnostics().active===1`,
      );
      const lastMounted = await run(
        `(()=>{const items=[...document.querySelectorAll('.thumb')];const item=items.reduce((a,b)=>Number(a.dataset.pageNumber)>Number(b.dataset.pageNumber)?a:b);item.focus();return Number(item.dataset.pageNumber);})()`,
      );
      if (lastMounted < (await run(`window.previewRenderDiagnostics().totalPages`))) {
        await run(
          `document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}))`,
        );
        await wait(
          `document.activeElement?.dataset.pageNumber==='${lastMounted + 1}'&&window.previewRenderDiagnostics().active===${lastMounted + 1}`,
        );
      }

      await run(
        `document.querySelectorAll('.sidebar-navigation-switch :is(button,fluent-tab)')[1].click()`,
      );
      await wait(`document.querySelectorAll('.sidebar-outline-item').length===2`);
      await run(`document.querySelector('.sidebar-outline-item').click()`);
      await wait(
        `document.activeElement?.matches('.sidebar-outline-item')&&window.previewRenderDiagnostics().active===2`,
      );
      await run(
        `document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}))`,
      );
      await wait(
        `document.activeElement?.textContent.includes('Nested section')&&window.previewRenderDiagnostics().active===1`,
      );
      await run(
        `document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true,cancelable:true}))`,
      );
      await wait(
        `document.activeElement?.textContent.includes('Original chapter')&&window.previewRenderDiagnostics().active===2`,
      );
      await run(
        `document.querySelectorAll('.sidebar-navigation-switch :is(button,fluent-tab)')[2].click()`,
      );
      await wait(`document.querySelectorAll('.sidebar-annotation-item').length===2`);
      await run(`document.querySelector('.sidebar-annotation-item').click()`);
      await wait(
        `document.activeElement?.matches('.sidebar-annotation-item')&&window.previewRenderDiagnostics().active===1`,
      );
      await run(
        `document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}))`,
      );
      await wait(
        `document.activeElement?.textContent.includes('Translated selection')&&window.previewRenderDiagnostics().active===2`,
      );
      const prevented = await run(
        `(()=>{const input=document.querySelector('.annotation-browser-search input');input.focus();const event=new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true});input.dispatchEvent(event);return event.defaultPrevented;})()`,
      );
      assert.equal(prevented, false, 'search field retains arrow keys');
    }
    if (process.argv.includes('--smoke-test=sidebar-keys')) {
      await verifyKeys();
      console.log(
        'Sidebar arrow keys navigate thumbnails, outline and annotations; search keys unchanged.',
      );
      app.exit(0);
      return;
    }
    assert.equal(
      await run(
        `document.querySelector('.sidebar-navigation-switch :is(button,fluent-tab):is([aria-pressed=true],[data-state=on])').textContent`,
      ),
      'Thumbnails',
    );
    await run(
      `document.querySelectorAll('.sidebar-navigation-switch :is(button,fluent-tab)')[1].click()`,
    );
    await wait(`!!document.querySelector('.sidebar-outline-item')`);
    assert.equal(
      await run(`document.querySelector('.sidebar-outline-item').textContent`),
      'Original chapter2',
    );
    assert.equal(await run(`document.querySelectorAll('.sidebar-outline-item').length`), 2);
    await run(`document.querySelector('.sidebar-outline-toggle').click()`);
    assert.equal(await run(`document.querySelectorAll('.sidebar-outline-item').length`), 1);
    await run(`document.querySelector('.sidebar-outline-toggle').click()`);
    assert.equal(await run(`document.querySelectorAll('.sidebar-outline-item').length`), 2);
    await run(
      `document.querySelector('.sidebar-outline-item').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`,
    );
    assert.equal(await run(`document.querySelectorAll('.sidebar-outline-item').length`), 1);
    await run(
      `document.querySelector('.sidebar-outline-item').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))`,
    );
    assert.equal(await run(`document.querySelectorAll('.sidebar-outline-item').length`), 2);
    assert.ok(
      await run(
        `(()=>{const icon=document.querySelector('.sidebar-outline-toggle svg').getBoundingClientRect(),row=document.querySelector('.sidebar-outline-item'),bounds=row.getBoundingClientRect(),style=getComputedStyle(row),center=bounds.top+parseFloat(style.paddingTop)+parseFloat(style.lineHeight)/2;return Math.abs(icon.top+icon.height/2-center)<1;})()`,
      ),
      'disclosure arrow aligns with title first line',
    );

    await wait(
      `!document.querySelector('.document-motion-snapshot,.sidebar-motion-enter-active,.sidebar-view-motion-enter-active,.workspace.document-opening')`,
    );
    await run(
      `document.querySelectorAll('.sidebar-navigation-switch :is(button,fluent-tab)')[0].click()`,
    );
    await wait(
      `!!document.querySelector('.thumbnail-list')&&!document.querySelector('.sidebar-view-motion-enter-active')`,
    );
    const before = await run(`document.querySelector('.sidebar').getBoundingClientRect().width`);
    const point = await run(
      `(()=>{const r=document.querySelector('.sidebar-resize-handle').getBoundingClientRect();return {x:Math.round(r.left+3),y:Math.round(r.top+60)};})()`,
    );

    window.focus();
    window.webContents.sendInputEvent({ type: 'mouseMove', ...point });
    await new Promise((r) => setTimeout(r, 60));
    window.webContents.sendInputEvent({
      type: 'mouseDown',
      ...point,
      button: 'left',
      clickCount: 1,
    });
    await new Promise((r) => setTimeout(r, 60));
    window.webContents.sendInputEvent({
      type: 'mouseMove',
      x: point.x + 90,
      y: point.y,
      modifiers: ['leftButtonDown'],
    });
    await new Promise((r) => setTimeout(r, 60));
    window.webContents.sendInputEvent({
      type: 'mouseUp',
      x: point.x + 90,
      y: point.y,
      button: 'left',
      clickCount: 1,
    });
    await wait(`document.querySelector('.sidebar').getBoundingClientRect().width>${before + 60}`);
    const expanded = await run(`document.querySelector('.sidebar').getBoundingClientRect().width`);
    await run(
      `document.querySelector('.sidebar-resize-handle').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))`,
    );
    await wait(`document.querySelector('.sidebar').getBoundingClientRect().width>${expanded + 10}`);
    for (const tab of [1, 2, 0, 1]) {
      await run(
        `document.querySelectorAll('.sidebar-navigation-switch :is(button,fluent-tab)')[${tab}].click()`,
      );
      await wait(`!document.querySelector('.sidebar-view-motion-enter-active')`);
      assert.ok(
        Math.abs(
          (await run(`document.querySelector('.sidebar').getBoundingClientRect().width`)) -
            expanded -
            20,
        ) < 2,
        'all sidebar tabs share the dragged thumbnail width',
      );
    }
    await wait(`!!document.querySelector('.sidebar-outline-item')`);
    const outlineOrigin = await run(`window.previewRenderDiagnostics().readingView`);
    await run(`document.querySelector('.sidebar-outline-item').click()`);
    await wait(
      `window.previewRenderDiagnostics().active===2&&!!document.querySelector('.reference-return-button')`,
    );
    await run(`document.querySelector('.reference-return-button').click()`);
    await wait(
      `window.previewRenderDiagnostics().active===${outlineOrigin.page}&&!document.querySelector('.reference-return-button')`,
    );
    assert.ok(
      Math.abs(
        (await run(`window.previewRenderDiagnostics().readingView`)).offsetY -
          outlineOrigin.offsetY,
      ) < 0.005,
      'outline restores position',
    );
    await run(`document.querySelector('.sidebar-outline-item').click()`);
    await wait(
      `window.previewRenderDiagnostics().active===2&&!!document.querySelector('.reference-return-button')`,
    );
    await run(
      `document.querySelectorAll('.sidebar-navigation-switch :is(button,fluent-tab)')[2].click()`,
    );
    await wait(`document.querySelectorAll('.sidebar-annotation-item').length===2`);
    assert.equal(
      await run(
        `getComputedStyle(document.querySelector('.sidebar-annotation-comment')).webkitLineClamp`,
      ),
      '4',
    );
    assert.equal(
      await run(
        `(()=>{const e=document.querySelector('.sidebar-annotation-comment');return e.scrollHeight>e.clientHeight&&e.clientHeight<=parseFloat(getComputedStyle(e).lineHeight)*4+1;})()`,
      ),
      true,
    );
    await run(`document.querySelectorAll('.sidebar-annotation-item')[0].click()`);
    await wait(
      `window.previewRenderDiagnostics().active===1&&document.querySelector('.annotation-reader')?.textContent.includes('Source comment')`,
    );
    assert.equal(
      await run(`window.previewRenderDiagnostics().readingView.showTranslations`),
      false,
    );
    await wait(`!!document.querySelector('.reference-return-button')`);
    const annotationOrigin = await run(`window.previewRenderDiagnostics().readingView`);
    await run(`document.querySelectorAll('.sidebar-annotation-item')[1].click()`);
    await wait(
      `window.previewRenderDiagnostics().active===2&&document.querySelector('.sidebar-annotation-item.selected')?.textContent.includes('Translated selection')`,
    );
    assert.equal(await run(`window.previewRenderDiagnostics().readingView.showTranslations`), true);
    await wait(`!document.querySelector('.annotation-reader')`);
    await wait(`!!document.querySelector('.reference-return-button')`);
    await run(
      `document.activeElement?.blur();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Backspace',metaKey:true,bubbles:true,cancelable:true}))`,
    );
    await wait(
      `window.previewRenderDiagnostics().active===1&&!document.querySelector('.reference-return-button')`,
    );
    const annotationReturned = await run(`window.previewRenderDiagnostics().readingView`);
    assert.equal(annotationReturned.showTranslations, annotationOrigin.showTranslations);
    assert.ok(
      Math.abs(annotationReturned.offsetY - annotationOrigin.offsetY) < 0.005,
      'annotation restores position',
    );
    await run(`document.querySelectorAll('.sidebar-annotation-item')[1].click()`);
    await wait(
      `window.previewRenderDiagnostics().active===2&&!!document.querySelector('.reference-return-button')`,
    );
    await run(
      `document.querySelectorAll('.sidebar-navigation-switch :is(button,fluent-tab)')[1].click();document.querySelector('.sidebar-outline-item')?.click()`,
    );
    await wait(`!!document.querySelector('.sidebar-outline-item')`);
    await run(`document.querySelector('.sidebar-outline-item').click()`);
    await wait(`window.previewRenderDiagnostics().active===2`);
    assert.equal(await run(`window.previewRenderDiagnostics().readingView.showTranslations`), true);
    await run(
      `document.querySelectorAll('.sidebar-navigation-switch :is(button,fluent-tab)')[2].click()`,
    );
    await wait(`document.querySelectorAll('.sidebar-annotation-item').length===2`);
    await new Promise((r) => setTimeout(r, 250));
    await writeFile(
      join(tmpdir(), 'pdfreader-sidebar.png'),
      (await window.webContents.capturePage()).toPNG(),
    );
    const footer = await run(
      `(()=>{const f=document.querySelector('.sidebar-navigation-switch').getBoundingClientRect(),s=document.querySelector('.sidebar').getBoundingClientRect();return {within:f.bottom<=s.bottom,gap:s.bottom-f.bottom};})()`,
    );
    assert.equal(footer.within, true);
    assert.ok(footer.gap < 16);
    await run(
      `document.querySelector('.sidebar-navigation-switch :is(button,fluent-tab)').click()`,
    );
    assert.ok(
      await run(
        `window.previewAppearance?.platform==='win32'?!!document.querySelector('.sidebar-navigation-switch fluent-tab[data-state=on]'):document.querySelector('.sidebar-tab-indicator').getAnimations().length>0`,
      ),
      'tab selection animates',
    );
    await wait(`window.previewRenderDiagnostics().thumbnails.length>0`);
    await run(`window.sidebarThumbnailNode=document.querySelector('.thumbnail-list')`);
    for (const tab of [1, 2, 0, 2, 1, 0]) {
      await run(
        `document.querySelectorAll('.sidebar-navigation-switch :is(button,fluent-tab)')[${tab}].click()`,
      );
      await new Promise((r) => setTimeout(r, 35));
    }
    await wait(
      `!document.querySelector('.sidebar-view-motion-enter-active,.sidebar-view-motion-leave-active')&&!!document.querySelector('.thumbnail-list')`,
    );
    await wait(`window.previewRenderDiagnostics().thumbnails.length>0`);
    assert.equal(
      await run(`document.querySelectorAll('.sidebar-view').length`),
      1,
      'rapid switching leaves one sidebar view',
    );
    assert.ok(
      await run(`document.querySelector('.thumbnail-list').clientHeight>100`),
      'thumbnail viewport survives rapid switching',
    );
    assert.equal(
      await run(`window.sidebarThumbnailNode===document.querySelector('.thumbnail-list')`),
      true,
      'tab switches preserve the thumbnail viewport',
    );
    assert.ok(
      await run(
        `(()=>{const f=document.querySelector('.sidebar-navigation-switch').getBoundingClientRect(),s=document.querySelector('.sidebar').getBoundingClientRect();return s.bottom-f.bottom<16;})()`,
      ),
      'switch remains at the bottom after rapid switching',
    );
    await run(
      `document.querySelectorAll('.sidebar-navigation-switch :is(button,fluent-tab)')[1].click()`,
    );
    await wait(
      `!!document.querySelector('.sidebar-outline-item')&&!document.querySelector('.sidebar-view-motion-enter-active')`,
    );
    window.webContents.send('reader:action', 'sidebar');
    await wait(`!document.querySelector('.sidebar')`);
    window.webContents.send('reader:action', 'sidebar');
    await wait(`!!document.querySelector('.sidebar-motion-enter-active')`);
    assert.equal(
      await run(
        `(()=>{const s=document.querySelector('.sidebar'),f=s.querySelector('.sidebar-navigation-switch');return f.getBoundingClientRect().width+parseFloat(getComputedStyle(f).marginLeft)+parseFloat(getComputedStyle(f).marginRight)<=${expanded + 21};})()`,
      ),
      true,
      'tab switch fits the sidebar during expansion',
    );
    await wait(
      `!!document.querySelector('.sidebar')&&!document.querySelector('.sidebar-motion-enter-active')`,
    );
    assert.ok(
      Math.abs(
        (await run(`document.querySelector('.sidebar').getBoundingClientRect().width`)) -
          expanded -
          20,
      ) < 2,
      'resized sidebar width survives hide/show',
    );
    for (const tab of [0, 1, 2]) {
      await run(
        `document.querySelectorAll('.sidebar-navigation-switch :is(button,fluent-tab)')[${tab}].click()`,
      );
      await new Promise((r) => setTimeout(r, 220));
      const motion = await run(
        `(async()=>{const app=document.querySelector('.app'),sidebar=document.querySelector('.sidebar');const padding=()=>parseFloat(getComputedStyle(sidebar).paddingTop);const start=padding();app.classList.add('immersive-header-hidden');await new Promise(r=>setTimeout(r,70));const middle=padding();await new Promise(r=>setTimeout(r,160));const hidden=padding();app.classList.remove('immersive-header-hidden');await new Promise(r=>setTimeout(r,70));const returning=padding();await new Promise(r=>setTimeout(r,160));return {start,middle,hidden,returning,end:padding()};})()`,
      );
      assert.ok(
        motion.start > 0 && motion.middle > 0 && motion.middle < motion.start,
        'sidebar tab ' + tab + ' animates while hiding header',
      );
      assert.equal(motion.hidden, 0);
      assert.ok(
        motion.returning > 0 && motion.returning < motion.start,
        'sidebar tab ' + tab + ' animates while showing header',
      );
      assert.equal(motion.end, motion.start);
    }
    await verifyKeys();
    console.log(
      JSON.stringify({
        sidebarModes: true,
        originalOutlinePageNavigation: true,
        mergedAnnotations: true,
        sourceCommentActivation: true,
        translationAnnotationNavigation: true,
        footerPlacement: true,
        thumbnailRestoration: true,
        outlineCollapse: true,
        dragAndKeyboardResize: true,
        fourLineCommentTrim: true,
        tabAnimation: true,
      }),
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
    app.quit();
  }
}
