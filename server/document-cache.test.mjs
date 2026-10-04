import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createDocumentCache} from './document-cache.mjs';
test('clearing a document persists invalidation and leaves other documents unchanged',async()=>{
 const root=await mkdtemp(join(tmpdir(),'reader-document-cache-'));
 try{
  const a=createHash('sha256').update('a'),b=createHash('sha256').update('b'),cache=createDocumentCache(root);
  assert.equal(await cache.scope(a),'');assert.equal(await cache.scope(b),'');
  const old=join(root,'documents',a.copy().digest('hex'));await mkdir(old,{recursive:true});await writeFile(join(old,'old.json'),'{}');
  await cache.clear(a);const scope=await cache.scope(a);assert.ok(scope);
  await assert.rejects(stat(old),{code:'ENOENT'});
  assert.equal(await cache.scope(b),'');assert.equal(await createDocumentCache(root).scope(a),scope);
  await cache.clear(a);assert.notEqual(await cache.scope(a),scope);
 }finally{await rm(root,{recursive:true,force:true});}
});
