import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from './index.mjs';
test('desktop backend has private origin, authenticates API, and releases its port',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'preview-backend-'));
 const backend=await startServer({port:0,development:false,cacheDir:dir,token:'test-only-token'});
 try{
  assert.equal((await fetch(backend.origin+'/api/config')).status,403);
  const headers={'X-Preview-Token':'test-only-token'};
  assert.equal((await fetch(backend.origin+'/api/config',{headers})).status,200);
  assert.equal((await fetch(backend.origin+'/api/config',{headers:{...headers,Origin:'https://example.com'}})).status,403);
 }finally{await backend.close();await rm(dir,{recursive:true,force:true});}
 await assert.rejects(fetch(backend.origin));
});

test('Inspector source language reaches its prompt and separates translations in cache',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'reader-source-api-'));const prompts=[];
 const backend=await startServer({port:0,development:false,cacheDir:dir,getApiKey:()=> 'mock',providerFetch:async(_url,options)=>{prompts.push(JSON.parse(options.body).messages[0].content);return new Response(JSON.stringify({choices:[{message:{content:'Translated'}}]}),{headers:{'Content-Type':'application/json'}});}});
 try{
  const request=sourceLanguage=>fetch(backend.origin+'/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Text fixture',language:'English',sourceLanguage})});
  assert.equal((await request('French')).status,200);assert.match(prompts[0],/from French into English/);
  assert.equal((await (await request('French')).json()).cached,true);assert.equal(prompts.length,1);
  assert.equal((await request('Japanese')).status,200);assert.equal(prompts.length,2);
  assert.equal((await request('invalid')).status,400);assert.equal(prompts.length,2);
 }finally{await backend.close();await rm(dir,{recursive:true,force:true});}
});
