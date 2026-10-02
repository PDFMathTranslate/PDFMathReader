import assert from 'node:assert/strict';
import {clipboard,ClipboardItem,Menu} from 'electron';
import {writeFile} from 'node:fs/promises';
export async function verifySearch(window){
 const evaluate=code=>window.webContents.executeJavaScript(code),pause=ms=>new Promise(r=>setTimeout(r,ms));
 async function wait(code){for(let n=0;n<400;n++){if(await evaluate(code))return;await pause(50);}throw Error('Search UI timed out: '+code);}
 window.show();window.focus();await pause(300);
 await evaluate(`document.querySelector('button[aria-label="Translation settings"]').click()`);
 await wait(`!!document.querySelector('.appearance-choice')`);
 await evaluate(`document.querySelectorAll('.appearance-choice')[1].click()`);
 await wait(`document.documentElement.dataset.appearance==='dark'`);
 await wait(`(async()=> (await window.previewPreferences.load()).appearance==='dark')()`);
 await evaluate(`document.querySelector('[aria-label="Purple accent color"]').click();document.querySelector('[aria-labelledby="reduce-motion-label"]').click();document.querySelector('[aria-labelledby="reduce-transparency-label"]').click()`);
 await wait(`document.documentElement.dataset.reduceMotion==='true'&&document.documentElement.dataset.reduceTransparency==='true'&&document.documentElement.style.getPropertyValue('--accent')==='#af52de'`);
 await evaluate(`(()=>{const input=document.querySelector('[aria-label="Custom accent color"]');input.value='#13579b';input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await wait(`(async()=> (await window.previewPreferences.load()).accentColor==='#13579b')()`);
 assert.equal(await evaluate(`getComputedStyle(document.querySelector('.settings')).backdropFilter`),'none');
 await wait(`(async()=>{const p=await window.previewPreferences.load();return p.reduceMotion&&p.reduceTransparency&&p.accentColor==='#13579b';})()`);
 await evaluate(`document.querySelector('.settings').scrollTop=document.querySelector('.appearance-section').offsetTop-60`);await pause(250);await writeFile('/tmp/pdfmathreader-appearance-dark.png',(await window.webContents.capturePage()).toPNG());
 await evaluate(`document.querySelectorAll('.appearance-choice')[2].click();document.querySelector('[aria-label="System accent color"]').click();document.querySelector('[aria-labelledby="reduce-motion-label"]').click();document.querySelector('[aria-labelledby="reduce-transparency-label"]').click();document.querySelector('[aria-label="Close settings"]').click()`);
 await evaluate(`document.querySelector('button[aria-label="Translation settings"]').click()`);await pause(300);await evaluate(`document.querySelector('.settings').scrollTop=document.querySelector('.appearance-section').offsetTop-60`);await pause(300);await writeFile('/tmp/pdfmathreader-appearance.png',(await window.webContents.capturePage()).toPNG());await evaluate(`document.querySelector('[aria-label="Close settings"]').click()`);
 console.log('Appearance controls passed: dark theme, custom accent selection, effects, persistence, opaque materials.');
 await evaluate(`(async()=>window.previewPreferences.save({...await window.previewPreferences.load(),language:'Japanese',concurrency:8,pageConcurrency:3,automatic:false,layoutVisible:true}))()`);
 await new Promise(resolve=>{window.webContents.once('did-finish-load',resolve);window.webContents.reload();});
 await wait(`!!document.querySelector('button[aria-label="Translation settings"]')`);await pause(400);
 await evaluate(`document.querySelector('button[aria-label="Translation settings"]').click()`);
 await wait(`document.querySelector('[aria-label="Translation language"]')?.textContent.includes('Japanese')&&document.querySelector('[aria-labelledby="parallel-pages-label"]')?.getAttribute('aria-valuenow')==='3'&&document.querySelector('[aria-labelledby="parallel-translations-label"]')?.getAttribute('aria-valuenow')==='8'`);
 assert.equal((await evaluate(`window.previewPreferences.load()`)).automatic,false);
 assert.equal((await evaluate(`window.previewPreferences.load()`)).layoutVisible,true);
 await evaluate(`(async()=>window.previewPreferences.save({...await window.previewPreferences.load(),language:'Simplified Chinese',concurrency:4,pageConcurrency:2,automatic:true,layoutVisible:false}))()`);
 await new Promise(resolve=>{window.webContents.once('did-finish-load',resolve);window.webContents.reload();});await pause(400);
 console.log('Settings persistence passed: language, both parallel limits and hidden Reading preferences survive reload.');

 await wait(`!![...document.querySelectorAll('button')].find(b=>b.textContent==='Try a sample document')`);
 await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Try a sample document').click()`);
 await wait(`document.querySelector('.thumb small')?.textContent==='Translated'&&!!document.querySelector('[aria-label="Search document"]')`);
 assert.equal(await evaluate(`!!document.querySelector('.toolbar [aria-label="Open PDF"]')`),false);
 await pause(500);
 for(const [direction,axis] of [['vertical','scrollTop'],['horizontal','scrollLeft']]){
  window.webContents.send('reader:action','layout:'+direction);await pause(500);
  await evaluate(`(()=>{const r=document.querySelector('.reader');r.${axis}=0;})()`);await pause(100);
  await evaluate(`(()=>{const r=document.querySelector('.reader');r.dispatchEvent(new WheelEvent('wheel',{bubbles:true,deltaY:120,deltaX:120}));r.${axis}=120;})()`);
  await wait(`document.querySelector('.app').classList.contains('immersive-header-hidden')`);await pause(220);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('.toolbar')).opacity`),'0');
  await evaluate(`(()=>{const r=document.querySelector('.reader');r.dispatchEvent(new WheelEvent('wheel',{bubbles:true,deltaY:-60,deltaX:-60}));r.${axis}=60;})()`);
  await wait(`!document.querySelector('.app').classList.contains('immersive-header-hidden')`);await pause(100);
  if(process.platform==='darwin')assert.deepEqual(window.getWindowButtonPosition(),{x:18,y:24},'native traffic lights retain their centered inset after revealing the header');
 }
 window.webContents.send('reader:action','layout:vertical');await pause(500);await evaluate(`document.querySelector('.reader').scrollTop=0`);
 console.log('Immersive titlebar passed: forward scroll hides and reverse scroll shows on both axes.');

 await wait(`!![...document.querySelectorAll('.paragraph')].find(b=>b.getAttribute('aria-label')?.includes('Mock translated paragraph'))`);
 const savedClipboard=await Promise.all((await clipboard.read()).map(async item=>new ClipboardItem(Object.fromEntries(await Promise.all(item.types.map(async type=>[type,await item.getType(type)]))))));
 try{
  await evaluate(`document.activeElement?.blur();[...document.querySelectorAll('.paragraph')].find(b=>b.getAttribute('aria-label')?.includes('Mock translated paragraph')).dispatchEvent(new PointerEvent('pointerenter'));`);
  window.webContents.sendInputEvent({type:'keyDown',keyCode:'C',modifiers:['meta']});window.webContents.sendInputEvent({type:'keyUp',keyCode:'C',modifiers:['meta']});
  await wait(`document.querySelector('.copy-toast')?.textContent==='已复制段落'`);
  assert.equal(await clipboard.readText(),'Mock translated paragraph');
  await evaluate(`[...document.querySelectorAll('.paragraph')].find(b=>b.getAttribute('aria-label')?.includes('Mock translated paragraph')).dispatchEvent(new PointerEvent('pointerleave'));`);
  console.log('Hovered paragraph Cmd+C and clipboard contents passed.');
  await evaluate(`document.querySelector('button[aria-label="Translation settings"]').click()`);
  await wait(`!!document.querySelector('[aria-label="Interaction mode"]')`);
  await evaluate(`[...document.querySelectorAll('[aria-label="Interaction mode"] button')].find(b=>b.textContent==='Reading mode').click()`);
  await wait(`(async()=> (await window.previewPreferences.load()).interactionMode==='reading')()`);
  await evaluate(`document.querySelector('[aria-label="Close settings"]').click()`);
  await wait(`!![...document.querySelectorAll('.reading-text-layer span')].find(e=>e.textContent.trim())`);
  assert.equal(await evaluate(`!!document.querySelector('.paragraph')`),false,'Reading mode has no paragraph hover or toggle targets');
  await pause(1900);
  const selectReading=async selector=>evaluate(`(()=>{const el=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim());const range=document.createRange();range.selectNodeContents(el);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);return selection.toString();})()`);
  const selected=await selectReading('.reading-paragraph .paragraph-text');
  assert.equal(selected,'Mock translated paragraph');
  window.webContents.sendInputEvent({type:'keyDown',keyCode:'C',modifiers:['meta']});window.webContents.sendInputEvent({type:'keyUp',keyCode:'C',modifiers:['meta']});await pause(150);
  assert.equal(await clipboard.readText(),selected);
  assert.equal(await evaluate(`!!document.querySelector('.copy-toast')`),false,'Reading copy uses native selection without paragraph toast');
  let nativeRoles;const popup=Menu.prototype.popup;
  try{Menu.prototype.popup=function(){nativeRoles=this.items.map(item=>item.role||item.label);};window.webContents.emit('context-menu',{}, {selectionText:selected});assert.ok(nativeRoles.includes('copy')&&nativeRoles.includes('selectall'),'Reading mode provides native selection menu');}finally{Menu.prototype.popup=popup;}
  await evaluate(`window.getSelection().removeAllRanges();document.querySelector('.translation-toggle').click()`);
  await wait(`!![...document.querySelectorAll('.reading-text-layer span')].find(e=>e.textContent.includes('quieter'))`);
  const originalSelected=await selectReading('.reading-text-layer span');assert.ok(originalSelected.length);
  window.webContents.sendInputEvent({type:'keyDown',keyCode:'C',modifiers:['meta']});window.webContents.sendInputEvent({type:'keyUp',keyCode:'C',modifiers:['meta']});await pause(150);assert.equal(await clipboard.readText(),originalSelected);
  await evaluate(`window.getSelection().removeAllRanges();document.querySelector('.translation-toggle').click();document.querySelector('button[aria-label="Translation settings"]').click()`);
  await wait(`!!document.querySelector('[aria-label="Interaction mode"]')`);
  await evaluate(`[...document.querySelectorAll('[aria-label="Interaction mode"] button')].find(b=>b.textContent==='Comparison mode').click();document.querySelector('[aria-label="Close settings"]').click()`);
  await wait(`!!document.querySelector('.paragraph')&&!document.querySelector('.reading-text-layer')`);
  console.log('Interaction modes passed: native original/translated selection copy, no reading hover targets or toast, native context menu, saved mode, comparison restoration.');

 }finally{if(savedClipboard.length)await clipboard.write(savedClipboard);else clipboard.clear();}

 await evaluate(`document.querySelector('[aria-label="Search document"]').click()`);
 await wait(`!!document.querySelector('[aria-label="Search document text"]')`);
 const enter=async text=>evaluate(`(()=>{const input=document.querySelector('[aria-label="Search document text"]');input.value=${JSON.stringify(text)};input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await enter('Mock translated');
 await wait(`document.querySelector('.search-count').textContent.includes(' / ')&&!!document.querySelector('.search-highlight')`);
 assert.equal(await evaluate(`document.querySelector('[aria-label="Search document text"]').placeholder`),'Search translation');
 await evaluate(`document.querySelector('.translation-toggle').click()`);
 await wait(`document.querySelector('.search-count').textContent==='No matches'`);
 await enter('quieter way');
 await wait(`document.querySelector('.search-count').textContent.includes(' / ')&&!!document.querySelector('.search-highlight')`);
 assert.equal(await evaluate(`document.querySelector('[aria-label="Search document text"]').placeholder`),'Search original');
 assert.ok(await evaluate(`(()=>{const r=document.querySelector('.reader').getBoundingClientRect(),h=document.querySelector('.search-highlight').getBoundingClientRect();return h.top>=r.top&&h.bottom<=r.bottom;})()`),'matching source text is visible');
 await writeFile('/tmp/pdfmathreader-search.png',(await window.webContents.capturePage()).toPNG());
 await evaluate(`document.querySelector('[aria-label="Close search"]').click()`);
 await wait(`!document.querySelector('.document-search')&&!document.querySelector('.search-highlight')`);
 window.webContents.send('reader:action','search');await wait(`!!document.querySelector('.document-search')`);
 console.log('Search passed: translated matches, original matches, mode isolation, visible coordinate highlight, close and Find action.');window.close();
}
