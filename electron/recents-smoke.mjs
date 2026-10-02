import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {mkdtemp,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
export async function verifyRecents(window,recents){
 const dir=await mkdtemp(join(tmpdir(),'recent-pdf-')),path=join(dir,'Portrait and landscape.pdf');const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);pdf.addPage().drawText('Recent document preview',{x:40,y:650,size:24,font});await writeFile(path,await pdf.save());
 const evaluate=code=>window.webContents.executeJavaScript(code);const pause=ms=>new Promise(r=>setTimeout(r,ms));async function wait(code){for(let i=0;i<100;i++){if(await evaluate(code))return;await pause(50);}throw Error('Recent UI assertion timed out');}
 try{
 await recents.remember(path);await window.webContents.reload();await wait(`!!document.querySelector('.recent-document')`);await wait(`document.querySelector('.recent-document img')?.naturalWidth>0`);assert.equal(await evaluate(`document.querySelector('.recent-document').textContent.trim()`),'');assert.equal(await evaluate(`document.querySelector('.recent-document').getAttribute('aria-label')`),'Open Portrait and landscape.pdf');assert.equal(await evaluate(`document.querySelector('.empty').classList.contains('has-recents')`),true);
 for(let i=0;i<5;i++){const folder=join(dir,String(i));await mkdir(folder);const fixture=join(folder,'Portrait and landscape.pdf'),doc=await PDFDocument.create(),face=await doc.embedFont(StandardFonts.Helvetica);const page=doc.addPage(i%2?[792,612]:[612,792]);page.drawText('Preview '+(i+2),{x:40,y:page.getHeight()-80,size:30,font:face});await writeFile(fixture,await doc.save());await recents.remember(fixture);}
 await window.webContents.reload();await wait(`document.querySelectorAll('.recent-document img').length===6&&Array.from(document.querySelectorAll('.recent-document img')).every(image=>image.naturalWidth>0)`);
 window.setSize(800,650);await pause(300);
 const gallery=await evaluate(`(()=>{const list=document.querySelector('.recent-gallery'),cards=[...list.querySelectorAll('.recent-document')].map(card=>card.getBoundingClientRect());return {overflow:list.scrollWidth>list.clientWidth,tops:cards.map(card=>card.top),labels:[...list.querySelectorAll('button')].map(card=>card.textContent.trim()),ratios:[...list.querySelectorAll('img')].map(image=>{const box=image.getBoundingClientRect();return [box.width/box.height,image.naturalWidth/image.naturalHeight];})};})()`);
 assert.equal(gallery.overflow,true);assert.ok(gallery.tops.every(top=>Math.abs(top-gallery.tops[0])<1));assert.ok(gallery.labels.every(label=>label===''));for(const [display,native] of gallery.ratios)assert.ok(Math.abs(display-native)<.02);
 assert.ok(recents.list().every(entry=>entry.thumbnail?.startsWith('data:image/png;base64,')));
 await writeFile('/tmp/pdfmathreader-recent-gallery.png',(await window.webContents.capturePage()).toPNG());
 await window.webContents.reload();await wait(`document.querySelectorAll('.recent-document img').length===6&&Array.from(document.querySelectorAll('.recent-document img')).every(image=>image.naturalWidth>0)`);
 await writeFile('/tmp/pdfmathreader-recent-gallery.json',JSON.stringify({realPagePreviews:true,horizontalGallery:true,horizontalOverflow:true,noVisibleFilenames:true,aspectRatiosPreserved:true,persistedPreviews:true}));
 await evaluate(`document.querySelector('.recent-document').click();true`);await wait(`!!document.querySelector('.page canvas')?.width&&!window.previewRenderDiagnostics().opening`);await recents.clear();await window.webContents.reload();await wait(`!!document.querySelector('.empty')`);assert.equal(await evaluate(`document.querySelectorAll('.recent-documents').length`),0);
 await recents.remember(path);await window.webContents.reload();await wait(`!!document.querySelector('.recent-heading button')`);await evaluate(`document.querySelector('.recent-heading button').click();true`);await wait(`!document.querySelector('.recent-documents')`);assert.deepEqual(recents.list(),[]);await window.webContents.reload();await wait(`!!document.querySelector('.empty')`);assert.equal(await evaluate(`document.querySelectorAll('.recent-documents').length`),0);console.log('Recent documents: reopen, startup positioning, Clear, and cleared-history reload passed.');
 }finally{await rm(dir,{recursive:true,force:true});}
}
