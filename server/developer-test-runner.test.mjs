import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeveloperTestRunner} from '../electron/developer-test-runner.mjs';
const services=[{id:'auto',label:'Auto',fields:[]},{id:'openai',label:'OpenAI',fields:[{id:'key',secret:true,required:true,type:'string'},{id:'model',type:'string',default:'default'}]},{id:'missing',label:'Missing',fields:[{id:'key',secret:true,required:true,type:'string'}]}];
function fixture(requestTest=async()=>({status:'success',message:'OK',elapsedMs:5,output:'translated'})){
 const calls=[];
 const reader={id:42,preferences:{engine:'pdf_inspector',language:'French',sourceLanguage:'English',concurrency:3,pageConcurrency:2,translationServices:{pdf_inspector:{id:'openai',values:{model:'current'},profiles:{openai:{values:{model:'saved'}}}}},kernelAdvancedOptions:{pdf_inspector:{debug:true}}}};
 const runner=createDeveloperTestRunner({readers:()=>[reader,{id:43,settingsOwner:{},preferences:{}}],loadCredentials:async()=>({pdf_inspector:{openai:{key:'super-secret'}}}),request:async(state,path,body,options)=>{if(path.includes('/services'))return {services};calls.push({state,path,body,options});return requestTest(body,options);}});
 return {runner,calls,reader};
}
async function finished(runner){for(let i=0;i<100;i++){if(!runner.status()?.running)return runner.status();await new Promise(r=>setTimeout(r,5));}throw Error('Test did not complete');}
test('context never exposes credentials or saved values and excludes settings windows',async()=>{
 const {runner}=fixture();const context=await runner.context();assert.equal(context.windowId,42);assert.equal(context.providerId,'openai');assert.equal(context.providers[1].configured,true);assert.equal(context.providers[2].configured,false);assert.equal(context.readers.length,1);assert.ok(!JSON.stringify(context).includes('super-secret'));assert.ok(!JSON.stringify(context).includes('saved'));
});
test('current provider uses frozen reader settings and encrypted profile credentials without changing active selection',async()=>{
 const {runner,calls,reader}=fixture();await runner.start({kind:'provider',windowId:42});const result=await finished(runner);assert.equal(result.results[0].status,'success');assert.equal(calls[0].body.translationService.values.key,'super-secret');assert.equal(calls[0].body.translationService.values.model,'saved');assert.equal(calls[0].body.language,'French');assert.equal(calls[0].body.concurrency,3);assert.equal(reader.preferences.translationServices.pdf_inspector.id,'openai');assert.ok(!JSON.stringify(result).includes('super-secret'));
});
test('batch sequentially tests configured providers, continues failures, skips incomplete profiles',async()=>{
 let active=0,peak=0;const {runner,calls}=fixture(async body=>{active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,10));active--;if(body.translationService.id==='auto')throw Error('Failed');return {status:'success',message:'OK'};});await runner.start({kind:'batch'});const result=await finished(runner);assert.deepEqual(result.results.map(row=>row.status),['error','success','skipped']);assert.equal(calls.length,2);assert.equal(peak,1);
});
test('kernel requests omit provider credentials and include advanced settings',async()=>{
 const {runner,calls}=fixture();await runner.start({kind:'kernel'});await finished(runner);assert.equal(calls[0].body.kind,'kernel');assert.equal(calls[0].body.translationService,undefined);assert.deepEqual(calls[0].body.advancedOptions,{debug:true});
});
test('cancel aborts running work and prevents remaining requests, concurrent start rejected',async()=>{
 const {runner,calls}=fixture((_body,{signal})=>new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(Error('Aborted')),{once:true});}));await runner.start({kind:'batch'});await assert.rejects(runner.start({kind:'kernel'}),/already running/);runner.cancel();const result=await finished(runner);assert.equal(calls.length,1);assert.ok(result.results.every(row=>row.status==='cancelled'));
});
test('errors redact saved secrets and stale reader requests fail',async()=>{
 const {runner}=fixture(async()=>{throw Error('failure super-secret');});await runner.start({kind:'provider'});const result=await finished(runner);assert.equal(result.results[0].message,'failure [redacted]');await assert.rejects(runner.context(999),/no longer available/);await assert.rejects(runner.start({kind:'invalid'}),/Unknown/);
});
test('multiple readers honor explicit selection and changes after start do not alter a batch',async()=>{
 const seen=[];let release;const pending=new Promise(resolve=>{release=resolve;});
 const first={id:1,preferences:{engine:'pdf_inspector',language:'French',sourceLanguage:'English',concurrency:2,pageConcurrency:2}};
 const second={id:2,preferences:{...first.preferences,language:'German'}};
 const runner=createDeveloperTestRunner({readers:()=>[first,second],defaultReader:()=>2,loadCredentials:async()=>({}),request:async(reader,path,body)=>{if(path.includes('/services'))return {services:[{id:'auto',fields:[]},{id:'second',fields:[]}]};seen.push({id:reader.id,language:body.language});if(seen.length===1)await pending;return {status:'success'};}});
 assert.equal((await runner.context()).windowId,2);
 await runner.start({kind:'batch',windowId:1});first.preferences.language='Spanish';release();await finished(runner);
 assert.deepEqual(seen,[{id:1,language:'French'},{id:1,language:'French'}]);
});
