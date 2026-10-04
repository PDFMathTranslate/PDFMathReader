import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createTranslationProvider,selectTranslationProvider,FREE_ENDPOINTS} from './translation-provider.mjs';
import {startServer} from './index.mjs';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
test('free protocol probes endpoints, adapts messages and JSON mode, and strips reasoning',async()=>{
 const calls=[];const client=createTranslationProvider(async(url,options)=>{calls.push({url,options});return url.endsWith('/check')?json({status:'ok'}):json({content:'<think>internal</think>译文'});});
 const response=await client.complete(selectTranslationProvider(),{messages:[{role:'system',content:'Translate'},{role:'user',content:'Hello'}],response_format:{type:'json_object'}},new AbortController().signal);
 assert.equal((await response.json()).choices[0].message.content,'译文');
 const request=calls.find(call=>!call.url.endsWith('/check'));assert.deepEqual(JSON.parse(request.options.body),{text:'Translate\n\nHello',requestJsonMode:true});assert.equal(request.options.headers.Authorization,undefined);
 await client.complete(selectTranslationProvider(),{messages:[]},new AbortController().signal);assert.equal(calls.filter(call=>call.url.endsWith('/check')).length,2);
});
test('free service fails over unavailable endpoint but preserves quota errors',async()=>{
 let count=0;const client=createTranslationProvider(async(url)=>url.endsWith('/check')?json({status:'ok'}):(++count===1?json({},503):json({content:'ok'})));
 assert.equal((await (await client.complete(selectTranslationProvider(),{},new AbortController().signal)).json()).choices[0].message.content,'ok');assert.equal(count,2);
 const limited=createTranslationProvider(async url=>url.endsWith('/check')?json({status:'ok'}):json({},429));assert.equal((await limited.complete(selectTranslationProvider(),{},new AbortController().signal)).status,429);
});
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
test('Legacy default prompt uses the supported Next template without changing source placeholders',async()=>{
 let payload;const client=createTranslationProvider(async(url,request)=>{if(url.endsWith('/check'))return json({status:'ok'});payload=JSON.parse(request.body);return json({content:'translated {v0}'});});
 await client.complete({...selectTranslationProvider(),kernel:'pdf_math_fast',language:'zh'},{messages:[{role:'user',content:'You are a professional, authentic machine translation engine. Only Output the translated text.\n\nSource Text: Formula {v0}\n\nTranslated Text:'}]},new AbortController().signal);
 assert.match(payload.text,/professional,authentic/);assert.match(payload.text,/into zh/);assert.match(payload.text,/Input:\n\nFormula \{v0\}$/);
});
