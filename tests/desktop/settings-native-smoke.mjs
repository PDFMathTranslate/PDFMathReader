import assert from 'node:assert/strict';
import { app, systemPreferences } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
export async function verifyNativeSettings(reader, windows) {
  const waitNative = async (predicate) => {
    for (let n = 0; n < 120; n++) {
      if (predicate()) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw Error('Native window state timed out');
  };
  const evaluate = (window, code) => window.webContents.executeJavaScript(code);
  const wait = async (window, code) => {
    for (let n = 0; n < 240; n++) {
      if (await evaluate(window, code)) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw Error('Native settings timed out: ' + code);
  };
  await wait(reader, 'window.previewReady===true');
  await evaluate(reader, `document.querySelector('[aria-label="Translation settings"]').click()`);
  for (let n = 0; n < 240 && windows.size < 2; n++)
    await new Promise((resolve) => setTimeout(resolve, 50));
  const settings = [...windows.keys()].find(
    (window) => windows.get(window).settingsOwner === reader,
  );
  assert(settings, 'settings has its own native window');
  await wait(
    settings,
    `window.previewReady===true&&!!document.querySelector('.settings-workspace')`,
  );
  assert.equal(settings.getParentWindow(), reader);
  assert.equal(
    windows.get(settings).backend,
    windows.get(reader).backend,
    'settings shares owner backend',
  );
  assert.equal(
    await evaluate(reader, `!!document.querySelector('.settings-workspace')`),
    false,
    'reader remains free of settings overlays',
  );
  assert.equal(
    await evaluate(settings, `!!document.querySelector('.toolbar')`),
    false,
    'dedicated window has no reader toolbar',
  );
  await new Promise((resolve) => setTimeout(resolve, 250));
  const geometry = await evaluate(
    settings,
    `(()=>{const e=document.querySelector('.settings-workspace'),r=e.getBoundingClientRect();return {left:r.left,top:r.top,width:r.width,height:r.height,screenWidth:innerWidth,screenHeight:innerHeight,drag:getComputedStyle(document.querySelector('.settings-categories')).webkitAppRegion,click:getComputedStyle(document.querySelector('.category-button')).webkitAppRegion}})()`,
  );
  assert.equal(geometry.left, 0);
  assert.equal(geometry.top, 0);
  assert.equal(geometry.width, geometry.screenWidth);
  assert.equal(geometry.height, geometry.screenHeight);
  assert.equal(geometry.drag, 'drag');
  assert.equal(geometry.click, 'no-drag');
  const generalSpacing = await evaluate(
    settings,
    `[...document.querySelectorAll('.workspace-page .settings-section-body')].filter(card=>card.getBoundingClientRect().height>0&&[...card.children].every(e=>e.classList.contains('setting-row'))).map(card=>({gap:getComputedStyle(card).rowGap,rows:[...card.children].map(row=>{const r=row.getBoundingClientRect(),label=row.querySelector('span').getBoundingClientRect();return {top:getComputedStyle(row).paddingTop,bottom:getComputedStyle(row).paddingBottom,center:Math.abs((r.top+r.bottom-label.top-label.bottom)/2)}})}))`,
  );
  assert(generalSpacing.length >= 2);
  for (const card of generalSpacing) {
    assert.equal(card.gap, '0px');
    for (const row of card.rows) {
      assert.equal(row.top, row.bottom);
      assert(row.center < 1, 'general settings labels center between separators');
    }
  }
  await writeFile(
    '/tmp/pdfmathreader-general-symmetric-spacing.png',
    (await settings.webContents.capturePage()).toPNG(),
  );
  await evaluate(
    settings,
    `document.querySelector('[data-settings-category="appearance"]').click();document.activeElement?.blur()`,
  );
  await new Promise((resolve) => setTimeout(resolve, 300));
  const appearanceTitle = await evaluate(
    settings,
    `(()=>{const title=document.querySelector('.appearance-section > h3'),card=document.querySelector('.appearance-section > .settings-section-body');return title.getBoundingClientRect().bottom<=card.getBoundingClientRect().top&&getComputedStyle(title.parentElement).backgroundColor==='rgba(0, 0, 0, 0)'})()`,
  );
  assert.equal(appearanceTitle, true, 'section title sits above the gray card');
  const cardEdges = await evaluate(
    settings,
    `['.appearance-section','.interface-section'].map(selector=>{const r=document.querySelector(selector+' > .settings-section-body').getBoundingClientRect();return {left:r.left,right:r.right}})`,
  );
  assert(
    Math.abs(cardEdges[0].left - cardEdges[1].left) < 1 &&
      Math.abs(cardEdges[0].right - cardEdges[1].right) < 1,
    'appearance cards share both horizontal edges',
  );
  const previousSize = settings.getSize();
  settings.setSize(720, 740);
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(
    await evaluate(
      settings,
      `(()=>{const page=document.querySelector('.workspace-page:not([style*="display: none"])');return page.scrollWidth<=page.clientWidth+1})()`,
    ),
    true,
    'appearance fits a narrow settings window',
  );
  settings.setSize(...previousSize);
  await new Promise((resolve) => setTimeout(resolve, 150));
  const dropdownAlignment = await evaluate(
    settings,
    `(()=>{const button=document.querySelector('.appearance-row .macvue-pop-up-button'),row=button.closest('.appearance-row');return Math.abs(row.getBoundingClientRect().right-button.getBoundingClientRect().right)<2})()`,
  );
  assert.equal(dropdownAlignment, true, 'appearance dropdown aligns to the right like switches');
  const interfaceSpacing = await evaluate(
    settings,
    `(()=>{const row=document.querySelector('.interface-section .appearance-row'),card=row.closest('.settings-section-body'),r=row.getBoundingClientRect(),c=card.getBoundingClientRect();return {top:r.top-c.top,bottom:c.bottom-r.bottom,height:r.height}})()`,
  );
  assert(
    Math.abs(interfaceSpacing.top - interfaceSpacing.bottom) < 2,
    'language row has balanced top and bottom spacing',
  );
  assert(interfaceSpacing.height <= 42, 'language row remains compact');
  await evaluate(
    settings,
    `document.querySelector('[data-settings-category="translation"]').click()`,
  );
  await wait(settings, `!!document.querySelector('#settings-translation-parallel')`);
  const translationAlignment = await evaluate(
    settings,
    `(()=>{const card=document.querySelector('#settings-translation-behavior').nextElementSibling,mode=card.querySelector('.kernel-setting'),parallel=document.querySelector('#settings-translation-parallel').nextElementSibling,controls=parallel.querySelector('.parallel-settings');return {modeGap:card.getBoundingClientRect().right-mode.getBoundingClientRect().right,parallelGap:parallel.getBoundingClientRect().right-controls.getBoundingClientRect().right}})()`,
  );
  assert(translationAlignment.modeGap < 20, 'translation mode fills card width');
  assert(translationAlignment.parallelGap < 20, 'parallel controls fill card width');
  const alignedMode = await evaluate(
    settings,
    `(()=>{const card=document.querySelector('#settings-translation-behavior').nextElementSibling,button=card.querySelector('.translation-mode-select .macvue-pop-up-button')||card.querySelector('.translation-mode-select'),toggle=card.querySelector('[aria-labelledby="reuse-translations-label"]'),parallel=document.querySelector('#settings-translation-parallel').nextElementSibling.querySelector('.parallel-settings');return {delta:Math.abs(button.getBoundingClientRect().right-toggle.getBoundingClientRect().right),border:getComputedStyle(parallel).borderTopWidth}})()`,
  );
  assert(alignedMode.delta < 2, 'translation mode button aligns with switch right edge');
  assert.equal(alignedMode.border, '0px', 'no divider above first parallel row');

  const cacheFixtureRoot = join(app.getPath('userData'), 'translations'),
    cacheFixtureNames = {};
  for (let n = 1; n <= 6; n++) {
    const id = n.toString(16).repeat(64);
    cacheFixtureNames[id] = { name: 'Cache fixture ' + n + '.pdf' };
    await mkdir(join(cacheFixtureRoot, 'documents', id), { recursive: true });
    await writeFile(join(cacheFixtureRoot, 'documents', id, 'result.pdf'), Buffer.alloc(n * 1024));
  }
  await mkdir(join(cacheFixtureRoot, '.cache-management'), { recursive: true });
  await writeFile(
    join(cacheFixtureRoot, '.cache-management', 'document-index.json'),
    JSON.stringify({ version: 1, documents: cacheFixtureNames }),
  );
  await evaluate(
    settings,
    `document.querySelector('[data-settings-category="performance"]').click()`,
  );
  await new Promise((resolve) => setTimeout(resolve, 200));
  await wait(settings, `!!document.querySelector('.performance-resources')`);
  assert.equal(
    await evaluate(settings, `!!document.querySelector('#settings-resources .resources-icon')`),
    false,
  );
  await wait(settings, `document.querySelectorAll('.document-cache-row').length===5`);
  assert.equal(
    await evaluate(settings, `document.querySelector('.document-cache-name').textContent`),
    'Cache fixture 6.pdf',
  );
  await evaluate(settings, `document.querySelector('.document-cache-row button').click()`);
  await wait(
    settings,
    `document.querySelector('.document-cache-name').textContent==='Cache fixture 5.pdf'`,
  );
  assert.equal(
    await evaluate(settings, `document.querySelectorAll('.document-cache-row').length`),
    5,
  );

  assert.equal(settings.webContents.getBackgroundThrottling(), true);
  await evaluate(
    settings,
    `document.querySelector('[aria-labelledby="reduce-background-frame-rate-label"]').click()`,
  );
  await wait(
    settings,
    `window.previewPreferences.load().then(p=>p.reduceBackgroundFrameRate===false)`,
  );
  assert.equal(settings.webContents.getBackgroundThrottling(), false);
  assert.equal(reader.webContents.getBackgroundThrottling(), false);
  await evaluate(
    settings,
    `document.querySelector('[aria-labelledby="reduce-background-frame-rate-label"]').click()`,
  );
  await wait(
    settings,
    `window.previewPreferences.load().then(p=>p.reduceBackgroundFrameRate===true)`,
  );
  assert.equal(settings.webContents.getBackgroundThrottling(), true);
  assert.equal(reader.webContents.getBackgroundThrottling(), true);

  await evaluate(
    settings,
    `document.querySelector('[data-setting="cache-size-limit"] .macvue-pop-up-button').focus()`,
  );
  settings.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Space' });
  settings.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Space' });
  await wait(
    settings,
    `[...document.querySelectorAll('.macvue-pop-up-button-item')].some(e=>e.textContent.trim()==='512 MB')`,
  );
  const cacheChoices = await evaluate(
    settings,
    `[...document.querySelectorAll('.macvue-pop-up-button-item')].filter(e=>e.getBoundingClientRect().height>0).map(e=>e.textContent.trim())`,
  );
  assert.deepEqual(cacheChoices, ['512 MB', '1 GB', '2 GB', '5 GB', '10 GB', 'Unlimited']);
  const cachePoint = await evaluate(
    settings,
    `(()=>{const r=[...document.querySelectorAll('.macvue-pop-up-button-item')].find(e=>e.textContent.trim()==='512 MB').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`,
  );
  settings.webContents.sendInputEvent({ type: 'mouseMove', ...cachePoint });
  await new Promise((resolve) => setTimeout(resolve, 100));
  settings.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', ...cachePoint });
  settings.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', ...cachePoint });
  try {
    await wait(
      settings,
      `(async()=> (await window.previewPreferences.load()).cacheLimitMB===512)()`,
    );
  } catch (error) {
    throw Error(
      error.message +
        ' ' +
        (await evaluate(
          settings,
          `(async()=>JSON.stringify({notice:document.querySelector('.performance-resources [role=status]')?.textContent,button:document.querySelector('[data-setting="cache-size-limit"]')?.textContent,cache:await (await fetch('/api/cache')).json()}))()`,
        )),
    );
  }
  assert.equal(
    await evaluate(reader, `(async()=> (await (await fetch('/api/cache')).json()).limitMB)()`),
    512,
    'owner backend follows cache limit preference',
  );
  await evaluate(settings, `document.querySelector('.cache-actions button').click()`);
  await wait(
    settings,
    `document.querySelector('.performance-resources [role=status]')?.textContent==='Cache cleared'`,
  );
  await writeFile(
    '/tmp/pdfmathreader-performance-cache.png',
    (await settings.webContents.capturePage()).toPNG(),
  );
  const effectsMetrics = await evaluate(
    settings,
    `[...document.querySelectorAll('.effects-section .setting-row')].map(row=>{const r=row.getBoundingClientRect(),track=row.querySelector('.macvue-switch-control').getBoundingClientRect(),style=getComputedStyle(row);return {width:track.width,height:track.height,top:style.paddingTop,bottom:style.paddingBottom,center:Math.abs((r.top+r.bottom-track.top-track.bottom)/2)}})`,
  );
  assert.equal(effectsMetrics.length, 3);
  for (const metric of effectsMetrics) {
    assert.equal(metric.width, 54);
    assert.equal(metric.height, 24);
    assert.equal(metric.top, metric.bottom);
    assert(metric.center < 1, 'switch vertically centers in its row');
  }
  await writeFile(
    '/tmp/pdfmathreader-settings-effects-spacing.png',
    (await settings.webContents.capturePage()).toPNG(),
  );
  await evaluate(
    settings,
    `document.querySelector('[data-settings-category="appearance"]').click()`,
  );
  await writeFile(
    '/tmp/pdfmathreader-settings-appearance.png',
    (await settings.webContents.capturePage()).toPNG(),
  );
  if (
    process.platform === 'darwin' &&
    systemPreferences.getMediaAccessStatus('screen') === 'granted'
  ) {
    try {
      await promisify(execFile)('/usr/sbin/screencapture', [
        '-x',
        '-l',
        settings.getMediaSourceId().split(':')[1],
        '/tmp/pdfmathreader-settings-appearance-window.png',
      ]);
    } catch {}
  }
  settings.setSize(680, 780);
  await new Promise((resolve) => setTimeout(resolve, 300));
  const narrow = await evaluate(
    settings,
    `(()=>{const page=document.querySelector('.workspace-page:not([style*="display: none"])');const shell=document.querySelector('.settings-workspace').getBoundingClientRect();return {fits:page.scrollWidth<=page.clientWidth+1,left:shell.left,right:shell.right,width:innerWidth}})()`,
  );
  assert.equal(narrow.fits, true, 'appearance controls fit a narrow settings window');
  assert.equal(narrow.left, 0);
  assert.equal(narrow.right, narrow.width);
  await writeFile(
    '/tmp/pdfmathreader-settings-appearance-narrow.png',
    (await settings.webContents.capturePage()).toPNG(),
  );
  settings.setSize(920, 780);
  await new Promise((resolve) => setTimeout(resolve, 300));
  await evaluate(settings, `document.querySelector('[data-settings-category="general"]').click()`);
  await evaluate(
    settings,
    `document.querySelector('[aria-labelledby="restore-documents-label"]').click()`,
  );
  await wait(
    reader,
    `(async()=> (await window.previewPreferences.load()).restoreDocuments===false)()`,
  );
  await evaluate(
    settings,
    `document.querySelector('[data-settings-category="providers"]').click()`,
  );
  await wait(settings, `!!document.querySelector('[data-provider-id="openai"]')`);
  await evaluate(settings, `document.querySelector('[data-provider-id="openai"]').click()`);
  await evaluate(settings, `document.activeElement?.blur()`);
  await new Promise((resolve) => setTimeout(resolve, 350));
  const minimal = await evaluate(
    settings,
    `(()=>{const panel=document.querySelector('.provider-detail').getBoundingClientRect(),button=document.querySelector('.provider-detail-actions button').getBoundingClientRect();return {titles:!!document.querySelector('.workspace-title,.workspace-heading,.provider-browser-heading,.provider-detail-heading,.provider-browse-hint'),right:panel.right-button.right,bottom:panel.bottom-button.bottom}})()`,
  );
  assert.equal(minimal.titles, false);
  assert(minimal.right < 30 && minimal.bottom < 30, 'native activation button sits at lower right');
  await writeFile(
    '/tmp/pdfmathreader-native-settings.png',
    (await settings.webContents.capturePage()).toPNG(),
  );
  if (
    process.platform === 'darwin' &&
    systemPreferences.getMediaAccessStatus('screen') === 'granted'
  ) {
    try {
      await promisify(execFile)('/usr/sbin/screencapture', [
        '-x',
        '-l',
        settings.getMediaSourceId().split(':')[1],
        '/tmp/pdfmathreader-native-settings-window.png',
      ]);
      console.log('Captured native window frame.');
    } catch {}
  }
  await evaluate(
    settings,
    `document.querySelector('[data-settings-category="providers"]').click()`,
  );
  await wait(settings, `!!document.querySelector('[data-provider-id="apple-local"]')`);
  assert.equal(
    await evaluate(settings, `!!document.querySelector('[data-provider-group="error"]')`),
    false,
    'empty error group is hidden',
  );
  assert.equal(
    await evaluate(
      settings,
      `document.querySelector('[data-provider-id="siliconflow-free"]').closest('[data-provider-group]').dataset.providerGroup`,
    ),
    'configured',
  );
  await evaluate(
    settings,
    `document.querySelector('[data-provider-id="siliconflow-free"]').click()`,
  );
  await wait(
    settings,
    `!!document.querySelector('.provider-free-thanks a[href="https://siliconflow.cn/"]')`,
  );
  assert.equal(
    await evaluate(settings, `document.querySelector('.provider-no-configuration')?.textContent`),
    'This service is ready to use without configuration.',
  );
  const providerNames = await evaluate(
    settings,
    `[...document.querySelectorAll('.provider-list-name')].map(e=>({text:e.textContent,width:e.clientWidth,scroll:e.scrollWidth,overflow:getComputedStyle(e).textOverflow}))`,
  );
  assert(
    providerNames.every((e) => e.scroll <= e.width + 1 && e.overflow !== 'ellipsis'),
    'provider names are fully displayed',
  );
  await writeFile(
    '/tmp/pdfmathreader-provider-auto-width.png',
    (await settings.webContents.capturePage()).toPNG(),
  );
  await evaluate(reader, `window.previewWindow.settings('kernel')`);
  assert.equal(windows.size, 2, 'reopening reuses one settings window');
  await wait(settings, `document.querySelector('.settings-workspace').dataset.section==='kernel'`);
  await wait(settings, `!!document.querySelector('.kernel-mode-switcher')`);
  assert.equal(
    await evaluate(settings, `!!document.querySelector('.kernel-navigation')`),
    false,
    'kernel page has no third navigation column',
  );
  assert.equal(
    await evaluate(
      settings,
      `document.querySelectorAll('.kernel-mode-switcher [role=radio]').length`,
    ),
    3,
  );
  await wait(
    settings,
    `document.querySelector('.workspace-page .advanced-settings')?.tagName==='SECTION'`,
  );
  const advancedTitle = await evaluate(
    settings,
    `(()=>{const section=document.querySelector('.advanced-settings'),title=section.querySelector('h3'),card=section.querySelector('.advanced-options');return title.getBoundingClientRect().bottom<=card.getBoundingClientRect().top&&getComputedStyle(section).backgroundColor==='rgba(0, 0, 0, 0)'})()`,
  );
  assert.equal(advancedTitle, true, 'mode settings are expanded below their section title');
  await new Promise((resolve) => setTimeout(resolve, 150));
  await writeFile(
    '/tmp/pdfmathreader-settings-kernel-sections.png',
    (await settings.webContents.capturePage()).toPNG(),
  );
  await evaluate(
    settings,
    `window.previewPreferences.save({engine:'pdf_math_fast',translationMode:'full'})`,
  );
  await wait(
    reader,
    `(async()=> {const p=await window.previewPreferences.load();return p.engine==='pdf_math_fast'&&p.translationMode==='full'})()`,
  );
  await evaluate(settings, `window.previewWindow.minimize()`);
  await waitNative(() => settings.isMinimized());
  assert.equal(settings.isMinimized(), true);
  settings.restore();
  await waitNative(() => !settings.isMinimized());
  await evaluate(settings, `window.previewWindow.maximize()`);
  await waitNative(() => settings.isMaximized());
  assert.equal(settings.isMaximized(), true);
  await evaluate(settings, `window.previewWindow.maximize()`);
  await evaluate(settings, `window.previewWindow.close()`);
  for (let n = 0; n < 240 && !settings.isDestroyed(); n++)
    await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(settings.isDestroyed(), true);
  assert.equal(reader.isDestroyed(), false);
  assert.equal(windows.size, 1);
  await evaluate(reader, `window.previewWindow.settings('general')`);
  const reopened = [...windows.keys()].find(
    (window) => windows.get(window).settingsOwner === reader,
  );
  assert(reopened);
  await wait(reopened, 'window.previewReady===true');
  console.log(
    'Native settings passed: independent reusable window, shared backend, full-window layout, sidebar drag regions, live preferences, minimize/maximize/close, reader survives and settings reopens.',
  );
  app.quit();
}
