import assert from 'node:assert/strict';
import {app,Menu} from 'electron';
import {PDFDocument} from 'pdf-lib';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
export async function verifyPageEdits(window,recents){
 const run=code=>window.webContents.executeJavaScript(code);
 async function wait(code){for(let i=0;i<300;i++){if(await run(code))return;await new Promise(r=>setTimeout(r,50));}throw Error('Page edit smoke timeout: '+code+' '+await run('document.body.innerText.slice(0,600)'));}
 const folder=await mkdtemp(join(tmpdir(),'page-edits-smoke-'));
 try{
  await wait('window.previewReady');await run('window.previewPreferences.save({automatic:false,documentOpenMode:"original"})');
  const pdf=await PDFDocument.create();for(const size of [[600,800],[600,800],[300,400]])pdf.addPage(size).drawText('Page edit test',{x:30,y:100,size:12});
  const path=join(folder,'Portrait and landscape.pdf');await writeFile(path,await pdf.save());await recents.remember(path);const id=recents.list()[0].id;
  await new Promise(r=>{window.webContents.once('did-finish-load',r);window.webContents.reload();});await wait('window.previewReady');await run(`document.querySelector('[data-recent-id="${id}"]').click()`);await wait('window.previewRenderDiagnostics().totalPages===3&&!!document.querySelector(".page canvas")?.width');
  const menu=Menu.getApplicationMenu();for(const id of ['edit-rotate-page','edit-align-width','edit-align-height'])assert(menu.getMenuItemById('edit-menu').submenu.items.some(item=>item.id===id));
  menu.getMenuItemById('edit-align-width').click();
  for(let i=0;i<200;i++){if((await PDFDocument.load(await readFile(path))).getPage(2).getWidth()===600)break;await new Promise(r=>setTimeout(r,50));}
  assert.equal((await PDFDocument.load(await readFile(path))).getPage(2).getHeight(),800);
  await wait('!document.querySelector(".workspace.document-opening")&&document.querySelectorAll(".page").length>0');await new Promise(r=>setTimeout(r,500));
  const page=await run('window.previewRenderDiagnostics().active');menu.getMenuItemById('edit-rotate-page').click();
  for(let i=0;i<200;i++){if((await PDFDocument.load(await readFile(path))).getPage(page-1).getRotation().angle===90)break;await new Promise(r=>setTimeout(r,50));}
  assert.equal((await PDFDocument.load(await readFile(path))).getPage(page-1).getRotation().angle,90);
  await wait('!!document.querySelector(".page canvas")?.width');console.log('Page edit native menu, original-file autosave and renderer reload passed.');app.exit(0);
 }finally{await rm(folder,{recursive:true,force:true});}
}
