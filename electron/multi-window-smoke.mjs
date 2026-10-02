import assert from 'node:assert/strict';
import {app} from 'electron';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {writeFile,mkdtemp,rm} from 'node:fs/promises';

export async function verifyMultiWindow(first,windows,createWindow){
 const wait=async(window,expression)=>{for(let i=0;i<200;i++){if(await window.webContents.executeJavaScript(expression))return;await new Promise(resolve=>setTimeout(resolve,100));}throw Error('Multi-window check timed out: '+expression);};
 const sample=window=>window.webContents.executeJavaScript("document.querySelector('.empty > button:not(.primary)').click()");
 await wait(first,"!!document.querySelector('.empty > button:not(.primary)')");await sample(first);
 await wait(first,"window.previewRenderDiagnostics?.().totalPages>0");
 const firstState=windows.get(first),firstPages=await first.webContents.executeJavaScript('window.previewRenderDiagnostics().totalPages');
 // Opening a second PDF from the existing reader must create a new window.
 await first.webContents.executeJavaScript(`(async()=>{const bytes=new Uint8Array(await (await fetch('/sample.pdf')).arrayBuffer());const input=document.querySelector('input[type=file]'),data=new DataTransfer();data.items.add(new File([bytes],'A quieter way to read.pdf',{type:'application/pdf'}));input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 for(let i=0;i<100&&windows.size<2;i++)await new Promise(resolve=>setTimeout(resolve,50));assert.equal(windows.size,2);
 const second=[...windows.keys()].find(window=>window!==first);await wait(second,'window.previewRenderDiagnostics?.().totalPages>0');
 const secondState=windows.get(second);
 assert.notEqual(first.webContents.getOSProcessId(),second.webContents.getOSProcessId());
 assert.notEqual(firstState.backend.processId,secondState.backend.processId);
 assert.notEqual(firstState.backend.origin,secondState.backend.origin);
 assert.equal(await first.webContents.executeJavaScript('window.previewRenderDiagnostics().totalPages'),firstPages);
 await second.webContents.executeJavaScript("window.previewPreferences.save({direction:'horizontal',columns:2,fit:'width',zoom:1,translationMode:'reading'})");
 assert.equal(await first.webContents.executeJavaScript("window.previewPreferences.load().then(state=>state.direction)"),'vertical');
 assert.equal(await second.webContents.executeJavaScript("window.previewPreferences.load().then(state=>state.direction)"),'horizontal');
 // Each window's IPC must report its own activity.
 second.hide();await wait(second,'window.previewActivity.current().then(active=>!active)');assert.equal(await second.webContents.executeJavaScript('window.previewActivity.current()'),false);
 assert.equal(await first.webContents.executeJavaScript('window.previewActivity.current()'),true);second.show();
 // Closing a document only clears that window.
 // Use the same menu action exposed to this renderer by the desktop shell.
 second.webContents.send('reader:action','close-document');await wait(second,'window.previewRenderDiagnostics?.().totalPages===0');
 assert.equal(await first.webContents.executeJavaScript('window.previewRenderDiagnostics().totalPages'),firstPages);
 // Closing a native window stops its backend but leaves its sibling running.
 second.close();for(let i=0;i<100&&windows.has(second);i++)await new Promise(resolve=>setTimeout(resolve,50));
 assert.equal(windows.size,1);assert.equal(first.isDestroyed(),false);
 assert.equal(await first.webContents.executeJavaScript("fetch('/api/config').then(r=>r.status)"),200);
 const bytes=await first.webContents.executeJavaScript("fetch('/sample.pdf').then(r=>r.arrayBuffer()).then(b=>Array.from(new Uint8Array(b)))");
 const folder=await mkdtemp(join(tmpdir(),'multi-window-'));const path=join(folder,'Portrait and landscape.pdf');await writeFile(path,new Uint8Array(bytes));app.emit('second-instance',{},[app.getPath('exe'),path],'/tmp');
 for(let i=0;i<100&&windows.size<2;i++)await new Promise(resolve=>setTimeout(resolve,50));
 const delivered=[...windows.keys()].find(window=>window!==first);assert.ok(delivered);await wait(delivered,'window.previewRenderDiagnostics?.().totalPages>0');
 assert.equal(await first.webContents.executeJavaScript('window.previewRenderDiagnostics().totalPages'),firstPages);delivered.close();
 for(let i=0;i<100&&windows.has(delivered);i++)await new Promise(resolve=>setTimeout(resolve,50));
 const recentId=await first.webContents.executeJavaScript("window.previewRecents.list().then(entries=>entries.find(entry=>entry.name==='Portrait and landscape.pdf').id)");
 await first.webContents.executeJavaScript(`window.previewRecents.openWindow(${JSON.stringify(recentId)})`);
 const recentWindow=[...windows.keys()].find(window=>window!==first);await wait(recentWindow,'window.previewRenderDiagnostics?.().totalPages>0');
 assert.equal(await first.webContents.executeJavaScript('window.previewRenderDiagnostics().totalPages'),firstPages);recentWindow.close();
 for(let i=0;i<100&&windows.has(recentWindow);i++)await new Promise(resolve=>setTimeout(resolve,50));
 await rm(folder,{recursive:true,force:true});const third=await createWindow();await wait(third,"!!document.querySelector('.empty')");assert.equal(windows.size,2);
 const result={passed:true,independentRendererProcesses:true,independentBackendProcesses:true,secondPDFPreservesFirst:true,ipcScopedToWindow:true,closeDocumentIsolated:true,closeWindowIsolated:true,newWindow:true,secondInstanceDeliveryIsolated:true,recentDocumentDeliveryIsolated:true,windowPreferencesIsolated:true};
 await writeFile('/tmp/preview-multi-window-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));app.quit();
}
