import {test} from 'node:test';
import assert from 'node:assert/strict';
import {access,mkdir,readFile,rm,symlink,truncate,utimes,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {mkdtemp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {CACHE_BYTES_PER_MB,createCacheManager} from './cache-management.mjs';
import {createDocumentCache,decodeDocumentName} from './document-cache.mjs';
import {startServer} from './index.mjs';

const oldTime=new Date('2020-01-01T00:00:00Z');
const exists=async path=>{try{await access(path);return true;}catch{return false;}};

test('prunes oldest cache artifacts recursively and leaves paired metadata and outside files alone',async()=>{
 const root=await mkdtemp(join(tmpdir(),'cache-management-prune-')),cache=join(root,'translations'),outside=join(root,'engines');
 const oldPdf=join(cache,'documents','old','page.pdf'),oldLayout=join(cache,'documents','old','page.layout.json');
 const newPdf=join(cache,'documents','new','page.pdf'),newLayout=join(cache,'documents','new','page.layout.json'),outsideFile=join(outside,'runtime.bin');
 await mkdir(join(cache,'documents','old'),{recursive:true});await mkdir(join(cache,'documents','new'),{recursive:true});await mkdir(outside,{recursive:true});
 await writeFile(oldPdf,'');await truncate(oldPdf,400*CACHE_BYTES_PER_MB);await writeFile(oldLayout,'old metadata');
 await writeFile(newPdf,'');await truncate(newPdf,200*CACHE_BYTES_PER_MB);await writeFile(newLayout,'new metadata');await writeFile(outsideFile,'outside');
 await utimes(oldPdf,oldTime,oldTime);await utimes(oldLayout,oldTime,oldTime);await utimes(newPdf,new Date('2021-01-01T00:00:00Z'),new Date('2021-01-01T00:00:00Z'));await utimes(newLayout,new Date('2021-01-01T00:00:00Z'),new Date('2021-01-01T00:00:00Z'));
 const manager=createCacheManager({directory:cache,limitMB:512,sweepIntervalMs:0,recentWriteMs:0});
 try{
  const result=await manager.start();
  assert.ok(result.bytes<=512*CACHE_BYTES_PER_MB);
  assert.equal(await exists(oldPdf),false);assert.equal(await exists(oldLayout),false);
  assert.equal(await exists(newPdf),true);assert.equal(await exists(newLayout),true);
  assert.equal(await readFile(outsideFile,'utf8'),'outside');
 }finally{await manager.close();await rm(root,{recursive:true,force:true});}
});

test('protects active work and clears scoped cache files without following links',async()=>{
 const root=await mkdtemp(join(tmpdir(),'cache-management-clear-')),cache=join(root,'translations'),outside=join(root,'source');
 const scoped=join(cache,'documents','a'.repeat(64));await mkdir(join(scoped,'paragraphs','generation'),{recursive:true});await mkdir(outside,{recursive:true});
 const outsideFile=join(outside,'source.pdf');await writeFile(outsideFile,'source');await writeFile(join(scoped,'a.generation'),'generation');await writeFile(join(scoped,'paragraphs','generation','result.json'),'translation');await symlink(outside,join(cache,'outside-link'),'dir');
 const manager=createCacheManager({directory:cache,limitMB:null,sweepIntervalMs:0});
 try{
  await manager.start();const release=manager.beginTask('translation');
  await assert.rejects(manager.clear(),error=>error?.status===409&&/in use/.test(error.message));
  assert.equal((await manager.stats()).busy,true);release();
  const result=await manager.clear();assert.equal(result.bytes,0);assert.equal(result.busy,false);
  assert.equal(await exists(join(cache,'documents')),false);assert.equal(await exists(join(cache,'outside-link')),false);assert.equal(await readFile(outsideFile,'utf8'),'source');
 }finally{await manager.close();await rm(root,{recursive:true,force:true});}
});

test('ranks hash-scoped document artifacts, preserves legacy null names, and clears one document',async()=>{
 const root=await mkdtemp(join(tmpdir(),'cache-management-documents-')),cache=join(root,'translations');
 const documentCache=createDocumentCache(cache),ids=Array.from({length:6},(_,index)=>createHash('sha256').update(`document-${index}`).digest('hex'));
 try{
  await documentCache.register(ids[5],'Largest%20paper.pdf');
  for(const [index,id] of ids.entries()){
   const directory=join(cache,'documents',id,'math','generation');await mkdir(directory,{recursive:true});await writeFile(join(directory,'result.pdf'),Buffer.alloc((index+1)*1024));
  }
  await writeFile(join(cache,'legacy-root.json'),'unassociated');
  const manager=createCacheManager({directory:cache,documentCache,limitMB:null,sweepIntervalMs:0});
  try{
   await manager.start();
   const initial=await manager.stats();
   assert.deepEqual(initial.documents.map(document=>document.id),ids.slice().reverse().slice(0,5));
   assert.equal(initial.documents[0].name,'Largest paper.pdf');
   assert.equal(initial.documents[1].name,null);
   assert.equal(initial.documents.some(document=>document.id===ids[0]),false);
   const release=manager.beginTask('translation');
   await assert.rejects(manager.clearDocument(ids[4]),error=>error?.status===409);
   release();
   await manager.clearDocument(ids[5]);
   assert.equal(await exists(join(cache,'documents',ids[5])),false);
   assert.equal(await readFile(join(cache,'legacy-root.json'),'utf8'),'unassociated');
   const after=await manager.stats();assert.equal(after.documents[0].id,ids[4]);assert.equal(after.documents.some(document=>document.id===ids[5]),false);
  }finally{await manager.close();}
 }finally{await rm(root,{recursive:true,force:true});}
});

test('decodes only safe filename metadata and clears a registered document through the API',async()=>{
 const root=await mkdtemp(join(tmpdir(),'cache-management-document-api-')),token='cache-document-token';
 const backend=await startServer({port:0,development:false,cacheDir:root,cacheLimitMB:null,token,localTranslationImpl:{available:async()=>false,close:async()=>{}},getApiKey:()=>''});
 const request=(path,options={})=>fetch(backend.origin+path,{...options,headers:{'Content-Type':'application/json','X-Preview-Token':token,...(options.headers||{})}});
 const pdf=Buffer.from('%PDF-1.7\ncache fixture'),hash=createHash('sha256').update(pdf).digest('hex');
 try{
  const upload=await request('/api/documents',{method:'POST',headers:{'Content-Type':'application/pdf','X-Document-Name':encodeURIComponent('Paper A.pdf')},body:pdf});assert.equal(upload.status,201);
  const directory=join(root,'documents',hash,'math','generation');await mkdir(directory,{recursive:true});await writeFile(join(directory,'result.pdf'),'cached result');await writeFile(join(root,'unrelated.bin'),'keep');
  const stats=await (await request('/api/cache')).json();assert.deepEqual(stats.documents,[{id:hash,name:'Paper A.pdf',bytes:'cached result'.length}]);
  const invalid=await request('/api/cache/document/clear',{method:'POST',body:JSON.stringify({id:'../../outside'})});assert.equal(invalid.status,400);
  const lease=join(root,'.cache-management','manual.lease');await writeFile(lease,'busy');const busy=await request('/api/cache/document/clear',{method:'POST',body:JSON.stringify({id:hash})});assert.equal(busy.status,409);await rm(lease,{force:true});
  const cleared=await request('/api/cache/document/clear',{method:'POST',body:JSON.stringify({id:hash})});assert.equal(cleared.status,200);assert.equal(await exists(join(root,'documents',hash)),false);assert.equal(await readFile(join(root,'unrelated.bin'),'utf8'),'keep');
  assert.deepEqual((await (await request('/api/cache')).json()).documents,[]);
  assert.equal(decodeDocumentName('%E0%A4%A'),null);
 }finally{await backend.close();await rm(root,{recursive:true,force:true});}
});

test('validates cache limits and exposes authenticated busy cache stats',async()=>{
 const root=await mkdtemp(join(tmpdir(),'cache-management-api-')),token='cache-test-token';
 const backend=await startServer({port:0,development:false,cacheDir:root,cacheLimitMB:null,token,localTranslationImpl:{available:async()=>false,close:async()=>{}},getApiKey:()=>''});
 const request=(path,options={})=>fetch(backend.origin+path,{...options,headers:{'Content-Type':'application/json',...(options.headers||{})}});
 try{
  assert.equal((await request('/api/cache')).status,403);
  const initial=await (await request('/api/cache',{headers:{'X-Preview-Token':token}})).json();assert.deepEqual(initial,{bytes:0,limitMB:null,busy:false,documents:[]});
  const invalid=await request('/api/cache/limit',{method:'POST',headers:{'X-Preview-Token':token},body:JSON.stringify({limitMB:256})});assert.equal(invalid.status,400);assert.match((await invalid.json()).error,/512/);
  const limited=await (await request('/api/cache/limit',{method:'POST',headers:{'X-Preview-Token':token},body:JSON.stringify({limitMB:512})})).json();assert.deepEqual(limited,{bytes:0,limitMB:512});
  const unlimited=await (await request('/api/cache/limit',{method:'POST',headers:{'X-Preview-Token':token},body:JSON.stringify({limitMB:null})})).json();assert.equal(unlimited.limitMB,null);
 }finally{await backend.close();await rm(root,{recursive:true,force:true});}
});
