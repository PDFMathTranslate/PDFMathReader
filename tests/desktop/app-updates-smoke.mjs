import assert from 'node:assert/strict';
import { app } from 'electron';
import { writeFile } from 'node:fs/promises';
let calls = 0;
export async function updateFetchFixture() {
  calls++;
  if (calls === 1) return new Response('', { status: 404 });
  if (calls === 2)
    return new Response(
      JSON.stringify({
        tag_name: 'v9.0.0',
        html_url: 'https://github.com/PDFMathTranslate/PDFMathReader/releases/tag/v9.0.0',
        draft: false,
        prerelease: false,
        assets: [],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  return new Response('', { status: 429 });
}
export async function verifyAppUpdates(reader, createWindow) {
  const run = (window, code) => window.webContents.executeJavaScript(code);
  const wait = async (window, code) => {
    for (let n = 0; n < 200; n++) {
      if (await run(window, code)) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw Error('App updates timeout: ' + code);
  };
  await wait(reader, 'window.previewReady');
  const settings = await createWindow(null, null, reader, 'about');
  settings.show();
  settings.focus();
  await wait(settings, `!!document.querySelector('.app-update-status')`);
  assert.equal(calls, 0, 'opening About must not trigger a request');
  assert.equal(
    await run(settings, `!!document.querySelector('.update-meta-row,time')`),
    false,
    'last check time is hidden',
  );
  assert.equal(
    await run(settings, `document.querySelectorAll('.update-status-side button').length`),
    1,
  );
  assert.equal(
    await run(settings, `!!document.querySelector('.update-status-value')`),
    false,
    'status and check action use one control',
  );
  await run(settings, `window.previewUpdates.setAutomatic(true)`);
  await wait(
    settings,
    `document.querySelector('.app-update-status [aria-labelledby=app-update-automatic-label]')?.getAttribute('data-state')==='checked'`,
  );
  await run(
    settings,
    `document.querySelector('.app-update-status [aria-labelledby=app-update-automatic-label]').click()`,
  );
  await wait(settings, `(async()=> !(await window.previewUpdates.status()).automatic)()`);
  assert.equal(
    await run(reader, `(async()=> (await window.previewUpdates.status()).automatic===false)()`),
    true,
  );
  await run(
    settings,
    `document.querySelector('.app-update-status [data-setting="app-update-action"]').click()`,
  );
  await wait(
    settings,
    `document.querySelector('.app-update-status')?.dataset.status==='no-release'`,
  );
  assert.equal(
    await run(settings, `(async()=> (await window.previewUpdates.status()).status)()`),
    'no-release',
  );
  await run(
    settings,
    `document.querySelector('.app-update-status [data-setting="app-update-action"]').click()`,
  );
  await wait(
    settings,
    `document.querySelector('.app-update-status [data-setting=app-update-action]')?.title.includes('9.0.0')`,
  );
  assert.equal(
    await run(
      settings,
      `document.querySelector('[data-version=app]').parentElement.nextElementSibling.classList.contains('app-update-status')`,
    ),
    true,
    'updates are directly below app version',
  );
  settings.setSize(680, 780);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(
    await run(
      settings,
      `(()=>{const page=document.querySelector('.app-update-status').closest('.workspace-page');return page.scrollWidth<=page.clientWidth+1})()`,
    ),
    true,
    'narrow About layout fits',
  );
  await run(reader, `window.previewPreferences.save({autoCheckUpdates:true})`);
  await wait(settings, `(async()=> (await window.previewUpdates.status()).automatic)()`);
  await wait(
    settings,
    `document.querySelector('.app-update-status [aria-labelledby=app-update-automatic-label]')?.getAttribute('data-state')==='checked'`,
  );
  await run(settings, `window.previewUpdates.check()`);
  await wait(settings, `(async()=> (await window.previewUpdates.status()).error==='rate-limit')()`);
  await wait(settings, `document.querySelector('.app-update-status')?.dataset.status==='error'`);
  await new Promise((resolve) => setTimeout(resolve, 100));
  await writeFile(
    '/tmp/pdfmathreader-app-updates.png',
    (await settings.webContents.capturePage()).toPNG(),
  );
  console.log(
    'App updates smoke passed: lazy About, no release, available update, rate limit, persisted switch and shared state.',
  );
  app.quit();
}
