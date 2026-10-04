import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createDocumentSession} from '../electron/document-session.mjs';
const view={page:8,offsetX:0,offsetY:.3,zoom:1,fit:'width',direction:'vertical',columns:1,sidebar:false,showTranslations:true};
test('session persists multiple documents and positions; closing all restores only the last closed document',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'reader-session-'));try{
 const path=join(dir,'session.json'),session=await createDocumentSession(path);
 await session.open(1,{path:'/tmp/a.pdf'});await session.open(2,{path:'/tmp/b.pdf'});await session.update(1,view);
 assert.deepEqual((await createDocumentSession(path)).restore(),[{path:'/tmp/a.pdf',view},{path:'/tmp/b.pdf'}]);
 const before=(await stat(path)).mtimeMs;await session.update(1,view);assert.equal((await stat(path)).mtimeMs,before);
 await session.close(2);assert.deepEqual((await createDocumentSession(path)).restore(),[{path:'/tmp/a.pdf',view}]);
 await session.close(1);await session.close(1);assert.deepEqual((await createDocumentSession(path)).restore(),[{path:'/tmp/a.pdf',view}]);
 assert.equal(JSON.parse(await readFile(path)).documents.length,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('sidebar tabs persist separately for each document and reject unknown modes',async()=>{
 const {createRecents}=await import('../electron/recents.mjs');
 const dir=await mkdtemp(join(tmpdir(),'reader-sidebar-'));
 try{
  const path=join(dir,'recents.json'),recents=await createRecents(path);
  const [a]=await recents.remember('/tmp/a.pdf');
  const [b]=await recents.remember('/tmp/b.pdf');
  await recents.setView(a.id,{...view,sidebarMode:'annotations'});
  await recents.setView(b.id,{...view,sidebarMode:'outline'});
  const restored=(await createRecents(path)).list();
  assert.equal(restored.find(item=>item.id===a.id).view.sidebarMode,'annotations');
  assert.equal(restored.find(item=>item.id===b.id).view.sidebarMode,'outline');
  await assert.rejects(recents.setView(a.id,{...view,sidebarMode:'invalid'}));
 }finally{await rm(dir,{recursive:true,force:true});}
});
