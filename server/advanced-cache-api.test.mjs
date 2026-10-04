import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from './index.mjs';

test('advanced API responds while detection is pending and serves disk cache after backend restart',async()=>{
 const root=await mkdtemp(join(tmpdir(),'advanced-cache-api-'));
 let release,started,probes=0;
 const gate=new Promise(resolve=>{release=resolve;});
 const detecting=new Promise(resolve=>{started=resolve;});
 const options={port:0,development:false,appVersion:'1.0.0',cacheDir:join(root,'translations'),enginesRoot:join(root,'engines'),findUvImpl:async()=>({available:true,path:'uv'}),execImpl:async(_command,args)=>{
  if(args[0]==='-c')return {stdout:'2.8.2'};
  assert.ok(args[0].endsWith('kernel-options.py'));
  probes++;started();await gate;
  return {stdout:JSON.stringify([{id:'debug',type:'boolean',flag:'--debug',flagValue:true,default:false}])};
 }};
 let backend;
 const get=path=>fetch(backend.origin+path,{signal:AbortSignal.timeout(2000)}).then(response=>response.json());
 try{
  backend=await startServer(options);
  await get('/api/engines/pdf_math_fast');
  assert.equal((await get('/api/engines/pdf_math_fast/advanced')).pending,true);
  await detecting;
  assert.ok((await get('/api/config')).sessionId,'other GUI requests remain responsive');
  assert.equal((await get('/api/engines/pdf_math_fast/advanced')).pending,true);
  assert.equal(probes,1,'polling shares one detector');
  release();let result;
  for(let i=0;i<100;i++){result=await get('/api/engines/pdf_math_fast/advanced');if(!result.pending)break;await new Promise(resolve=>setTimeout(resolve,10));}
  assert.equal(result.pending,undefined);assert.equal(result.options.length,1);
  await backend.close();backend=await startServer(options);
  await get('/api/engines/pdf_math_fast');
  assert.deepEqual(await get('/api/engines/pdf_math_fast/advanced'),result);
  assert.equal(probes,1,'a new backend reads persistent schema without detecting again');
 }finally{release();await backend?.close();await rm(root,{recursive:true,force:true});}
});
