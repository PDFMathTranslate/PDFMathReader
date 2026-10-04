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
 await new Promise(resolve=>{window.webContents.once('did-finish-load',resolve);window.webContents.reload();});
 await wait(`!![...document.querySelectorAll('button')].find(b=>b.textContent==='Try a sample document')`);
 await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Try a sample document').click()`);
 await wait(`document.querySelectorAll('.paragraph-quick-link').length===2`);
 console.log('Quick links passed: creation, paired SF Symbols, both directions, original/translation switching, persistence across reload.');window.close();
}
