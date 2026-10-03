import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,stat,realpath,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createLimiter,createEngines,prepareKernelAssets,pythonResourcePath,definitions} from './engines.mjs';
import {startServer} from './index.mjs';
test('fresh kernel assets have valid targets and reuse existing shared models',async()=>{
 const root=await mkdtemp(join(tmpdir(),'kernel-assets-'));
 try{
  const shared=join(root,'shared');await mkdir(join(shared,'models'),{recursive:true});
  const owned=join(root,'owned'),home=join(root,'job');await prepareKernelAssets(owned,home,shared);
  for(const kind of ['fonts','models','tiktoken','cmap'])assert.ok((await stat(join(home,'.cache','babeldoc',kind))).isDirectory());
  assert.equal(await realpath(join(home,'.cache','babeldoc','models')),await realpath(join(shared,'models')));
  // BabelDOC performs this during import; dangling symlinks used to throw.
  await mkdir(join(home,'.cache','babeldoc','tiktoken'),{recursive:true});
 }finally{await rm(root,{recursive:true,force:true});}
});
test('global translation budget holds across simultaneous page workers and releases after failures',async()=>{
 const limiter=createLimiter(2);let active=0,peak=0;const completed=[];
 await Promise.allSettled(Array.from({length:12},(_,n)=>limiter.run(async()=>{active++;peak=Math.max(peak,active);try{await new Promise(r=>setTimeout(r,2+(n%3)*3));if(n===3)throw Error('fixture failure');completed.push(n);}finally{active--;}})));
 assert.equal(peak,2);assert.equal(active,0);assert.equal(completed.length,11);assert.ok(completed.includes(11));
});
test('missing math environments are unavailable, inspector has a queried version, and unknown kernels are rejected',async()=>{
 const root=await mkdtemp(join(tmpdir(),'preview-kernels-'));
 const e=createEngines({root,cacheDir:join(root,'cache')});
 try{assert.equal((await e.check('pdf_inspector')).available,true);assert.match((await e.check('pdf_inspector')).version,/^\d+\./);for(const id of ['pdf_math_fast','pdf_math_precise'])assert.equal((await e.check(id)).available,false);await assert.rejects(e.check('../other'));const c=new AbortController();c.abort();await assert.rejects(e.translate({signal:c.signal}),/Cancelled/);}finally{e.close();await rm(root,{recursive:true,force:true});}
});

test('normal installs stay idempotent while explicit reinstall upgrades a healthy environment and clears advanced metadata',async()=>{
 const root=await mkdtemp(join(tmpdir(),'kernel-install-'));const calls=[];let healthy=false;let releasePip;let resolvePipStarted;
 const pipStarted=new Promise(resolve=>{resolvePipStarted=resolve;});const pipGate=new Promise(resolve=>{releasePip=resolve;});
 const uvPath='/fixture/uv',pythonPath=join(root,'pdf_math_fast','bin/python');
 const execImpl=async(command,args)=>{
  calls.push({command,args});
  if(command===uvPath&&args[0]==='venv'){
   healthy=true;await mkdir(join(root,'pdf_math_fast','bin'),{recursive:true});return {stdout:''};
  }
  if(command===uvPath&&args[0]==='pip'){resolvePipStarted();await pipGate;return {stdout:''};}
  if(command===pythonPath&&args[0]==='-c'){
   if(!healthy)throw Error('fixture environment is missing');
   return {stdout:'2.8.2\n'};
  }
  if(command===pythonPath&&args[0].endsWith('kernel-options.py'))return {stdout:JSON.stringify([{id:'debug',type:'boolean',flag:'--debug',flagValue:true,default:false}])};
  throw Error(`Unexpected fixture command: ${command}`);
 };
 const e=createEngines({root,cacheDir:join(root,'cache'),findUvImpl:async()=>({available:true,path:uvPath,version:'uv fixture'}),execImpl});
 try{
  const first=e.install('pdf_math_fast');await pipStarted;
  const duplicate=e.install('pdf_math_fast');
  assert.equal(calls.filter(call=>call.command===uvPath&&call.args[0]==='pip').length,1);
  releasePip();
  const installed=await first;await duplicate;
  assert.equal(installed.available,true);assert.equal(installed.version,'2.8.2');
  const firstVenvCalls=calls.filter(call=>call.command===uvPath&&call.args[0]==='venv');
  assert.equal(firstVenvCalls.length,1);
  const firstAdvanced=await e.advanced('pdf_math_fast');assert.equal(firstAdvanced.options.length,1);
  await e.advanced('pdf_math_fast');
  assert.equal(calls.filter(call=>call.command===pythonPath&&call.args[0].endsWith('kernel-options.py')).length,1);
  await e.install('pdf_math_fast');
  const initialPipCalls=calls.filter(call=>call.command===uvPath&&call.args[0]==='pip');
  assert.equal(initialPipCalls.length,1);
  assert.deepEqual(initialPipCalls[0].args,['pip','install','--python',pythonPath,definitions.pdf_math_fast.spec]);
  await e.install('pdf_math_fast',{reinstall:true});
  assert.equal(calls.filter(call=>call.command===uvPath&&call.args[0]==='venv').length,1);
  const pipCalls=calls.filter(call=>call.command===uvPath&&call.args[0]==='pip');
  assert.deepEqual(pipCalls[1].args,['pip','install','--upgrade','--reinstall','--python',pythonPath,definitions.pdf_math_fast.updateSpec]);
  await e.advanced('pdf_math_fast');
  assert.equal(calls.filter(call=>call.command===pythonPath&&call.args[0].endsWith('kernel-options.py')).length,2);
 }finally{releasePip?.();e.close();await rm(root,{recursive:true,force:true});}
});

test('Git reinstalls use each kernel Git command specification',async()=>{
 const root=await mkdtemp(join(tmpdir(),'kernel-git-install-'));const calls=[];const healthy=new Set();
 const uvPath='/fixture/uv';
 const execImpl=async(command,args)=>{
  calls.push({command,args});
  if(command===uvPath&&args[0]==='venv'){
   const envPath=args.at(-1);healthy.add(envPath);await mkdir(join(envPath,'bin'),{recursive:true});return {stdout:''};
  }
  if(command===uvPath&&args[0]==='pip')return {stdout:''};
  if(command.endsWith('/bin/python')&&args[0]==='-c'){
   if(!healthy.has(command.slice(0,-'/bin/python'.length)))throw Error('fixture environment is missing');
   return {stdout:'2.8.2\n'};
  }
  throw Error(`Unexpected fixture command: ${command}`);
 };
 const e=createEngines({root,cacheDir:join(root,'cache'),findUvImpl:async()=>({available:true,path:uvPath,version:'uv fixture'}),execImpl});
 try{
  for(const id of ['pdf_math_fast','pdf_math_precise']){
   await e.install(id,{reinstall:true,source:'git'});
   const pythonPath=join(root,id,'bin/python');
   const pipCalls=calls.filter(call=>call.command===uvPath&&call.args[0]==='pip');
   const pipCall=pipCalls.at(-1);
   assert.deepEqual(pipCall.args,['pip','install','--upgrade','--reinstall','--refresh','--python',pythonPath,definitions[id].gitSpec]);
  }
  assert.equal(calls.filter(call=>call.command===uvPath&&call.args[0]==='venv').length,2);
 }finally{e.close();await rm(root,{recursive:true,force:true});}
});

test('install endpoint parses reinstall requests and forwards the Git source',async()=>{
 const root=await mkdtemp(join(tmpdir(),'kernel-install-api-'));const enginesRoot=join(root,'engines');const calls=[];let healthy=false;
 const uvPath='/fixture/uv',pythonPath=join(enginesRoot,'pdf_math_fast','bin/python');
 const execImpl=async(command,args)=>{
  calls.push({command,args});
  if(command===uvPath&&args[0]==='venv'){
   healthy=true;await mkdir(join(enginesRoot,'pdf_math_fast','bin'),{recursive:true});return {stdout:''};
  }
  if(command===uvPath&&args[0]==='pip')return {stdout:''};
  if(command===pythonPath&&args[0]==='-c'){
   if(!healthy)throw Error('fixture environment is missing');
   return {stdout:'2.8.2\n'};
  }
  throw Error(`Unexpected fixture command: ${command}`);
 };
 const backend=await startServer({port:0,development:false,cacheDir:join(root,'cache'),enginesRoot,findUvImpl:async()=>({available:true,path:uvPath,version:'uv fixture'}),execImpl});
 const request=body=>fetch(backend.origin+'/api/engines/pdf_math_fast/install',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  assert.equal((await request({reinstall:false})).status,200);
  assert.equal((await request({reinstall:'true'})).status,200);
  assert.equal((await request({reinstall:true})).status,200);
  assert.equal((await request({reinstall:true,source:'git'})).status,200);
  const pipCalls=calls.filter(call=>call.command===uvPath&&call.args[0]==='pip');
  assert.equal(pipCalls.length,3);
  assert.deepEqual(pipCalls[1].args,['pip','install','--upgrade','--reinstall','--python',pythonPath,definitions.pdf_math_fast.updateSpec]);
  assert.deepEqual(pipCalls[2].args,['pip','install','--upgrade','--reinstall','--refresh','--python',pythonPath,definitions.pdf_math_fast.gitSpec]);
  assert.equal(calls.filter(call=>call.command===uvPath&&call.args[0]==='venv').length,1);
 }finally{await backend.close();await rm(root,{recursive:true,force:true});}
});

 test('utility process resolves both Python helpers from the explicit application resources',async()=>{
  const root=await mkdtemp(join(tmpdir(),'kernel-resources-'));
  try{for(const name of ['kernel-options.py','kernel-worker.py']){
   await writeFile(join(root,name),'# fixture');
   assert.equal(pythonResourcePath(name,root),join(root,name));
  }}finally{await rm(root,{recursive:true,force:true});}
 });
