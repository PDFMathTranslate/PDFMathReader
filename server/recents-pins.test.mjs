import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createRecents} from '../electron/recents.mjs';

const status={totalPages:2,completedPages:1,partialPages:1,failedPages:0,engine:'pdf_math_precise',language:'English',updatedAt:1};

test('pinned state reloads, is listed, and survives remember',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pdfmathreader-recents-pins-')),storage=join(dir,'recent-documents.json'),legacy=join(dir,'legacy.pdf'),file=join(dir,'pinned.pdf');
 try{
  await writeFile(storage,JSON.stringify([{id:'legacy-id',path:legacy}]));
  await writeFile(file,'fixture');
  const recents=await createRecents(storage);
  assert.equal(recents.list()[0].pinned,false);
  await recents.remember(file);
  const id=recents.list().find(entry=>entry.name==='pinned.pdf').id;
  await recents.setPinned(id,true);
  await recents.remember(file);
  assert.equal(recents.list().find(entry=>entry.id===id).pinned,true);
  assert.equal(JSON.parse(await readFile(storage,'utf8')).find(entry=>entry.id===id).pinned,true);
  const reloaded=await createRecents(storage);
  assert.equal(reloaded.list().find(entry=>entry.id===id).pinned,true);
  assert.equal(reloaded.list()[0].id,id);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('pinned documents sort first and survive eviction of more than ten unpinned documents',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pdfmathreader-recents-pins-')),storage=join(dir,'recent-documents.json'),pinnedFile=join(dir,'pinned.pdf');
 try{
  await writeFile(pinnedFile,'fixture');
  const recents=await createRecents(storage);
  await recents.remember(pinnedFile);
  const pinnedId=recents.list()[0].id;
  await recents.setPinned(pinnedId,true);
  for(let index=0;index<11;index++){
   const file=join(dir,`recent-${index}.pdf`);
   await writeFile(file,'fixture');
   await recents.remember(file);
  }
  const listed=recents.list();
  assert.equal(listed.length,11);
  assert.equal(listed[0].id,pinnedId);
  assert.equal(listed[0].pinned,true);
  assert.equal(listed.some(entry=>entry.name==='recent-0.pdf'),false);
  assert.deepEqual(listed.slice(1).map(entry=>entry.name),Array.from({length:10},(_,index)=>`recent-${10-index}.pdf`));
  assert.deepEqual((await createRecents(storage)).list(),listed);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('unpinning enforces the ten-document unpinned limit',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pdfmathreader-recents-pins-')),storage=join(dir,'recent-documents.json'),pinnedFile=join(dir,'pinned.pdf');
 try{
  await writeFile(pinnedFile,'fixture');
  const recents=await createRecents(storage);
  await recents.remember(pinnedFile);
  const pinnedId=recents.list()[0].id;
  await recents.setPinned(pinnedId,true);
  for(let index=0;index<10;index++){
   const file=join(dir,`recent-${index}.pdf`);
   await writeFile(file,'fixture');
   await recents.remember(file);
  }
  assert.equal(recents.list().length,11);
  const unpinned=await recents.setPinned(pinnedId,false);
  assert.equal(unpinned.length,10);
  assert.equal(unpinned.every(entry=>entry.pinned===false),true);
  assert.equal(JSON.parse(await readFile(storage,'utf8')).length,10);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('clear preserves pins and clearTranslationStatus removes the saved snapshot',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pdfmathreader-recents-pins-')),storage=join(dir,'recent-documents.json'),pinnedFile=join(dir,'pinned.pdf'),otherFile=join(dir,'other.pdf');
 try{
  await writeFile(pinnedFile,'fixture');
  await writeFile(otherFile,'fixture');
  const recents=await createRecents(storage);
  await recents.remember(pinnedFile);
  const pinnedId=recents.list()[0].id;
  await recents.setPinned(pinnedId,true);
  await recents.remember(otherFile);
  const otherId=recents.list().find(entry=>entry.name==='other.pdf').id;
  await recents.setTranslationStatus(pinnedId,status);
  await recents.setTranslationStatus(otherId,status);
  await recents.clearTranslationStatus(pinnedId);
  assert.equal(recents.list().find(entry=>entry.id===pinnedId).translationStatus,undefined);
  assert.deepEqual(recents.list().find(entry=>entry.id===otherId).translationStatus,status);
  assert.equal(Object.hasOwn(JSON.parse(await readFile(storage,'utf8')).find(entry=>entry.id===pinnedId),'translationStatus'),false);
  await recents.clear();
  assert.deepEqual(recents.list(),[{id:pinnedId,name:'pinned.pdf',thumbnail:undefined,pinned:true}]);
  assert.equal(recents.path(pinnedId),pinnedFile);
  const reloaded=await createRecents(storage);
  assert.deepEqual(reloaded.list(),recents.list());
 }finally{await rm(dir,{recursive:true,force:true});}
});
