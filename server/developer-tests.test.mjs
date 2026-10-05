import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PDFDocument} from 'pdf-lib';
import {createDeveloperTests,createDeveloperSamplePDF,developerMockCompletion,validateDeveloperTestRequest} from './developer-tests.mjs';
import {startServer} from './index.mjs';

const request={kind:'kernel',engine:'pdf_inspector',language:'French',sourceLanguage:'English',concurrency:2,pageConcurrency:2,advancedOptions:{}};
const mathKernelRequest={...request,engine:'pdf_math_fast'};
const providerRequest={...request,kind:'provider',translationService:{id:'fixture',values:{key:'fixture-secret',model:'fixture-model'}}};
const mathProviderRequest={...providerRequest,engine:'pdf_math_fast'};

test('developer test validation accepts the API contract and rejects unsafe ranges',async()=>{
 const normalized=validateDeveloperTestRequest(providerRequest);
 assert.equal(normalized.kind,'provider');
 assert.equal(normalized.translationService.id,'fixture');
 assert.throws(()=>validateDeveloperTestRequest({...request,concurrency:0}),/concurrency/);
 assert.throws(()=>validateDeveloperTestRequest({...request,sourceLanguage:'not-a-language'}),/source language/);
 assert.equal((await PDFDocument.load(await createDeveloperSamplePDF())).getPageCount(),1);
});

test('developer test runner uses the local mock transport and forwards native settings',async()=>{
 const proxyJobs=new Map(),calls=[],limits=[];
 const pageLimiter={setMax:value=>limits.push(['page',value]),run:(fn,{signal}={})=>fn(signal)};
 const limiter={setMax:value=>limits.push(['provider',value]),run:(fn)=>fn()};
 const engines={
  async translate(options){
   calls.push(options);
   const job=[...proxyJobs.values()][0];
   if(job.provider.developerMock){
    const response=developerMockCompletion({messages:[{role:'user',content:'fixture source'}]},job.provider);
    assert.equal(response.ok,true);job.providerCalls++;
   }
   const document=await PDFDocument.create();document.addPage().drawText('translated fixture');
   const bytes=Buffer.from(await document.save());bytes.cached=false;bytes.layoutKey='fixture-layout';return bytes;
  },
  async layout(){return {paragraphs:[{text:'fixture source',translation:'fixture translation'}]};}
 };
 const runner=createDeveloperTests({
  engines,layoutExtraction:{extractPage:async()=>[{text:'Inspector fixture',x:20,y:730,width:100,height:12,fontSize:12,itemType:'Text'}]},
  providerFor:async()=>({id:'fixture',model:'fixture-model',native:true}),
  complete:async()=>Response.json({choices:[{message:{content:'fixture translation'}}]}),
  limiter,pageLimiter,proxyJobs,proxyUrl:'http://127.0.0.1:1/kernel-proxy/v1',
  samplePDF:async()=>Buffer.from(await createDeveloperSamplePDF({marker:'runner-fixture'}))
 });
 const kernel=await runner.run(mathKernelRequest);assert.equal(kernel.message.includes('local mock transport'),true);assert.equal(kernel.output,'fixture translation');
 const native=await runner.run({...mathProviderRequest,translationService:{id:'fixture',values:{model:'native-model'}}});
 assert.equal(native.message.includes('configured provider'),true);
 assert.deepEqual(limits,[['provider',2],['page',2],['provider',2],['page',2]]);
 assert.equal(calls[1].threads,2);
 assert.deepEqual(calls[1].advancedOptions,{});
 assert.deepEqual(calls[1].translationService,{id:'fixture',values:{model:'native-model'}});
 assert.equal(calls[1].reuseTranslations,false);
});

test('developer provider tests bypass direct provider cache and return the translation sample',async()=>{
 const proxyJobs=new Map(),calls=[];
 const limiter={setMax(){},run:(fn,options)=>fn(options?.signal)};
 const pageLimiter={setMax(){},run:fn=>fn()};
 const runner=createDeveloperTests({
  engines:{translate:async()=>{throw Error('engine must not run for Inspector provider tests');}},
  layoutExtraction:{extractPage:async()=>[]},
  providerFor:async selection=>({id:selection.id,model:selection.values.model}),
  complete:async(_provider,body,_signal,options)=>{calls.push({body,options});return Response.json({choices:[{message:{content:'Bonjour fixture'}}]});},
  limiter,pageLimiter,proxyJobs,proxyUrl:'http://127.0.0.1:1/kernel-proxy/v1',samplePDF:async()=>Buffer.from('%PDF fixture')
 });
 const first=await runner.run({...providerRequest,engine:'pdf_inspector'});
 const second=await runner.run({...providerRequest,engine:'pdf_inspector'});
 assert.equal(first.output,'Bonjour fixture');assert.equal(second.output,'Bonjour fixture');
 assert.equal(calls.length,2);assert.ok(calls.every(call=>call.options.cache===false));
 assert.equal(calls[0].body.messages.at(-1).content,'Water freezes at zero degrees Celsius.');
 assert.match(calls[0].body.messages[0].content,/English into French/);
});

test('developer API is gated, runs Inspector locally, and does not call a provider',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'developer-test-gate-'));let providerCalls=0;
 const backend=await startServer({port:0,development:false,cacheDir:directory,getApiKey:()=>null,providerFetch:async()=>{providerCalls++;throw Error('provider must not be called');}});
 const headers={'Content-Type':'application/json'};
 try{
  const body=JSON.stringify(request);
  assert.equal((await fetch(backend.origin+'/api/developer/test',{method:'POST',headers,body})).status,403);
  assert.equal((await fetch(backend.origin+'/api/developer/enabled',{method:'POST',headers,body:'{"enabled":true}'})).status,200);
  const response=await fetch(backend.origin+'/api/developer/test',{method:'POST',headers,body});
  const result=await response.json();
  assert.equal(response.status,200);assert.equal(result.status,'success');assert.equal(typeof result.elapsedMs,'number');assert.match(result.output,/PDFMathReader developer test/);assert.equal(providerCalls,0);
  const invalid=await fetch(backend.origin+'/api/developer/test',{method:'POST',headers,body:JSON.stringify({...request,concurrency:99})});
  assert.equal(invalid.status,400);assert.equal((await invalid.json()).status,'error');
 }finally{await backend.close();await rm(directory,{recursive:true,force:true});}
});

test('developer Inspector provider calls the configured service on every run and redacts secrets',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'developer-test-provider-'));const calls=[];let fail=false;
 const backend=await startServer({port:0,development:false,cacheDir:directory,getApiKey:()=>null,providerFetch:async(url,options)=>{
  calls.push({url,options});
  if(fail)throw Error('fixture-secret leaked by provider');
  return Response.json({choices:[{message:{content:'Bonjour fixture'}}]});
 }});
 const headers={'Content-Type':'application/json'},body={...providerRequest,engine:'pdf_inspector',translationService:{id:'openai',values:{key:'fixture-secret',model:'fixture-model',base_url:'http://127.0.0.1:9100/v1'}}};
 try{
  await fetch(backend.origin+'/api/developer/enabled',{method:'POST',headers,body:'{"enabled":true}'});
  const post=()=>fetch(backend.origin+'/api/developer/test',{method:'POST',headers,body:JSON.stringify(body)});
  const first=await post(),firstResult=await first.json();assert.equal(first.status,200);assert.equal(firstResult.status,'success');assert.equal(firstResult.output,'Bonjour fixture');
  const second=await post();assert.equal(second.status,200);assert.equal((await second.json()).status,'success');assert.equal(calls.length,2);
  assert.equal(calls[0].url,'http://127.0.0.1:9100/v1/chat/completions');assert.equal(JSON.parse(calls[0].options.body).model,'fixture-model');assert.match(JSON.parse(calls[0].options.body).messages[0].content,/English into French/);
  fail=true;const failed=await post(),failedResult=await failed.json();assert.equal(failed.status,422);assert.equal(failedResult.status,'error');assert.doesNotMatch(JSON.stringify(failedResult),/fixture-secret/);
 }finally{await backend.close();await rm(directory,{recursive:true,force:true});}
});
