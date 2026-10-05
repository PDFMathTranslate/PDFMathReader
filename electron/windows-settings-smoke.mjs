import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { app } from 'electron';
import { join } from 'node:path';
import { createReaderPreferences } from './preferences.mjs';

export async function verifyWindowsSettings(window) {
  assert.equal(process.platform, 'win32');
  const evaluate = async (code) => {
    try {
      return await window.webContents.executeJavaScript(code);
    } catch (error) {
      console.error('Failed Windows smoke script:', code);
      console.error(
        await window.webContents.executeJavaScript(
          `([...document.querySelectorAll('.windows-menu-panel button')].map(button=>button.textContent))`,
        ),
      );
      throw error;
    }
  };
  const wait = async (code) => {
    for (let n = 0; n < 200; n++) {
      if (await evaluate(code)) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    console.error(
      'Settings diagnostic',
      await evaluate(
        "(async()=>({preferences:await window.previewPreferences.load(),source:document.querySelector('#source-language-label')?.parentElement.querySelector('fluent-dropdown')?.value,error:document.querySelector('.error-banner')?.textContent}))()",
      ),
    );
    throw Error('Windows settings condition timed out: ' + code);
  };
  const open = async () => {
    await wait(`window.previewReady===true`);
    await wait(
      `!!customElements.get('fluent-button')&&!!document.querySelector('.toolbar-actions fluent-button:last-child')`,
    );
    await evaluate(`document.querySelector('.toolbar-actions fluent-button:last-child').click()`);
    await wait(
      `!!document.querySelector('.settings fluent-dropdown')&&!!customElements.get('fluent-dropdown')`,
    );
  };
  await open();
  await wait(
    `!!document.querySelector('.settings fluent-dropdown')&&document.querySelector('#source-language-label').parentElement.querySelector('fluent-dropdown').value==='English'`,
  );
  await new Promise((resolve) => setTimeout(resolve, 600));
  await evaluate(
    `(()=>{const control=document.querySelector('#source-language-label').parentElement.querySelector('fluent-dropdown');control.value='Japanese';control.dispatchEvent(new Event('change',{bubbles:true,composed:true}));})()`,
  );
  await wait(`(async()=> (await window.previewPreferences.load()).sourceLanguage==='Japanese')()`);
  await evaluate(
    `(()=>{const control=document.querySelector('fluent-switch[aria-labelledby="reduce-motion-label"]');control.checked=true;control.dispatchEvent(new Event('change',{bubbles:true,composed:true}));})()`,
  );
  await wait(`(async()=> (await window.previewPreferences.load()).reduceMotion===true)()`);
  await evaluate(
    `(()=>{const control=document.querySelector('fluent-slider[aria-labelledby="parallel-pages-label"]');control.value=7;control.dispatchEvent(new Event('change',{bubbles:true,composed:true}));})()`,
  );
  await wait(`(async()=> (await window.previewPreferences.load()).pageConcurrency===7)()`);
  let disk;
  for (let n = 0; n < 100; n++) {
    disk = JSON.parse(
      await readFile(join(app.getPath('userData'), 'reader-preferences.json'), 'utf8'),
    );
    if (disk.pageConcurrency === 7) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.equal(disk.sourceLanguage, 'Japanese');
  assert.equal(disk.reduceMotion, true);
  assert.equal(disk.pageConcurrency, 7);
  const reopened = (
    await createReaderPreferences(join(app.getPath('userData'), 'reader-preferences.json'))
  ).load();
  assert.equal(reopened.sourceLanguage, 'Japanese');
  assert.equal(reopened.reduceMotion, true);
  assert.equal(reopened.pageConcurrency, 7);
  await new Promise((resolve) => {
    window.webContents.once('did-finish-load', resolve);
    window.webContents.reload();
  });
  await wait(
    `(async()=>!!window.previewPreferences&&(await window.previewPreferences.load()).sourceLanguage==='Japanese')()`,
  );
  await open();
  await wait(
    `document.querySelector('#source-language-label').parentElement.querySelector('fluent-dropdown').value==='Japanese'&&document.querySelector('fluent-switch[aria-labelledby="reduce-motion-label"]').checked===true&&Number(document.querySelector('fluent-slider[aria-labelledby="parallel-pages-label"]').value)===7`,
  );
  const metrics = await evaluate(
    `(()=>{const panel=document.querySelector('.settings');return {line:getComputedStyle(panel).lineHeight,gap:getComputedStyle(panel).gap,weight:getComputedStyle(document.querySelector('#settings-account')).fontWeight};})()`,
  );
  assert.equal(metrics.line, '20px');
  assert.equal(metrics.gap, '16px');
  assert.equal(metrics.weight, '400');
  await writeFile(
    join(process.cwd(), '.cache/windows-settings-verified.png'),
    (await window.webContents.capturePage()).toPNG(),
  );
  await evaluate(`document.querySelector('.settings-heading fluent-button').click()`);
  await evaluate(`document.querySelector('.windows-menu-trigger').click()`);
  await wait(`document.querySelectorAll('.windows-menu-panel').length===1`);
  await evaluate(
    `(()=>{const view=[...document.querySelectorAll('.windows-menu-panel button')].find(button=>button.textContent.trim()==='View›');const box=view.getBoundingClientRect();view.dispatchEvent(new PointerEvent('pointerenter',{clientX:box.left+box.width/2,clientY:box.top+box.height/2}));})()`,
  );
  await wait(`document.querySelectorAll('.windows-menu-panel').length===2`);
  await evaluate(
    `(()=>{const layout=[...document.querySelectorAll('.windows-menu-panel[data-level="1"] button')].find(button=>button.textContent.trim()==='Layout›');const box=layout.getBoundingClientRect();layout.dispatchEvent(new PointerEvent('pointerenter',{clientX:box.left+box.width/2,clientY:box.top+box.height/2}));})()`,
  );
  await wait(`document.querySelectorAll('.windows-menu-panel').length===3`);
  await new Promise((resolve) => setTimeout(resolve, 100));
  const menus = await evaluate(
    `([...document.querySelectorAll('.windows-menu-panel')].map(panel=>{const box=panel.getBoundingClientRect();return {left:box.left,right:box.right,top:box.top,bottom:box.bottom};}))`,
  );
  await writeFile(
    join(process.cwd(), '.cache/windows-menu-verified.png'),
    (await window.webContents.capturePage()).toPNG(),
  );
  assert.ok(
    menus.every(
      (box) =>
        box.left >= 0 &&
        box.right <= window.getBounds().width &&
        box.top >= 0 &&
        box.bottom <= window.getBounds().height,
    ),
    'cascades stay inside window',
  );
  assert.ok(
    menus[1].left > menus[0].left && menus[2].left > menus[1].left,
    'submenus expand sideways ' + JSON.stringify(menus),
  );
  await evaluate(
    `document.querySelector('.windows-menu-trigger').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`,
  );
  await wait(`!document.querySelector('.windows-menu-panel')`);
  const caption = await evaluate(
    `(()=>{const group=document.querySelector('.windows-window-controls'),buttons=[...group.children];return {right:group.getBoundingClientRect().right,width:innerWidth,order:buttons.map(button=>button.className),radius:buttons.map(button=>getComputedStyle(button).borderRadius)};})()`,
  );
  assert.deepEqual(caption.order, ['windows-minimize', 'windows-maximize', 'windows-close']);
  assert.ok(Math.abs(caption.right - caption.width) < 1);
  assert.deepEqual(caption.radius, ['0px', '0px', '0px']);
  await evaluate(`document.querySelector('.windows-maximize').click()`);
  await wait(`document.querySelector('.windows-maximize').getAttribute('aria-pressed')==='true'`);
  assert.equal(window.isMaximized(), true);
  await evaluate(`document.querySelector('.windows-maximize').click()`);
  await wait(`document.querySelector('.windows-maximize').getAttribute('aria-pressed')==='false'`);
  assert.equal(window.isMaximized(), false);
  console.log(
    'Windows settings smoke passed: preferences persisted on disk and restored after renderer reload; spacing and API label verified.',
  );
  console.log(
    'Windows chrome smoke passed: hover cascades, viewport bounds, right-edge native caption buttons and maximize/restore verified.',
  );
  app.quit();
}
