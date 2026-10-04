import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createTranslationProvider,selectTranslationProvider,FREE_ENDPOINTS} from './translation-provider.mjs';

const responseJSON=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const openAIResponse=(content,status=200)=>responseJSON({id:'resp_test',object:'chat.completion',model:'gpt-4.1-mini',choices:[{index:0,message:{role:'assistant',content},finish_reason:'stop'}]},status);
const signal=()=>new AbortController().signal;
const body=({language='French',prompt='Translate the passage.',text='Hello from the cache.'}={})=>({
 model:'caller-supplied-model',
 stream:true,
 messages:[
  {role:'system',content:`${prompt} Translate into ${language}.`},
  {role:'user',content:text}
 ]
});
const content=async response=>(await response.json()).choices?.[0]?.message?.content;

test('persists successful OpenAI responses across provider instances without credential keys',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'translation-text-cache-'));let firstCalls=0,secondCalls=0;
 const provider={id:'openai',model:'gpt-4.1-mini',key:'first-secret'};
 const request=body();
 try{
  const firstClient=createTranslationProvider(async(url,options)=>{
   firstCalls++;assert.equal(url,'https://api.openai.com/v1/chat/completions');
   const sent=JSON.parse(options.body);assert.equal(sent.model,provider.model);assert.equal(sent.stream,false);assert.doesNotMatch(JSON.stringify(sent),/first-secret/);
   return openAIResponse('persisted translation');
  },{cacheDirectory:directory});
  assert.equal(await content(await firstClient.complete(provider,request,signal())),'persisted translation');

  const secondClient=createTranslationProvider(async()=>{secondCalls++;return openAIResponse('uncached translation');},{cacheDirectory:directory});
  const restarted=await secondClient.complete({...provider,key:'second-secret'},request,signal());
  assert.equal(await content(restarted),'persisted translation');
  assert.equal(firstCalls,1);assert.equal(secondCalls,0);
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('deduplicates concurrent requests and keeps the shared request alive for a remaining waiter',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'translation-text-cache-concurrent-'));let calls=0,release;
 let startedResolve;const started=new Promise(resolve=>{startedResolve=resolve;});
 const gate=new Promise(resolve=>{release=resolve;});
 const fetch=async()=>{calls++;startedResolve();await gate;return openAIResponse('shared translation');};
 const provider={id:'openai',model:'gpt-4.1-mini',key:'secret'};
 const request=body();
 try{
  const firstController=new AbortController(),secondController=new AbortController();
  const firstClient=createTranslationProvider(fetch,{cacheDirectory:directory});
  const secondClient=createTranslationProvider(fetch,{cacheDirectory:directory});
  const first=firstClient.complete(provider,request,firstController.signal);
  const second=secondClient.complete(provider,request,secondController.signal);
  await started;
  await new Promise(resolve=>setImmediate(resolve));
  firstController.abort();
  await assert.rejects(first,error=>error?.name==='AbortError');
  release();
  assert.equal(await content(await second),'shared translation');
  assert.equal(calls,1);
  assert.equal(await content(await secondClient.complete(provider,request,signal())),'shared translation');
  assert.equal(calls,1);
 }finally{release?.();await rm(directory,{recursive:true,force:true});}
});

test('does not cache failed or empty OpenAI responses',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'translation-text-cache-invalid-'));let failureCalls=0,emptyCalls=0;
 const provider={id:'openai',model:'gpt-4.1-mini',key:'secret'};
 try{
  const failureClient=createTranslationProvider(async()=>{
   failureCalls++;return failureCalls===1?openAIResponse('temporary failure',503):openAIResponse('recovered translation');
  },{cacheDirectory:directory});
  const failed=await failureClient.complete(provider,body({text:'Failure case'}),signal());
  assert.equal(failed.status,503);
  assert.equal(await content(await failureClient.complete(provider,body({text:'Failure case'}),signal())),'recovered translation');
  assert.equal(await content(await failureClient.complete(provider,body({text:'Failure case'}),signal())),'recovered translation');
  assert.equal(failureCalls,2);

  const emptyClient=createTranslationProvider(async()=>{emptyCalls++;return openAIResponse('');},{cacheDirectory:directory});
  const emptyRequest=body({text:'Empty case'});
  assert.equal((await emptyClient.complete(provider,emptyRequest,signal())).status,200);
  assert.equal((await emptyClient.complete(provider,emptyRequest,signal())).status,200);
  assert.equal(emptyCalls,2);
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('keys the cache by effective outbound request, service, and model',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'translation-text-cache-key-'));let calls=0;
 const fetch=async()=>{calls++;return openAIResponse(`translation ${calls}`);};
 const request=body({language:'French',prompt:'Translate the passage.',text:'Same source.'});
 const provider={id:'openai',model:'gpt-4.1-mini',key:'secret',kernel:'pdf_math_fast',language:'French'};
 try{
  const client=createTranslationProvider(fetch,{cacheDirectory:directory});
  assert.equal(await content(await client.complete(provider,request,signal())),'translation 1');
  // Caller-only model/stream and kernel/language metadata produce the same outbound request.
  assert.equal(await content(await client.complete({...provider,kernel:'pdf_math_precise',language:'Japanese'}, {...request,model:'another-model',stream:false},signal())),'translation 1');
  assert.equal(calls,1);
  assert.equal(await content(await client.complete(provider,{...body({language:'French',prompt:'Use a formal register.',text:'Same source.'}),model:'ignored',stream:false},signal())),'translation 2');
  assert.equal(await content(await client.complete(provider,body({language:'Japanese',prompt:'Translate the passage.',text:'Same source.'}),signal())),'translation 3');
  assert.equal(await content(await client.complete({...provider,model:'gpt-4.1-large'},request,signal())),'translation 4');
  assert.equal(calls,4);
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('persists a free-service response and keeps it isolated from the OpenAI service',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'translation-text-cache-free-'));let openAICalls=0,freeChecks=0,freeTranslations=0,restartedFreeTranslations=0;
 const request=body({language:'German',text:'Same source for both services.'});
 try{
  const openAIClient=createTranslationProvider(async()=>{openAICalls++;return openAIResponse('OpenAI translation');},{cacheDirectory:directory});
  assert.equal(await content(await openAIClient.complete({id:'openai',model:'gpt-4.1-mini',key:'secret'},request,signal())),'OpenAI translation');

  const freeFetch=async url=>{
   if(url.endsWith('/check')){freeChecks++;return responseJSON({status:'ok'});}
   assert.ok(FREE_ENDPOINTS.includes(url));freeTranslations++;return responseJSON({content:'Free translation'});
  };
  const freeProvider=selectTranslationProvider();
  const freeClient=createTranslationProvider(freeFetch,{cacheDirectory:directory});
  assert.equal(await content(await freeClient.complete(freeProvider,request,signal())),'Free translation');
  assert.equal(openAICalls,1);assert.equal(freeTranslations,1);assert.ok(freeChecks>=1);

  const restartedClient=createTranslationProvider(async()=>{restartedFreeTranslations++;return responseJSON({content:'Unexpected uncached translation'});},{cacheDirectory:directory});
  assert.equal(await content(await restartedClient.complete(freeProvider,request,signal())),'Free translation');
  assert.equal(restartedFreeTranslations,0);
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('cache false bypasses the persistent text cache without replacing it',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'translation-text-cache-bypass-'));let calls=0;
 const provider={id:'openai',model:'gpt-4.1-mini',key:'secret'};const request=body({text:'Bypass case'});
 try{
  const client=createTranslationProvider(async()=>{calls++;return openAIResponse(`translation ${calls}`);},{cacheDirectory:directory});
  assert.equal(await content(await client.complete(provider,request,signal())),'translation 1');
  assert.equal(await content(await client.complete(provider,request,signal(),{cache:false})),'translation 2');
  assert.equal(await content(await client.complete(provider,request,signal())),'translation 1');
  assert.equal(calls,2);
 }finally{await rm(directory,{recursive:true,force:true});}
});
