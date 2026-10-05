import assert from 'node:assert/strict';
import { Menu } from 'electron';
import { writeFile } from 'node:fs/promises';
export async function verifyExperience(window) {
  const evaluate = (code) => window.webContents.executeJavaScript(code),
    pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const wait = async (code) => {
    for (let n = 0; n < 200; n++) {
      if (await evaluate(code)) return;
      await pause(50);
    }
    throw Error('Experience check timed out: ' + code);
  };
  await evaluate(`document.activeElement?.blur()`);
  window.webContents.send('reader:action', 'percent:10');
  await pause(400);
  const first = await evaluate(`window.previewRenderDiagnostics().active`);
  await evaluate(
    `document.dispatchEvent(new KeyboardEvent('keydown',{key:'PageDown',bubbles:true,cancelable:true}))`,
  );
  await wait(`window.previewRenderDiagnostics().active===${first + 1}`);
  await evaluate(
    `document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',shiftKey:true,bubbles:true,cancelable:true}))`,
  );
  await wait(`window.previewRenderDiagnostics().active===${first}`);
  await evaluate(`document.querySelector('button[aria-label="Translation settings"]').click()`);
  await wait(`!!document.querySelector('[aria-labelledby="auto-hide-header-label"]')`);
  await evaluate(`document.querySelector('[aria-labelledby="auto-hide-header-label"]').click()`);
  await wait(`(async()=>!(await window.previewPreferences.load()).autoHideHeader)()`);
  await evaluate(`document.querySelector('[aria-label="Close settings"]').click()`);
  await pause(300);
  await evaluate(
    `(()=>{const r=document.querySelector('.reader');r.dispatchEvent(new WheelEvent('wheel',{bubbles:true,deltaY:120}));r.scrollTop+=120;})()`,
  );
  await pause(250);
  assert.equal(
    await evaluate(`document.querySelector('.app').classList.contains('immersive-header-hidden')`),
    false,
  );
  await evaluate(`document.querySelector('button[aria-label="Translation settings"]').click()`);
  await wait(`!!document.querySelector('[aria-labelledby="auto-hide-header-label"]')`);
  await evaluate(
    `document.querySelector('[aria-labelledby="auto-hide-header-label"]').click();document.querySelector('[aria-label="Close settings"]').click()`,
  );
  await pause(300);
  await wait(`!!document.querySelector('[data-scrub="zoom"]')`);
  const oldZoom = await evaluate(`window.previewRenderDiagnostics().zoom`);
  await evaluate(
    `(()=>{const input=document.querySelector('[data-scrub="zoom"]');input.dispatchEvent(new PointerEvent('pointerenter',{bubbles:false}));document.dispatchEvent(new KeyboardEvent('keydown',{key:'Alt',altKey:true,bubbles:true}));})()`,
  );
  assert.equal(
    await evaluate(`getComputedStyle(document.querySelector('[data-scrub="zoom"]')).cursor`),
    'ew-resize',
  );
  await evaluate(
    `document.querySelector('[data-scrub="zoom"]').dispatchEvent(new WheelEvent('wheel',{deltaY:80,altKey:true,bubbles:true,cancelable:true}))`,
  );
  await wait(`window.previewRenderDiagnostics().zoom!==${oldZoom}`);
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keyup',{key:'Alt',bubbles:true}))`);
  await pause(400);
  window.webContents.send('reader:action', 'zoom-in');
  await wait(
    `document.querySelector('.page-layout')?.getAnimations().some(animation=>animation.playState==='running')`,
  );
  await pause(500);
  await evaluate(`document.querySelector('button[aria-label="Translation settings"]').click()`);
  await wait(`!!document.querySelector('.appearance-choice')`);
  await evaluate(`document.querySelectorAll('.appearance-choice')[1].click()`);
  await wait(`document.documentElement.dataset.appearance==='dark'`);
  assert.equal(
    await evaluate(`getComputedStyle(document.querySelector('.page')).filter`),
    'invert(0.75)',
  );
  assert.equal(
    await evaluate(
      `document.querySelector('.appearance-section').textContent.includes('This Mac')`,
    ),
    false,
  );
  await evaluate(`document.querySelector('[aria-label="Interface language"]').focus()`);
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Space' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Space' });
  await wait(`!!document.querySelector('.macvue-pop-up-button-item')`);
  await pause(250);
  const languagePoint = await evaluate(
    `(()=>{const item=[...document.querySelectorAll('.macvue-pop-up-button-item')].find(item=>item.textContent.trim()==='简体中文');item.scrollIntoView({block:'nearest'});const r=item.getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`,
  );
  await writeFile(
    '/tmp/pdfmathreader-language-popup.png',
    (await window.webContents.capturePage()).toPNG(),
  );
  window.webContents.sendInputEvent({ type: 'mouseMove', ...languagePoint });
  window.webContents.sendInputEvent({
    type: 'mouseDown',
    button: 'left',
    clickCount: 1,
    ...languagePoint,
  });
  window.webContents.sendInputEvent({
    type: 'mouseUp',
    button: 'left',
    clickCount: 1,
    ...languagePoint,
  });
  await wait(`document.querySelector('.settings-heading h2')?.textContent==='设置'`);
  await wait(`(async()=> (await window.previewPreferences.load()).uiLanguage==='zh-CN')()`);
  for (const [locale, heading, menu] of [
    ['zh-CN', '设置', '文件'],
    ['ja', '設定', 'ファイル'],
    ['en', 'Settings', 'File'],
  ]) {
    await evaluate(`window.previewPreferences.save({uiLanguage:${JSON.stringify(locale)}})`);
    await new Promise((resolve) => {
      window.webContents.once('did-finish-load', resolve);
      window.webContents.reload();
    });
    await wait(
      `!!document.querySelector('.appearance-choice')||!!document.querySelector('.toolbar-actions button')`,
    );
    await evaluate(`document.querySelector('.toolbar-actions button:last-child').click()`);
    await wait(
      `document.querySelector('.settings-heading h2')?.textContent===${JSON.stringify(heading)}`,
    );
    assert.ok(Menu.getApplicationMenu().items.some((item) => item.label === menu));
    assert.equal((await evaluate(`window.previewPreferences.load()`)).uiLanguage, locale);
  }
  console.log(
    'Experience checks passed: page shortcuts, optional header hiding, Alt-wheel zoom and cursor, nonlinear zoom animation, dark PDF inversion, localized interface and menus.',
  );
}
