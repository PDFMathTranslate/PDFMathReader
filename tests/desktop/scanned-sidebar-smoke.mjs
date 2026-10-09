import assert from 'node:assert/strict';
import { app } from 'electron';
import { copyFile, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const SOURCE_PDF = process.env.PDFMATHREADER_SCANNED_PDF
  ? resolve(process.env.PDFMATHREADER_SCANNED_PDF)
  : null;
const TOTAL_PAGES = 526;
const TARGET_PAGES = Object.freeze([106, 107, 108, 109, 110, 111, 112, 113, 114]);
const MIN_INK_PIXELS = 100;

export async function verifyScannedSidebar(window, recents) {
  const run = (code) =>
    window.webContents.executeJavaScript(code).catch((error) => {
      throw Error(`Scanned sidebar script failed: ${code.slice(0, 240)} (${error.message})`, {
        cause: error,
      });
    });
  const pause = (ms) => new Promise((resolvePause) => setTimeout(resolvePause, ms));
  const diagnostics = () => run('window.previewRenderDiagnostics?.()');
  const activateWindow = () => {
    app.focus({ steal: true });
    window.show();
    window.focus();
    window.webContents.focus();
  };
  const screenshot = async (path) => {
    try {
      await writeFile(path, (await window.webContents.capturePage()).toPNG());
      console.log(`Scanned sidebar screenshot: ${path}`);
    } catch (error) {
      console.warn(`Scanned sidebar screenshot unavailable: ${path} (${error.message})`);
    }
  };
  async function waitFor(label, code, timeoutMs = 30_000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (await run(code)) return;
      await pause(75);
    }
    let state;
    try {
      state = await run(
        `(()=>({title:document.title,active:document.querySelector('.thumb.selected')?.dataset.pageNumber,diagnostics:window.previewRenderDiagnostics?.(),thumbnailScroll:document.querySelector('.thumbnail-list')?.scrollTop,readerScroll:document.querySelector('.reader')?.scrollTop}))()`,
      );
    } catch (error) {
      state = { diagnosticsError: error.message };
    }
    throw Error(`Scanned sidebar timeout: ${label}\n${JSON.stringify(state)}`);
  }
  const thumbnailState = (pageNumber) =>
    run(
      `(()=>{const number=${pageNumber},item=document.querySelector('.thumb[data-page-number="${pageNumber}"]'),canvas=item?.querySelector('canvas');if(!item||!canvas)return {number,mounted:false,width:canvas?.width||0,height:canvas?.height||0,ink:0};if(!canvas.width||!canvas.height)return {number,mounted:true,width:canvas.width,height:canvas.height,ink:0};const data=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height).data;let ink=0;for(let i=0;i<data.length;i+=4)if(data[i]<245||data[i+1]<245||data[i+2]<245)ink++;return {number,mounted:true,width:canvas.width,height:canvas.height,ink,inkRatio:ink/(canvas.width*canvas.height)};})()`,
    );
  const thumbnailStates = () => Promise.all(TARGET_PAGES.map((page) => thumbnailState(page)));
  async function waitForThumbnail(pageNumber, context) {
    await waitFor(
      `${context}: page ${pageNumber} thumbnail ink`,
      `(()=>{const item=document.querySelector('.thumb[data-page-number="${pageNumber}"]'),canvas=item?.querySelector('canvas');if(!canvas||!canvas.width||!canvas.height)return false;const data=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,canvas.width,canvas.height).data;let ink=0;for(let i=0;i<data.length;i+=4)if(data[i]<245||data[i+1]<245||data[i+2]<245)ink++;return ink>=${MIN_INK_PIXELS};})()`,
      45_000,
    );
    const state = await thumbnailState(pageNumber);
    assert.equal(state.mounted, true, `${context}: page ${pageNumber} thumbnail is not mounted`);
    assert.ok(
      state.width > 0 && state.height > 0,
      `${context}: page ${pageNumber} canvas is empty`,
    );
    assert.ok(
      state.ink >= MIN_INK_PIXELS,
      `${context}: page ${pageNumber} canvas has only ${state.ink} ink pixels (${JSON.stringify(state)})`,
    );
    return state;
  }
  async function jumpTo(pageNumber) {
    const percent = ((pageNumber - 0.5) / TOTAL_PAGES) * 100;
    window.webContents.send('reader:action', `percent:${percent}`);
    await waitFor(
      `reader jump to page ${pageNumber}`,
      `window.previewRenderDiagnostics?.().active===${pageNumber}`,
    );
    await run(
      `(()=>{const list=document.querySelector('.thumbnail-list'),inner=document.querySelector('.thumbnail-inner');list.scrollTop=parseFloat(inner.style.height)*(${pageNumber}-1)/${TOTAL_PAGES};list.dispatchEvent(new Event('scroll',{bubbles:true}));})()`,
    );
    await waitFor(
      `sidebar selected page ${pageNumber}`,
      `document.querySelector('.thumb.selected')?.dataset.pageNumber==='${pageNumber}'`,
    );
  }
  async function scrollReaderAndSidebar() {
    const result = await run(
      `(()=>{const reader=document.querySelector('.reader'),list=document.querySelector('.thumbnail-list');if(!reader||!list)return false;const readerMax=Math.max(0,reader.scrollHeight-reader.clientHeight),listMax=Math.max(0,list.scrollHeight-list.clientHeight);for(const ratio of [0.04,0.28,0.56,0.83,0.47,0.91]){reader.scrollTop=Math.round(readerMax*ratio);reader.dispatchEvent(new Event('scroll',{bubbles:true}));list.scrollTop=Math.round(listMax*(1-ratio));list.dispatchEvent(new Event('scroll',{bubbles:true}));}return {readerMax,listMax};})()`,
    );
    assert.ok(result, 'reader and thumbnail scroll containers are present');
    await pause(90);
  }
  async function toggleSidebarAndWindow() {
    for (let cycle = 0; cycle < 2; cycle++) {
      window.webContents.send('reader:action', 'sidebar');
      await waitFor(
        'thumbnail sidebar hidden',
        "!document.querySelector('.thumbnail-list')",
        10_000,
      );
      window.webContents.send('reader:action', 'sidebar');
      await waitFor(
        'thumbnail sidebar shown',
        "!!document.querySelector('.thumbnail-list')",
        10_000,
      );
      await waitFor(
        'thumbnail sidebar viewport',
        "document.querySelector('.thumbnail-list')?.clientHeight>0",
      );
      window.webContents.send('preferences:changed', { reduceResourceUsage: true });
      window.hide();
      // Cross the resource-release timer so resume exercises bitmap eviction
      // and the same mounted thumbnail viewport.
      await pause(1_200);
      await waitFor(
        'background bitmaps released',
        'window.previewRenderDiagnostics().residentBytes===0',
        10_000,
      );
      activateWindow();
      window.webContents.send('preferences:changed', { reduceResourceUsage: false });
      await waitFor('window foreground', 'window.previewActivityActive===true', 10_000);
      await pause(120);
    }
  }

  let fixtureDirectory;
  try {
    assert.ok(
      SOURCE_PDF,
      'Set PDFMATHREADER_SCANNED_PDF to a local scanned PDF before running this smoke.',
    );
    const source = await stat(SOURCE_PDF);
    assert.equal(source.isFile(), true, `Scanned PDF is not a file: ${SOURCE_PDF}`);
    fixtureDirectory = await mkdtemp(join(tmpdir(), 'scanned-sidebar-'));
    const fixturePath = join(fixtureDirectory, 'Portrait and landscape.pdf');
    await copyFile(SOURCE_PDF, fixturePath);
    activateWindow();
    await waitFor('renderer ready', 'window.previewReady===true', 20_000);
    await run(
      `window.previewPreferences.save({engine:'pdf_math_fast',automatic:false,reduceResourceUsage:false,reduceBackgroundFrameRate:false,documentOpenMode:'manual',translationMode:'reading',reduceMotion:true,sidebar:true,direction:'vertical',columns:1,fit:'width',showTranslations:false})`,
    );
    await recents.remember(fixturePath);
    const entry = recents.list().find((candidate) => recents.path(candidate.id) === fixturePath);
    assert.ok(entry, `Scanned PDF copy was not added to recents: ${fixturePath}`);
    await recents.setView(entry.id, {
      page: 1,
      offsetX: 0,
      offsetY: 0,
      zoom: 1,
      fit: 'width',
      direction: 'vertical',
      columns: 1,
      sidebar: true,
      sidebarMode: 'thumbnails',
      showTranslations: false,
    });
    const loaded = new Promise((resolveLoad) =>
      window.webContents.once('did-finish-load', resolveLoad),
    );
    window.webContents.reload();
    await loaded;
    await waitFor('renderer ready after reload', 'window.previewReady===true', 20_000);
    activateWindow();
    window.webContents.send('preferences:changed', { reduceResourceUsage: false });
    await waitFor('initial foreground', 'window.previewActivityActive===true', 10_000);
    // Keep this smoke local: Fast OCR availability is mocked in the renderer,
    // while automatic translation remains disabled and no provider is called.
    await run(
      `(()=>{const upstream=window.fetch;window.fetch=(input,options)=>String(input)==='/api/engines/pdf_math_fast'?Promise.resolve(new Response(JSON.stringify({id:'pdf_math_fast',installed:true,available:true,ocrAvailable:true,version:'smoke-fixture'}),{headers:{'Content-Type':'application/json'}})):upstream(input,options);return true;})()`,
    );
    await run(
      `window.previewPreferences.save({engine:'pdf_math_fast',automatic:false,reduceResourceUsage:false,reduceBackgroundFrameRate:false,documentOpenMode:'manual',translationMode:'reading',reduceMotion:true,sidebar:true,direction:'vertical',columns:1,fit:'width',showTranslations:false})`,
    );
    await waitFor(
      'scanned PDF recent card',
      `!!document.querySelector('[data-recent-id="${entry.id}"]')`,
      20_000,
    );
    await run(`document.querySelector('[data-recent-id="${entry.id}"]').click()`);
    await waitFor(
      '526 page scanned PDF open',
      `(()=>{const d=window.previewRenderDiagnostics?.();return d?.totalPages===${TOTAL_PAGES}&&!d.opening&&d.readingView?.sidebar===true;})()`,
      90_000,
    );
    assert.equal(
      await run('(async()=> (await window.previewPreferences.load()).engine)()'),
      'pdf_math_fast',
      'scanned sidebar smoke must run with Fast OCR selected',
    );
    // The book's first leaf is blank; verify its frame rather than text ink.
    await waitFor(
      'initial thumbnail frame',
      `document.querySelector('.thumb[data-page-number="1"] canvas')?.width>0`,
    );

    const observations = [];
    for (const [index, pageNumber] of TARGET_PAGES.entries()) {
      await jumpTo(pageNumber);
      const beforeStress = await waitForThumbnail(pageNumber, 'before stress');
      observations.push({ pageNumber, beforeStress });
      await scrollReaderAndSidebar();
      if (index % 3 === 0) await toggleSidebarAndWindow();
    }

    await jumpTo(106);
    const afterStress = await waitForThumbnail(
      106,
      'after repeated reader/sidebar/window transitions',
    );
    await screenshot('/tmp/pdfmathreader-scanned-sidebar-page106.png');
    await scrollReaderAndSidebar();
    await screenshot('/tmp/pdfmathreader-scanned-sidebar-page106-after-scroll.png');
    const finalStates = await thumbnailStates();
    console.log(
      'Scanned sidebar smoke passed',
      JSON.stringify({
        source: SOURCE_PDF,
        fixture: fixturePath,
        pages: TOTAL_PAGES,
        engine: 'pdf_math_fast',
        targetPages: TARGET_PAGES,
        observations,
        afterStress,
        mountedAfterFinalScroll: finalStates
          .filter((state) => state.mounted)
          .map((state) => state.number),
        screenshots: [
          '/tmp/pdfmathreader-scanned-sidebar-page106.png',
          '/tmp/pdfmathreader-scanned-sidebar-page106-after-scroll.png',
        ],
        diagnostics: await diagnostics(),
      }),
    );
    app.exit(0);
  } catch (error) {
    await screenshot('/tmp/pdfmathreader-scanned-sidebar-failure.png');
    throw error;
  } finally {
    if (fixtureDirectory) await rm(fixtureDirectory, { recursive: true, force: true });
  }
}
