import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from './index.mjs';

test('Inspector custom OpenAI base URL/model/key and service-specific cache isolation',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'custom-provider-')),calls=[];
 const backend=await startServer({port:0,development:false,cacheDir:directory,providerFetch:async(url,options)=>{
  calls.push({url,body:JSON.parse(options.body),headers:options.headers});
  return Response.json({choices:[{message:{content:'Texte '+calls.length}}]});
 }});
 try{
  const request=base_url=>fetch(backend.origin+'/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Science paragraph.',language:'French',sourceLanguage:'English',translationService:{id:'openai',values:{key:'fixture-secret',model:'fixture-model',base_url}}})});
  assert.equal((await request('http://localhost:9001/v1')).status,200);
  assert.equal(calls[0].url,'http://localhost:9001/v1/chat/completions');
  assert.equal(calls[0].headers.Authorization,'Bearer fixture-secret');assert.equal(calls[0].body.model,'fixture-model');
  assert.ok(!Object.hasOwn(calls[0].body,'sourceText'));
  assert.equal((await(await request('http://localhost:9001/v1')).json()).cached,true);assert.equal(calls.length,1);
  assert.equal((await(await request('http://localhost:9002/v1')).json()).cached,false);assert.equal(calls.length,2);
  assert.equal((await request('file:///invalid')).status,422);
 }finally{await backend.close();await rm(directory,{recursive:true,force:true});}
});
