import assert from 'node:assert/strict';
import { app } from 'electron';
export async function verifyKernelMenuMouse(window, createWindow) {
  const run = (code) => window.webContents.executeJavaScript(code),
    pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const wait = async (code) => {
    for (let n = 0; n < 200; n++) {
      if (await run(code)) return;
      await pause(50);
    }
    throw Error('Kernel menu mouse timeout: ' + code);
  };
  await wait('window.previewReady');
  window.show();
  app.focus({ steal: true });
  window.focus();
  window.webContents.focus();
  // Keep kernel switching local so the test never installs or contacts a provider.
  await run(
    `(()=>{const upstream=window.fetch;window.fetch=(input,options)=>/^\\/api\\/engines\\/(pdf_inspector|pdf_math_fast|pdf_math_precise)$/.test(String(input))?Promise.resolve(new Response(JSON.stringify({available:true,version:'1.0.0'}),{headers:{'Content-Type':'application/json'}})):upstream(input,options);})()`,
  );
  const click = async (selector) => {
    const point = await run(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)}),r=e.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`,
    );
    window.webContents.sendInputEvent({ type: 'mouseMove', ...point });
    await pause(30);
    window.webContents.sendInputEvent({
      type: 'mouseDown',
      button: 'left',
      clickCount: 1,
      ...point,
    });
    window.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...point });
    await pause(100);
  };
  const trigger = '.toolbar-kernel .macvue-pop-up-button';
  for (const [index, engine] of [
    [1, 'pdf_math_fast'],
    [2, 'pdf_math_precise'],
    [0, 'pdf_inspector'],
  ]) {
    await click(trigger);
    await wait(
      'document.querySelectorAll(".macvue-pop-up-button-content [role=option]").length===3',
    );
    const selector = `.macvue-pop-up-button-content [role=option]:nth-child(${index + 1})`;
    assert.equal(
      await run(
        `getComputedStyle(document.querySelector(${JSON.stringify(selector)})).getPropertyValue('-webkit-app-region')`,
      ),
      'no-drag',
    );
    await click(selector);
    await wait(`window.previewPreferences.load().then(p=>p.engine===${JSON.stringify(engine)})`);
    await wait('!document.querySelector(".macvue-pop-up-button-content")');
  }
  await click(trigger);
  await wait('!!document.querySelector(".macvue-pop-up-button-content")');
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'End' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'End' });
  await pause(100);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' });
  await wait('window.previewPreferences.load().then(p=>p.engine==="pdf_math_precise")');
  const settings = await createWindow(null, null, window, 'general');
  settings.show();
  settings.focus();
  const inspect = (code) => settings.webContents.executeJavaScript(code);
  const waitSettings = async (code) => {
    for (let n = 0; n < 200; n++) {
      if (await inspect(code)) return;
      await pause(50);
    }
    console.log(
      await inspect(
        `JSON.stringify({section:document.querySelector('.settings-workspace')?.dataset.section,source:document.querySelector('.language-code-control .macvue-pop-up-button[aria-label="Source language"]')?.outerHTML,menus:document.querySelectorAll('.macvue-pop-up-button-content').length})`,
      ),
    );
    throw Error('Language selector timeout: ' + code);
  };
  const clickSettings = async (selector) => {
    app.focus({ steal: true });
    settings.focus();
    settings.webContents.focus();
    await pause(50);
    const point = await inspect(
      `(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}})()`,
    );
    settings.webContents.sendInputEvent({ type: 'mouseMove', ...point });
    await pause(30);
    settings.webContents.sendInputEvent({
      type: 'mouseDown',
      button: 'left',
      clickCount: 1,
      ...point,
    });
    settings.webContents.sendInputEvent({
      type: 'mouseUp',
      button: 'left',
      clickCount: 1,
      ...point,
    });
    await pause(100);
  };
  await waitSettings('window.previewReady');
  await inspect("document.querySelector('[data-settings-category=translation]').click()");
  await pause(100);
  await clickSettings('.language-code-control .macvue-pop-up-button[aria-label="Source language"]');
  await waitSettings('!!document.querySelector(".macvue-pop-up-button-content [role=option]")');
  await clickSettings('.macvue-pop-up-button-content [role=option]:last-child');
  await waitSettings('window.previewPreferences.load().then(p=>p.sourceLanguage==="en")');
  await inspect(
    `(()=>{const input=document.querySelector('.language-code-control input');input.value='pt-BR';input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
  );
  await waitSettings('window.previewPreferences.load().then(p=>p.sourceLanguage==="pt-BR")');
  console.log(
    'Kernel menu mouse smoke passed: pointer selects all three modes, menu closes, preferences persist, keyboard remains functional, options exclude toolbar dragging, unbound source popup opens and custom language code persists.',
  );
  app.exit(0);
}
