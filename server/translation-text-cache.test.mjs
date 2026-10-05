import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readdir} from 'node:fs/promises';
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

test('document cache invalidation bypasses shared text results without changing another document',async()=>{
 const {createDocumentCache}=await import('./document-cache.mjs');
 const {createHash}=await import('node:crypto');
 const directory=await mkdtemp(join(tmpdir(),'translation-document-scope-'));
 let calls=0;
 try{
  const cache=createDocumentCache(directory),a=createHash('sha256').update('PDF A'),b=createHash('sha256').update('PDF B');
  const client=createTranslationProvider(async()=>{calls++;return openAIResponse('translated');},{cacheDirectory:join(directory,'text')});
  const provider={id:'openai',model:'gpt-4.1-mini',key:'test'};
  const complete=async hash=>content(await client.complete(provider,body(),signal(),{cacheScope:await cache.scope(hash)}));
  await complete(a);await complete(b);assert.equal(calls,1);
  await cache.clear(a);await complete(a);assert.equal(calls,2);
  await complete(b);assert.equal(calls,2);
 }finally{await rm(directory,{recursive:true,force:true});}
});
