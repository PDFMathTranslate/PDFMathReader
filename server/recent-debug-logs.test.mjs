import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRecentDebugLogs,mergeRecentDebugLogEvents} from './recent-debug-logs.mjs';
import {startServer} from './index.mjs';

function event(kernel,message,time=0){return {kind:'kernel-stdout',kernel,pid:123,message,time:new Date(time).toISOString()};}

test('recent debug logs stay scoped to the selected engine and bounded',()=>{
 let now=0;
 const logs=createRecentDebugLogs({maxEvents:200,now:()=>now,redact:value=>String(value).replaceAll('fixture-secret','[redacted]')});
 const fast=logs.begin('pdf_math_fast'),precise=logs.begin('pdf_math_precise');
 assert.equal(logs.record(event('pdf_math_inspector','wrong engine')),null);
 for(let index=0;index<205;index++){now=index;assert.ok(logs.record(event('pdf_math_fast',`fast ${index} fixture-secret`,index)));}
 now=205;assert.ok(logs.record(event('pdf_math_precise','precise',205)));
 fast.end();precise.end();
 const fastEvents=logs.snapshot('pdf_math_fast'),preciseEvents=logs.snapshot('pdf_math_precise');
 assert.equal(fastEvents.length,199);
 assert.equal(preciseEvents.length,1);
 assert.equal(fastEvents[0].message,'fast 6 [redacted]');
 assert.ok(fastEvents.every(item=>item.kernel==='pdf_math_fast'));
 assert.ok(preciseEvents.every(item=>item.kernel==='pdf_math_precise'));
 assert.ok(logs.size()<=200);
});

test('concurrent debug requests keep a kernel capture active until the last request ends',()=>{
 const logs=createRecentDebugLogs();
 const first=logs.begin('pdf_math_fast'),second=logs.begin('pdf_math_fast');
 assert.equal(logs.activeCount('pdf_math_fast'),2);
 first.end();
 assert.equal(logs.activeCount('pdf_math_fast'),1);
 assert.ok(logs.record(event('pdf_math_fast','captured while second request is active')));
 second.end();
 assert.equal(logs.activeCount('pdf_math_fast'),0);
 assert.equal(logs.record(event('pdf_math_fast','after both requests ended')),null);
 assert.equal(logs.snapshot('pdf_math_fast').length,1);
});

test('kernel events are not collected while no debug request is active',()=>{
 const logs=createRecentDebugLogs();
 assert.equal(logs.record(event('pdf_math_fast','must stay out')),null);
 assert.equal(logs.size(),0);
 const handle=logs.begin('pdf_math_fast');
 assert.ok(logs.record(event('pdf_math_fast','captured')));
 handle.end();
 assert.equal(logs.record(event('pdf_math_fast','must stay out too')),null);
 assert.deepEqual(logs.snapshot('pdf_math_fast').map(item=>item.message),['captured']);
});

test('merged developer and debug rings de-duplicate and return newest events last',()=>{
 const duplicate=event('pdf_math_fast','same',1_000);
 const merged=mergeRecentDebugLogEvents([
  [event('pdf_math_fast','old',500),duplicate],
  [duplicate,event('pdf_math_fast','new',1_500)]
 ],{limit:3});
 assert.deepEqual(merged.map(item=>item.message),['old','same','new']);
 assert.equal(merged.length,3);
});

test('recent log route authenticates, filters engines, and Inspector debug tests add no kernel events',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'recent-debug-logs-'));
 const backend=await startServer({port:0,development:false,token:'recent-log-token',cacheDir:directory,getApiKey:()=> 'fixture-secret',providerFetch:async()=>Response.json({choices:[{message:{content:'Fixture translation'}}]})});
 const headers={'X-Preview-Token':'recent-log-token','Content-Type':'application/json'};
 const read=async engine=>{const response=await fetch(`${backend.origin}/api/developer/recent-logs?engine=${engine}`,{headers});assert.equal(response.status,200);return response.json();};
 try{
  assert.equal((await fetch(`${backend.origin}/api/developer/recent-logs?engine=pdf_inspector`)).status,403);
  assert.equal((await fetch(`${backend.origin}/api/developer/recent-logs?engine=unknown`,{headers})).status,400);
  await fetch(backend.origin+'/api/developer/enabled',{method:'POST',headers,body:'{"enabled":true}'});
  const translation=await fetch(backend.origin+'/api/translate',{method:'POST',headers,body:JSON.stringify({text:'fixture source',language:'French',reuseTranslations:false,translationService:{id:'openai',values:{key:'fixture-secret',model:'fixture-model',base_url:'http://127.0.0.1:9100/v1'}}})});
  assert.equal(translation.status,200);await translation.text();
  const inspectorLogs=await read('pdf_inspector');
  assert.ok(inspectorLogs.events.length>=2);
  assert.ok(inspectorLogs.events.every(item=>item.kernel==='pdf_inspector'));
  assert.equal((await read('pdf_math_fast')).events.length,0);
  await fetch(backend.origin+'/api/developer/enabled',{method:'POST',headers,body:'{"enabled":false}'});
  await fetch(backend.origin+'/api/developer/enabled',{method:'POST',headers,body:'{"enabled":true}'});
  const developerTest=await fetch(backend.origin+'/api/developer/test',{method:'POST',headers,body:JSON.stringify({kind:'kernel',engine:'pdf_inspector',language:'French',sourceLanguage:'English',concurrency:1,pageConcurrency:1,advancedOptions:{debug:true}})});
  assert.equal(developerTest.status,200);await developerTest.text();
  const afterInspectorTest=await read('pdf_inspector');
  assert.ok(afterInspectorTest.events.every(item=>!String(item.kind).startsWith('kernel-')));
 }finally{await backend.close();await rm(directory,{recursive:true,force:true});}
});
