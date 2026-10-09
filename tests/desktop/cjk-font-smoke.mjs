import assert from 'node:assert/strict';
import { app } from 'electron';
import { copyFile, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const SOURCE_PDF = process.env.PDFMATHREADER_CJK_PDF
  ? resolve(process.env.PDFMATHREADER_CJK_PDF)
  : null;
const FILE_NAME = 'Portrait and landscape.pdf';
const TOTAL_PAGES = 7;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MIN_CJK_INK_PIXELS = 8;
const PAGE_1_REGIONS = Object.freeze({
  mixedTitleChineseSpan: { x0: 237.939, y0: 196.161, x1: 420.256, y1: 208.117 },
  subtitle: { x0: 276.112, y0: 244.934, x1: 335.888, y1: 256.889 },
  footerBody: { x0: 108, y0: 689.716, x1: 538.387, y1: 701.671 },
  footerChineseSecondLine: { x0: 72, y0: 713.624, x1: 299.149, y1: 725.579 },
});

export async function verifyCJKFont(window, recents) {
  const run = (code) =>
    window.webContents.executeJavaScript(code).catch((error) => {
      throw Error(`CJK font smoke script failed: ${code.slice(0, 240)} (${error.message})`, {
        cause: error,
      });
    });
  const pause = (ms) => new Promise((resolvePause) => setTimeout(resolvePause, ms));
  const rendererMessages = [];
  const onConsoleMessage = (_event, details) => {
    const value = details && typeof details === 'object' ? details : { message: details };
    rendererMessages.push({
      level: value.level,
      message: String(value.message ?? ''),
      sourceId: value.sourceId,
      lineNumber: value.lineNumber,
    });
  };
  window.webContents.on('console-message', onConsoleMessage);

  async function waitFor(label, code, timeoutMs = 20_000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (await run(code)) return;
      await pause(75);
    }
    let state;
    try {
      state = await run(
        `(()=>({title:document.title,empty:!!document.querySelector('.empty'),diagnostics:window.previewRenderDiagnostics?.(),page1Canvas:document.querySelector('.page[data-page="1"] canvas')?.width||0}))()`,
      );
    } catch (error) {
      state = { diagnosticsError: error.message };
    }
    throw Error(`CJK font smoke timeout: ${label}\n${JSON.stringify(state)}`);
  }

  async function screenshot(path) {
    await writeFile(path, (await window.webContents.capturePage()).toPNG());
    console.log(`CJK font screenshot: ${path}`);
  }

  async function pageInk(pageNumber, regions = {}) {
    return run(
      `(()=>{const canvas=document.querySelector('.page[data-page="${pageNumber}"] canvas');if(!canvas||!canvas.width||!canvas.height)return {page:${pageNumber},canvasWidth:canvas?.width||0,canvasHeight:canvas?.height||0,regions:{}};const context=canvas.getContext('2d',{willReadFrequently:true}),scaleX=canvas.width/${PAGE_WIDTH},scaleY=canvas.height/${PAGE_HEIGHT},source=${JSON.stringify(regions)},result={};for(const [name,region] of Object.entries(source)){const left=Math.max(0,Math.floor(region.x0*scaleX)-2),top=Math.max(0,Math.floor(region.y0*scaleY)-2),right=Math.min(canvas.width,Math.ceil(region.x1*scaleX)+2),bottom=Math.min(canvas.height,Math.ceil(region.y1*scaleY)+2),width=Math.max(0,right-left),height=Math.max(0,bottom-top);let ink=0;if(width&&height){const data=context.getImageData(left,top,width,height).data;for(let index=0;index<data.length;index+=4)if(data[index+3]>0&&(data[index]<245||data[index+1]<245||data[index+2]<245))ink++;}result[name]={ink,left,top,right,bottom,width,height};}return {page:${pageNumber},canvasWidth:canvas.width,canvasHeight:canvas.height,regions:result};})()`,
    );
  }

  const preferences = {
    engine: 'pdf_inspector',
    automatic: false,
    documentOpenMode: 'manual',
    translationMode: 'reading',
    interactionMode: 'reading',
    reduceResourceUsage: false,
    reduceBackgroundFrameRate: false,
    reduceMotion: true,
    fit: 'width',
    direction: 'vertical',
    columns: 1,
  };
  let fixtureDirectory;
  try {
    assert.ok(
      SOURCE_PDF,
      'Set PDFMATHREADER_CJK_PDF to the supplied local PDF before running this smoke.',
    );
    assert.equal((await stat(SOURCE_PDF)).isFile(), true, `CJK PDF is not a file: ${SOURCE_PDF}`);
    fixtureDirectory = await mkdtemp(join(tmpdir(), 'cjk-font-smoke-'));
    const fixturePath = join(fixtureDirectory, FILE_NAME);
    await copyFile(SOURCE_PDF, fixturePath);

    await waitFor('renderer ready', 'window.previewReady===true');
    await run(`window.previewPreferences.save(${JSON.stringify(preferences)})`);
    await recents.remember(fixturePath);
    const recent = recents.list().find((entry) => recents.path(entry.id) === fixturePath);
    assert.ok(recent, `CJK PDF copy was not added to recents: ${fixturePath}`);
    await recents.setView(recent.id, {
      page: 1,
      offsetX: 0,
      offsetY: 0,
      zoom: 1,
      fit: 'width',
      direction: 'vertical',
      columns: 1,
      sidebar: true,
      showTranslations: false,
    });

    await new Promise((resolveLoad) => {
      window.webContents.once('did-finish-load', resolveLoad);
      window.webContents.reload();
    });
    await waitFor('renderer ready after reload', 'window.previewReady===true');
    window.webContents.send('preferences:changed', preferences);
    await run(`window.previewPreferences.save(${JSON.stringify(preferences)})`);
    const saved = await run('window.previewPreferences.load()');
    assert.equal(saved.engine, 'pdf_inspector');
    assert.equal(saved.automatic, false);
    assert.equal(saved.reduceResourceUsage, false);
    window.webContents.send('preferences:changed', preferences);

    await waitFor('recent card', `!!document.querySelector('[data-recent-id="${recent.id}"]')`);
    await run(`document.querySelector('[data-recent-id="${recent.id}"]').click()`);
    await waitFor(
      'seven-page document open',
      `(()=>{const d=window.previewRenderDiagnostics?.();return d?.totalPages===${TOTAL_PAGES}&&!d.opening&&d.active===1&&d.readingView?.page===1&&d.readingView?.showTranslations===false;})()`,
      45_000,
    );
    await waitFor(
      'page 1 canvas',
      `document.querySelector('.page[data-page="1"] canvas')?.width>0`,
      15_000,
    );
    const diagnostics = await run('window.previewRenderDiagnostics()');
    assert.equal(diagnostics.totalPages, TOTAL_PAGES);
    assert.equal(diagnostics.translatedPages, 0, 'smoke must not translate the document');
    assert.deepEqual(diagnostics.translationRequests, []);

    const page1 = await pageInk(1, PAGE_1_REGIONS);
    assert.ok(page1.canvasWidth > 0 && page1.canvasHeight > 0, 'page 1 canvas is empty');
    for (const [name, region] of Object.entries(page1.regions))
      assert.ok(
        region.ink >= MIN_CJK_INK_PIXELS,
        `page 1 ${name} region has only ${region.ink} ink pixels: ${JSON.stringify(region)}`,
      );
    await screenshot('/tmp/pdfmathreader-cjk-font-page1.png');

    await run(`document.querySelector('.thumb[aria-label="Go to page 2"]')?.click();true`);
    await waitFor(
      'page 2 active',
      `window.previewRenderDiagnostics?.().active===2&&document.querySelector('.page[data-page="2"] canvas')?.width>0`,
      15_000,
    );
    await screenshot('/tmp/pdfmathreader-cjk-font-page2.png');
    const page2 = await pageInk(2);
    assert.ok(page2.canvasWidth > 0 && page2.canvasHeight > 0, 'page 2 canvas is empty');

    const fontWarnings = rendererMessages.filter((entry) =>
      /font|cmap|to.?unicode|glyph/i.test(entry.message),
    );
    console.log(
      'CJK font smoke passed',
      JSON.stringify({
        source: SOURCE_PDF,
        fixture: fixturePath,
        pages: TOTAL_PAGES,
        page1,
        page2,
        screenshots: [
          '/tmp/pdfmathreader-cjk-font-page1.png',
          '/tmp/pdfmathreader-cjk-font-page2.png',
        ],
        rendererFontOrCMapMessages: fontWarnings,
      }),
    );
  } finally {
    if (!window.webContents.isDestroyed())
      window.webContents.removeListener('console-message', onConsoleMessage);
    if (fixtureDirectory) await rm(fixtureDirectory, { recursive: true, force: true });
  }
  app.exit(0);
}
