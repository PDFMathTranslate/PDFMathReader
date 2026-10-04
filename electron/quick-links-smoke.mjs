import assert from 'node:assert/strict';
export async function verifyQuickLinks(window){
 const evaluate=code=>window.webContents.executeJavaScript(code),pause=ms=>new Promise(r=>setTimeout(r,ms));
 async function wait(code){for(let i=0;i<400;i++){if(await evaluate(code))return;await pause(50);}throw Error('Quick links timeout: '+code);}
 await wait(`!![...document.querySelectorAll('button')].find(b=>b.textContent==='Try a sample document')`);
 await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Try a sample document').click()`);
 await wait(`!![...document.querySelectorAll('.paragraph')].find(b=>b.getAttribute('aria-label')?.includes('Mock translated paragraph'))`);
 await evaluate(`document.querySelector('[aria-label="Search document"]').click()`);
 await wait(`!!document.querySelector('[aria-label="Search document text"]')`);
 await evaluate(`(()=>{const input=document.querySelector('[aria-label="Search document text"]');input.value='Mock translated';input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await wait(`!!document.querySelector('.quick-return-create')`);
 const surfaces=await evaluate(`(()=>{const properties=['height','paddingTop','paddingBottom','borderRadius','border','backgroundColor','boxShadow','color'];return ['.reference-return-button','.quick-return-create'].map(selector=>{const style=getComputedStyle(document.querySelector(selector));return properties.map(property=>style[property]);});})()`);
 assert.deepEqual(surfaces[0],surfaces[1],'paired return controls share the same surface and height');
 await evaluate(`document.querySelector('.quick-return-create').click()`);
 await wait(`!document.querySelector('.document-search')&&document.querySelectorAll('.paragraph-quick-link').length===2`);
 for(const side of ['origin','result']){await evaluate(`document.querySelector('[data-link-side="${side}"]').click()`);await pause(250);assert.equal(await evaluate(`document.querySelectorAll('.paragraph-quick-link [data-symbol="link"]').length`),2);}
 await evaluate(`document.querySelector('.translation-toggle').click()`);await pause(250);
 assert.equal(await evaluate(`document.querySelectorAll('.paragraph-quick-link').length`),2);
 await evaluate(`window.previewAnnotations.save({key:window.previewRenderDiagnostics().annotationKey,nativeRefs:[],annotations:[{id:'rail-note',page:1,kind:'comment',origin:'source',text:'Selection',comment:'Rail alignment',color:'#FFFF00',rects:[{x:50,y:80,width:160,height:20}],createdAt:'2026-01-01T00:00:00Z'}]})`);
 await evaluate(`window.previewPreferences.save({interactionMode:'reading'})`);
 await new Promise(resolve=>{window.webContents.once('did-finish-load',resolve);window.webContents.reload();});
 await wait(`!![...document.querySelectorAll('button')].find(b=>b.textContent==='Try a sample document')`);
 await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Try a sample document').click()`);
 await wait(`document.querySelectorAll('.paragraph-quick-link').length===2`);
 await wait(`!!document.querySelector('.annotation-note')`);
 for(let mode=0;mode<2;mode++){
  await pause(500);
  const aligned=await evaluate(`(()=>{const comment=document.querySelector('.annotation-note').getBoundingClientRect();return [...document.querySelectorAll('.paragraph-quick-link')].every(button=>Math.abs(button.getBoundingClientRect().left-comment.left)<1);})()`);
  assert.equal(aligned,true,'links share the comment rail in both original and translated views');
  await evaluate(`document.querySelector('.translation-toggle').click()`);
 }
 console.log('Quick links passed: creation, paired SF Symbols, both directions, original/translation switching, persistence across reload.');window.close();
}
