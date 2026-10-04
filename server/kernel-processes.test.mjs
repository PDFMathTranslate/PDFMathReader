import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createKernelProcesses} from './kernel-processes.mjs';

function alive(pid){try{process.kill(pid,0);return true;}catch{return false;}}
async function waitUntilStopped(pid){
 for(let attempt=0;attempt<50;attempt++){
  if(!alive(pid))return;
  await new Promise(resolve=>setTimeout(resolve,20));
 }
 assert.fail(`Kernel process ${pid} survived shutdown`);
}
test('closing kernels terminates the worker and its descendants, and prevents new work',async()=>{
 const processes=createKernelProcesses();
 const child=processes.spawn(process.execPath,['--input-type=module','-e',`
  import {spawn} from 'node:child_process';
  const worker=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
  worker.once('spawn',()=>console.log(worker.pid));
  setInterval(()=>{},1000);
 `],{stdio:['ignore','pipe','pipe']});
 const [data]=await once(child.stdout,'data');const descendant=Number(String(data).trim());
 try{
  assert.ok(alive(child.pid));assert.ok(alive(descendant));
  const closing=processes.close();assert.equal(processes.close(),closing);
  assert.throws(()=>processes.spawn(process.execPath,[]),/closed/);
  assert.throws(()=>processes.exec(process.execPath,[]),/closed/);
  await closing;
  await waitUntilStopped(child.pid);await waitUntilStopped(descendant);
 }finally{await processes.close();}
});
test('metadata and installation subprocesses are stopped on shutdown',async()=>{
 const processes=createKernelProcesses();
 const task=processes.exec(process.execPath,['-e','setInterval(()=>{},1000)'],{});
 // Register the rejection handler before stopping the command.
 const result=task.then(()=>null,error=>error);
 await once(task.child,'spawn');
 await processes.close();
 assert.ok(await result);await waitUntilStopped(task.child.pid);
});
