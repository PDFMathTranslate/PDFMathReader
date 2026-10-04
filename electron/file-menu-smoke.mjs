import assert from 'node:assert/strict';
import {app,Menu} from 'electron';
import {PDFDocument} from 'pdf-lib';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
export async function verifyFileMenu(window,recents){
 const evaluate=code=>window.webContents.executeJavaScript(code);
 const wait=async code=>{for(let i=0;i<300;i++){if(await evaluate(code))return;await new Promise(resolve=>setTimeout(resolve,50));}throw Error('File menu timed out: '+code);};
 const menu=()=>Menu.getApplicationMenu(),file=()=>menu().getMenuItemById('file-menu').submenu;
 const dir=await mkdtemp(join(tmpdir(),'file-menu-'));
 try{
  await wait('window.previewReady===true');
  assert.ok(menu().getMenuItemById('edit-menu').submenu.items.some(item=>item.id==='edit-preferences'));
  assert.ok(!file().items.some(item=>item.id==='file-preferences'));
  assert.equal(menu().getMenuItemById('file-recents').enabled,false);
  assert.ok(!menu().getMenuItemById('file-recents').submenu);
  assert.equal(menu().getMenuItemById('file-recents-empty').enabled,false);
  menu().getMenuItemById('edit-preferences').click(undefined,window);
  await wait('!!document.querySelector("[data-setting=restore-documents]")');
  window.webContents.send('reader:action','settings');
  const path=join(dir,'Portrait and landscape.pdf'),pdf=await PDFDocument.create();pdf.addPage();await writeFile(path,await pdf.save());
  await recents.remember(path);const id=recents.list()[0].id;
  const item=menu().getMenuItemById('recent-document-'+id);
  assert.equal(item.label,'Portrait and landscape.pdf');assert.equal(item.enabled,true);
  assert.ok(!menu().getMenuItemById('file-recents-empty'));
  await item.click(undefined,window);
  await wait('window.previewRenderDiagnostics?.().totalPages===1 && !window.previewRenderDiagnostics().opening');
  await recents.remove(id);
  assert.ok(!menu().getMenuItemById('recent-document-'+id));
  assert.equal(menu().getMenuItemById('file-recents-empty').enabled,false);
  assert.equal(menu().getMenuItemById('edit-rotate-page').enabled,true);
  console.log('File menu smoke passed: inline recent section, preferences in Edit, opening document, dynamic updates, preserved page actions.');
 }finally{await rm(dir,{recursive:true,force:true});}
 app.exit(0);
}
