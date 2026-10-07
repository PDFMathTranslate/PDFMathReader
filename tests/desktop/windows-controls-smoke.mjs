import assert from 'node:assert/strict';
import { app } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { PDFDocument } from 'pdf-lib';

export async function verifyWindowsControls(window) {
  const run = (code) =>
    window.webContents.executeJavaScript(code).catch((error) => {
      throw Error('Windows controls script failed: ' + code, { cause: error });
    });
  async function wait(code) {
    for (let n = 0; n < 200; n++) {
      if (await run(code)) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw Error(
      'Windows controls timed out: ' +
        code +
        ' ' +
        (await run(
          `JSON.stringify({text:document.body.innerText.slice(-1500),diagnostics:window.previewRenderDiagnostics?.(),categories:[...document.querySelectorAll('[data-settings-category]')].map(el=>el.dataset.settingsCategory),search:[...document.querySelectorAll('.settings-workspace fluent-text-input[type=search]')].map(el=>el.value)})`,
        )),
    );
  }
  await wait('window.previewReady');
  assert.equal(await run('window.previewAppearance.platform'), 'win32');
  if (
    process.argv.some((arg) =>
      ['--smoke-test=windows-reader-controls', '--smoke-test=windows-chrome'].includes(arg),
    )
  ) {
    const pdf = await PDFDocument.load(
      await readFile(new URL('../../public/sample.pdf', import.meta.url)),
    );
    while (pdf.getPageCount() < 3) pdf.addPage([612, 792]);
    const encoded = Buffer.from(await pdf.save()).toString('base64');
    await run(
      `(()=>{const d=new DataTransfer();d.items.add(new File([Uint8Array.from(atob(${JSON.stringify(encoded)}),c=>c.charCodeAt(0))],'Portrait and landscape.pdf',{type:'application/pdf'}));const input=document.querySelector('input[type=file]');input.files=d.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`,
    );
    await wait(`!!document.querySelector('.page canvas')?.width`);
    window.show();
    window.focus();
    window.webContents.focus();
    await new Promise((resolve) => setTimeout(resolve, 350));
    const clickChrome = async (selector) => {
      const point = await run(
        `(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`,
      );
      window.webContents.sendInputEvent({ type: 'mouseMove', ...point });
      await new Promise((resolve) => setTimeout(resolve, 30));
      window.webContents.sendInputEvent({
        type: 'mouseDown',
        button: 'left',
        clickCount: 1,
        ...point,
      });
      window.webContents.sendInputEvent({
        type: 'mouseUp',
        button: 'left',
        clickCount: 1,
        ...point,
      });
    };
    await clickChrome('.windows-menu-trigger');
    await wait(`!!document.querySelector('.windows-menu-panel')`);
    await clickChrome('.windows-menu-trigger');
    await wait(`!document.querySelector('.windows-menu-panel')`);
    await clickChrome('.toolbar > fluent-button.icon-button');
    await wait(`!document.querySelector('.sidebar')`);
    await clickChrome('.toolbar > fluent-button.icon-button');
    await wait(`!!document.querySelector('.sidebar')`);
    if (process.argv.includes('--smoke-test=windows-chrome')) {
      console.log('Windows menu and sidebar toggle real mouse clicks passed');
      app.quit();
      return;
    }
    await wait(`!window.previewRenderDiagnostics().fitAdjusting`);
    await new Promise((resolve) => setTimeout(resolve, 500));
    await run(`document.querySelector('.reader').dispatchEvent(new Event('scroll'))`);
    await wait(`document.querySelectorAll('.reader-floating-tools fluent-text-input').length===2`);
    await run(
      `document.querySelector('.floating-zoom fluent-text-input').focus();document.querySelector('.reader-floating-tools').dispatchEvent(new PointerEvent('pointerenter'))`,
    );
    assert.equal(
      await run(`document.querySelectorAll('.reader-floating-tools fluent-button').length`),
      4,
    );
    const edit = (kind, value) =>
      run(
        `(()=>{const host=document.querySelector('fluent-text-input[data-scrub="${kind}"]');const input=host.control;input.focus();input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('input',{bubbles:true,composed:true}));input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,composed:true,cancelable:true}));})()`,
      );
    await edit('page', '2');
    await wait(`document.querySelector('fluent-text-input[data-scrub=page]').value==='2'`);
    await run(`document.querySelector('.page-navigator fluent-button:last-child').click()`);
    await wait(`document.querySelector('fluent-text-input[data-scrub=page]').value==='3'`);
    assert.equal(
      await run(`document.querySelector('.page-navigator fluent-button:last-child').disabled`),
      true,
    );
    await run(`document.querySelector('.page-navigator fluent-button:first-child').click()`);
    await wait(`document.querySelector('fluent-text-input[data-scrub=page]').value==='2'`);
    await edit('zoom', '125');
    await wait(`document.querySelector('fluent-text-input[data-scrub=zoom]').value==='125%'`);
    await wait(`window.previewRenderDiagnostics().zoom===1.25`);
    await run(`document.querySelector('.floating-zoom fluent-button:last-child').focus()`);
    await run(`document.querySelector('.floating-zoom fluent-button:last-child').click()`);
    await wait(
      `window.previewRenderDiagnostics().zoom>1.25&&parseFloat(document.querySelector('fluent-text-input[data-scrub=zoom]').value)>125`,
    );
    await run(`document.querySelector('.floating-zoom fluent-button:first-child').click()`);
    await wait(
      `Math.abs(window.previewRenderDiagnostics().zoom-1.25)<0.001&&document.querySelector('fluent-text-input[data-scrub=zoom]').value==='125%'`,
    );
    await run(
      `document.querySelector('fluent-text-input[data-scrub=zoom]').control.dispatchEvent(new WheelEvent('wheel',{deltaY:-40,altKey:true,bubbles:true,cancelable:true}))`,
    );
    await wait(`document.querySelector('fluent-text-input[data-scrub=zoom]').value!=='125%'`);
    window.show();
    await new Promise((resolve) => setTimeout(resolve, 350));
    await writeFile(
      join(tmpdir(), 'pdfreader-fluent-reader-controls.png'),
      (await window.webContents.capturePage()).toPNG(),
    );
    console.log(
      'Windows Fluent reader controls passed: page entry, navigation, bounds, zoom entry, buttons and Alt-wheel',
    );
    app.quit();
    return;
  }
  if (process.argv.includes('--smoke-test=windows-kernel-menu')) {
    window.show();
    window.focus();
    window.webContents.focus();
    await new Promise((resolve) => setTimeout(resolve, 350));
    await run(
      `(()=>{const original=window.fetch;window.fetch=(input,...args)=>String(input).includes('/api/engines/')?Promise.resolve(new Response(JSON.stringify({available:true,local:true}),{headers:{'Content-Type':'application/json'}})):original(input,...args);})()`,
    );
    const mouseClick = async (selector) => {
      const point = await run(
        `(()=>{const el=document.querySelector(${JSON.stringify(selector)});const r=el.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`,
      );
      window.webContents.sendInputEvent({ type: 'mouseMove', ...point });
      await new Promise((resolve) => setTimeout(resolve, 30));
      window.webContents.sendInputEvent({
        type: 'mouseDown',
        button: 'left',
        clickCount: 1,
        ...point,
      });
      window.webContents.sendInputEvent({
        type: 'mouseUp',
        button: 'left',
        clickCount: 1,
        ...point,
      });
      await new Promise((resolve) => setTimeout(resolve, 100));
    };
    for (const [index, engine] of [
      [2, 'pdf_math_fast'],
      [3, 'pdf_math_precise'],
      [1, 'pdf_inspector'],
    ]) {
      await wait(`!document.querySelector('.toolbar-kernel fluent-dropdown').disabled`);
      await mouseClick('.toolbar-kernel fluent-dropdown [slot=control]');
      await wait(
        `document.querySelector('.toolbar-kernel fluent-listbox').matches(':popover-open')`,
      );
      assert.equal(
        await run(
          `getComputedStyle(document.querySelector('.toolbar-kernel fluent-option')).getPropertyValue('-webkit-app-region')`,
        ),
        'no-drag',
      );
      await mouseClick(`.toolbar-kernel fluent-option:nth-child(${index})`);
      await wait(
        `document.querySelector('.toolbar-kernel fluent-dropdown').value==='${engine}'&&!document.querySelector('.toolbar-kernel fluent-listbox').matches(':popover-open')`,
      );
      await wait(`window.previewPreferences.load().then(p=>p.engine==='${engine}')`);
    }
    console.log('Windows toolbar kernel mouse selection passed');
    app.quit();
    return;
  }
  window.webContents.send('reader:action', 'settings');
  await wait(`!!document.querySelector('.settings-workspace fluent-button.category-button')`);
  const category = (id) =>
    run(`document.querySelector('[data-settings-category="${id}"]').click()`);
  await category('general');
  assert.equal(
    await run(
      `(()=>{const button=document.querySelector('[data-settings-category=general]');const label=button.querySelector('.category-label');const reference=document.createElement('span');reference.style.color='var(--text)';button.append(reference);const expected=getComputedStyle(reference).color;reference.remove();return getComputedStyle(label).color===expected&&getComputedStyle(button).backgroundColor!==expected;})()`,
    ),
    true,
    'Selected settings category must retain readable text over its highlight',
  );
  await run(
    `document.querySelector('[data-settings-category="general"]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true,cancelable:true}))`,
  );
  await wait(`document.querySelector('.settings-workspace').dataset.section==='appearance'`);
  await run(
    `(()=>{const input=document.querySelector('.settings-workspace fluent-text-input[type=search]');input.value=document.querySelector('[data-settings-category=performance]').textContent.trim();input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await wait(
    `!!document.querySelector('[data-settings-category="performance"]')&&!document.querySelector('[data-settings-category="general"]')`,
  );
  await run(
    `(()=>{const input=document.querySelector('.settings-workspace fluent-text-input[type=search]');input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await wait(`!!document.querySelector('[data-settings-category="kernel"]')`);
  await category('kernel');
  await wait(`document.querySelectorAll('.fluent-kernel-modes fluent-tab').length===3`);
  await run(
    `document.querySelector('.fluent-kernel-modes fluent-tab[data-kernel-mode=pdf_math_precise]').click()`,
  );
  await wait(
    `document.querySelector('.fluent-kernel-modes fluent-tab[data-kernel-mode=pdf_math_precise]').dataset.state==='on'`,
  );
  await category('providers');
  await wait(`!!document.querySelector('fluent-button.provider-list-item')`);
  await run(`document.querySelector('fluent-button.provider-list-item').click()`);
  await wait(`!!document.querySelector('fluent-button.provider-list-item.is-browse')`);
  window.show();
  await new Promise((resolve) => setTimeout(resolve, 350));
  await writeFile(
    join(tmpdir(), 'pdfreader-fluent-settings.png'),
    (await window.webContents.capturePage()).toPNG(),
  );
  console.log(
    'Windows Fluent controls passed: settings navigation, keyboard, search, kernel selection and providers',
  );
  app.quit();
}
