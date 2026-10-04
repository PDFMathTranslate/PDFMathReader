import assert from 'node:assert/strict';
import {app} from 'electron';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createDocumentSession} from './document-session.mjs';
export async function verifySession(first,windows,createWindow){
 const wait=async(target,expression)=>{for(let i=0;i<200;i++){if(await target.webContents.executeJavaScript(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error(expression);};
 const dir=await mkdtemp(join(tmpdir(),'reader-session-smoke-')),store=join(app.getPath('userData'),'document-session.json');
 try{
 await wait(first,'window.previewReady');
 const bytes=await first.webContents.executeJavaScript("fetch('/sample.pdf').then(r=>r.arrayBuffer()).then(b=>Array.from(new Uint8Array(b)))");
 const a=join(dir,'A quieter way to read.pdf'),b=join(dir,'Portrait and landscape.pdf');await writeFile(a,new Uint8Array(bytes));await writeFile(b,new Uint8Array(bytes));
 const view={page:2,offsetX:0,offsetY:.2,zoom:1,fit:'width',direction:'vertical',columns:1,sidebar:false,showTranslations:false};
 const second=await createWindow(a,view),third=await createWindow(b);
 await wait(second,'window.previewReady');await wait(third,'window.previewReady');
 await second.webContents.executeJavaScript('window.previewSaveReadingView()');await third.webContents.executeJavaScript('window.previewSaveReadingView()');
 const restored=(await createDocumentSession(store)).restore();assert.equal(restored.length,2);assert.equal(restored.find(e=>e.path===a).view.page,2);
 second.webContents.send('reader:action','close-document');await wait(second,'window.previewRenderDiagnostics().totalPages===0');
 assert.deepEqual((await createDocumentSession(store)).restore().map(e=>e.path),[b]);
 third.webContents.send('reader:action','close-document');await wait(third,'window.previewRenderDiagnostics().totalPages===0');
 const fallback=(await createDocumentSession(store)).restore();assert.equal(fallback.length,1);assert.equal(fallback[0].path,b);
 await first.webContents.executeJavaScript('window.previewPreferences.save({restoreDocuments:false})');assert.equal(await second.webContents.executeJavaScript('window.previewPreferences.load().then(p=>p.restoreDocuments)'),false);
 console.log(JSON.stringify({passed:true,multipleDocuments:true,restoredPosition:true,lastClosedFallback:true,sharedOptOut:true}));
 }finally{await rm(dir,{recursive:true,force:true});}app.quit();
}
