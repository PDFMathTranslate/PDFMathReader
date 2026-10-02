import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
export async function verifyFitWidth(window,recents){
 const evaluate=code=>window.webContents.executeJavaScript(code),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 async function wait(code){for(let i=0;i<150;i++){if(await evaluate(code))return;await pause(80);}throw Error('Fit width timeout: '+code);}
 const folder=await mkdtemp(join(tmpdir(),'reader-fit-width-'));
 try{
  const pdf=await PDFDocument.create();for(const width of [800,600,800,600])pdf.addPage([width,1000]);
  const path=join(folder,'Portrait and landscape.pdf');await writeFile(path,await pdf.save());await recents.remember(path);const id=recents.list()[0].id;
  await window.webContents.reload();await wait(`!!document.querySelector('[data-recent-id="${id}"]')`);
  await evaluate(`document.querySelector('[data-recent-id="${id}"]').click();true`);
  await wait(`window.previewRenderDiagnostics()?.totalPages===4&&!window.previewRenderDiagnostics().opening`);
  window.webContents.send('reader:action','fit-width');await pause(500);
  const state=()=>evaluate(`(()=>{const d=window.previewRenderDiagnostics(),r=document.querySelector('.reader'),s=getComputedStyle(r),p=document.querySelector('.page[data-page="'+d.readingView.page+'"]');return {view:d.readingView,width:p.getBoundingClientRect().width,left:p.getBoundingClientRect().left-(r.getBoundingClientRect().left+parseFloat(s.paddingLeft)),available:r.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight)};})()`);
  const wide=await state();assert.equal(wide.view.page,1);assert.ok(Math.abs(wide.width-wide.available)<2);
  // Scroll into the narrower page with a known page-relative reading anchor.
  await evaluate(`(()=>{const r=document.querySelector('.reader'),p=document.querySelector('.page[data-page="2"]'),s=getComputedStyle(r),b=p.getBoundingClientRect();r.scrollTop+=b.top-r.getBoundingClientRect().top-parseFloat(s.paddingTop)+b.height*.2;return true;})()`);
  await wait(`window.previewRenderDiagnostics().readingView.page===2`);await pause(650);
  const narrow=await state();assert.equal(narrow.view.page,2);assert.ok(Math.abs(narrow.width-narrow.available)<2,'narrow page fills viewport');assert.ok(Math.abs(narrow.left)<2,'whole page is visible horizontally');assert.ok(narrow.view.zoom>wide.view.zoom*1.3);assert.ok(Math.abs(narrow.view.offsetY-.2)<.005,'reading anchor survives refit '+JSON.stringify(narrow));
  await pause(500);const stable=await state();assert.equal(stable.view.page,2);assert.ok(Math.abs(stable.view.zoom-narrow.view.zoom)<.0001,'fit stays stable');
  window.webContents.send('reader:action','percent:75');await wait(`window.previewRenderDiagnostics().readingView.page===3`);await pause(500);
  const back=await state();assert.ok(Math.abs(back.width-back.available)<2,'wide page refits after navigation');assert.ok(back.view.zoom<narrow.view.zoom);
  window.webContents.send('reader:action','zoom-in');await pause(350);const manual=await state();assert.equal(manual.view.fit,'manual');
  window.webContents.send('reader:action','percent:100');await pause(500);assert.equal((await state()).view.zoom,manual.view.zoom,'manual zoom stays unchanged across page widths');
  console.log('Mixed-width fit smoke passed:',JSON.stringify({wide:wide.view.zoom,narrow:narrow.view.zoom,anchor:narrow.view.offsetY,stable:true,manual:true}));
 }finally{await rm(folder,{recursive:true,force:true});window.close();}
}
