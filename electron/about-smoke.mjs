import { app } from 'electron';
import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
export async function verifyAbout(reader, createWindow) {
  const evaluate = (target, code) => target.webContents.executeJavaScript(code);
  const wait = async (target, code) => {
    for (let n = 0; n < 400; n++) {
      if (await evaluate(target, code)) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw Error('About timed out: ' + code);
  };
  await wait(reader, 'window.previewReady===true');
  const metadata = JSON.parse(
    await readFile(new URL('../dist/build-info.json', import.meta.url), 'utf8'),
  );
  const settings = await createWindow(null, null, reader, 'about');
  settings.show();
  settings.focus();
  await wait(
    settings,
    `document.querySelector('[data-version=app]')?.textContent===${JSON.stringify(metadata.version)}&&/\\d+\\.\\d+/.test(document.querySelector('[data-version=pdf_math_precise]')?.textContent||'')&&/\\d+\\.\\d+/.test(document.querySelector('[data-version=uv]')?.textContent||'')`,
  );
  const result = await evaluate(
    settings,
    `(()=>{const section=document.querySelector('.about-versions');return {first:section.closest('.workspace-page').firstElementChild===section,versions:[...section.querySelectorAll('[data-version]')].map(el=>({id:el.dataset.version,text:el.textContent})),features:[...section.querySelectorAll('.feature-updates li span')].map(el=>el.textContent)}})()`,
  );
  assert.equal(result.first, true);
  assert.equal(result.versions.length, 5);
  assert.equal(
    await evaluate(
      settings,
      `[...document.querySelectorAll('.settings h3,.settings .setting-row span,.settings .effective-translation-summary,.settings .dependency-project span')].every(el=>getComputedStyle(el).userSelect==='none')`,
    ),
    true,
  );
  const heading = await evaluate(
    settings,
    `(()=>{window.getSelection().removeAllRanges();const r=document.querySelector('#settings-about-versions').getBoundingClientRect();return {x:Math.round(r.x+4),y:Math.round(r.y+r.height/2),end:Math.round(r.x+140)}})()`,
  );
  settings.webContents.sendInputEvent({
    type: 'mouseDown',
    x: heading.x,
    y: heading.y,
    button: 'left',
    clickCount: 1,
  });
  settings.webContents.sendInputEvent({
    type: 'mouseMove',
    x: heading.end,
    y: heading.y,
    button: 'left',
  });
  settings.webContents.sendInputEvent({
    type: 'mouseUp',
    x: heading.end,
    y: heading.y,
    button: 'left',
    clickCount: 1,
  });
  assert.equal(await evaluate(settings, `window.getSelection().toString()`), '');
  assert.equal(
    await evaluate(
      settings,
      `(()=>{const input=document.querySelector('.sidebar-search input');input.value='editable';input.focus();input.setSelectionRange(0,8);const works=getComputedStyle(input).userSelect==='text'&&input.selectionEnd-input.selectionStart===8;input.value='';input.blur();return works})()`,
    ),
    true,
  );

  for (const version of result.versions) assert.match(version.text, /\d+\.\d+/);
  assert.deepEqual(
    result.features,
    metadata.recentFeatures.map((item) =>
      item.subject.replace(
        /^(\s*)(\p{L})/u,
        (_match, space, letter) => space + letter.toUpperCase(),
      ),
    ),
  );
  assert.ok(result.features.length <= 10);
  await evaluate(reader, `window.previewPreferences.save({uiLanguage:'zh-CN'})`);
  await wait(
    settings,
    `document.querySelector('#settings-about-versions')?.textContent==='版本与更新'`,
  );
  await writeFile(
    '/tmp/pdfmathreader-about-versions.png',
    (await settings.webContents.capturePage()).toPNG(),
  );
  settings.setSize(680, 780);
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(
    await evaluate(
      settings,
      `(()=>{const page=document.querySelector('.about-versions').closest('.workspace-page');return page.scrollWidth<=page.clientWidth+1})()`,
    ),
    true,
  );
  console.log(
    'About passed: first section, real app/three kernels/UV versions, build snapshot feature list and narrow layout.',
    JSON.stringify(result),
  );
  app.quit();
}
