import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
export async function verifyKernelError(window,createWindow){
 const run=code=>window.webContents.executeJavaScript(code).catch(e=>{throw Error('Evaluation failed: '+code,{cause:e});}),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 async function wait(code){for(let n=0;n<200;n++){if(await run(code))return;await pause(50);}throw Error('Kernel error timed out: '+code);}
 await wait('window.previewReady');const settings=await createWindow(null,null,window,'general');
 for(let n=0;n<200;n++){try{if(await settings.webContents.executeJavaScript('window.previewReady===true'))break;}catch{}await pause(50);}
 const save=code=>settings.webContents.executeJavaScript(code);window.show();window.focus();
 await run(`(()=>{const original=window.fetch;window.kernelRecoveryCalls=[];window.fetch=async(input,options)=>{const path=String(input),match=path.match(/^\\/api\\/engines\\/(pdf_inspector|pdf_math_fast|pdf_math_precise)(\\/install)?$/);if(match){window.kernelRecoveryCalls.push({path,body:options?.body});await new Promise(r=>setTimeout(r,100));return new Response(JSON.stringify({id:match[1],available:false,reason:'The translation kernel could not start. Check your connection and try again.'}),{status:200,headers:{'Content-Type':'application/json'}});}return original(input,options);};})()`);
 await save(`window.previewPreferences.save({engine:'pdf_math_fast',appearance:'light',reduceMotion:true})`);
 await wait(`!!document.querySelector('.kernel-error-popover')`);
 assert.deepEqual(await run(`[...document.querySelectorAll('.kernel-error-popover button')].map(b=>b.textContent.trim())`),['Reinstall kernel','Build latest source','Ignore for 5 minutes','Retry']);
 assert.equal(await run(`document.querySelector('.kernel-error-actions button:last-child').classList.contains('macvue-button--prominent')`),true);
 const bounds=await run(`(()=>{const e=document.querySelector('.kernel-error-popover'),r=e.getBoundingClientRect(),s=getComputedStyle(e);return {left:r.left,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight,radius:s.borderRadius,blur:s.backdropFilter};})()`);
 assert.ok(bounds.left>=0&&bounds.right<=bounds.width&&bounds.bottom<=bounds.height);assert.equal(bounds.radius,'22px');assert.equal(bounds.blur,'none');
 const opaque=()=>run(`(()=>{const c=document.createElement('canvas'),ctx=c.getContext('2d');ctx.fillStyle=getComputedStyle(document.querySelector('.kernel-error-popover')).backgroundColor;ctx.fillRect(0,0,1,1);return ctx.getImageData(0,0,1,1).data[3]===255;})()`);
 assert.equal(await opaque(),true,'error surface must fully obscure document text');
 await run(`(()=>{const e=document.querySelector('.kernel-error-popover'),back=document.createElement('div');back.id='kernel-error-backing';back.style.cssText='position:absolute;top:30px;right:-10px;width:360px;height:420px;z-index:1;background:white;color:black;font-size:20px;line-height:1.4;overflow:hidden';back.textContent='Underlying PDF text must not show through. '.repeat(100);e.before(back);})()`);
 await writeFile('/tmp/pdfmathreader-kernel-error-light.png',(await window.webContents.capturePage()).toPNG());
 for(const [index,source] of [[0,'release'],[1,'git']]){await run(`document.querySelectorAll('.kernel-error-repairs button')[${index}].click()`);await wait(`window.kernelRecoveryCalls.filter(c=>c.body).some(c=>JSON.parse(c.body).source==='${source}')`);await pause(250);await wait(`!!document.querySelector('.kernel-error-popover:not(.settings-motion-leave-active) .kernel-error-repairs button:not(:disabled)')`);assert.equal(await run(`JSON.parse(window.kernelRecoveryCalls.filter(c=>c.body).at(-1).body).source`),source);}
 await save(`window.previewPreferences.save({appearance:'dark'})`);await wait(`document.documentElement.dataset.appearance==='dark'`);await pause(100);
 assert.equal(await opaque(),true,'dark error surface must also be opaque');
 await writeFile('/tmp/pdfmathreader-kernel-error-dark.png',(await window.webContents.capturePage()).toPNG());
 await save(`window.previewPreferences.save({reduceTransparency:true})`);await wait(`getComputedStyle(document.querySelector('.kernel-error-popover')).backdropFilter==='none'`);
 await run(`document.querySelector('.kernel-error-actions button:last-child').click()`);await wait(`!!document.querySelector('.kernel-error-popover')`);
 await pause(250);
 await run(`(()=>{const original=window.setTimeout;window.setTimeout=(callback,delay,...args)=>{if(delay===300000)window.kernelIgnoreExpiry=()=>callback(...args);return original(callback,delay,...args);};window.documentClickReached=false;document.querySelector('.reader').addEventListener('pointerdown',()=>window.documentClickReached=true,{once:true});document.querySelector('.reader').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));})()`);
 await wait(`!document.querySelector('.kernel-error-popover')`);
 assert.equal(await run(`window.documentClickReached&&typeof window.kernelIgnoreExpiry==='function'`),true,'document interaction continues and starts a five minute suppression');
 await pause(300);
 assert.equal(await run(`!!document.querySelector('.kernel-error-popover')`),false,'the existing kernel failure must stay suppressed');
 await run(`window.kernelIgnoreExpiry()`);await wait(`!!document.querySelector('.kernel-error-popover')`);await pause(250);
 await run(`document.querySelector('.kernel-error-actions button:first-child').click()`);await wait(`!document.querySelector('.kernel-error-popover')`);
 await save(`window.previewPreferences.save({engine:'pdf_inspector',reduceTransparency:false})`);await wait(`!!document.querySelector('.kernel-error-popover')`);
 assert.equal(await run(`document.querySelectorAll('.kernel-error-popover button').length`),2);assert.ok(await run(`!!document.querySelector('.kernel-error-hint')`));
 await run(`document.querySelector('.kernel-error-actions button').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);await wait(`!document.querySelector('.kernel-error-popover')`);
 console.log('Kernel error smoke passed: recovery actions, prominent retry, light/dark, reduced transparency, opaque surface over document text, bounds, ignore and Escape.');settings.close();window.close();
}
