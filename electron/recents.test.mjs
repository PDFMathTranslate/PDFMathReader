import test from 'node:test';
import assert from 'node:assert/strict';
import {access,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRecents,validateTranslationStatus} from './recents.mjs';

test('translation status persists across remember and reload, then removal persists',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'pdfmathreader-recents-')),storage=join(dir,'recent-documents.json'),file=join(dir,'Portrait and landscape.pdf');
 try{
  await writeFile(file,'fixture');
  const recents=await createRecents(storage);
  await recents.remember(file);
  const id=recents.list()[0].id,status={totalPages:4,completedPages:2,partialPages:1,failedPages:1,engine:'pdf_math_precise',language:'English',updatedAt:Date.now()};
  await recents.setTranslationStatus(id,status);
  assert.deepEqual(recents.list()[0].translationStatus,status);
  await recents.remember(file);
  assert.deepEqual(recents.list()[0].translationStatus,status);
  const reloaded=await createRecents(storage);
  assert.deepEqual(reloaded.list()[0].translationStatus,status);
  await reloaded.remove(id);
  assert.deepEqual(reloaded.list(),[]);
  await access(file);
  assert.deepEqual((await createRecents(storage)).list(),[]);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('invalid translation status is rejected and omitted while loading',async()=>{
 const invalid={totalPages:2,completedPages:2,partialPages:1,failedPages:0,engine:'unknown',language:'English',updatedAt:Date.now()};
 assert.throws(()=>validateTranslationStatus(invalid),/Invalid recent document translation status/);
 const dir=await mkdtemp(join(tmpdir(),'pdfmathreader-recents-')),storage=join(dir,'recent-documents.json');
 try{
  await writeFile(storage,JSON.stringify([{id:'recent-id',path:'/tmp/Portrait and landscape.pdf',translationStatus:invalid}]));
  const recents=await createRecents(storage);
  assert.equal(recents.list()[0].translationStatus,undefined);
 }finally{await rm(dir,{recursive:true,force:true});}
});
