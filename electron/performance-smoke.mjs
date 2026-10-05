import assert from 'node:assert/strict';
import { Menu } from 'electron';
import { PDFDocument, rgb } from 'pdf-lib';

const PAGE_COUNT = 120;
const STRESS_PAGE_COUNT = 1000;
const MEGABYTE = 1024 * 1024;
const CACHE_BYTES = 64 * MEGABYTE;
const CACHE_ENTRIES = 96;
const RESIDENT_BYTES = 135 * MEGABYTE;
const MAX_MOUNTED_PAGES = 60;
const MAX_TOTAL_DOM_NODES = 80;
const WAIT_MS = 30_000;
const STRESS_WAIT_MS = 90_000;
const POLL_MS = 75;

export async function verifyPerformance(window) {
  const evaluate = (code) => window.webContents.executeJavaScript(code);
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const diagnosticsCode = `typeof window.previewRenderDiagnostics==='function'?window.previewRenderDiagnostics():null`;
  const pdfChunkCode = `performance.getEntriesByType('resource').some(entry=>{const name=entry.name;return name.includes('/pdf-')&&!name.includes('pdf.worker');})`;

  async function diagnostics() {
    const state = await evaluate(diagnosticsCode);
    assert.ok(state, 'preview render diagnostics are unavailable');
    return state;
  }

  async function documentStats() {
    const result = await evaluate(
      `(async()=>{const response=await fetch('/api/document-stats');let body=null;try{body=await response.json();}catch{}return {status:response.status,body};})()`,
    );
    assert.equal(result.status, 200, `document stats request failed with HTTP ${result.status}`);
    assert.ok(result.body, 'document stats response is empty');
    for (const key of ['uploads', 'uploadBytes', 'activeBytes'])
      assert.equal(typeof result.body[key], 'number', `document stats is missing ${key}`);
    return result.body;
  }

  function statsValues(state) {
    return {
      uploads: state.uploads,
      uploadBytes: state.uploadBytes,
      activeBytes: state.activeBytes,
    };
  }

  async function waitFor(label, code, timeout = WAIT_MS) {
    const started = Date.now();
    console.log(`Performance smoke: waiting for ${label}`);
    while (Date.now() - started < timeout) {
      if (await evaluate(code)) {
        console.log(`Performance smoke: ${label} ready in ${Date.now() - started} ms`);
        return;
      }
      await pause(POLL_MS);
    }
    let state = null;
    try {
      state = await evaluate(
        `(()=>{const d=${diagnosticsCode};return {title:document.title,empty:!!document.querySelector('.empty'),pageDOM:document.querySelectorAll('.page').length,thumbnailDOM:document.querySelectorAll('.thumb').length,reader:document.querySelector('.reader')?{top:document.querySelector('.reader').scrollTop,left:document.querySelector('.reader').scrollLeft}:null,diagnostics:d};})()`,
      );
    } catch (error) {
      state = { diagnosticsError: error.message };
    }
    console.log(`Performance smoke timeout: ${label}`, JSON.stringify(state));
    throw Error(`Performance smoke timed out: ${label}`);
  }

  async function domSnapshot() {
    return evaluate(
      `(()=>{const d=${diagnosticsCode};const pageNodes=[...document.querySelectorAll('.page')],thumbNodes=[...document.querySelectorAll('.thumb')],list=document.querySelector('.thumbnail-list'),listRect=list?.getBoundingClientRect();return {d,pageDOM:pageNodes.length,pageIds:pageNodes.map(page=>Number(page.dataset.page)),thumbnailDOM:thumbNodes.length,thumbnailIds:thumbNodes.map(thumb=>Number(thumb.getAttribute('aria-label')?.match(/(\\d+)$/)?.[1])),thumbnailOutsideBuffer:listRect?thumbNodes.some(thumb=>{const rect=thumb.getBoundingClientRect();return rect.bottom<listRect.top-201||rect.top>listRect.bottom+201;}):false};})()`,
    );
  }

  async function assertDOMBound(label) {
    const report = await domSnapshot();
    assert.ok(report?.d, `${label}: render diagnostics missing while checking DOM`);
    assert.equal(
      report.pageDOM,
      report.d.mountedPages,
      `${label}: page DOM count disagrees with diagnostics`,
    );
    assert.equal(
      report.pageDOM,
      report.d.window.length,
      `${label}: mounted page DOM must equal the render window`,
    );
    assert.deepEqual(
      [...report.pageIds].sort((a, b) => a - b),
      [...new Set(report.d.window)].sort((a, b) => a - b),
      `${label}: page DOM escaped the render window`,
    );
    assert.ok(
      report.pageDOM < MAX_MOUNTED_PAGES,
      `${label}: mounted page DOM is ${report.pageDOM}`,
    );
    assert.equal(
      report.thumbnailDOM,
      report.d.mountedThumbnails,
      `${label}: thumbnail DOM count disagrees with diagnostics`,
    );
    if (report.thumbnailOutsideBuffer)
      console.log(
        'Thumbnail geometry',
        await evaluate(
          `JSON.stringify({list:document.querySelector('.thumbnail-list').getBoundingClientRect().toJSON(),top:document.querySelector('.thumbnail-list').scrollTop,thumbs:[...document.querySelectorAll('.thumb')].map(t=>({n:t.getAttribute('aria-label'),rect:t.getBoundingClientRect().toJSON()}))})`,
        ),
      );
    assert.equal(
      report.thumbnailOutsideBuffer,
      false,
      `${label}: thumbnail DOM escaped the visible sidebar window plus 200 px`,
    );
    assert.ok(
      report.pageDOM + report.thumbnailDOM <= MAX_TOTAL_DOM_NODES,
      `${label}: total page and thumbnail DOM is ${report.pageDOM + report.thumbnailDOM}`,
    );
    return report;
  }

  function assertLimits(state, label) {
    assert.ok(state?.cache, `${label}: cache diagnostics missing`);
    assert.equal(state.cache.maxBytes, CACHE_BYTES, `${label}: cache byte limit changed`);
    assert.equal(state.cache.maxEntries, CACHE_ENTRIES, `${label}: cache entry limit changed`);
    assert.ok(state.cache.bytes <= CACHE_BYTES, `${label}: cache uses ${state.cache.bytes} bytes`);
    assert.ok(
      state.cache.entries <= CACHE_ENTRIES,
      `${label}: cache has ${state.cache.entries} entries`,
    );
    assert.ok(
      state.residentBytes <= RESIDENT_BYTES,
      `${label}: resident canvases use ${state.residentBytes} bytes`,
    );
  }

  function assertResidentWindow(state, label) {
    assert.ok(Array.isArray(state.window), `${label}: render window missing`);
    assert.ok(Array.isArray(state.pages), `${label}: resident page list missing`);
    assert.equal(
      state.mountedPages,
      state.window.length,
      `${label}: mounted page count must equal render window length`,
    );
    assert.ok(
      state.pages.every((page) => state.window.includes(page)),
      `${label}: resident page escaped render window`,
    );
  }

  async function centerPixel(pageNumber) {
    return evaluate(
      `(()=>{const canvas=document.querySelector('.page[data-page="${pageNumber}"] canvas');if(!canvas||!canvas.width||!canvas.height)return null;const pixel=canvas.getContext('2d').getImageData(Math.floor(canvas.width/2),Math.floor(canvas.height/2),1,1).data;return Array.from(pixel);})()`,
    );
  }

  async function assertBlackCenter(pageNumber, label) {
    const pixel = await centerPixel(pageNumber);
    if (!pixel)
      console.log(
        'Missing page bitmap',
        JSON.stringify(await diagnostics()),
        await evaluate(
          `JSON.stringify([...document.querySelectorAll('.page')].map(p=>({n:p.dataset.page,width:p.querySelector('canvas').width,top:p.getBoundingClientRect().top})))`,
        ),
      );
    assert.ok(pixel, `${label}: page ${pageNumber} canvas is not resident`);
    assert.ok(
      pixel[0] < 16 && pixel[1] < 16 && pixel[2] < 16 && pixel[3] === 255,
      `${label}: page ${pageNumber} center pixel was ${pixel}`,
    );
  }

  async function createFixture(pageCount = PAGE_COUNT) {
    const pdf = await PDFDocument.create();
    const sizes = [
      [612, 792],
      [792, 612],
      [540, 760],
    ];
    for (let index = 0; index < pageCount; index++) {
      const page = pdf.addPage(sizes[index % sizes.length]);
      const size = 180;
      page.drawRectangle({
        x: (page.getWidth() - size) / 2,
        y: (page.getHeight() - size) / 2,
        width: size,
        height: size,
        color: rgb(0, 0, 0),
      });
    }
    return Buffer.from(await pdf.save()).toString('base64');
  }

  async function importFixture(encoded) {
    await waitFor('file input', `!!document.querySelector('input[type="file"]')`, 10_000);
    await evaluate(
      `(()=>{const input=document.querySelector('input[type="file"]');const data=new DataTransfer();data.items.add(new File([Uint8Array.from(atob(${JSON.stringify(encoded)}),character=>character.charCodeAt(0))],'Portrait and landscape.pdf',{type:'application/pdf'}));input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`,
    );
  }

  async function selectLayout(direction) {
    const item = Menu.getApplicationMenu()?.getMenuItemById(`layout-${direction}`);
    assert.ok(item, `missing layout menu item: ${direction}`);
    item.click();
    await waitFor(
      `${direction} layout`,
      `document.querySelector('.page-layout')?.classList.contains(${JSON.stringify(direction)})`,
      10_000,
    );
    await pause(500);
  }

  async function selectColumns(count) {
    const item = Menu.getApplicationMenu()?.getMenuItemById(`columns-${count}`);
    assert.ok(item, `missing columns menu item: ${count}`);
    item.click();
    await waitFor(
      `${count} columns`,
      `document.querySelector('.page-layout')?.classList.contains('vertical')&&getComputedStyle(document.querySelector('.page-layout')).getPropertyValue('--page-columns').trim()===${JSON.stringify(String(count))}`,
      10_000,
    );
    await pause(500);
    assert.equal(item.checked, true, `columns-${count} should be selected`);
  }

  async function jump(percent, pageNumber) {
    window.webContents.send('reader:action', `percent:${percent}`);
    await waitFor(
      `jump to ${percent}%`,
      `(()=>{const page=document.querySelector('.page[data-page="${pageNumber}"]'),canvas=page?.querySelector('canvas'),reader=document.querySelector('.reader');if(!page||!canvas||!reader||canvas.width<=0)return false;const pageRect=page.getBoundingClientRect(),readerRect=reader.getBoundingClientRect();return pageRect.bottom>readerRect.top&&pageRect.top<readerRect.bottom&&pageRect.right>readerRect.left&&pageRect.left<readerRect.right;})()`,
      20_000,
    );
    await pause(500);
    return diagnostics();
  }

  async function waitForRowWindow(direction, count, label, pageCount = PAGE_COUNT) {
    const effectiveColumns = direction === 'vertical' ? count : 1;
    const geometryCode = `(()=>{const reader=document.querySelector('.reader'),d=window.previewRenderDiagnostics?.();if(!reader||!d)return null;const bounds=reader.getBoundingClientRect(),visible=[];for(const page of document.querySelectorAll('.page')){const rect=page.getBoundingClientRect();if(rect.bottom>bounds.top&&rect.top<bounds.bottom&&rect.right>bounds.left&&rect.left<bounds.right)visible.push(Number(page.dataset.page));}if(!visible.length)return null;const rows=visible.map(page=>Math.floor((page-1)/${effectiveColumns})),first=Math.max(0,Math.min(...rows)-4),last=Math.max(...rows)+4,expected=Array.from({length:${pageCount}},(_,index)=>index+1).filter(page=>{const row=Math.floor((page-1)/${effectiveColumns});return row>=first&&row<=last;}).sort((a,b)=>a-b),actual=[...new Set(d.window)].sort((a,b)=>a-b);return {visible,first,last,expected,actual};})()`;
    await waitFor(
      `${label} ±4-row render window`,
      `(()=>{const geometry=${geometryCode};return !!geometry&&JSON.stringify(geometry.actual)===JSON.stringify(geometry.expected);})()`,
      20_000,
    );
    const geometry = await evaluate(geometryCode);
    const state = await diagnostics();
    assert.deepEqual(
      [...state.window].sort((a, b) => a - b),
      geometry.expected,
      `${label}: render window does not match visible rows ±4`,
    );
    await assertDOMBound(label);
    return state;
  }

  async function assertLayoutRequestsDoNotRegister(label) {
    const before = await documentStats();
    const statuses = await evaluate(
      `(async()=>{const d=window.previewRenderDiagnostics?.();if(!d?.documentId)return [];const statuses=[];for(const page of [1,2]){const height=page===1?792:612;const response=await fetch('/api/layout?page='+page+'&height='+height,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({documentId:d.documentId,page,height})});await response.text();statuses.push(response.status);}return statuses;})()`,
    );
    assert.deepEqual(statuses, [200, 200], `${label}: layout requests did not complete`);
    const after = await documentStats();
    assert.deepEqual(
      statsValues(after),
      statsValues(before),
      `${label}: layout requests changed document registration or upload bytes`,
    );
    return after;
  }

  async function assertBackgroundPause() {
    await pause(300);
    window.minimize();
    await waitFor(
      'background render pause',
      `window.previewRenderDiagnostics?.().foreground===false`,
      10_000,
    );
    // macOS can animate minimization before sending the inactive event.
    // Compare only work after the renderer has acknowledged the pause.
    const before = await diagnostics();
    const snapshot = {
      cache: before.cache,
      metrics: before.metrics,
      window: before.window,
      pages: before.pages,
      thumbnails: before.thumbnails,
      residentBytes: before.residentBytes,
    };
    await pause(200);
    const paused = await diagnostics();
    assert.equal(paused.foreground, false, 'minimized window should report foreground false');
    assert.deepEqual(
      paused.cache,
      snapshot.cache,
      'minimized window changed bitmap cache diagnostics',
    );
    assert.deepEqual(
      paused.metrics,
      snapshot.metrics,
      'minimized window changed render diagnostics',
    );
    assert.deepEqual(
      paused.window,
      snapshot.window,
      'minimized window changed the virtual render window',
    );
    assert.deepEqual(
      paused.pages,
      snapshot.pages,
      'minimized window changed resident page bitmaps',
    );
    assert.deepEqual(
      paused.thumbnails,
      snapshot.thumbnails,
      'minimized window changed resident thumbnail bitmaps',
    );
    assert.equal(
      paused.residentBytes,
      snapshot.residentBytes,
      'minimized window changed resident bitmap bytes',
    );
    window.restore();
    window.focus();
    await waitFor(
      'foreground render restore',
      `window.previewRenderDiagnostics?.().foreground===true`,
      10_000,
    );
    await waitFor(
      'restored page pixels',
      `(()=>{const canvas=document.querySelector('.page canvas');return !!canvas&&canvas.width>0&&canvas.height>0;})()`,
      20_000,
    );
    await assertBlackCenter(1, 'foreground restore');
  }

  async function assertContinuousStressPreview(destinationPage, percent) {
    const selector = `.page[data-page="${destinationPage}"] canvas`,
      holdKey = '__pdfMathReaderPerformanceSmokeScrollHold',
      started = Date.now();
    const before = await diagnostics();
    assert.ok(
      !before.pages.includes(destinationPage),
      `1000-page scroll destination ${destinationPage} should start without a resident canvas`,
    );
    await evaluate(
      `(()=>{const reader=document.querySelector('.reader'),key=${JSON.stringify(holdKey)};if(!reader)throw Error('reader is unavailable');const previous=window[key];if(previous?.handle)clearInterval(previous.handle);const tick=()=>{if(reader.isConnected)reader.dispatchEvent(new Event('scroll',{bubbles:true}));};tick();window[key]={handle:setInterval(tick,40)};return true;})()`,
    );
    let preview;
    let previewDpr;
    let previewBytes;
    let deviceDpr;
    try {
      window.webContents.send('reader:action', `percent:${percent}`);
      await waitFor(
        `1000-page scrolling preview destination ${destinationPage}`,
        `(()=>{const d=window.previewRenderDiagnostics?.(),canvas=document.querySelector(${JSON.stringify(selector)});return d?.previewScrolling===true&&d.pages?.includes(${destinationPage})&&!!canvas&&canvas.width>0&&canvas.height>0;})()`,
        STRESS_WAIT_MS,
      );
      preview = await diagnostics();
      const canvas = await evaluate(
        `(()=>{const canvas=document.querySelector(${JSON.stringify(selector)});return {width:canvas?.width||0,height:canvas?.height||0,deviceDpr:window.devicePixelRatio||1};})()`,
      );
      deviceDpr = canvas.deviceDpr;
      previewDpr =
        preview.pageResolution?.find((item) => item.number === destinationPage)?.dpr || 0;
      previewBytes = canvas.width * canvas.height * 4;
      assert.equal(
        preview.previewScrolling,
        true,
        '1000-page destination rendered after scrolling settled',
      );
      assert.ok(
        preview.pages.includes(destinationPage),
        `1000-page destination ${destinationPage} is not resident during scrolling`,
      );
      assert.ok(
        previewDpr > 0 && previewDpr <= deviceDpr,
        `1000-page scrolling destination DPR was ${previewDpr}`,
      );
      assert.ok(
        previewBytes <= 16 * MEGABYTE + 16384 * 8,
        `1000-page scrolling destination uses ${previewBytes} bytes`,
      );
      assertLimits(preview, '1000-page scrolling preview');
      assertResidentWindow(preview, '1000-page scrolling preview');
      await assertBlackCenter(destinationPage, '1000-page scrolling preview');
      console.log(
        'Performance smoke 1000-page scrolling preview:',
        JSON.stringify({
          destinationPage,
          elapsedMs: Date.now() - started,
          deviceDpr,
          previewDpr,
          previewBytes,
        }),
      );
    } finally {
      await evaluate(
        `(()=>{const key=${JSON.stringify(holdKey)},hold=window[key];if(hold?.handle)clearInterval(hold.handle);delete window[key];return true;})()`,
      );
    }
    await waitFor(
      `1000-page settled destination ${destinationPage}`,
      `(()=>{const d=window.previewRenderDiagnostics?.(),canvas=document.querySelector(${JSON.stringify(selector)}),entry=d?.pageResolution?.find(item=>item.number===${destinationPage});return d?.previewScrolling===false&&d.pages?.includes(${destinationPage})&&!!canvas&&canvas.width>0&&canvas.height>0&&(${deviceDpr <= 1}||entry?.dpr>=${previewDpr});})()`,
      STRESS_WAIT_MS,
    );
    const settled = await diagnostics(),
      settledDpr =
        settled.pageResolution?.find((item) => item.number === destinationPage)?.dpr || 0;
    assert.equal(
      settled.previewScrolling,
      false,
      '1000-page preview did not resume after scroll hold',
    );
    assert.ok(
      settledDpr >= previewDpr,
      `settled destination DPR ${settledDpr} was below preview DPR ${previewDpr}`,
    );
    if (deviceDpr > 1)
      assert.ok(
        settledDpr >= previewDpr,
        `settled destination DPR ${settledDpr} decreased from preview DPR ${previewDpr}`,
      );
    assertLimits(settled, '1000-page settled preview');
    assertResidentWindow(settled, '1000-page settled preview');
    await assertBlackCenter(destinationPage, '1000-page settled preview');
    console.log(
      'Performance smoke 1000-page settled preview:',
      JSON.stringify({
        destinationPage,
        elapsedMs: Date.now() - started,
        deviceDpr,
        previewDpr,
        settledDpr,
        previewBytes,
      }),
    );
  }

  console.log(
    `Performance smoke: generating ${PAGE_COUNT}-page variable portrait / landscape fixture`,
  );
  const initialResources = await evaluate(
    `performance.getEntriesByType('resource').map(entry=>entry.name).filter(name=>name.includes('/pdf-')&&!name.includes('pdf.worker'))`,
  );
  assert.deepEqual(
    initialResources,
    [],
    'PDF.js chunk should remain lazy before the first PDF load',
  );
  const initialStats = await documentStats();
  assert.equal(initialStats.activeBytes, 0, 'document registry should start empty');
  const encoded = await createFixture();
  await importFixture(encoded);
  await waitFor(
    '120-page document ready',
    `(()=>{const d=window.previewRenderDiagnostics?.();return document.title==='TEST — Portrait and landscape.pdf'&&d?.totalPages===${PAGE_COUNT}&&d?.opening===false&&d.mountedPages===d.window.length;})()`,
  );
  await waitFor('PDF.js chunk loaded', pdfChunkCode, 20_000);
  await waitFor(
    'initial nonempty page',
    `(()=>{const canvas=document.querySelector('.page canvas');if(!canvas||!canvas.width||!canvas.height)return false;const pixel=canvas.getContext('2d').getImageData(Math.floor(canvas.width/2),Math.floor(canvas.height/2),1,1).data;return pixel[3]>0;})()`,
  );
  await waitFor(
    'initial thumbnails',
    `(()=>{const d=window.previewRenderDiagnostics?.();return !!d&&d.totalPages===${PAGE_COUNT}&&d.mountedThumbnails>0&&d.mountedThumbnails<${PAGE_COUNT}&&d.thumbnails.length>0;})()`,
  );

  const registeredStats = await documentStats();
  assert.equal(
    registeredStats.uploads,
    initialStats.uploads + 1,
    'one imported PDF should create exactly one document registration',
  );
  assert.equal(
    registeredStats.activeBytes,
    registeredStats.uploadBytes - initialStats.uploadBytes,
    'active bytes should match the newly registered PDF',
  );
  const initial = await diagnostics();
  assert.equal(initial.totalPages, PAGE_COUNT, 'diagnostics total page count changed');
  assert.equal(
    initial.mountedPages,
    initial.window.length,
    'initial mounted pages must equal the render window length',
  );
  assert.ok(
    initial.mountedPages < MAX_MOUNTED_PAGES,
    `initial render mounted ${initial.mountedPages} pages`,
  );
  assert.ok(
    initial.mountedThumbnails < PAGE_COUNT,
    `initial thumbnail residency was ${initial.mountedThumbnails}`,
  );
  await assertDOMBound('initial render');
  assertResidentWindow(initial, 'initial render');
  assertLimits(initial, 'initial render');
  console.log(
    'Performance smoke virtualization baseline:',
    JSON.stringify({
      totalPages: initial.totalPages,
      mountedPages: initial.mountedPages,
      mountedThumbnails: initial.mountedThumbnails,
      pageDOM: initial.mountedPages,
      thumbnailDOM: initial.mountedThumbnails,
      window: initial.window.length,
      cache: initial.cache,
      documents: statsValues(registeredStats),
      metrics: initial.metrics,
    }),
  );
  await assertLayoutRequestsDoNotRegister('initial document');
  await assertBackgroundPause();

  await evaluate(
    `(()=>{const reader=document.querySelector('.reader');if(reader)reader.style.scrollBehavior='auto';return true;})()`,
  );
  const layoutResults = [];
  for (const count of [1, 2, 4]) {
    await selectLayout('vertical');
    await selectColumns(count);
    await jump(10, 12);
    await assertBlackCenter(12, `vertical ${count} columns 10% jump`);
    await jump(80, 96);
    const far = await waitForRowWindow('vertical', count, `vertical ${count} columns`);
    assertResidentWindow(far, `vertical ${count} columns 80% jump`);
    assert.ok(far.pages.includes(96), `vertical ${count} columns 80% page 96 is not resident`);
    await waitFor(
      `vertical ${count} columns old page released`,
      `(()=>{const d=window.previewRenderDiagnostics?.(),canvas=document.querySelector('.page[data-page="1"] canvas');return !!d&&!d.window.includes(1)&&(!canvas||canvas.width===0);})()`,
      10_000,
    );
    assert.equal(
      await evaluate(`document.querySelector('.page[data-page="1"] canvas')?.width||0`),
      0,
      `vertical ${count} columns should release page 1`,
    );
    assertLimits(far, `vertical ${count} columns 80% jump`);
    await assertBlackCenter(96, `vertical ${count} columns 80% jump`);
    layoutResults.push({
      direction: 'vertical',
      columns: count,
      window: far.window.length,
      mountedPages: far.mountedPages,
      resident: far.pages.length,
      cacheEntries: far.cache.entries,
    });
  }
  await selectLayout('horizontal');
  const horizontalState = await jump(80, 96);
  assertResidentWindow(horizontalState, 'horizontal');
  assertLimits(horizontalState, 'horizontal');
  await assertBlackCenter(96, 'horizontal');
  const horizontalMenu = Menu.getApplicationMenu()?.getMenuItemById('columns-1');
  assert.ok(horizontalMenu, `missing pages-per-row menu`);
  assert.equal(horizontalMenu.enabled, false, 'horizontal layout should disable columns');
  assert.ok(
    await evaluate(
      `(()=>{const d=window.previewRenderDiagnostics?.(),pages=[...document.querySelectorAll('.page')];return d?.totalPages===${PAGE_COUNT}&&pages.length===d.mountedPages&&pages.every((page,index)=>index===0||page.getBoundingClientRect().left>pages[index-1].getBoundingClientRect().left);})()`,
    ),
    'horizontal layout should place mounted pages in one scrollable row',
  );
  await jump(10, 12);
  await assertBlackCenter(12, 'horizontal 10% jump');
  await jump(80, 96);
  const horizontal = await waitForRowWindow('horizontal', 1, 'horizontal');
  assertResidentWindow(horizontal, 'horizontal 80% jump');
  assert.ok(horizontal.pages.includes(96), 'horizontal 80% page 96 is not resident');
  await waitFor(
    'horizontal old page released',
    `(()=>{const d=window.previewRenderDiagnostics?.(),canvas=document.querySelector('.page[data-page="1"] canvas');return !!d&&!d.window.includes(1)&&(!canvas||canvas.width===0);})()`,
    10_000,
  );
  assert.equal(
    await evaluate(`document.querySelector('.page[data-page="1"] canvas')?.width||0`),
    0,
    'horizontal layout should release page 1',
  );
  assertLimits(horizontal, 'horizontal 80% jump');
  await assertBlackCenter(96, 'horizontal 80% jump');
  layoutResults.push({
    direction: 'horizontal',
    columns: 1,
    window: horizontal.window.length,
    mountedPages: horizontal.mountedPages,
    resident: horizontal.pages.length,
    cacheEntries: horizontal.cache.entries,
  });

  await waitFor('thumbnail list', `!!document.querySelector('.thumbnail-list')`, 10_000);
  await evaluate(
    `(()=>{const list=document.querySelector('.thumbnail-list');list.style.scrollBehavior='auto';list.scrollTop=list.scrollHeight;list.dispatchEvent(new Event('scroll',{bubbles:true}));return true;})()`,
  );
  await waitFor(
    'last thumbnail',
    `(()=>{const d=window.previewRenderDiagnostics?.(),canvas=document.querySelector('.thumb[aria-label="Go to page 120"] canvas');return !!d&&d.totalPages===${PAGE_COUNT}&&d.thumbnails.includes(${PAGE_COUNT})&&!!canvas&&canvas.width>0;})()`,
  );
  await assertDOMBound('last thumbnail');
  await evaluate(
    `(()=>{const list=document.querySelector('.thumbnail-list');list.scrollTop=0;list.dispatchEvent(new Event('scroll',{bubbles:true}));return true;})()`,
  );
  await waitFor(
    'first thumbnail after return',
    `(()=>{const d=window.previewRenderDiagnostics?.(),canvas=document.querySelector('.thumb[aria-label="Go to page 1"] canvas');return !!d&&d.thumbnails.includes(1)&&!!canvas&&canvas.width>0;})()`,
  );

  window.webContents.send('reader:action', 'close-document');
  await waitFor(
    'document close',
    `(()=>{const d=window.previewRenderDiagnostics?.();return !!document.querySelector('.empty')&&!!d&&d.totalPages===0&&d.mountedPages===0&&d.mountedThumbnails===0&&d.cache.bytes===0&&d.pages.length===0&&d.thumbnails.length===0;})()`,
    20_000,
  );
  const closed = await diagnostics();
  assert.equal(closed.cache.bytes, 0, 'close-document should clear bitmap cache bytes');
  assert.equal(closed.pages.length, 0, 'close-document should release page canvases');
  assert.equal(closed.thumbnails.length, 0, 'close-document should release thumbnail canvases');
  const beforeStressStats = await documentStats();
  assert.equal(
    beforeStressStats.activeBytes,
    0,
    'closed document should release active backend bytes',
  );

  console.log(`Performance smoke: generating ${STRESS_PAGE_COUNT}-page virtualization fixture`);
  const stressEncoded = await createFixture(STRESS_PAGE_COUNT);
  await importFixture(stressEncoded);
  await waitFor(
    '1000-page document ready',
    `(()=>{const d=window.previewRenderDiagnostics?.();return document.title==='TEST — Portrait and landscape.pdf'&&d?.totalPages===${STRESS_PAGE_COUNT}&&d?.opening===false&&d.mountedPages===d.window.length;})()`,
    STRESS_WAIT_MS,
  );
  await waitFor(
    '1000-page initial canvas',
    `(()=>{const canvas=document.querySelector('.page canvas');return !!canvas&&canvas.width>0&&canvas.height>0;})()`,
    STRESS_WAIT_MS,
  );
  await waitFor(
    '1000-page initial thumbnails',
    `(()=>{const d=window.previewRenderDiagnostics?.();return !!d&&d.mountedThumbnails>0&&d.mountedThumbnails<${STRESS_PAGE_COUNT};})()`,
    STRESS_WAIT_MS,
  );
  const stressInitial = await diagnostics();
  assert.equal(stressInitial.totalPages, STRESS_PAGE_COUNT, '1000-page diagnostics total is wrong');
  assert.ok(
    stressInitial.mountedPages < MAX_MOUNTED_PAGES,
    `1000-page render mounted ${stressInitial.mountedPages} pages`,
  );
  assertResidentWindow(stressInitial, '1000-page initial render');
  assertLimits(stressInitial, '1000-page initial render');
  await assertDOMBound('1000-page initial render');
  const stressStats = await documentStats();
  assert.equal(
    stressStats.uploads,
    beforeStressStats.uploads + 1,
    '1000-page fixture should create one additional registration',
  );
  console.log(
    'Performance smoke 1000-page baseline:',
    JSON.stringify({
      totalPages: stressInitial.totalPages,
      mountedPages: stressInitial.mountedPages,
      mountedThumbnails: stressInitial.mountedThumbnails,
      window: stressInitial.window.length,
      pageDOM: stressInitial.mountedPages,
      thumbnailDOM: stressInitial.mountedThumbnails,
      cache: stressInitial.cache,
      documents: statsValues(stressStats),
      metrics: stressInitial.metrics,
    }),
  );
  await selectLayout('vertical');
  await selectColumns(1);
  await assertContinuousStressPreview(Math.ceil(STRESS_PAGE_COUNT / 2), 50);
  await jump(100, STRESS_PAGE_COUNT);
  const stressTail = await waitForRowWindow(
    'vertical',
    1,
    '1000-page final row',
    STRESS_PAGE_COUNT,
  );
  assertResidentWindow(stressTail, '1000-page final row');
  assert.ok(stressTail.pages.includes(STRESS_PAGE_COUNT), '1000-page final page is not resident');
  await assertBlackCenter(STRESS_PAGE_COUNT, '1000-page final row');
  await assertLayoutRequestsDoNotRegister('1000-page document');

  window.webContents.send('reader:action', 'close-document');
  await waitFor(
    '1000-page document close',
    `(()=>{const d=window.previewRenderDiagnostics?.();return !!document.querySelector('.empty')&&!!d&&d.totalPages===0&&d.mountedPages===0&&d.mountedThumbnails===0&&d.cache.bytes===0&&d.pages.length===0&&d.thumbnails.length===0;})()`,
    20_000,
  );
  const finalStats = await documentStats();
  assert.equal(
    finalStats.activeBytes,
    0,
    'final document close should release active backend bytes',
  );
  const finalState = await diagnostics();
  assert.equal(finalState.cache.bytes, 0, 'final close should clear bitmap cache bytes');
  assert.equal(finalState.pages.length, 0, 'final close should release page canvases');
  assert.equal(finalState.thumbnails.length, 0, 'final close should release thumbnail canvases');
  console.log(
    'Performance smoke passed:',
    JSON.stringify({
      pages: PAGE_COUNT,
      stressPages: STRESS_PAGE_COUNT,
      initial: {
        window: initial.window.length,
        mountedPages: initial.mountedPages,
        mountedThumbnails: initial.mountedThumbnails,
      },
      layouts: layoutResults,
      sidebar: { lastThumbnail: true, returnedToFirst: true },
      documentStats: {
        uploads: finalStats.uploads,
        uploadBytes: finalStats.uploadBytes,
        activeBytes: finalStats.activeBytes,
      },
      closed: { cacheBytes: finalState.cache.bytes, pages: finalState.pages.length },
    }),
  );
  window.close();
}
