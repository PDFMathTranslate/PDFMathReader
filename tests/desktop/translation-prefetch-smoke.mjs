import assert from 'node:assert/strict';
import { app } from 'electron';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
export async function verifyTranslationPrefetch(window, recents) {
  window.show();
  window.focus();
  const run = (code) => window.webContents.executeJavaScript(code),
    pause = (ms) => new Promise((r) => setTimeout(r, ms));
  async function wait(code) {
    for (let i = 0; i < 180; i++) {
      if (await run(code)) return;
      await pause(50);
    }
    throw Error(
      'Prefetch timeout: ' +
        code +
        ' ' +
        JSON.stringify(await run('window.previewRenderDiagnostics?.()')),
    );
  }
  async function reload() {
    const loaded = new Promise((resolve) => window.webContents.once('did-finish-load', resolve));
    window.webContents.reload();
    await loaded;
    await wait('window.previewReady');
  }
  const folder = await mkdtemp(join(tmpdir(), 'translation-prefetch-'));
  try {
    const pdf = await PDFDocument.create(),
      font = await pdf.embedFont(StandardFonts.Helvetica);
    for (let n = 1; n <= 24; n++)
      pdf
        .addPage([612, 792])
        .drawText('Page ' + n + ' reading paragraph', { x: 50, y: 700, font, size: 16 });
    const path = join(folder, 'Portrait and landscape.pdf');
    await writeFile(path, await pdf.save());
    await recents.remember(path);
    const id = recents.list()[0].id;
    await wait('window.previewReady');
    await run(`window.previewPreferences.save({reduceMotion:true})`);
    await pause(250);
    await run(
      `window.previewPreferences.save({engine:'pdf_inspector',translationMode:'full',automatic:false,documentOpenMode:'manual',fit:'width',columns:1,direction:'vertical'})`,
    );
    assert.equal(
      await run('(async()=> (await window.previewPreferences.load()).documentOpenMode)()'),
      'manual',
    );
    await reload();
    assert.equal(
      await run('(async()=> (await window.previewPreferences.load()).documentOpenMode)()'),
      'manual',
    );
    assert.equal(await run('localStorage.getItem("documentOpenMode")'), 'manual');
    const installMock = () =>
      run(`(()=>{const original=window.fetch;window.prefetchEvents=[];window.fetch=async(url,options={})=>{
   if(url==='/api/layout'){const {page}=JSON.parse(options.body);return new Response(JSON.stringify({paragraphs:[{id:'p'+page,text:'Page '+page,x:50,y:80,width:400,height:50,fontSize:16}]}),{status:200,headers:{'Content-Type':'application/json'}});}
   if(url==='/api/translate'){const body=JSON.parse(options.body),page=Number(body.text.split(' ')[1]);window.prefetchEvents.push({kind:'start',page});await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,900);options.signal.addEventListener('abort',()=>{clearTimeout(timer);window.prefetchEvents.push({kind:'abort',page});reject(new DOMException('Aborted','AbortError'));},{once:true});});window.prefetchEvents.push({kind:'finish',page});return new Response(JSON.stringify({translation:'Translated '+page,cached:false}),{status:200,headers:{'Content-Type':'application/json'}});}
   return original(url,options);
  };return true;})()`);
    await installMock();
    // A saved translated view must not override manual opening, even in full-document mode.
    const savedView = {
      page: 5,
      offsetX: 0,
      offsetY: 0.2,
      zoom: 1,
      fit: 'width',
      columns: 1,
      direction: 'vertical',
      sidebar: true,
      showTranslations: true,
    };
    await recents.setView(id, savedView);
    await run(`document.querySelector('[data-recent-id="${id}"]').click();true`);
    await wait(
      'window.previewRenderDiagnostics().totalPages===24&&!window.previewRenderDiagnostics().opening',
    );
    await pause(1200);
    const manual = await run('window.previewRenderDiagnostics()');
    assert.equal(
      manual.readingView.showTranslations,
      false,
      'manual opening overrides saved translated view',
    );
    assert.equal(manual.active, 5, 'manual opening preserves reading position');
    assert.deepEqual(
      await run('window.prefetchEvents'),
      [],
      'manual opening sends no translation requests',
    );
    await run(
      `(()=>{const r=document.querySelector('.reader');r.scrollTop=r.scrollHeight*.65;r.dispatchEvent(new Event('scroll'));return true;})()`,
    );
    await pause(400);
    assert.deepEqual(
      await run('window.prefetchEvents'),
      [],
      'scrolling cannot unlock manual opening',
    );
    window.webContents.send('reader:action', 'translation');
    await wait('window.prefetchEvents.some(e=>e.kind==="start")');
    assert.equal(
      await run('window.previewRenderDiagnostics().readingView.showTranslations'),
      true,
      'explicit toggle enables translation',
    );
    window.webContents.send('reader:action', 'close-document');
    await wait('!!document.querySelector(".empty")');
    await run(
      `window.previewPreferences.save({documentOpenMode:'translation',translationMode:'reading'})`,
    );
    await recents.setView(id, { ...savedView, page: 1, offsetY: 0 });
    await reload();
    await installMock();
    await run(`document.querySelector('[data-recent-id="${id}"]').click();true`);
    await wait('window.prefetchEvents.some(e=>e.kind==="start"&&e.page===1)');
    await wait('window.prefetchEvents.some(e=>e.kind==="start"&&e.page===2)');
    // Jump while requests are in flight. The destination must start without waiting for their 900ms delay.
    await run(
      `(()=>{const r=document.querySelector('.reader');r.scrollTop=r.scrollHeight*.65;r.dispatchEvent(new Event('scroll'));return true;})()`,
    );
    await wait('window.prefetchEvents.some(e=>e.kind==="abort"&&e.page<=2)');
    await wait('window.prefetchEvents.some(e=>e.kind==="start"&&e.page>=15)');
    const landed = await run('window.previewRenderDiagnostics()');
    assert.ok(landed.active >= 15);
    assert.equal(landed.translationOrder[0], landed.active);
    await pause(250);
    const settled = await run('window.previewRenderDiagnostics()');
    assert.equal(settled.translationMoving, false);
    assert.ok(settled.translationOrder.includes(settled.active + 1));
    await run(
      `(()=>{const r=document.querySelector('.reader');r.scrollTop=r.scrollHeight*.3;r.dispatchEvent(new Event('scroll'));return true;})()`,
    );
    await pause(300);
    const back = await run('window.previewRenderDiagnostics()');
    assert.equal(back.readingDirection, -1);
    assert.ok(
      back.translationOrder.indexOf(back.active - 1) <
        back.translationOrder.indexOf(back.active + 1),
    );
    await run(`document.querySelector('[aria-label="Translation settings"]').click();true`);
    assert.equal(
      await run(
        `(()=>{const slider=document.querySelector('.parallel-settings');return slider?.closest('details')?.open===false;})()`,
      ),
      true,
    );
    window.webContents.send('reader:action', 'close-document');
    await wait('!!document.querySelector(".empty")');
    await run(`window.previewPreferences.save({translationMode:'reading-ahead'})`);
    await recents.setView(id, { ...savedView, page: 1, offsetY: 0 });
    await reload();
    await installMock();
    await run(`document.querySelector('[data-recent-id="${id}"]').click();true`);
    await wait('window.previewRenderDiagnostics().translationOrder.includes(7)');
    const ahead = await run('window.previewRenderDiagnostics()');
    assert.equal(ahead.translationOrder[0], ahead.active);
    assert.ok(ahead.translationOrder.length < 24, 'lookahead stays bounded');
    await wait('window.prefetchEvents.some(e=>e.kind==="start"&&e.page===7)');
    console.log('READING_AHEAD_SIX_PAGES_PASS');
    console.log(
      JSON.stringify({
        manualOpeningOverridesSavedView: true,
        manualOpeningPreservesPosition: true,
        noTranslationBeforeExplicitToggle: true,
        advancedConcurrencyCollapsed: true,
        automaticDespiteLegacyDisabledPreference: true,
        nextPagePrepared: true,
        jumpCancelsOldRequests: true,
        destinationPrioritized: true,
        backwardPrefetch: true,
        events: await run('window.prefetchEvents'),
      }),
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
    app.quit();
  }
}
