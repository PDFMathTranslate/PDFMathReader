import assert from 'node:assert/strict';
import { app } from 'electron';
import { PDFDocument, PDFName, PDFHexString } from 'pdf-lib';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  captureDocumentPage,
  motionCanvasSize,
} from '../../src/features/reader/document-motion.mjs';
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
      `window.previewPreferences.save({interactionMode:'reading',automatic:false,documentOpenMode:'manual',uiLanguage:'en',interfaceStyle:${JSON.stringify(process.argv.includes('--smoke-test=sidebar-glass') ? 'liquid-glass' : 'default')}})`,
    );
    const pdf = await PDFDocument.load(
      await readFile(new URL('../../public/sample.pdf', import.meta.url)),
    );
    if (process.argv.includes('--smoke-test=sidebar-glass'))
      for (let i = 0; i < 7; i++) {
        const [page] = await pdf.copyPages(pdf, [0]);
        pdf.addPage(page);
      }
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
    if (process.argv.includes('--smoke-test=sidebar-glass')) {
      window.show();
      window.focus();
      window.webContents.focus();
      await wait(`document.querySelector('.thumb canvas')?.width>0`);
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await wait(`document.documentElement.dataset.liquidGlass==='ready'`);
      const geometry = () =>
        run(`(()=>{
        const rect=e=>{const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
        return {footer:rect(document.querySelector('.sidebar-navigation-switch')),
          viewport:rect(document.querySelector('.thumbnail-list')),
          rows:[...document.querySelectorAll('.thumb')].map(e=>({
            number:e.dataset.pageNumber,row:rect(e),canvas:rect(e.querySelector('canvas')),
            label:rect(e.querySelector('span')),
          }))};
      })()`);
      const verifyGeometry = async () => {
        const state = await geometry();
        assert.ok(
          state.viewport.bottom <= state.footer.top,
          'footer reserves space below the scroller',
        );
        for (let i = 0; i < state.rows.length; i++) {
          const item = state.rows[i];
          assert.ok(item.canvas.bottom <= item.label.top + 1, 'page number stays below its image');
          assert.ok(item.label.bottom <= item.row.bottom + 1, 'page number stays inside its row');
          if (i)
            assert.ok(state.rows[i - 1].row.bottom <= item.row.top, 'virtual rows never overlap');
        }
      };
      await verifyGeometry();
      // Real opening animations clone the rail. Frozen captures must not carry
      // duplicate SVG filter IDs or acquire a second live scene.
      const cloned = await run(`(()=>{
        const motionCanvasSize=${motionCanvasSize.toString()};
        const capture=(${captureDocumentPage.toString()})(document.querySelector('.sidebar'));
        capture.element.id='glass-motion-check';
        document.querySelector('.app').append(capture.element);
        return {layers:capture.element.querySelectorAll('.reader-glass-layer').length,
          hosts:capture.element.querySelectorAll('.reader-glass-host').length};
      })()`);
      assert.deepEqual(cloned, { layers: 0, hosts: 0 });
      await new Promise((resolve) => setTimeout(resolve, 300));
      assert.equal(
        await run(`document.querySelector('#glass-motion-check .reader-glass-layer')!==null`),
        false,
      );
      await run(`document.querySelector('#glass-motion-check').remove()`);
      for (let i = 0; i < 3; i++) {
        for (const tab of [1, 2, 0]) {
          await run(
            `document.querySelectorAll('.sidebar-navigation-switch > button')[${tab}].click()`,
          );
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        await run(
          `(()=>{const list=document.querySelector('.thumbnail-list');list.scrollTop=${i % 2 ? 0 : 650};list.dispatchEvent(new Event('scroll'));})()`,
        );
        await new Promise((resolve) => setTimeout(resolve, 300));
        await verifyGeometry();
        assert.equal(
          await run(
            `document.querySelectorAll('.sidebar-navigation-switch > .reader-glass-layer').length`,
          ),
          0,
        );
        assert.equal(await run(`document.documentElement.dataset.liquidGlass`), 'ready');
      }
      await run(`document.querySelector('.thumb[data-page-number="4"]').click()`);
      await wait(`window.previewRenderDiagnostics().active===4`);
      await new Promise((resolve) => setTimeout(resolve, 350));
      await verifyGeometry();
      await writeFile(
        '/tmp/pdfmathreader-sidebar-glass-fixed.png',
        (await window.webContents.capturePage()).toPNG(),
      );
      console.log(
        JSON.stringify({
          liquidGlassSidebar: true,
          stableVirtualRows: true,
          isolatedMotionCapture: true,
          stableGlassLayers: true,
          tabSwitchAndScroll: true,
        }),
      );
      return;
    }
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
    if (process.argv.includes('--smoke-test=sidebar-glass'))
      for (let i = 0; i < 7; i++) {
        const [page] = await pdf.copyPages(pdf, [0]);
        pdf.addPage(page);
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
