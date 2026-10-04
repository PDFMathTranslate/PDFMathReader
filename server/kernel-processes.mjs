import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';

const exec=promisify(execFile);

// Own every kernel process, including metadata queries and uv installs.
export function createKernelProcesses({execImpl=exec}={}){
 const children=new Set(),stopping=new Map();
 let closed=false,closePromise;
 function track(child){
  if(!child)return;
  children.add(child);
  child.once('close',()=>children.delete(child));
 }
 function ensureOpen(){if(closed)throw Error('Kernel service is closed');}
 async function terminate(child){
  if(stopping.has(child))return stopping.get(child);
  const task=(async()=>{
   if(!child.pid)return;
   if(process.platform==='win32'){
    // child.kill() only stops Python itself; its multiprocessing workers survive.
    try{await exec('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,timeout:3000});}
    catch(error){if(child.exitCode===null&&child.signalCode===null)throw error;}
   }else{
    try{process.kill(-child.pid,'SIGTERM');}catch{child.kill('SIGTERM');}
    await new Promise(resolve=>setTimeout(resolve,300));
    // Descendants may ignore TERM even if their parent has already exited.
    try{process.kill(-child.pid,'SIGKILL');}catch{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');}
   }
  })();
  stopping.set(child,task);
  try{await task;}finally{stopping.delete(child);}
 }
 return {
  spawn(file,args,options){ensureOpen();const child=spawn(file,args,{...options,windowsHide:true,detached:process.platform!=='win32'});track(child);return child;},
  exec(file,args,options){ensureOpen();const task=execImpl(file,args,{...options,windowsHide:true,detached:process.platform!=='win32'});track(task.child);return task;},
  terminate,
  close(){if(!closePromise){closed=true;closePromise=Promise.all([...children].map(terminate).concat([...stopping.values()]));}return closePromise;}
 };
}
