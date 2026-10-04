import {Menu} from 'electron';
import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
export async function verifyCrop(window,recents){
 const evaluate=async code=>{try{return await window.webContents.executeJavaScript(code);}catch(e){console.error('Crop evaluation failed:',code);throw e;}},pause=ms=>new Promise(r=>setTimeout(r,ms));
 async function wait(code){for(let i=0;i<150;i++){if(await evaluate(code))return;await pause(80);}console.error(await evaluate(`({diag:window.previewRenderDiagnostics?.(),text:document.body.innerText.slice(-3000)})`));throw Error('Crop timeout: '+code);}
 const folder=await mkdtemp(join(tmpdir(),'reader-crop-'));
 try{
  const pdf=await PDFDocument.create();pdf.addPage([800,1000]).drawText('Crop test');pdf.addPage([600,800]).drawText('Second page');
  const path=join(folder,'Portrait and landscape.pdf'),original=await pdf.save();await writeFile(path,original);await recents.remember(path);const id=recents.list()[0].id;
  await window.webContents.reload();await wait(`!!document.querySelector('[data-recent-id="${id}"]')`);await evaluate(`document.querySelector('[data-recent-id="${id}"]').click();true`);
  await wait(`window.previewRenderDiagnostics?.()?.totalPages===2&&!window.previewRenderDiagnostics().opening`);
  const menu=Menu.getApplicationMenu();assert.equal(menu.getMenuItemById('view-crop').submenu.items.length,5);
  async function command(id){menu.getMenuItemById(id).click();await pause(500);}
  const geometry=()=>evaluate(`(()=>{const p=document.querySelector('.page'),w=p.closest('.page-wrap'),r=w.getBoundingClientRect(),b=p.getBoundingClientRect(),d=window.previewRenderDiagnostics();return {view:d.readingView,width:r.width,height:r.height,fullWidth:b.width,fullHeight:b.height,x:b.left-r.left,y:b.top-r.top,overflow:getComputedStyle(w).overflow};})()`);
  await command('crop-x-more');let state=await geometry();assert.equal(state.view.cropX,.05);assert.equal(state.overflow,'hidden');assert.ok(Math.abs(state.width-(state.fullWidth-2)*.95-2)<2);assert.ok(Math.abs(state.x+(state.fullWidth-2)*.025)<2);
  await command('crop-y-more');state=await geometry();assert.equal(state.view.cropY,.05);assert.ok(Math.abs(state.height-(state.fullHeight-2)*.95-2)<2);
  assert.ok(await evaluate(`getComputedStyle(document.querySelector('.page-wrap')).boxShadow!=='none'`),'Cropped frame must retain the page shadow');
  await writeFile(join(tmpdir(),'pdfmathreader-crop-shadow.png'),(await window.webContents.capturePage()).toPNG());
  await evaluate(`window.previewSaveReadingView()`);await window.webContents.reload();await wait(`!!document.querySelector('[data-recent-id="${id}"]')`);await evaluate(`document.querySelector('[data-recent-id="${id}"]').click();true`);await wait(`window.previewRenderDiagnostics?.()?.totalPages===2&&!window.previewRenderDiagnostics().opening`);state=await geometry();assert.equal(state.view.cropX,.05);assert.equal(state.view.cropY,.05);
  await command('crop-x-less');assert.equal((await geometry()).view.cropX,0);await command('crop-y-less');assert.equal((await geometry()).view.cropY,0);
  await command('crop-x-more');await command('crop-y-more');await command('crop-reset');state=await geometry();assert.equal(state.view.cropX,0);assert.equal(state.view.cropY,0);
  assert.deepEqual(await readFile(path),Buffer.from(original));console.log('Crop smoke passed: menu, geometry, fit, persistence, less/reset, unchanged PDF');
 }finally{await rm(folder,{recursive:true,force:true});window.close();}
}
