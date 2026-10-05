import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createDocumentSession} from '../electron/document-session.mjs';
const view={page:8,offsetX:0,offsetY:.3,zoom:1,fit:'width',direction:'vertical',columns:1,sidebar:false,showTranslations:true};
test('quitting from the start page replaces an old multi-document session with only the last document',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'reader-session-'));try{
 const path=join(dir,'session.json');
 await writeFile(path,JSON.stringify({documents:[{path:'/tmp/a.pdf'},{path:'/tmp/b.pdf',view}],last:{path:'/tmp/b.pdf',view}}));
 const session=await createDocumentSession(path);
 await session.saveOnQuit();
 assert.deepEqual((await createDocumentSession(path)).restore(),[{path:'/tmp/b.pdf',view}]);
 assert.deepEqual(JSON.parse(await readFile(path)).documents,[]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('session persists multiple documents and positions; closing all restores only the last closed document',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'reader-session-'));try{
 const path=join(dir,'session.json'),session=await createDocumentSession(path);
 await session.open(1,{path:'/tmp/a.pdf'});await session.open(2,{path:'/tmp/b.pdf'});await session.update(1,view);
 await session.saveOnQuit();
 assert.deepEqual((await createDocumentSession(path)).restore(),[{path:'/tmp/a.pdf',view},{path:'/tmp/b.pdf'}]);
 const before=(await stat(path)).mtimeMs;await session.update(1,view);assert.equal((await stat(path)).mtimeMs,before);
 await session.close(2);assert.deepEqual((await createDocumentSession(path)).restore(),[{path:'/tmp/a.pdf',view}]);
 await session.close(1);await session.close(1);assert.deepEqual((await createDocumentSession(path)).restore(),[{path:'/tmp/a.pdf',view}]);
 assert.equal(JSON.parse(await readFile(path)).documents.length,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
