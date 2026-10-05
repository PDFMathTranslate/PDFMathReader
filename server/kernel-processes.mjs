import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {basename} from 'node:path';
import {redactArgv,redactDiagnosticText,summarizeStdinCommand} from './developer-diagnostics.mjs';

const exec=promisify(execFile);
const MAX_STREAM_BUFFER=64*1024;

function safePid(value){return Number.isInteger(value)&&value>0?value:null;}

export function parseCpuDuration(value){
 const text=String(value??'').trim();
 if(!text)return null;
 const dayMatch=text.match(/^(\d+)-(.*)$/);
 const days=dayMatch?Number(dayMatch[1]):0;
 const parts=(dayMatch?dayMatch[2]:text).split(':');
 if(parts.length<1||parts.length>3||!parts.every(part=>/^\d+(?:\.\d+)?$/.test(part)))return null;
 const numbers=parts.map(Number);
 if(numbers.some(value=>!Number.isFinite(value)))return null;
 let seconds;
 if(parts.length===3)seconds=numbers[0]*3600+numbers[1]*60+numbers[2];
 else if(parts.length===2)seconds=numbers[0]*60+numbers[1];
 else seconds=numbers[0];
 return seconds+days*86400;
}

// Own every kernel process, including metadata queries and uv installs.
export function createKernelProcesses({execImpl=exec,onEvent,now=()=>globalThis.performance?.now?.()??Date.now()}={}){
 const children=new Set(),stopping=new Map(),records=new Map();
 const cpuSamples=new Map();
 let closed=false,closePromise;
 function emit(event){try{onEvent?.(event);}catch{}}
 function processMetadata(file,metadata={}){
  return {
   kernel:metadata.kernel==null?null:String(metadata.kernel),
   role:'kernel',
   name:metadata.name||basename(String(file||''))||'kernel',
   secrets:Array.isArray(metadata.secrets)?metadata.secrets:[]
  };
 }
 function attachStreams(child,metadata){
  for(const streamName of ['stdout','stderr']){
   const stream=child?.[streamName];
   if(!stream||typeof stream.on!=='function')continue;
   let buffered='',droppingOversizedLine=false;
   const emitLine=line=>{if(!line)return;emit({kind:`kernel-${streamName}`,kernel:metadata.kernel,pid:child.pid,message:redactDiagnosticText(line,{secrets:metadata.secrets})});};
   const omitted=()=>emitLine('[oversized output line omitted]');
   const flush=()=>{if(buffered){emitLine(buffered);buffered='';}};
   stream.on('data',chunk=>{
    let data=String(chunk);
    if(droppingOversizedLine){
     const boundary=data.search(/[\r\n]/);
     if(boundary<0)return;
     data=data.slice(boundary+1);droppingOversizedLine=false;
    }
    buffered+=data;
    const lines=buffered.split(/\r\n|[\r\n]/);buffered=lines.pop()||'';
    for(const line of lines)line.length>MAX_STREAM_BUFFER?omitted():emitLine(line);
    // Discard the entire oversized line, including future chunks. Emitting a
    // partial prefix/tail could expose a credential split across that boundary.
    if(buffered.length>MAX_STREAM_BUFFER){omitted();buffered='';droppingOversizedLine=true;}
   });
   stream.once?.('end',flush);
   stream.once?.('close',flush);
  }
  const input=child?.stdin;
  if(!input||typeof input.on!=='function')return;
  for(const method of ['write','end']){
   const original=input[method];
   if(typeof original!=='function')continue;
   input[method]=function(chunk,...args){
    if(chunk!==undefined)emit({kind:'kernel-stdin',kernel:metadata.kernel,pid:child.pid,message:summarizeStdinCommand(chunk,{secrets:metadata.secrets})});
    return original.call(this,chunk,...args);
   };
  }
 }
 function track(child,file,metadata={}){
  if(!child)return;
  const details=processMetadata(file,metadata);
  const record={...details,pid:safePid(child.pid),rootPid:safePid(child.pid),command:JSON.stringify(redactArgv(file,metadata.args,{secrets:details.secrets}))};
  children.add(child);records.set(child,record);
  let spawnReported=false;
  const reportSpawn=()=>{
   if(spawnReported)return;
   spawnReported=true;
   record.pid=safePid(child.pid);record.rootPid=record.pid;
   const argv=redactArgv(file,metadata.args,{secrets:details.secrets});
   emit({kind:'kernel-spawn',kernel:details.kernel,pid:record.pid,message:`spawn argv=${JSON.stringify(argv)}`});
  };
  if(typeof child.once==='function')child.once('spawn',reportSpawn);else reportSpawn();
  if(safePid(child.pid))queueMicrotask(reportSpawn);
  attachStreams(child,details);
  child.once?.('close',(code,signal)=>{
   children.delete(child);records.delete(child);
   emit({kind:'kernel-exit',kernel:details.kernel,pid:record.pid,message:`exit code=${code??'null'} signal=${signal??'none'}`});
  });
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
 async function snapshot(){
 if(process.platform==='win32')return {available:false,reason:'Process sampling is unavailable on Windows.',processes:[]};
 const roots=[...records.values()].filter(record=>safePid(record.pid));
  if(!roots.length){cpuSamples.clear();return {available:true,cpuPercentBasis:'interval',processes:[]};}
  let stdout;
   try{({stdout}=await execImpl('ps',['-axo','pid=,ppid=,time=,rss=,stat=,comm='],{timeout:3000,windowsHide:true}));}
  catch(error){return {available:false,reason:`Process sampling failed: ${error?.message||'ps failed'}`,processes:[]};}
  const rows=String(stdout||'').split(/\r?\n/).map(line=>{
   const match=line.trim().match(/^(\d+)\s+(\d+)\s+(\S+)\s+(\d+)\s+(\S+)\s+(.+?)\s*$/);
   if(!match)return null;
   const cpuSeconds=parseCpuDuration(match[3]),rss=Number(match[4]);
   return {pid:Number(match[1]),ppid:Number(match[2]),cpuSeconds,cpuPercent:null,rssBytes:Number.isFinite(rss)?rss*1024:null,state:match[5],name:match[6]};
  }).filter(Boolean);
  const byPid=new Map(rows.map(row=>[row.pid,row]));
  const byParent=new Map();
  for(const row of rows){const childrenForParent=byParent.get(row.ppid)||[];childrenForParent.push(row);byParent.set(row.ppid,childrenForParent);}
  const sampledAt=now(),output=[],seenPids=new Set();
  for(const root of roots){
   const walk=(row,rootPid)=>{
    if(!row)return;
    seenPids.add(row.pid);
    const previous=cpuSamples.get(row.pid);
    const elapsedMs=previous?sampledAt-previous.at:null;
    const cpuPercent=previous&&elapsedMs>0&&row.cpuSeconds!==null&&previous.cpuSeconds!==null&&row.cpuSeconds>=previous.cpuSeconds
     ?(row.cpuSeconds-previous.cpuSeconds)*100000/elapsedMs:null;
    cpuSamples.set(row.pid,{at:sampledAt,cpuSeconds:row.cpuSeconds});
    output.push({pid:row.pid,ppid:row.ppid,kernel:root.kernel,role:'kernel',name:row.name||root.name,command:row.pid===rootPid?root.command:row.name,cpuPercent,rssBytes:row.rssBytes,state:row.state,rootPid,cpuPercentBasis:'interval'});
    for(const child of byParent.get(row.pid)||[])walk(child,rootPid);
   };
   walk(byPid.get(root.pid),root.pid);
  }
  for(const pid of cpuSamples.keys())if(!seenPids.has(pid))cpuSamples.delete(pid);
  return {available:true,cpuPercentBasis:'interval',processes:output};
 }
 return {
  spawn(file,args,options={},metadata={}){ensureOpen();const child=spawn(file,args,{...options,windowsHide:true,detached:process.platform!=='win32'});track(child,file,{...metadata,args});return child;},
  exec(file,args,options={},metadata={}){ensureOpen();const task=execImpl(file,args,{...options,windowsHide:true,detached:process.platform!=='win32'});track(task.child,file,{...metadata,args});return task;},
  observe(child,file,metadata={}){ensureOpen();track(child,file,metadata);return child;},
  snapshot,
  terminate,
  close(){if(!closePromise){closed=true;closePromise=Promise.all([...children].map(terminate).concat([...stopping.values()]));}return closePromise;}
 };
}
