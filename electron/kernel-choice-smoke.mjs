import { writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { BrowserWindow, Menu } from 'electron';
export async function verifyKernelChoice(window) {
  const evaluate = (target, code) => target.webContents.executeJavaScript(code);
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function wait(target, code) {
    for (let n = 0; n < 200; n++) {
      try {
        if (await evaluate(target, code)) return;
      } catch {}
      await pause(50);
    }
    await writeFile('/tmp/macvue-failure.png', (await target.webContents.capturePage()).toPNG());
    console.log(
      await evaluate(
        target,
        `JSON.stringify({error:document.querySelector('.error-banner')?.textContent,mode:[...document.querySelectorAll('.mac-mode-control button')].map(b=>({text:b.textContent,state:b.dataset.state,disabled:b.disabled})),preferences:window.previewPreferences.load()})`,
      ),
    );
    throw Error('Kernel preference UI timed out: ' + code);
  }
  async function open(target) {
    target.show();
    target.focus();
    await pause(300);
    await wait(target, `!!document.querySelector('[aria-label="Translation settings"]')`);
    await evaluate(
      target,
      `(()=>{const b=document.querySelector('[aria-label="Translation settings"]');b.focus();if(!document.querySelector('.settings'))b.click();})()`,
    );
    await wait(target, `!!document.querySelector('.mac-mode-control button')`);
  }
  for (const [id, label] of [
    ['pdf_math_fast', 'Fast'],
    ['pdf_math_precise', 'Precise'],
    ['pdf_inspector', 'Ultra fast'],
  ]) {
    await open(window);
    await wait(window, `!document.querySelector('.mac-mode-control button').disabled`);
    await evaluate(
      window,
      `(()=>{const b=[...document.querySelectorAll('.mac-mode-control button')].find(b=>b.textContent===${JSON.stringify(label)});b.focus();b.click();})()`,
    );
    await wait(
      window,
      `(async()=>{const p=await window.previewPreferences.load();return p.engine===${JSON.stringify(id)};})()`,
    );
    await new Promise((resolve) => {
      window.webContents.once('did-finish-load', resolve);
      window.webContents.reload();
    });
    await open(window);
    await wait(
      window,
      `document.querySelector('.mac-mode-control button[data-state="on"]')?.textContent===${JSON.stringify(label)}`,
    );
    assert.equal((await evaluate(window, 'window.previewPreferences.load()')).engine, id);
    if (id === 'pdf_math_precise') {
      const existing = new Set(BrowserWindow.getAllWindows());
      const menu = Menu.getApplicationMenu()
        .items.find((item) => item.label === 'File')
        .submenu.items.find((item) => item.label === 'New Window');
      menu.click();
      let other;
      for (let n = 0; n < 200 && !other; n++) {
        other = BrowserWindow.getAllWindows().find((item) => !existing.has(item));
        await pause(50);
      }
      assert.ok(other);
      await open(other);
      await wait(
        other,
        `document.querySelector('.mac-mode-control button[data-state="on"]')?.textContent==='Precise'`,
      );
      other.close();
    }
  }
  await open(window);
  const point = await evaluate(
    window,
    `(()=>{const r=document.querySelector('[aria-label="Translation language"]').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`,
  );
  window.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...point });
  window.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...point });
  await wait(
    window,
    `[...document.querySelectorAll('[role="option"]')].some(e=>e.textContent.trim()==='Japanese')`,
  );
  const itemPoint = await evaluate(
    window,
    `(()=>{const r=[...document.querySelectorAll('[role="option"]')].find(e=>e.textContent.trim()==='Japanese').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`,
  );
  window.webContents.sendInputEvent({ type: 'mouseMove', ...itemPoint });
  window.webContents.sendInputEvent({
    type: 'mouseDown',
    button: 'left',
    clickCount: 1,
    ...itemPoint,
  });
  window.webContents.sendInputEvent({
    type: 'mouseUp',
    button: 'left',
    clickCount: 1,
    ...itemPoint,
  });
  await wait(
    window,
    `document.querySelector('.settings [aria-label="Translation language"]')?.textContent.includes('Japanese')`,
  );
  assert.equal(
    await evaluate(window, `!!document.querySelector('.settings')`),
    true,
    'pop-up selection keeps settings open',
  );
  assert.equal(
    await evaluate(window, `!!document.querySelector('[aria-labelledby="boundaries-label"]')`),
    false,
    'Reading settings stay hidden',
  );
  await evaluate(
    window,
    `document.querySelector('[aria-labelledby="parallel-pages-label"]').focus()`,
  );
  window.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Right' });
  window.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Right' });
  await wait(
    window,
    `document.querySelector('[aria-labelledby="parallel-pages-label"]').getAttribute('aria-valuenow')==='3'`,
  );
  await wait(
    window,
    `(async()=>{const p=await window.previewPreferences.load();return p.language==='Japanese'&&p.pageConcurrency===3;})()`,
  );
  await evaluate(window, `document.querySelector('.mac-translation-control button').click()`);
  await wait(
    window,
    `(async()=> (await window.previewPreferences.load()).translationMode==='full')()`,
  );
  await evaluate(window, `document.querySelectorAll('.mac-translation-control button')[1].click()`);
  await wait(
    window,
    `(async()=> (await window.previewPreferences.load()).translationMode==='reading')()`,
  );
  assert.equal(
    await evaluate(window, `document.querySelector('[aria-label="OpenAI API key"]').type`),
    'password',
  );
  console.log(
    'MacVue settings: language menu, persisted language and slider keyboard step, translation mode, and secure field passed.',
  );
  await pause(250);
  await writeFile(
    '/tmp/pdfmathreader-settings-sections.png',
    (await window.webContents.capturePage()).toPNG(),
  );
  console.log(
    'Kernel choice: all three selections persisted across reload; Precise restored in a new window.',
  );
  window.close();
}
