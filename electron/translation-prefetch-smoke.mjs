import assert from 'node:assert/strict';
import {app} from 'electron';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
export async function verifyTranslationPrefetch(window,recents){
 const run=code=>window.webContents.executeJavaScript(code),pause=ms=>new Promise(r=>setTimeout(r,ms));
 async function wait(code){for(let i=0;i<180;i++){if(await run(code))return;await pause(50);}throw Error('Prefetch timeout: '+code+' '+JSON.stringify(await run('window.previewRenderDiagnostics?.()')));}
 const folder=await mkdtemp(join(tmpdir(),'translation-prefetch-'));
 try{
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
  for(let n=1;n<=24;n++)pdf.addPage([612,792]).drawText('Page '+n+' reading paragraph',{x:50,y:700,font,size:16});
  const path=join(folder,'Portrait and landscape.pdf');await writeFile(path,await pdf.save());await recents.remember(path);const id=recents.list()[0].id;
  await run(`window.previewPreferences.save({engine:'pdf_inspector',translationMode:'reading',automatic:false,fit:'width',columns:1,direction:'vertical',reduceMotion:true})`);
  await window.webContents.reload();await wait('window.previewReady');
  await run(`(()=>{const original=window.fetch;window.prefetchEvents=[];window.fetch=async(url,options={})=>{
   if(url==='/api/layout'){const {page}=JSON.parse(options.body);return new Response(JSON.stringify({paragraphs:[{id:'p'+page,text:'Page '+page,x:50,y:80,width:400,height:50,fontSize:16}]}),{status:200,headers:{'Content-Type':'application/json'}});}
   if(url==='/api/translate'){const body=JSON.parse(options.body),page=Number(body.text.split(' ')[1]);window.prefetchEvents.push({kind:'start',page});await new Promise((resolve,reject)=>{const timer=setTimeout(resolve,900);options.signal.addEventListener('abort',()=>{clearTimeout(timer);window.prefetchEvents.push({kind:'abort',page});reject(new DOMException('Aborted','AbortError'));},{once:true});});window.prefetchEvents.push({kind:'finish',page});return new Response(JSON.stringify({translation:'Translated '+page,cached:false}),{status:200,headers:{'Content-Type':'application/json'}});}
   return original(url,options);
  };return true;})()`);
  await run(`document.querySelector('[data-recent-id="${id}"]').click();true`);
  await wait('window.prefetchEvents.some(e=>e.kind==="start"&&e.page===1)');
  await wait('window.prefetchEvents.some(e=>e.kind==="start"&&e.page===2)');
  // Jump while requests are in flight. The destination must start without waiting for their 900ms delay.
  await run(`(()=>{const r=document.querySelector('.reader');r.scrollTop=r.scrollHeight*.65;r.dispatchEvent(new Event('scroll'));return true;})()`);
  await wait('window.prefetchEvents.some(e=>e.kind==="abort"&&e.page<=2)');
  await wait('window.prefetchEvents.some(e=>e.kind==="start"&&e.page>=15)');
  const landed=await run('window.previewRenderDiagnostics()');assert.ok(landed.active>=15);assert.equal(landed.translationOrder[0],landed.active);
  await pause(250);const settled=await run('window.previewRenderDiagnostics()');assert.equal(settled.translationMoving,false);assert.ok(settled.translationOrder.includes(settled.active+1));
  await run(`(()=>{const r=document.querySelector('.reader');r.scrollTop=r.scrollHeight*.3;r.dispatchEvent(new Event('scroll'));return true;})()`);await pause(300);
  const back=await run('window.previewRenderDiagnostics()');assert.equal(back.readingDirection,-1);assert.ok(back.translationOrder.indexOf(back.active-1)<back.translationOrder.indexOf(back.active+1));
  await run(`document.querySelector('[aria-label="Translation settings"]').click();true`);
  assert.equal(await run(`(()=>{const slider=document.querySelector('.parallel-settings');return slider?.closest('details')?.open===false;})()`),true);
  console.log(JSON.stringify({advancedConcurrencyCollapsed:true,automaticDespiteLegacyDisabledPreference:true,nextPagePrepared:true,jumpCancelsOldRequests:true,destinationPrioritized:true,backwardPrefetch:true,events:await run('window.prefetchEvents')}));
 }finally{await rm(folder,{recursive:true,force:true});app.quit();}
}
