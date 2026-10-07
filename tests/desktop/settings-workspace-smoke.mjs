import assert from 'node:assert/strict';
import { app, shell } from 'electron';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
export async function verifySettingsWorkspace(window) {
  const evaluate = (code) =>
    window.webContents.executeJavaScript(code).catch((error) => {
      throw Error(`Settings script failed: ${code}`, { cause: error });
    });
  const wait = async (code) => {
    for (let n = 0; n < 200; n++) {
      if (await evaluate(code)) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw Error(
      'Settings workspace timed out: ' +
        code +
        ' ' +
        (await evaluate(
          `JSON.stringify({provider:!!document.querySelector('.provider-settings'),section:document.querySelector('.settings-workspace')?.dataset.section})`,
        )),
    );
  };
  await wait('window.previewReady===true');
  window.show();
  window.focus();
  await evaluate(`document.querySelector('button[aria-label="Translation settings"]').click()`);
  await wait(`!!document.querySelector('.settings-workspace')`);
  const category = async (id) => {
    await evaluate(`document.querySelector('[data-settings-category="${id}"]').click()`);
    await wait(`document.querySelector('.settings-workspace').dataset.section==='${id}'`);
  };
  const visible = (selector) =>
    evaluate(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)});return !!e&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0})()`,
    );
  const searchSettings = async (text) => {
    await evaluate(
      `(()=>{const input=document.querySelector('.settings-workspace input[type="search"]');input.value=${JSON.stringify(text)};input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
  };
  await searchSettings('Reduce motion');
  await wait(`!!document.querySelector('[data-settings-result="performance"]')`);
  await evaluate(`document.querySelector('[data-settings-result="performance"]').click()`);
  await wait(`document.querySelector('.settings-workspace').dataset.section==='performance'`);
  assert.equal(await visible('[aria-labelledby="reduce-motion-label"]'), true);
  assert.equal(
    await evaluate(`document.activeElement.getAttribute('aria-labelledby')`),
    'reduce-motion-label',
  );
  await searchSettings('');
  await category('general');
  assert.equal(await visible('[data-setting="restore-documents"]'), true);
  assert.equal(await visible('.appearance-section'), false);
  await evaluate(`document.querySelector('[aria-labelledby="restore-documents-label"]').click()`);
  await wait(`(async()=> (await window.previewPreferences.load()).restoreDocuments===false)()`);
  await category('performance');
  assert.equal(await visible('[data-setting="reduce-resource-usage"]'), true);
  for (const id of ['reduce-motion', 'reduce-transparency', 'reduce-padding'])
    assert.equal(await visible(`[aria-labelledby="${id}-label"]`), true);
  assert.equal(await visible('.performance-cache'), true);
  assert.equal(
    await evaluate(
      `!!document.querySelector('.performance-resources [data-setting="cache-size-limit"]')`,
    ),
    false,
    'cache controls have their own section',
  );
  assert.equal(await visible('[data-setting="open-cache-folder"]'), true);
  const originalOpenPath = shell.openPath;
  let openedPath;
  shell.openPath = async (path) => {
    openedPath = path;
    return '';
  };
  try {
    await evaluate(`document.querySelector('[data-setting="open-cache-folder"]').click()`);
    for (let n = 0; n < 100 && !openedPath; n++)
      await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(openedPath, join(app.getPath('userData'), 'translations'));
  } finally {
    shell.openPath = originalOpenPath;
  }
  await new Promise((resolve) => setTimeout(resolve, 250));
  await writeFile(
    '/tmp/pdfmathreader-settings-performance.png',
    (await window.webContents.capturePage()).toPNG(),
  );
  await category('appearance');
  assert.equal(await visible('.appearance-section'), true);
  assert.equal(await visible('[data-setting="reduce-resource-usage"]'), false);
  assert.equal(await visible('[aria-labelledby="reduce-motion-label"]'), false);
  await category('general');
  assert.equal(await visible('[data-setting="reduce-resource-usage"]'), false);
  if (process.argv.includes('--performance-settings-only')) {
    console.log(
      'Performance settings passed: category navigation, resource and effects controls, removed from General and Appearance.',
    );
    app.quit();
    return;
  }
  await category('translation');
  assert.equal(await visible('[data-setting="reuse-translations"]'), true);
  await evaluate(`document.querySelector('[aria-labelledby="reuse-translations-label"]').click()`);
  await wait(`(async()=> (await window.previewPreferences.load()).reuseTranslations===false)()`);
  await category('kernel');
  assert.equal(await visible('.mac-mode-control'), true);
  assert.equal(await evaluate(`!!document.querySelector('.kernel-navigation')`), false);
  assert.equal(await visible('.advanced-settings'), true);
  assert.equal(await evaluate(`document.querySelector('.advanced-settings').tagName`), 'SECTION');
  assert.equal(
    await evaluate(`document.querySelectorAll('.kernel-mode-switcher [role=radio]').length`),
    3,
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  await category('providers');
  await wait(
    `!!document.querySelector('.provider-settings')&&!document.querySelector('.provider-settings [aria-busy="true"]')`,
  );
  await wait(`!!document.querySelector('[data-provider-id]')`);
  const shellColumns = await evaluate(
    `(()=>{const sidebar=document.querySelector('.settings-categories').getBoundingClientRect(),main=document.querySelector('.settings-main').getBoundingClientRect();return sidebar.right<=main.left+1})()`,
  );
  assert.equal(shellColumns, true, 'categories and content sit beside each other');
  const columns = await evaluate(
    `(()=>{const s=document.querySelector('.settings-workspace').getBoundingClientRect(),list=document.querySelector('.provider-list').getBoundingClientRect(),detail=document.querySelector('.provider-detail').getBoundingClientRect();return {sidebar:s.x,list:list.x,detail:detail.x,width:s.width}})()`,
  );
  assert(
    columns.sidebar < columns.list && columns.list < columns.detail,
    'category, provider, detail columns are ordered',
  );
  await searchSettings('OpenAI');
  await wait(`!!document.querySelector('[data-settings-result="providers"]')`);
  await evaluate(`document.querySelector('[data-settings-result="providers"]').click()`);
  await wait(
    `document.querySelector('[data-provider-id="openai"]').getAttribute('aria-selected')==='true'`,
  );
  await searchSettings('');
  await evaluate(`document.querySelector('[data-provider-id="openai"]').click()`);
  await wait(`!!document.querySelector('input[aria-labelledby="provider-field-model"]')`);
  assert.equal(
    (await evaluate('window.previewPreferences.load()')).translationServices.pdf_inspector.id,
    'auto',
    'browsing does not activate a provider',
  );
  await evaluate(
    `(()=>{const e=document.querySelector('input[aria-labelledby="provider-field-model"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'settings-smoke-model');e.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await wait(
    `(async()=> (await window.previewPreferences.load()).translationServices.pdf_inspector.profiles.openai.values.model==='settings-smoke-model')()`,
  );
  assert.equal(
    (await evaluate('window.previewPreferences.load()')).translationServices.pdf_inspector.id,
    'auto',
    'editing a profile preserves active provider',
  );
  const minimal = await evaluate(
    `(()=>{const panel=document.querySelector('.provider-detail').getBoundingClientRect(),button=document.querySelector('.provider-detail-actions button').getBoundingClientRect();return {titles:!!document.querySelector('.workspace-title,.provider-browser-heading,.provider-detail-heading,.provider-browse-hint'),right:panel.right-button.right,bottom:panel.bottom-button.bottom}})()`,
  );
  assert.equal(minimal.titles, false);
  assert(minimal.right < 30 && minimal.bottom < 30, 'activation button sits at lower right');
  await writeFile(
    '/tmp/pdfmathreader-settings-provider-minimal.png',
    (await window.webContents.capturePage()).toPNG(),
  );
  await evaluate(`document.querySelector('.provider-detail-actions button').click()`);
  await wait(
    `(async()=> (await window.previewPreferences.load()).translationServices.pdf_inspector.id==='openai')()`,
  );
  await new Promise((resolve) => setTimeout(resolve, 250));
  await writeFile(
    '/tmp/pdfmathreader-settings-providers.png',
    (await window.webContents.capturePage()).toPNG(),
  );
  window.setSize(720, 740);
  await new Promise((resolve) => setTimeout(resolve, 250));
  const fits = await evaluate(
    `(()=>{const r=document.querySelector('.settings-workspace').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight})()`,
  );
  assert.equal(fits, true, 'settings fit a narrower window');
  await writeFile(
    '/tmp/pdfmathreader-settings-narrow.png',
    (await window.webContents.capturePage()).toPNG(),
  );
  window.setSize(1200, 900);
  await new Promise((resolve) => setTimeout(resolve, 250));
  await category('general');
  await writeFile(
    '/tmp/pdfmathreader-settings-general.png',
    (await window.webContents.capturePage()).toPNG(),
  );
  assert.equal(await evaluate(`!!document.querySelector('.legacy-settings-button')`), false);
  await wait(
    `document.querySelector('.effective-translation-summary')?.textContent.includes('Inspector · OpenAI compatible · ')`,
  );
  await evaluate(`document.querySelector('.workspace-actions button').click()`);
  await wait(`!document.querySelector('.settings-workspace')`);
  await new Promise((resolve) => {
    window.webContents.once('did-finish-load', resolve);
    window.webContents.reload();
  });
  await wait('window.previewReady===true');
  const saved = await evaluate('window.previewPreferences.load()');
  assert.equal(saved.restoreDocuments, false);
  assert.equal(saved.reuseTranslations, false);
  assert.equal(saved.translationServices.pdf_inspector.id, 'openai');
  assert.equal(
    saved.translationServices.pdf_inspector.profiles.openai.values.model,
    'settings-smoke-model',
  );
  await evaluate(`document.querySelector('button[aria-label="Translation settings"]').click()`);
  await wait(`!!document.querySelector('.settings-workspace')`);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' });
  await wait(`!document.querySelector('.settings-workspace')`);
  console.log(
    'Settings workspace passed: two and three columns, category visibility, shared saved preferences, legacy switch, reload and Escape.',
  );
  app.quit();
}

export async function verifyProviderHistory(window, createWindow) {
  const evaluate = (target, code) => target.webContents.executeJavaScript(code);
  const wait = async (target, code) => {
    for (let n = 0; n < 150; n++) {
      if (await evaluate(target, code)) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw Error('Provider history timed out: ' + code);
  };
  await wait(window, 'window.previewReady===true');
  const settings = await createWindow(null, null, window, 'providers');
  await wait(
    settings,
    'window.previewReady===true&&!!document.querySelector("[data-provider-id=auto]")',
  );
  const group = () =>
    evaluate(
      settings,
      `document.querySelector('[data-provider-id="auto"]').closest('[data-provider-group]').dataset.providerGroup`,
    );
  assert.equal(await group(), 'configured');
  await evaluate(
    window,
    `window.previewPreferences.save({translationServiceHistory:{pdf_inspector:{auto:{status:'error',updatedAt:100}}}})`,
  );
  await wait(
    settings,
    `document.querySelector('[data-provider-id="auto"]').closest('[data-provider-group]').dataset.providerGroup==='error'`,
  );
  await evaluate(
    window,
    `window.previewPreferences.save({translationServiceHistory:{pdf_inspector:{auto:{status:'success',updatedAt:101}}}})`,
  );
  await wait(
    settings,
    `document.querySelector('[data-provider-id="auto"]').closest('[data-provider-group]').dataset.providerGroup==='configured'`,
  );
  await evaluate(
    window,
    `window.previewPreferences.save({translationServiceHistory:{pdf_inspector:{auto:{status:'error',updatedAt:99}}}})`,
  );
  assert.equal(await group(), 'configured');
  await evaluate(
    window,
    `window.previewPreferences.save({translationServiceHistory:{pdf_inspector:{auto:{status:'error',updatedAt:102}}}})`,
  );
  await wait(
    settings,
    `document.querySelector('[data-provider-id="auto"]').closest('[data-provider-group]').dataset.providerGroup==='error'`,
  );
  await new Promise((resolve) => {
    settings.webContents.once('did-finish-load', resolve);
    settings.webContents.reload();
  });
  await wait(
    settings,
    'window.previewReady===true&&!!document.querySelector("[data-provider-id=auto]")',
  );
  assert.equal(await group(), 'error');
  await evaluate(
    window,
    `window.previewPreferences.save({translationServiceHistory:{pdf_inspector:{auto:null}}})`,
  );
  await wait(
    settings,
    `document.querySelector('[data-provider-id="auto"]').closest('[data-provider-group]').dataset.providerGroup==='configured'`,
  );
  console.log(
    'Provider history IPC passed: cross-window groups, newer results, reload persistence and reset.',
  );
  app.quit();
}
