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
  await wait('window.previewReady');window.show();window.focus();
  await evaluate(`document.querySelector('button[aria-label="Translation settings"]').click()`);await wait(`!!document.querySelector('[data-setting="default-page-crop"]')`);
  assert.deepEqual(await evaluate(`(async()=>{const p=await window.previewPreferences.load();return [p.defaultPageCropEnabled,p.autoAlignDocumentWidth]})()`),[false,false]);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('.crop-sliders [role="slider"]')].map(e=>e.getAttribute('aria-valuemax'))`),['50','50']);
  await evaluate(`document.querySelector('[aria-labelledby="default-page-crop-label"]').click()`);await wait(`(async()=> (await window.previewPreferences.load()).defaultPageCropEnabled)()`);
  await evaluate(`(()=>{const s=document.querySelector('.crop-sliders [role="slider"]');s.focus();s.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true}));})()`);await wait(`(async()=> (await window.previewPreferences.load()).defaultPageCropX===.5)()`);
  await evaluate(`document.querySelector('[aria-labelledby="default-page-crop-label"]').click();document.querySelector('button[aria-label="Close settings"]').click()`);
  const pdf=await PDFDocument.create();pdf.addPage([800,1000]).drawText('Crop test');pdf.addPage([600,800]).drawText('Second page');
  const path=join(folder,'Portrait and landscape.pdf'),original=await pdf.save();await writeFile(path,original);await recents.remember(path);const id=recents.list()[0].id;
  if(await evaluate('window.previewRenderDiagnostics().totalPages>0')){Menu.getApplicationMenu().getMenuItemById('file-close-document').click();await wait('window.previewRenderDiagnostics().totalPages===0');await pause(400);}await evaluate('window.previewDocuments.closed()');await new Promise(resolve=>{window.webContents.once('did-finish-load',resolve);window.webContents.reload();});await wait('window.previewReady');await wait(`!!document.querySelector('[data-recent-id="${id}"]')`);await evaluate(`document.querySelector('[data-recent-id="${id}"]').click();true`);
  await wait(`window.previewRenderDiagnostics?.()?.totalPages===2&&!window.previewRenderDiagnostics().opening`);
  const menu=Menu.getApplicationMenu();const viewItems=menu.getMenuItemById('view-menu').submenu.items;const cropTitle=viewItems.findIndex(item=>item.id==='view-crop');assert.equal(viewItems[cropTitle].enabled,false);assert.equal(viewItems[cropTitle].submenu,null);assert.deepEqual(viewItems.slice(cropTitle+1,cropTitle+6).map(item=>item.id),['crop-x-more','crop-x-less','crop-y-more','crop-y-less','crop-reset']);
  async function command(id){menu.getMenuItemById(id).click();await pause(500);}
  const geometry=async()=>{await wait(`!!document.querySelector('.page')&&!!window.previewRenderDiagnostics()?.readingView`);return evaluate(`(()=>{const p=document.querySelector('.page'),w=p.closest('.page-wrap'),r=w.getBoundingClientRect(),b=p.getBoundingClientRect(),d=window.previewRenderDiagnostics();return {view:d.readingView,width:r.width,height:r.height,fullWidth:b.width,fullHeight:b.height,x:b.left-r.left,y:b.top-r.top,overflow:getComputedStyle(w).overflow};})()`);};
  await command('crop-x-more');let state=await geometry();assert.equal(state.view.cropX,.05);assert.equal(state.overflow,'clip');assert.ok(Math.abs(state.width-(state.fullWidth-2)*.95-2)<2);assert.ok(Math.abs(state.x+(state.fullWidth-2)*.025)<2);
  await command('crop-y-more');state=await geometry();assert.equal(state.view.cropY,.05);assert.ok(Math.abs(state.height-(state.fullHeight-2)*.95-2)<2);
  assert.ok(await evaluate(`getComputedStyle(document.querySelector('.page-wrap')).boxShadow!=='none'`),'Cropped frame must retain the page shadow');
  await writeFile(join(tmpdir(),'pdfmathreader-crop-shadow.png'),(await window.webContents.capturePage()).toPNG());
  await evaluate(`window.previewSaveReadingView()`);if(await evaluate('window.previewRenderDiagnostics().totalPages>0')){Menu.getApplicationMenu().getMenuItemById('file-close-document').click();await wait('window.previewRenderDiagnostics().totalPages===0');await pause(400);}await evaluate('window.previewDocuments.closed()');await new Promise(resolve=>{window.webContents.once('did-finish-load',resolve);window.webContents.reload();});await wait('window.previewReady');await wait(`!!document.querySelector('[data-recent-id="${id}"]')`);await evaluate(`document.querySelector('[data-recent-id="${id}"]').click();true`);await wait(`window.previewRenderDiagnostics?.()?.totalPages===2&&!window.previewRenderDiagnostics().opening`);state=await geometry();assert.equal(state.view.cropX,.05);assert.equal(state.view.cropY,.05);
  await command('crop-x-less');assert.equal((await geometry()).view.cropX,0);await command('crop-y-less');assert.equal((await geometry()).view.cropY,0);
  await command('crop-x-more');await command('crop-y-more');await command('crop-reset');state=await geometry();assert.equal(state.view.cropX,0);assert.equal(state.view.cropY,0);
  assert.deepEqual(await readFile(path),Buffer.from(original));
  // Opening defaults must crop only the view; alignment must update the source.
  const freshFolder=await mkdtemp(join(folder,'defaults-')),freshPath=join(freshFolder,'Portrait and landscape.pdf');
  await writeFile(freshPath,original);await recents.remember(freshPath);const freshId=recents.list()[0].id;
  await evaluate(`window.previewPreferences.save({defaultPageCropEnabled:true,defaultPageCropX:.5,defaultPageCropY:.2,autoAlignDocumentWidth:false,documentOpenMode:'original'})`);
  async function reopen(id){if(await evaluate('window.previewRenderDiagnostics().totalPages>0')){Menu.getApplicationMenu().getMenuItemById('file-close-document').click();await wait('window.previewRenderDiagnostics().totalPages===0');await pause(400);}await evaluate('window.previewDocuments.closed()');await new Promise(resolve=>{window.webContents.once('did-finish-load',resolve);window.webContents.reload();});await wait('window.previewReady');await wait(`!!document.querySelector('[data-recent-id="${id}"]')`);await evaluate(`document.querySelector('[data-recent-id="${id}"]').click();true`);await wait(`window.previewRenderDiagnostics?.()?.totalPages===2&&!window.previewRenderDiagnostics().opening&&!!document.querySelector('.page canvas')?.width`);}
  await reopen(freshId);state=await geometry();assert.equal(state.view.cropX,.5);assert.equal(state.view.cropY,.2);assert.deepEqual(await readFile(freshPath),Buffer.from(original));
  await evaluate('window.previewSaveReadingView()');await evaluate(`window.previewPreferences.save({defaultPageCropX:.1,defaultPageCropY:.1,autoAlignDocumentWidth:true})`);
  await reopen(freshId);
  for(let i=0;i<150;i++){if((await PDFDocument.load(await readFile(freshPath))).getPage(1).getWidth()===800)break;await pause(80);}
  const aligned=await PDFDocument.load(await readFile(freshPath));assert.equal(aligned.getPage(1).getWidth(),800);assert.ok(Math.abs(aligned.getPage(1).getHeight()-800*800/600)<.001);
  await wait(`window.previewRenderDiagnostics?.()?.totalPages===2&&!window.previewRenderDiagnostics().opening&&!!document.querySelector('.page canvas')?.width`);await pause(500);
  state=await geometry();assert.equal(state.view.cropX,.5);assert.equal(state.view.cropY,.2);
  const alignedBytes=await readFile(freshPath);await evaluate('window.previewSaveReadingView()');await reopen(freshId);await pause(500);assert.deepEqual(await readFile(freshPath),alignedBytes);
  console.log('Crop smoke passed: crop defaults, saved view precedence, source preservation, automatic width alignment and no-op reopen');
 }finally{await rm(folder,{recursive:true,force:true});window.close();}
}
