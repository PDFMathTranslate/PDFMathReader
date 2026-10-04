import assert from 'node:assert/strict';
import {app} from 'electron';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
export async function verifyLargeOpen(window,recents){
 const evaluate=code=>window.webContents.executeJavaScript(code);
 const wait=async code=>{for(let i=0;i<1200;i++){if(await evaluate(code))return;await new Promise(r=>setTimeout(r,25));}throw Error('Large open timed out: '+code);};
 const root=await mkdtemp(join(tmpdir(),'large-open-')),path=join(root,'Portrait and landscape.pdf');
 try{
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
  for(let i=0;i<1000;i++){const page=pdf.addPage(i%2?[792,612]:[612,792]);page.drawText('Large document page '+(i+1),{x:30,y:300,font,size:18});}
  pdf.context.register(pdf.context.stream(new Uint8Array(16*1024*1024)));
  const bytes=await pdf.save({useObjectStreams:false});await writeFile(path,bytes);await recents.remember(path);
  await evaluate('window.previewPreferences.save({automatic:false,reduceMotion:true})');
  const loaded=new Promise(r=>window.webContents.once('did-finish-load',r));window.webContents.reload();await loaded;
  await wait('window.previewReady===true && !!document.querySelector(".recent-document")');
  const started=Date.now();await evaluate('document.querySelector(".recent-document").click()');
  await wait('window.previewRenderDiagnostics?.().totalPages===1000 && !window.previewRenderDiagnostics().opening && window.previewRenderDiagnostics().metrics.firstPageMs!==null');
  const report=await evaluate('window.previewPerformanceReport()');
  assert.ok(await evaluate('document.querySelector(".page canvas")?.width>0'));
  console.log('Large start-page open',JSON.stringify({fileBytes:bytes.length,clickToReadyMs:Date.now()-started,firstScreenMs:report.firstScreenMs,stages:report.stages}));
 }finally{await rm(root,{recursive:true,force:true});}
 app.exit(0);
}
