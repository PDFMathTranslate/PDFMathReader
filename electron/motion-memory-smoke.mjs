// Real Chromium canvas allocation/disposal check; isolated from reader data.
import {app,BrowserWindow} from 'electron';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {rectangleTransform,motionCanvasSize,captureDocumentPage,releaseDocumentCapture,animateDocumentPage} from '../src/document-motion.mjs';
void (async()=>{
await app.whenReady();
const window=new BrowserWindow({width:500,height:700,show:true,webPreferences:{backgroundThrottling:false,contextIsolation:true,nodeIntegration:false,sandbox:true}});
try{
 await window.loadURL('data:text/html,<html><body></body></html>');
 const functions=[rectangleTransform,motionCanvasSize,captureDocumentPage,releaseDocumentCapture,animateDocumentPage].map(fn=>fn.toString()).join('\n');
 const result=await window.webContents.executeJavaScript(`(async()=>{
  ${functions}
  const page=document.createElement('div'),original=document.createElement('canvas');
  Object.assign(page.style,{width:'400px',height:'600px'});
  original.width=original.height=4096;original.style.width='400px';original.style.height='600px';
  original.getContext('2d').fillRect(0,0,100,100);page.append(original);document.body.append(page);
  const capture=captureDocumentPage(page),clone=capture.element.querySelector('canvas');
  const snapshotBytes=clone.width*clone.height*4,sourceBytes=original.width*original.height*4;
  await animateDocumentPage(capture,capture.rect,capture.rect);
  const completedDisposed=clone.width===0&&clone.height===0&&!capture.element.isConnected;
  const cancelled=captureDocumentPage(page),cancelledCanvas=cancelled.element.querySelector('canvas'),controller=new AbortController();controller.abort();
  await animateDocumentPage(cancelled,cancelled.rect,cancelled.rect,{signal:controller.signal});
  const cancelledDisposed=cancelledCanvas.width===0&&cancelledCanvas.height===0;
  return {sourceBytes,snapshotBytes,completedDisposed,cancelledDisposed,originalIntact:original.width===4096&&original.height===4096,snapshots:document.querySelectorAll('.document-motion-snapshot').length};
 })()`);
 assert.equal(result.sourceBytes,64*1024*1024);assert.ok(result.snapshotBytes<=8*1024*1024);
 assert.equal(result.completedDisposed,true);assert.equal(result.cancelledDisposed,true);assert.equal(result.originalIntact,true);assert.equal(result.snapshots,0);
 await writeFile('/tmp/pdfmathreader-motion-memory.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{window.destroy();app.quit();}
})().catch(error=>{console.error(error);app.exit(1);});
