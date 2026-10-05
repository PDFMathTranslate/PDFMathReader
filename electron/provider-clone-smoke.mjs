import assert from 'node:assert/strict';
import {app} from 'electron';
export async function verifyProviderClone(window){
 const run=code=>window.webContents.executeJavaScript(code);
 const wait=async code=>{for(let n=0;n<300;n++){if(await run(code))return;await new Promise(r=>setTimeout(r,50));}throw Error('Provider clone timed out: '+code+' '+await run(`document.querySelector('.error')?.textContent`));};
 await wait('window.previewReady===true');
 await run(`(async()=>{const original=window.fetch;const pdf=await (await original('/sample.pdf')).arrayBuffer();window.fetch=async(input,options)=>{const url=String(input);if(url==='/api/engines/pdf_math_fast'){window.cloneEngineChecked=true;return new Response(JSON.stringify({id:'pdf_math_fast',installed:true,available:true}),{headers:{'Content-Type':'application/json'}});}if(url.startsWith('/api/math-page?'))return new Response(pdf.slice(0),{headers:{'Content-Type':'application/pdf','X-Layout-Key':'clone-fixture','X-Translation-Outcome':'success'}});if(url==='/api/math-layout/clone-fixture')return new Response(JSON.stringify({paragraphs:[]}),{headers:{'Content-Type':'application/json'}});return original(input,options);};await window.previewPreferences.save({engine:'pdf_math_fast',automatic:true,documentOpenMode:'translation',translationMode:'full'});})()`);
 window.webContents.send('reader:action','menu-option',{group:'engine',value:'pdf_math_fast'});
 await wait(`window.cloneEngineChecked===true`);
 await run(`document.querySelector('.sample-button').click()`);
 await wait(`(async()=> (await window.previewPreferences.load()).translationServiceHistory?.pdf_math_fast?.auto?.status==='success')()`);
 await wait(`document.querySelector('.page canvas')?.width>0`);
 assert.equal(await run(`!!document.querySelector('.kernel-error-popover')`),false);
 assert.equal(await run(`document.querySelector('.error')?.textContent.includes('cloned')||false`),false);
 console.log('Provider clone smoke passed: fast PDF load, real preload IPC and persisted reactive outcome. Mock translation only.');app.quit();
}
