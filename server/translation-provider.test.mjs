import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createTranslationProvider,selectTranslationProvider,FREE_ENDPOINTS} from './translation-provider.mjs';
import {startServer} from './index.mjs';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});

test('configured key routes only to OpenAI and aborted fallback sends no translation',async()=>{
 const calls=[];const client=createTranslationProvider(async(url,options)=>{calls.push({url,options});return json({status:'ok'});});
 await client.complete(selectTranslationProvider('test-key'),{messages:[]},new AbortController().signal);assert.equal(calls.length,1);assert.equal(calls[0].url,'https://api.openai.com/v1/chat/completions');assert.equal(calls[0].options.headers.Authorization,'Bearer test-key');
 const controller=new AbortController();controller.abort();await assert.rejects(client.complete(selectTranslationProvider(),{},controller.signal));assert.equal(calls.filter(call=>FREE_ENDPOINTS.includes(call.url)).length,0);
});
test('backend fallback headers survive cache and failure, with independent launch sessions and provider caches',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'reader-free-'));let key;const calls=[];let fail=false;
 const options={port:0,development:false,cacheDir:dir,getApiKey:()=>key,providerFetch:async(url,request)=>{calls.push(url);return url.endsWith('/check')?json({status:'ok'}):fail?json({},429):url.includes('api.openai.com')?json({choices:[{message:{content:'paid'}}]}):json({content:'free'});}};
 const backend=await startServer(options);let session;
 try{
  session=(await (await fetch(backend.origin+'/api/config')).json()).sessionId;
  const request=text=>fetch(backend.origin+'/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,language:'French',reuseTranslations:false})});
  let response=await request('Hello');assert.equal(response.headers.get('X-Translation-Service'),'siliconflow-free');assert.equal(response.headers.get('X-Translation-Session'),session);assert.equal(response.headers.get('X-Free-Service-Notice'),'1');assert.equal((await response.json()).translation,'free');
  response=await request('Hello');assert.equal(response.headers.get('X-Free-Service-Notice'),null);assert.equal((await response.json()).cached,true);
  key='mock';response=await request('Hello');assert.equal(response.headers.get('X-Translation-Service'),'openai');assert.equal((await response.json()).translation,'paid');
  key=undefined;fail=true;response=await request('Other');assert.equal(response.status,502);assert.equal(response.headers.get('X-Translation-Service'),'siliconflow-free');assert.match((await response.json()).error,/SiliconFlow.*429/);
 }finally{await backend.close();}
 const next=await startServer(options);try{assert.notEqual((await (await fetch(next.origin+'/api/config')).json()).sessionId,session);}finally{await next.close();await rm(dir,{recursive:true,force:true});}
});
