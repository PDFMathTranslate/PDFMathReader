import assert from 'node:assert/strict';
import {app,BrowserWindow} from 'electron';
import {writeFile} from 'node:fs/promises';
export async function verifyKernelSettings(reader,createWindow){
 const evaluate=(target,code)=>target.webContents.executeJavaScript(code).catch(error=>{throw Error('Kernel settings evaluation failed: '+code,{cause:error});});
 const wait=async(target,code)=>{for(let n=0;n<300;n++){try{if(await evaluate(target,code))return;}catch{}await new Promise(r=>setTimeout(r,50));}throw Error('Kernel settings timed out: '+code);};
 await wait(reader,'window.previewReady===true');
 const settings=await createWindow(null,null,reader,'kernel');settings.show();settings.focus();
 await wait(settings,`window.previewReady===true&&document.querySelectorAll('.kernel-mode-switcher [role=radio]').length===3`);
 assert.equal(await evaluate(settings,`!!document.querySelector('.kernel-navigation')`),false);
 assert.equal(await evaluate(settings,`document.querySelector('.kernel-mode-switcher').closest('.workspace-page').dataset.settingsPage`),'general');
 assert.equal(await evaluate(settings,`document.querySelector('[data-settings-page="general"] > section:first-child').getAttribute('aria-labelledby')`),'settings-engine');
 await wait(settings,`!!document.querySelector('.advanced-settings')`);
 assert.equal(await evaluate(settings,`document.querySelector('.advanced-settings').closest('.workspace-page').dataset.settingsPage`),'kernel');
 const category=async id=>{await evaluate(settings,`document.querySelector('[data-settings-category="${id}"]').click()`);await wait(settings,`document.querySelector('.settings-workspace').dataset.section==='${id}'`);};
 assert.equal(await evaluate(settings,`document.querySelector('.advanced-settings').tagName`),'SECTION');
 assert.equal(await evaluate(settings,`!!document.querySelector('.advanced-settings summary')`),false);
 assert.equal(await evaluate(settings,'window.previewDeveloper.enabled()'),false);
 await category('general');
 await wait(settings,`[...document.querySelectorAll('.kernel-mode-switcher img')].every(img=>img.complete&&img.naturalWidth===148&&img.naturalHeight===100)`);
 assert.equal(await evaluate(settings,`[...document.querySelectorAll('.kernel-mode-preview')].every(el=>{const r=el.getBoundingClientRect();return r.width===74&&r.height===50})`),true,'mode preview proportions match appearance');
 for(const id of ['pdf_math_fast','pdf_math_precise','pdf_inspector']){
  await category('general');
  await wait(settings,`!document.querySelector('[data-kernel-mode="${id}"]').disabled`);
  await evaluate(settings,`document.querySelector('[data-kernel-mode="${id}"]').click()`);
  await wait(settings,`document.querySelector('[data-kernel-mode="${id}"]').getAttribute('aria-checked')==='true'&&!document.querySelector('[data-kernel-mode="${id}"]').disabled`);
  assert.equal((await evaluate(settings,'window.previewPreferences.load()')).engine,id);
 assert.equal(await evaluate(settings,`!!document.querySelector('.legacy-settings-button')`),false);
 assert.ok((await evaluate(settings,`document.querySelector('.effective-translation-summary')?.textContent`)).startsWith(({pdf_inspector:'Inspector',pdf_math_fast:'Legacy',pdf_math_precise:'Next'})[id]+' · '));
  await category('kernel');
  if(id!=='pdf_inspector'){await wait(settings,`document.querySelectorAll('.advanced-option').length>0&&document.querySelector('.advanced-option').getBoundingClientRect().height>0`);}
  if(id==='pdf_math_fast'){assert.equal(await evaluate(settings,`!!document.querySelector('.developer-options .advanced-kernel-update')&&!document.querySelector('.advanced-settings .advanced-kernel-update')`),true,'maintenance actions belong to developer options');}
  if(id==='pdf_math_fast'){await new Promise(r=>setTimeout(r,100));await writeFile('/tmp/pdfmathreader-kernel-settings-balance.png',(await settings.webContents.capturePage()).toPNG());}
 }
 await evaluate(reader,`window.previewPreferences.save({translationServices:{pdf_inspector:{id:'openai',values:{},profiles:{}}},language:'English'})`);
 await wait(settings,`document.querySelector('.effective-translation-summary')?.textContent==='Inspector · OpenAI compatible · English'`);
 await evaluate(reader,`window.previewPreferences.save({uiLanguage:'zh-CN'})`);
 await wait(settings,`document.querySelector('#settings-mode-options')?.textContent==='模式设定'`);
 await wait(settings,`document.querySelector('.effective-translation-summary')?.textContent==='Inspector · 兼容 OpenAI · 英语'`);
 await evaluate(reader,`window.previewPreferences.save({translationServices:{pdf_inspector:{id:'apple-local',values:{},profiles:{}}},language:'French'})`);
 await wait(settings,`document.querySelector('.effective-translation-summary')?.textContent.startsWith('Inspector · ')&&document.querySelector('.effective-translation-summary')?.textContent.endsWith(' · 法语')&&!document.querySelector('.effective-translation-summary')?.textContent.includes('OpenAI')`);
 assert.equal(await evaluate(settings,`document.querySelector('.workspace-heading h2')?.textContent`),'内核');
 assert.equal(await evaluate(settings,`document.querySelector('.category-button[aria-current=page] .category-label')?.textContent`),'内核');
 await new Promise(r=>setTimeout(r,200));
 await writeFile('/tmp/pdfmathreader-kernel-settings-sections.png',(await settings.webContents.capturePage()).toPNG());
 await category('general');settings.setSize(680,780);await new Promise(r=>setTimeout(r,150));
 assert.equal(await evaluate(settings,`(()=>{const page=document.querySelector('.kernel-mode-switcher').closest('.workspace-page');return page.scrollWidth<=page.clientWidth+1})()`),true);
 await writeFile('/tmp/pdfmathreader-kernel-settings-narrow.png',(await settings.webContents.capturePage()).toPNG());
 await evaluate(settings,`document.querySelector('[data-kernel-mode="pdf_inspector"]').focus()`);
 settings.webContents.sendInputEvent({type:'keyDown',keyCode:'Right'});settings.webContents.sendInputEvent({type:'keyUp',keyCode:'Right'});
 await wait(settings,`document.querySelector('[data-kernel-mode="pdf_math_fast"]').getAttribute('aria-checked')==='true'&&!document.querySelector('[data-kernel-mode="pdf_math_fast"]').disabled`);
 await category('kernel');
 await evaluate(settings,`document.querySelector('[aria-labelledby="developer-mode-label"]').click()`);
 await wait(settings,`(async()=> await window.previewDeveloper.enabled())()`);
 const monitor=BrowserWindow.getAllWindows().find(window=>window!==reader&&window!==settings);
 assert(monitor,'developer switch opens independent monitor');
 await wait(settings,`!document.querySelector('[aria-labelledby="developer-mode-label"]').disabled`);
 await evaluate(settings,`document.querySelector('[aria-labelledby="developer-mode-label"]').click()`);
 await wait(settings,`(async()=> !(await window.previewDeveloper.enabled()))()`);
 console.log('Kernel settings passed: general-first kernel switch, preserved advanced menu, landscape icons, native schema loading, mode selection, keyboard, narrow layout and developer default-off/open/close.');app.quit();
}
