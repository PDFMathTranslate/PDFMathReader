import assert from 'node:assert/strict';
import { app } from 'electron';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const fixtureName = 'Portrait and landscape.pdf';
const before = 'The mechanism depends on';
const after = 'institutional incentives and repeated observations.';
const combinedSource = `${before} ${after}`;
const barrierBefore = 'A separate paragraph starts here.';
const barrierAfter = 'Another independent paragraph follows.';
const layouts = {
  1: {
    paragraphs: [
      {
        id: 'barrier-before',
        text: barrierBefore,
        x: 40,
        y: 240,
        width: 520,
        height: 18,
        fontSize: 12,
        textAlign: 'left',
      },
      {
        id: 'fragment-before',
        text: before,
        x: 40,
        y: 300,
        width: 520,
        height: 18,
        fontSize: 12,
        textAlign: 'left',
      },
    ],
  },
  2: {
    paragraphs: [
      {
        id: 'fragment-after',
        text: after,
        x: 40,
        y: 300,
        width: 520,
        height: 18,
        fontSize: 12,
        textAlign: 'left',
      },
      {
        id: 'barrier-after',
        text: barrierAfter,
        x: 40,
        y: 360,
        width: 520,
        height: 18,
        fontSize: 12,
        textAlign: 'left',
      },
    ],
  },
};

async function writeFixture(path) {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const first = document.addPage([612, 792]);
  first.drawText(barrierBefore, { x: 40, y: 360, size: 12, font });
  first.drawText(before, { x: 40, y: 300, size: 12, font });
  const second = document.addPage([612, 792]);
  second.drawText(after, { x: 40, y: 300, size: 12, font });
  second.drawText(barrierAfter, { x: 40, y: 240, size: 12, font });
  await writeFile(path, await document.save());
}

export async function verifyParagraphContinuation(window, recents) {
  const evaluate = (code) =>
      window.webContents.executeJavaScript(code).catch((error) => {
        throw Error(`Paragraph continuation renderer evaluation failed: ${error.message}`, {
          cause: error,
        });
      }),
    pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

  const wait = async (code, label = code) => {
    let last;
    for (let attempt = 0; attempt < 400; attempt++) {
      last = await evaluate(code);
      if (last) return last;
      await pause(50);
    }
    let state = '';
    try {
      state = JSON.stringify(
        await evaluate(
          '({diagnostics:window.previewRenderDiagnostics?.(),body:document.body.innerText.slice(0,1200)})',
        ),
      );
    } catch {}
    throw Error(`Paragraph continuation smoke timed out waiting for ${label}: ${state}`);
  };

  const focus = () => {
    window.show();
    app.focus({ steal: true });
    window.focus();
    window.webContents.focus();
  };
  const savePreferences = async (values) => {
    // The sender does not receive its own preference-change notification.
    // Simulate an external settings window so renderer state matches the save.
    window.webContents.send('preferences:changed', values);
    await pause(80);
    await evaluate(`window.previewPreferences.save(${JSON.stringify(values)})`);
    await pause(80);
  };

  const reload = async () => {
    if (await evaluate('window.previewRenderDiagnostics?.().totalPages>0')) {
      window.webContents.send('reader:action', 'close-document');
      await wait(
        'window.previewRenderDiagnostics?.().totalPages===0',
        'document closed before reload',
      );
    }
    await new Promise((resolve, reject) => {
      let timer;
      const cleanup = () => {
        clearTimeout(timer);
        window.webContents.removeListener('did-finish-load', done);
        window.webContents.removeListener('did-fail-load', failed);
      };
      const done = () => {
        cleanup();
        resolve();
      };
      const failed = (_event, code, description) => {
        if (code === -3) return;
        cleanup();
        reject(Error(`Renderer reload failed (${code}): ${description}`));
      };
      timer = setTimeout(() => {
        cleanup();
        reject(Error('Renderer reload timed out.'));
      }, 30000);
      window.webContents.once('did-finish-load', done);
      window.webContents.on('did-fail-load', failed);
      window.webContents.reload();
    });
    await wait('window.previewReady===true', 'renderer ready after reload');
    focus();
  };

  const installMocks = async (mode) =>
    evaluate(`(()=>{
      const mode=${JSON.stringify(mode)};
      const layouts=${JSON.stringify(layouts)};
      const originalFetch=window.fetch.bind(window);
      const state={mode,layoutCalls:[],continuationCalls:[],translationCalls:[],externalCalls:[]};
      window.paragraphContinuationSmoke=state;
      window.fetch=async(input,options={})=>{
        const href=input?.url||String(input);
        const url=new URL(href,location.href);
        if(url.origin!==location.origin){
          state.externalCalls.push(url.href);
          throw new Error('paragraph continuation smoke blocked external fetch');
        }
        let body={};
        try{body=JSON.parse(options.body||'{}');}catch{}
        if(url.pathname==='/api/layout'){
          const page=Number(body.page);
          state.layoutCalls.push({page,body});
          return new Response(JSON.stringify(layouts[page]||{paragraphs:[]}),{status:200,headers:{'Content-Type':'application/json'}});
        }
        if(url.pathname==='/api/paragraph-continuation'){
          state.continuationCalls.push(body);
          const combine=mode==='combine'&&body.before===${JSON.stringify(before)}&&body.after===${JSON.stringify(after)};
          return new Response(JSON.stringify({combine,status:'classified'}),{status:200,headers:{'Content-Type':'application/json'}});
        }
        if(url.pathname==='/api/translate'){
          if(body.cacheOnly)return new Response(null,{status:204});
          state.translationCalls.push(body);
          return new Response(JSON.stringify({translation:body.text,cached:false}),{status:200,headers:{'Content-Type':'application/json'}});
        }
        return originalFetch(input,options);
      };
      return true;
    })()`);

  const openRecent = async (id) => {
    const selector = `[data-recent-id=${JSON.stringify(id)}]`;
    await wait(`!!document.querySelector(${JSON.stringify(selector)})`, 'fixture recent entry');
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).click();true`);
    await wait(
      `(()=>{const d=window.previewRenderDiagnostics?.();return d?.recentId===${JSON.stringify(id)}&&d.totalPages===2&&!d.opening&&document.querySelector('.page canvas')?.width>0;})()`,
      'fixture rendered',
    );
    await wait(
      `document.querySelectorAll('.reading-paragraph[data-block-id]').length===4`,
      'all translated fixture blocks rendered',
    );
  };

  const blockSnapshot = () =>
    evaluate(`(()=>[...document.querySelectorAll('.reading-paragraph[data-block-id]')].map((element)=>{
      const page=element.closest('.page')?.dataset.page||'';
      return {
        key:page+':'+element.dataset.blockId,
        page:Number(page),
        id:element.dataset.blockId,
        text:element.querySelector('.paragraph-text')?.textContent||'',
        style:{left:element.style.left,top:element.style.top,width:element.style.width,height:element.style.height},
        data:Object.fromEntries(Object.entries(element.dataset).filter(([key])=>key.startsWith('paragraph'))),
      };
    }).sort((a,b)=>a.page-b.page||a.id.localeCompare(b.id)))()`);

  const openExperimentalSettings = async () => {
    await evaluate('document.querySelector("[aria-label=\\"Translation settings\\"]").click()');
    await wait(
      '!!document.querySelector("[data-settings-category=experimental]")',
      'experimental settings category',
    );
    await evaluate('document.querySelector("[data-settings-category=experimental]").click()');
    await wait(
      '!!document.querySelector("[data-setting=paragraph-continuation-detection] input")',
      'paragraph continuation setting',
    );
  };

  const folder = await mkdtemp(join(tmpdir(), 'pdfmathreader-paragraph-continuation-'));
  const path = join(folder, fixtureName);
  try {
    await writeFixture(path);
    await wait('window.previewReady===true', 'initial renderer ready');
    focus();
    const initial = await evaluate('window.previewPreferences.load()');
    assert.equal(
      initial.paragraphContinuationDetection,
      false,
      'paragraph continuation detection defaults off',
    );
    await evaluate('window.previewCredentials.save("paragraph-smoke-placeholder")');
    await recents.remember(path);
    const recent = recents
      .list()
      .find((entry) => entry.name === fixtureName && recents.path(entry.id) === path);
    assert.ok(recent, 'synthetic fixture was added to recents');
    await recents.setView(recent.id, {
      page: 1,
      offsetX: 0,
      offsetY: 0,
      zoom: 1,
      fit: 'width',
      direction: 'vertical',
      columns: 1,
      sidebar: false,
      showTranslations: true,
    });
    // Recent-document setup can trigger the renderer's saveView watcher while
    // its initial settings still carry the default-off continuation flag.
    await pause(350);
    await savePreferences({
      automatic: true,
      documentOpenMode: 'translation',
      translationMode: 'full',
      interactionMode: 'reading',
      restoreDocuments: false,
      engine: 'pdf_inspector',
      reuseTranslations: false,
      reduceMotion: true,
      reduceResourceUsage: false,
      reduceBackgroundFrameRate: false,
      paragraphContinuationDetection: true,
      jevApiToken: 'paragraph-smoke-token',
      language: 'English',
      sourceLanguage: 'English',
      concurrency: 4,
      pageConcurrency: 2,
      translationServices: { pdf_inspector: { id: 'openai', values: {} } },
      fit: 'width',
      direction: 'vertical',
      columns: 1,
    });

    await reload();
    assert.equal(
      await evaluate('window.previewPreferences.load().then(p=>p.paragraphContinuationDetection)'),
      true,
      'paragraph continuation preference survives the initial reload',
    );
    await installMocks('combine');
    await openRecent(recent.id);
    await wait(
      `window.paragraphContinuationSmoke.translationCalls.some(call=>call.text===${JSON.stringify(combinedSource)})`,
      'combined translation request',
    );
    const combinedState = await evaluate('window.paragraphContinuationSmoke');
    assert.equal(combinedState.externalCalls.length, 0, 'combined smoke made no external fetches');
    assert.ok(
      combinedState.layoutCalls.some((call) => call.page === 1) &&
        combinedState.layoutCalls.some((call) => call.page === 2),
      'both synthetic page layouts were requested',
    );
    assert.ok(
      combinedState.continuationCalls.some(
        (call) => call.before === before && call.after === after,
      ),
      'cross-page continuation was classified',
    );
    assert.ok(
      combinedState.continuationCalls.some(
        (call) => call.before === barrierBefore && call.after === before,
      ),
      'intentional boundary was classified separately',
    );
    assert.ok(
      combinedState.continuationCalls.every((call) => call.token === 'paragraph-smoke-token'),
      'continuation requests use the configured synthetic Jev token',
    );
    const combinedTargetTranslations = combinedState.translationCalls
      .filter((call) => call.text === combinedSource)
      .map((call) => call.text);
    assert.deepEqual(
      combinedTargetTranslations,
      [combinedSource],
      'combined source is translated once',
    );
    const combinedBlocks = await blockSnapshot();
    const combinedTargetBlocks = combinedBlocks
      .filter((block) => ['fragment-before', 'fragment-after'].includes(block.id))
      .sort((a, b) => a.page - b.page);
    assert.equal(
      combinedTargetBlocks.map((block) => block.text).join(''),
      combinedSource,
      'per-fragment translated DOM text preserves the complete translation',
    );
    assert.equal(
      new Set(combinedTargetBlocks.map((block) => block.data.paragraphGroupId)).size,
      1,
      'combined fragments share one logical paragraph group',
    );
    assert.deepEqual(
      combinedTargetBlocks.map((block) => Number(block.data.paragraphIndex)),
      [0, 1],
      'combined fragments retain logical paragraph order',
    );
    assert.ok(
      combinedTargetBlocks.every((block) => block.data.paragraphText === combinedSource),
      'combined fragments expose the complete logical paragraph text',
    );
    assert.equal(
      await evaluate(
        'document.querySelectorAll("[class*=continuation][class*=overlay],.paragraph-continuation-gutter").length',
      ),
      0,
      'continuation detection does not add a gutter overlay',
    );

    window.webContents.send('reader:action', 'close-document');
    await wait('window.previewRenderDiagnostics?.().totalPages===0', 'combined fixture closed');
    await savePreferences({
      paragraphContinuationDetection: true,
      jevApiToken: 'paragraph-smoke-separate',
    });
    await reload();
    await installMocks('separate');
    await openRecent(recent.id);
    await wait(
      `window.paragraphContinuationSmoke.translationCalls.filter(call=>call.text===${JSON.stringify(before)}||call.text===${JSON.stringify(after)}).length===2`,
      'separate fragment translations',
    );
    const separateState = await evaluate('window.paragraphContinuationSmoke');
    assert.equal(separateState.externalCalls.length, 0, 'fallback smoke made no external fetches');
    assert.ok(
      separateState.continuationCalls.some(
        (call) => call.before === before && call.after === after,
      ),
      'fallback scenario still checked the target fragments',
    );
    assert.deepEqual(
      separateState.translationCalls
        .filter((call) => call.text === before || call.text === after)
        .map((call) => call.text)
        .sort(),
      [after, before].sort(),
      'uncertain boundary keeps the two source fragments as separate requests',
    );
    const separateBlocks = await blockSnapshot();
    assert.deepEqual(
      separateBlocks.map((block) => [block.key, block.style]),
      combinedBlocks.map((block) => [block.key, block.style]),
      'fragment IDs and layout boxes stay unchanged across grouping decisions',
    );
    assert.deepEqual(
      separateBlocks
        .filter((block) => ['fragment-before', 'fragment-after'].includes(block.id))
        .sort((a, b) => a.page - b.page)
        .map((block) => block.text),
      [before, after],
      'fallback rendering retains per-fragment text',
    );

    await openExperimentalSettings();
    const setting =
      'document.querySelector("[data-setting=paragraph-continuation-detection] input")';
    assert.equal(await evaluate(`${setting}.getAttribute('aria-valuetext')`), 'On');
    await evaluate(`${setting}.click()`);
    await wait(
      '(async()=> (await window.previewPreferences.load()).paragraphContinuationDetection===false)()',
      'paragraph continuation setting disabled',
    );
    await evaluate('document.querySelector(".settings-heading button")?.click()');
    await reload();
    assert.equal(
      await evaluate('window.previewPreferences.load().then(p=>p.paragraphContinuationDetection)'),
      false,
      'paragraph continuation setting persists after reload',
    );
    await installMocks('off');
    await openRecent(recent.id);
    await wait(
      `window.paragraphContinuationSmoke.translationCalls.filter(call=>call.text===${JSON.stringify(before)}||call.text===${JSON.stringify(after)}).length===2`,
      'flag-off fragment translations',
    );
    const offState = await evaluate('window.paragraphContinuationSmoke');
    assert.equal(offState.continuationCalls.length, 0, 'flag off makes no Jev continuation calls');
    console.log(
      'Paragraph continuation smoke passed',
      JSON.stringify({
        defaultOff: true,
        crossPageCombine: true,
        combinedTranslationOnce: true,
        fallbackKeepsFragmentsSeparate: true,
        metadataPreserved: true,
        geometryPreserved: true,
        noGutterOverlay: true,
        settingPersists: true,
        flagOffNoJevCall: true,
      }),
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
  app.exit(0);
}
