import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
export async function verifyAnimation(window) {
  window.webContents.debugger.attach('1.3');
  await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
  });
  const evaluate = async (code) => {
      try {
        return await window.webContents.executeJavaScript(code);
      } catch (error) {
        console.log('Animation UI action failed:', code.slice(0, 180));
        throw error;
      }
    },
    pause = (ms) => new Promise((r) => setTimeout(r, ms));
  async function wait(code) {
    for (let i = 0; i < 2000; i++) {
      if (await evaluate(code)) return;
      await pause(30);
    }
    console.log(
      await evaluate(
        `JSON.stringify({reduce:matchMedia('(prefers-reduced-motion: reduce)').matches,paragraphs:document.querySelectorAll('.paragraph').length,translation:!!document.querySelector('.paragraph-text'),status:document.querySelector('.page-caption')?.textContent})`,
      ),
    );
    throw Error('Animation check timed out: ' + code);
  }
  await wait(`!!document.querySelector('.empty')`);
  await evaluate(
    `Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Try a sample document').click()`,
  );
  await wait(`!!document.querySelector('.text-revealing .reveal-letter')`);
  const stagger = await evaluate(
    `Array.from(document.querySelector('.text-revealing').querySelectorAll('.reveal-letter')).slice(0,8).map(e=>getComputedStyle(e).animationDelay)`,
  );
  assert.ok(new Set(stagger).size > 1);
  assert.equal(
    await evaluate(`getComputedStyle(document.querySelector('.reveal-mask')).overflow`),
    'hidden',
  );
  assert.ok(
    await evaluate(
      `Array.from(document.querySelectorAll('.reveal-letter')).some(e=>e.textContent==='👩🏽‍💻')`,
    ),
  );
  await wait(
    `!!document.querySelector('.paragraph.translated')&&!document.querySelector('.text-revealing')`,
  );
  // The button's hover halo extends 8 px beyond its box even at opacity zero.
  // Check the translated text scroller rather than that decorative overflow.
  assert.ok(
    await evaluate(
      `(()=>{const p=document.querySelector('.paragraph.translated .paragraph-text');return p&&p.scrollWidth<=p.clientWidth+1;})()`,
    ),
  );
  const originalCanvas = await evaluate(`document.querySelector('.page canvas').toDataURL()`);
  await evaluate(`document.querySelector('.paragraph.translated').click()`);
  await wait(`!!document.querySelector('.native-paragraph-reveal .pdf-glyph-mask')`);
  assert.ok(
    await evaluate(
      `(()=>{const glyph=document.querySelector('.native-paragraph-reveal .pdf-glyph-rise');return getComputedStyle(glyph).backgroundImage.includes('blob:')&&glyph.getBoundingClientRect().width>0;})()`,
    ),
  );
  await writeFile(
    '/tmp/preview-paragraph-original-transition.png',
    (await window.webContents.capturePage()).toPNG(),
  );
  await wait(`!document.querySelector('.native-paragraph-reveal')`);
  assert.equal(
    await evaluate(`document.querySelector('.page canvas').toDataURL()`),
    originalCanvas,
  );
  await evaluate(`document.querySelector('.paragraph').click()`);
  await wait(`!!document.querySelector('.text-revealing')`);
  await evaluate(`const p=document.querySelector('.paragraph');p.click();p.click();true`);
  await pause(650);
  assert.equal(await evaluate(`!!document.querySelector('.native-paragraph-reveal')`), false);
  await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  await evaluate(`document.querySelector('.paragraph').click()`);
  await pause(80);
  assert.equal(
    await evaluate(`document.querySelectorAll('.text-revealing,.pdf-text-reveal').length`),
    0,
  );
  await evaluate(`document.querySelector('.paragraph').click()`);
  await pause(80);
  assert.equal(
    await evaluate(`document.querySelectorAll('.text-revealing,.pdf-text-reveal').length`),
    0,
  );
  await window.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }],
  });
  console.log('Inspector reveal checks passed; checking math reveal');
  await evaluate(`document.querySelector('[aria-label="Translation settings"]').click()`);
  await wait(`!!document.querySelector('.mac-mode-control')`);
  await evaluate(
    `Array.from(document.querySelectorAll('.mac-mode-control button')).find(b=>b.textContent.trim()==='Fast').click()`,
  );
  await wait(`(async()=> (await window.previewPreferences.load()).engine==='pdf_math_fast')()`);
  await wait(`!document.querySelector('.mac-mode-control').disabled`);
  await evaluate(`document.querySelector('[aria-label="Close settings"]').click()`);
  await wait(`!!document.querySelector('.page .pdf-glyph-mask')`);
  assert.ok(await evaluate(`document.querySelectorAll('.page .pdf-glyph-mask').length>10`));
  await wait(
    `!document.querySelector('.pdf-text-reveal')&&document.querySelector('.thumb small')?.textContent==='Translated'`,
  );
  window.webContents.send('reader:action', 'translation');
  await wait(`!!document.querySelector('.pdf-text-reveal .pdf-glyph-mask')`);
  await wait(`!document.querySelector('.pdf-text-reveal')`);
  const result = {
    incomingCharactersStaggered: true,
    clippedMasks: true,
    originalUsesNativePDFGlyphs: true,
    originalCanvasUnchanged: true,
    rapidToggleCleanup: true,
    reducedMotionSkipsAnimation: true,
    nativeMathArrivalAndReturn: true,
    mockOnly: true,
  };
  await writeFile('/tmp/preview-animation-verification.json', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  window.webContents.debugger.detach();
  window.close();
}
