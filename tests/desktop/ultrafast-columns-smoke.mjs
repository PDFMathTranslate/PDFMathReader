import assert from 'node:assert/strict';
import { app } from 'electron';
import { PDFDocument } from 'pdf-lib';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const SOURCE_PDF = process.env.PDFMATHREADER_COLUMNS_PDF
  ? resolve(process.env.PDFMATHREADER_COLUMNS_PDF)
  : null;
const FIXTURE_NAME = 'Portrait and landscape.pdf';
const FIRST_PAGE = 1;
const ZOOMS = [1.61, 1];
const BEFORE_SENTINEL = 'data about persons';
const AFTER_SENTINEL = 'scrutinizing declarations';
const TRANSLATION_SEED = '在大数据社会中，个人行为数据会被持续收集、分析，并与审查声明进行比较。';

async function firstPageFixture(sourcePath, fixturePath) {
  const source = await PDFDocument.load(await readFile(sourcePath));
  assert.ok(source.getPageCount() > 0, `Source PDF has no pages: ${sourcePath}`);
  const { width, height } = source.getPage(0).getSize();
  const fixture = await PDFDocument.create();
  const [first] = await fixture.copyPages(source, [0]);
  fixture.addPage(first);
  await writeFile(fixturePath, await fixture.save());
  return { width, height };
}

export async function verifyUltraFastColumns(window, recents) {
  const evaluate = (code) =>
      window.webContents.executeJavaScript(code).catch((error) => {
        throw Error(`Ultra fast column renderer evaluation failed: ${error.message}`, {
          cause: error,
        });
      }),
    pause = (milliseconds) => new Promise((resolvePause) => setTimeout(resolvePause, milliseconds));

  async function waitFor(label, code, timeoutMs = 45_000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if (await evaluate(code)) return;
      await pause(75);
    }
    let state = '';
    try {
      state = JSON.stringify(
        await evaluate(
          '({diagnostics:window.previewRenderDiagnostics?.(),state:window.ultrafastColumnsSmoke,body:document.body.innerText.slice(0,1600)})',
        ),
      );
    } catch {}
    throw Error(`Ultra fast column smoke timed out waiting for ${label}: ${state}`);
  }

  async function reload() {
    await new Promise((resolveReload, rejectReload) => {
      let timer;
      const cleanup = () => {
        clearTimeout(timer);
        window.webContents.removeListener('did-finish-load', done);
        window.webContents.removeListener('did-fail-load', failed);
      };
      const done = () => {
        cleanup();
        resolveReload();
      };
      const failed = (_event, code, description) => {
        if (code === -3) return;
        cleanup();
        rejectReload(Error(`Renderer reload failed (${code}): ${description}`));
      };
      timer = setTimeout(() => {
        cleanup();
        rejectReload(Error('Renderer reload timed out.'));
      }, 30_000);
      window.webContents.once('did-finish-load', done);
      window.webContents.on('did-fail-load', failed);
      window.webContents.reload();
    });
    await waitFor('renderer ready after reload', 'window.previewReady===true');
    window.show();
    window.focus();
    window.webContents.focus();
  }

  async function savePreferences(values) {
    // The sender does not receive its own preference-change notification.
    // Simulate the settings window before persisting the values.
    window.webContents.send('preferences:changed', values);
    await pause(80);
    await evaluate(`window.previewPreferences.save(${JSON.stringify(values)})`);
    await pause(80);
  }

  async function installMocks() {
    await evaluate(`(()=>{
      const before=${JSON.stringify(BEFORE_SENTINEL)};
      const after=${JSON.stringify(AFTER_SENTINEL)};
      const originalFetch=window.fetch.bind(window);
      const state={layoutCalls:[],layoutResults:[],continuationCalls:[],translationCalls:[],externalCalls:[]};
      window.ultrafastColumnsSmoke=state;
      window.fetch=async(input,options={})=>{
        const href=input?.url||String(input);
        const url=new URL(href,location.href);
        if(url.origin!==location.origin){
          state.externalCalls.push(url.href);
          throw new Error('ultra fast column smoke blocked external fetch');
        }
        let body={};
        try{body=JSON.parse(options.body||'{}');}catch{}
        // Keep layout extraction real: this branch forwards to the actual
        // backend and records the native Inspector response without replacing it.
        if(url.pathname==='/api/layout'){
          state.layoutCalls.push(body);
          const response=await originalFetch(input,options);
          let result=null;
          try{result=await response.clone().json();}catch{}
          state.layoutResults.push({request:body,status:response.status,result});
          return response;
        }
        if(url.pathname==='/api/paragraph-continuation'){
          const call={...body};
          state.continuationCalls.push(call);
          const normalize=(text)=>String(text||'').replace(/\\s+/g,' ').trim();
          const layout=state.layoutResults.find((item)=>item.request.page===1)?.result;
          const paragraphs=Array.isArray(layout?.paragraphs)?layout.paragraphs:[];
          const fontSizes=paragraphs.map((item)=>Number(item.fontSize)).filter((value)=>Number.isFinite(value)&&value>0).sort((a,b)=>a-b);
          const bodyFont=fontSizes[Math.floor(fontSizes.length/2)]||0;
          const beforeBlock=paragraphs.find((item)=>normalize(item.text).toLowerCase().includes(before));
          const bodyFloor=Number(beforeBlock?.y);
          const bodyBlocks=paragraphs.filter((item)=>Number.isFinite(Number(item.x))&&Number.isFinite(Number(item.width))&&Number.isFinite(Number(item.fontSize))&&item.width<=320&&normalize(item.text).length>5&&Number(item.fontSize)>=bodyFont*0.9&&(!Number.isFinite(bodyFloor)||Number(item.y)>=bodyFloor));
          const left=bodyBlocks.filter((item)=>item.x<300).sort((a,b)=>a.y-b.y||a.x-b.x);
          const right=bodyBlocks.filter((item)=>item.x>=300).sort((a,b)=>a.y-b.y||a.x-b.x);
          const start=left.findIndex((item)=>normalize(item.text).toLowerCase().includes(before));
          const end=right.findIndex((item)=>normalize(item.text).toLowerCase().includes(after));
          const sequence=start>=0&&end>=0
            ? [...left.slice(start),...right.slice(0,end+1)]
            : [];
          const approvedPairs=[];
          for(let index=1;index<sequence.length;index++){
            const pair=normalize(sequence[index-1].text)+'||'+normalize(sequence[index].text);
            approvedPairs.push(pair);
          }
          state.approvedPairs=approvedPairs;
          const pair=normalize(body.before)+'||'+normalize(body.after);
          const combine=approvedPairs.includes(pair)||(String(body.before||'').toLowerCase().includes(before)&&String(body.after||'').toLowerCase().includes(after));
          call.combine=combine;
          return new Response(JSON.stringify({combine,status:'classified'}),{status:200,headers:{'Content-Type':'application/json'}});
        }
        if(url.pathname==='/api/translate'){
          const text=String(body.text||'');
          const call={...body};
          state.translationCalls.push(call);
          if(body.cacheOnly)return new Response(null,{status:204});
          return new Response(JSON.stringify({translation:${JSON.stringify(TRANSLATION_SEED)}.repeat(Math.max(1,Math.min(6,Math.ceil(text.trim().length/72)))),cached:false,model:'ultrafast-columns-smoke'}),{status:200,headers:{'Content-Type':'application/json'}});
        }
        return originalFetch(input,options);
      };
      return true;
    })()`);
  }

  async function openRecent(id, zoom) {
    await waitFor(
      'fixture recent entry',
      `!!document.querySelector('[data-recent-id=${JSON.stringify(id)}]')`,
    );
    await evaluate(`document.querySelector('[data-recent-id=${JSON.stringify(id)}]').click();true`);
    await waitFor(
      'one page rendered at the requested zoom',
      `(()=>{const d=window.previewRenderDiagnostics?.();return d?.totalPages===1&&!d.opening&&Math.abs(d.zoom-${zoom})<0.001&&document.querySelector('.page[data-page="1"] canvas')?.width>0;})()`,
    );
    await waitFor(
      'real layout and translated paragraphs',
      `(()=>{const s=window.ultrafastColumnsSmoke,d=window.previewRenderDiagnostics?.();return s?.layoutResults?.some(x=>x.request.page===1&&x.status===200&&x.result?.paragraphs?.length>0)&&d?.readingView?.showTranslations===true&&document.querySelectorAll('.page[data-page="1"] .reading-paragraph .paragraph-text').length>0;})()`,
    );
  }

  async function snapshot() {
    return evaluate(`(()=>{
      const page=document.querySelector('.page[data-page="1"]');
      if(!page)return {page:null,blocks:[]};
      const pageRect=page.getBoundingClientRect();
      const blocks=[...page.querySelectorAll('.reading-paragraph[data-block-id]')].map((element)=>{
        const rect=element.getBoundingClientRect();
        const text=element.querySelector('.paragraph-text');
        const range=document.createRange();
        if(text)range.selectNodeContents(text);
        const textRects=text?[...range.getClientRects()].map((r)=>({left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height})):[];
        return {
          id:String(element.dataset.blockId),
          groupId:element.dataset.paragraphGroupId||'',
          index:element.dataset.paragraphIndex==null?null:Number(element.dataset.paragraphIndex),
          paragraphText:element.dataset.paragraphText||'',
          textContent:text?.textContent||'',
          rect:{left:rect.left-pageRect.left,top:rect.top-pageRect.top,right:rect.right-pageRect.left,bottom:rect.bottom-pageRect.top,width:rect.width,height:rect.height},
          screenRect:{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height},
          textRects,
        };
      });
      return {page:{left:pageRect.left,top:pageRect.top,width:pageRect.width,height:pageRect.height},blocks};
    })()`);
  }

  function layoutResult() {
    return evaluate(
      'window.ultrafastColumnsSmoke.layoutResults.find(item=>item.request.page===1)?.result||null',
    );
  }

  async function scrollToTarget() {
    await evaluate(`(()=>{
      const target=[...document.querySelectorAll('.page[data-page="1"] .reading-paragraph')].find((element)=>/data about persons|scrutinizing declarations/i.test(element.dataset.paragraphText||''));
      target?.scrollIntoView({block:'center',inline:'nearest'});
      return true;
    })()`);
    await pause(180);
  }

  async function screenshot(path) {
    await writeFile(path, (await window.webContents.capturePage()).toPNG());
  }

  const fixtureDirectory = await mkdtemp(join(tmpdir(), 'pdfmathreader-ultrafast-columns-'));
  const fixturePath = join(fixtureDirectory, FIXTURE_NAME);
  const preferences = {
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
    jevApiToken: 'ultrafast-columns-token',
    language: 'Simplified Chinese',
    sourceLanguage: 'English',
    ultraFastSerif: false,
    ultraFastFont: '',
    concurrency: 4,
    pageConcurrency: 2,
    fit: 'manual',
    direction: 'vertical',
    columns: 1,
    zoom: ZOOMS[0],
  };
  try {
    assert.ok(
      SOURCE_PDF,
      'Set PDFMATHREADER_COLUMNS_PDF to the supplied local PDF before running this smoke.',
    );
    assert.equal(
      (await stat(SOURCE_PDF)).isFile(),
      true,
      `Columns PDF is not a file: ${SOURCE_PDF}`,
    );
    const pageSize = await firstPageFixture(SOURCE_PDF, fixturePath);

    window.setContentSize(1600, 1000);
    await waitFor('initial renderer ready', 'window.previewReady===true');
    window.show();
    window.focus();
    await evaluate('window.previewCredentials.save("ultrafast-columns-placeholder")');
    await recents.remember(fixturePath);
    const recent = recents.list().find((entry) => recents.path(entry.id) === fixturePath);
    assert.ok(recent, `First-page PDF fixture was not added to recents: ${fixturePath}`);
    await recents.setView(recent.id, {
      page: FIRST_PAGE,
      offsetX: 0,
      offsetY: 0,
      zoom: ZOOMS[0],
      fit: 'manual',
      direction: 'vertical',
      columns: 1,
      sidebar: false,
      showTranslations: true,
    });
    // Recent-document setup can trigger saveView before the new Jev setting is
    // applied. Preserve the continuation smoke's setup/save/reload ordering.
    await pause(350);
    await savePreferences(preferences);
    await reload();
    const saved = await evaluate('window.previewPreferences.load()');
    assert.equal(saved.engine, 'pdf_inspector');
    assert.equal(saved.interactionMode, 'reading');
    assert.equal(saved.language, 'Simplified Chinese');
    assert.equal(saved.paragraphContinuationDetection, true);
    assert.equal(saved.jevApiToken, 'ultrafast-columns-token');
    await installMocks();
    await openRecent(recent.id, ZOOMS[0]);

    const firstLayout = await layoutResult();
    const sourceBlocks = firstLayout.paragraphs || [];
    assert.ok(sourceBlocks.length > 0, 'Actual /api/layout returned no extracted paragraphs');
    assert.ok(
      sourceBlocks.every((block) => {
        const text = String(block.text).toLowerCase();
        return !(text.includes('in our') && text.includes('in this article'));
      }),
      'Actual source extraction must keep In our and In this article out of one paragraph block',
    );
    const bodyFontSizes = sourceBlocks
      .map((block) => Number(block.fontSize))
      .filter((fontSize) => Number.isFinite(fontSize) && fontSize > 0)
      .sort((a, b) => a - b);
    const bodyFontSize = bodyFontSizes[Math.floor(bodyFontSizes.length / 2)] || 0;
    const leftSource = sourceBlocks.find((block) =>
        block.text.toLowerCase().includes(BEFORE_SENTINEL),
      ),
      rightSource = sourceBlocks.find((block) => block.text.toLowerCase().includes(AFTER_SENTINEL));
    assert.ok(
      leftSource,
      `Actual layout is missing the left continuation source: ${BEFORE_SENTINEL}`,
    );
    assert.ok(
      rightSource,
      `Actual layout is missing the right continuation source: ${AFTER_SENTINEL}`,
    );
    const bodyBlocks = sourceBlocks.filter(
      (block) =>
        Number.isFinite(Number(block.x)) &&
        Number.isFinite(Number(block.width)) &&
        Number.isFinite(Number(block.fontSize)) &&
        String(block.text || '').trim().length >= 20 &&
        block.width <= 320 &&
        Number(block.fontSize) >= bodyFontSize * 0.9 &&
        (!Number.isFinite(Number(leftSource.y)) || Number(block.y) >= Number(leftSource.y)),
    );
    assert.ok(bodyBlocks.length >= 2, 'Actual layout must expose at least two body column blocks');
    assert.ok(
      bodyBlocks.every((block) => block.x >= 300 || block.x + block.width <= 294),
      `Body blocks must stay on one side of the gutter: ${JSON.stringify(bodyBlocks)}`,
    );
    assert.notEqual(
      String(leftSource.id),
      String(rightSource.id),
      'Column fragments must retain distinct source IDs',
    );
    assert.ok(
      leftSource.x < rightSource.x,
      'Target fragments must progress from the left to right column',
    );
    await waitFor(
      'both target column fragments translated',
      `(()=>{const ids=${JSON.stringify([String(leftSource.id), String(rightSource.id)])};const blocks=[...document.querySelectorAll('.page[data-page="1"] .reading-paragraph[data-block-id]')];return ids.every((id)=>blocks.some((element)=>element.dataset.blockId===id));})()`,
    );

    const firstSnapshot = await snapshot();
    const continuationState = await evaluate('window.ultrafastColumnsSmoke');
    await writeFile(
      '/tmp/pdfmathreader-ultrafast-columns-state.json',
      JSON.stringify({ sourceBlocks, continuationState, snapshot: firstSnapshot }, null, 2),
    );
    const targetIds = new Set([String(leftSource.id), String(rightSource.id)]);
    const bodyIds = new Set(bodyBlocks.map((block) => String(block.id)));
    const bodyTargets = firstSnapshot.blocks.filter((block) => bodyIds.has(block.id));
    assert.equal(
      bodyTargets.length,
      bodyIds.size,
      'Every extracted body block must retain a translated DOM region',
    );
    const firstTargets = firstSnapshot.blocks.filter((block) => targetIds.has(block.id));
    assert.equal(firstTargets.length, 2, 'Both grouped column fragments must retain DOM regions');
    const groupedIds = new Set(firstTargets.map((block) => block.groupId));
    assert.equal(groupedIds.size, 1, 'Affirmative continuation fragments must share one group ID');
    assert.ok([...groupedIds][0], 'Grouped continuation fragments must expose a group ID');
    assert.deepEqual(
      firstTargets.map((block) => block.index).sort((a, b) => a - b),
      [0, 1],
      'Grouped continuation fragments retain their original order',
    );
    assert.ok(
      firstTargets.every(
        (block) =>
          block.paragraphText.toLowerCase().includes(BEFORE_SENTINEL) &&
          block.paragraphText.toLowerCase().includes(AFTER_SENTINEL),
      ),
      'Grouped fragments expose the complete logical source paragraph',
    );
    const pageScale = firstSnapshot.page.width / pageSize.width;
    const expectedTargets = [leftSource, rightSource].map((source) => ({
      source,
      left: source.x * pageScale,
      top: source.y * pageScale,
      width: source.width * pageScale,
      height: Math.max(source.height, source.fontSize * 1.1) * pageScale,
    }));
    for (const target of bodyTargets) {
      assert.ok(
        target.textRects.every(
          (rect) =>
            rect.left >= target.screenRect.left - 1 && rect.right <= target.screenRect.right + 1,
        ),
        `Translated body text for block ${target.id} escaped its source column`,
      );
    }
    for (const target of firstTargets) {
      const expected = expectedTargets.find(
        (candidate) => String(candidate.source.id) === target.id,
      );
      assert.ok(expected, `Missing geometry source for block ${target.id}`);
      assert.ok(
        Math.abs(target.rect.left - expected.left) < 2,
        `Block ${target.id} left edge changed at 161%`,
      );
      assert.ok(
        Math.abs(target.rect.top - expected.top) < 2,
        `Block ${target.id} top edge changed at 161%`,
      );
      assert.ok(
        Math.abs(target.rect.width - expected.width) < 2,
        `Block ${target.id} width changed at 161%`,
      );
      assert.ok(
        Math.abs(target.rect.height - expected.height) < 2,
        `Block ${target.id} height changed at 161%`,
      );
      assert.ok(
        target.textRects.every(
          (rect) =>
            rect.left >= target.screenRect.left - 1 && rect.right <= target.screenRect.right + 1,
        ),
        `Translated text for block ${target.id} escaped its source column`,
      );
    }
    const leftTarget = firstTargets.find((block) => block.id === String(leftSource.id));
    const rightTarget = firstTargets.find((block) => block.id === String(rightSource.id));
    assert.ok(leftTarget && rightTarget);
    assert.ok(
      leftTarget.rect.right < rightTarget.rect.left,
      'Column targets must not span or overlap the gutter',
    );
    assert.ok(
      Math.abs(leftSource.x - 51) < 32,
      `Left body x drifted from the 161% reference: ${leftSource.x}`,
    );
    assert.ok(
      Math.abs(rightSource.x - 306) < 40,
      `Right body x drifted from the 161% reference: ${rightSource.x}`,
    );
    assert.ok(
      continuationState.externalCalls.length === 0,
      'Column smoke made no external fetches',
    );
    assert.ok(
      continuationState.layoutCalls.some((call) => call.page === FIRST_PAGE) &&
        continuationState.layoutResults.some(
          (result) => result.request.page === FIRST_PAGE && result.status === 200,
        ),
      'Column smoke used the actual /api/layout backend',
    );
    assert.ok(
      continuationState.continuationCalls.some((call) => call.combine === true),
      'Column smoke classified the target fragments affirmatively',
    );
    assert.ok(
      continuationState.continuationCalls.some((call) => call.combine === false),
      'Column smoke classified non-target boundaries separately',
    );
    assert.ok(
      continuationState.continuationCalls.every((call) => call.token === 'ultrafast-columns-token'),
      'Continuation requests use the configured synthetic Jev token',
    );
    assert.ok(
      continuationState.translationCalls.some(
        (call) =>
          !call.cacheOnly &&
          String(call.text).toLowerCase().includes(BEFORE_SENTINEL) &&
          String(call.text).toLowerCase().includes(AFTER_SENTINEL),
      ),
      'The grouped column paragraph was translated once as a complete source',
    );
    await scrollToTarget();
    await screenshot('/tmp/pdfmathreader-ultrafast-columns-161.png');

    window.webContents.send('reader:action', 'close-document');
    await waitFor(
      'fixture closed before the 100% pass',
      'window.previewRenderDiagnostics?.().totalPages===0',
    );
    await recents.setView(recent.id, {
      page: FIRST_PAGE,
      offsetX: 0,
      offsetY: 0,
      zoom: ZOOMS[1],
      fit: 'manual',
      direction: 'vertical',
      columns: 1,
      sidebar: false,
      showTranslations: true,
    });
    await installMocks();
    await openRecent(recent.id, ZOOMS[1]);
    await waitFor(
      'both target column fragments translated at 100%',
      `(()=>{const ids=${JSON.stringify([...targetIds])};const blocks=[...document.querySelectorAll('.page[data-page="1"] .reading-paragraph[data-block-id]')];return ids.every((id)=>blocks.some((element)=>element.dataset.blockId===id));})()`,
    );
    const secondSnapshot = await snapshot();
    const secondTargets = secondSnapshot.blocks.filter((block) => targetIds.has(block.id));
    assert.equal(
      secondTargets.length,
      2,
      'Both grouped column fragments must remain visible at 100%',
    );
    for (const target of secondTargets) {
      const source = sourceBlocks.find((block) => String(block.id) === target.id);
      const expectedHeight = Math.max(source.height, source.fontSize * 1.1);
      assert.ok(
        Math.abs(target.rect.left - source.x) < 2,
        `Block ${target.id} left edge changed at 100%`,
      );
      assert.ok(
        Math.abs(target.rect.top - source.y) < 2,
        `Block ${target.id} top edge changed at 100%`,
      );
      assert.ok(
        Math.abs(target.rect.width - source.width) < 2,
        `Block ${target.id} width changed at 100%`,
      );
      assert.ok(
        Math.abs(target.rect.height - expectedHeight) < 2,
        `Block ${target.id} height changed at 100%`,
      );
      assert.ok(
        target.textRects.every(
          (rect) =>
            rect.left >= target.screenRect.left - 1 && rect.right <= target.screenRect.right + 1,
        ),
        `Translated text for block ${target.id} escaped its source column at 100%`,
      );
    }
    assert.ok(
      secondTargets.find((block) => block.id === String(leftSource.id)).rect.right <
        secondTargets.find((block) => block.id === String(rightSource.id)).rect.left,
      'Column targets remain separated at 100%',
    );
    await scrollToTarget();
    await screenshot('/tmp/pdfmathreader-ultrafast-columns-100.png');
    console.log(
      'Ultra fast column smoke passed',
      JSON.stringify({
        source: SOURCE_PDF,
        fixture: fixturePath,
        firstPageOnly: true,
        actualLayoutBackend: true,
        groupedTargetIds: [...targetIds],
        continuationCalls: continuationState.continuationCalls.length,
        screenshots: [
          '/tmp/pdfmathreader-ultrafast-columns-161.png',
          '/tmp/pdfmathreader-ultrafast-columns-100.png',
        ],
      }),
    );
  } finally {
    await rm(fixtureDirectory, { recursive: true, force: true });
  }
  app.exit(0);
}
