import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createEngines,definitions,kernelPythonPath} from './engines.mjs';
import {decorateAdvancedOptions} from './kernel-options.mjs';

const ENGINE_ID='pdf_math_fast';
const UV_PATH='/fixture/uv';
const KERNEL_VERSION='2.8.2';

const rawOptions=[
 {id:'vfont',flag:'--vfont',type:'string',default:'',help:'font',label:'Vfont'},
 {id:'vchar',flag:'--vchar',type:'string',default:'',help:'character',label:'Vchar'}
];

const refreshedRawOptions=[
 {id:'vfont',flag:'--vfont',type:'string',default:'',help:'font',label:'Vfont'},
 {id:'debug',flag:'--debug',type:'boolean',default:false,flagValue:true,help:'debug',label:'Debug'}
];

const metadataPath=root=>join(root,'.advanced-options',`${ENGINE_ID}.json`);
const isKernelOptionsCall=call=>typeof call.args?.[0]==='string'&&call.args[0].endsWith('kernel-options.py');
const isKernelProbeCall=call=>call.args?.[0]==='-c';
const jsonValue=value=>JSON.parse(JSON.stringify(value));

function fixture({root,version=KERNEL_VERSION,raw=rawOptions,optionsFailure=()=>false,initiallyInstalled=true}={}){
 const calls=[];
 let detections=0;
 let probes=0;
 let installed=initiallyInstalled;
 const pythonPath=kernelPythonPath(join(root,ENGINE_ID));
 const currentVersion=()=>typeof version==='function'?version():version;
 const currentRaw=()=>typeof raw==='function'?raw(detections):raw;
 const shouldFail=()=>typeof optionsFailure==='function'?optionsFailure(detections):optionsFailure;
 const execImpl=async(command,args)=>{
  calls.push({command,args});
  if(command===pythonPath&&args[0]==='-c'){
   probes++;
   if(!installed)throw Error('fixture environment is missing');
   return {stdout:`${currentVersion()}\n`};
  }
  if(command===pythonPath&&isKernelOptionsCall({args})){
   detections++;
   if(shouldFail())throw Error('fixture advanced detection failed');
   return {stdout:JSON.stringify(currentRaw())};
  }
  if(command===UV_PATH&&args[0]==='venv'){
   installed=true;
   await mkdir(join(root,ENGINE_ID,'bin'),{recursive:true});
   return {stdout:''};
  }
  if(command===UV_PATH&&args[0]==='pip')return {stdout:''};
  throw Error(`Unexpected fixture command: ${command} ${args.join(' ')}`);
 };
 return {
  calls,
  get detections(){return detections;},
  get probes(){return probes;},
  set failed(value){optionsFailure=()=>value;},
  findUvImpl:async()=>({available:true,path:UV_PATH,version:'uv fixture'}),
  execImpl
 };
}

function enginesFor(root,cacheDir,fixtureData,appVersion='development'){
 return createEngines({
  root,
  cacheDir,
  appVersion,
  findUvImpl:fixtureData.findUvImpl,
  execImpl:fixtureData.execImpl
 });
}

test('advanced options persist and reuse the disk cache across engine instances',async()=>{
 const root=await mkdtemp(join(tmpdir(),'advanced-cache-process-'));
 const cacheDir=join(root,'cache');
 const fixtureData=fixture({root});
 const expected=decorateAdvancedOptions(ENGINE_ID,rawOptions);
 let engines;
 try{
  engines=enginesFor(root,cacheDir,fixtureData,'1.0.0');
  const first=await engines.advanced(ENGINE_ID);
  assert.deepEqual(first.options,expected);
  assert.equal(fixtureData.detections,1);
  const persisted=JSON.parse(await readFile(metadataPath(root),'utf8'));
  assert.deepEqual(persisted,{
   schemaVersion:1,
   appVersion:'1.0.0',
   kernelVersion:KERNEL_VERSION,
   result:jsonValue(first)
  });
  engines.close();

  engines=enginesFor(root,cacheDir,fixtureData,'1.0.0');
  const second=await engines.advanced(ENGINE_ID);
  assert.deepEqual(second,first);
  assert.equal(fixtureData.detections,1,'a second process must reuse the persisted schema');
  assert.equal(fixtureData.probes,2,'the second process may re-probe the installed kernel version');
  engines.close();

  engines=enginesFor(root,cacheDir,fixtureData,'1.0.0');
  const beforeProbe=fixtureData.probes;
  const suppliedState={id:ENGINE_ID,label:definitions[ENGINE_ID].label,installed:true,available:true,version:KERNEL_VERSION};
  assert.deepEqual(await engines.advanced(ENGINE_ID,suppliedState),first);
  assert.equal(fixtureData.probes,beforeProbe,'a supplied known state bypasses the kernel check');
  assert.equal(fixtureData.detections,1);
 }finally{
  engines?.close();
  await rm(root,{recursive:true,force:true});
 }
});

test('advanced disk cache invalidates when app or kernel version changes',async()=>{
 const root=await mkdtemp(join(tmpdir(),'advanced-cache-version-'));
 const cacheDir=join(root,'cache');
 let version=KERNEL_VERSION;
 const fixtureData=fixture({root,version:()=>version});
 let engines;
 try{
  engines=enginesFor(root,cacheDir,fixtureData,'1.0.0');
  await engines.advanced(ENGINE_ID);
  engines.close();

  engines=enginesFor(root,cacheDir,fixtureData,'2.0.0');
  await engines.advanced(ENGINE_ID);
  assert.equal(fixtureData.detections,2,'changing appVersion invalidates the disk cache');
  engines.close();

  version='2.8.3';
  engines=enginesFor(root,cacheDir,fixtureData,'2.0.0');
  const result=await engines.advanced(ENGINE_ID);
  assert.equal(result.options.length,rawOptions.length);
  assert.equal(fixtureData.detections,3,'changing the probed kernel version invalidates the disk cache');
  assert.deepEqual(JSON.parse(await readFile(metadataPath(root),'utf8')),{schemaVersion:1,appVersion:'2.0.0',kernelVersion:'2.8.3',result:jsonValue(result)});
 }finally{
  engines?.close();
  await rm(root,{recursive:true,force:true});
 }
});

test('successful installs populate advanced metadata and reinstalls refresh it at the same kernel version',async()=>{
 const root=await mkdtemp(join(tmpdir(),'advanced-cache-install-'));
 const cacheDir=join(root,'cache');
 const fixtureData=fixture({root,initiallyInstalled:false,raw:detection=>detection===1?rawOptions:refreshedRawOptions});
 let engines;
 try{
  engines=enginesFor(root,cacheDir,fixtureData,'1.0.0');
  const installed=await engines.install(ENGINE_ID);
  assert.equal(installed.available,true);
  assert.equal(installed.version,KERNEL_VERSION);
  assert.equal(fixtureData.detections,1);
  const firstMetadata=JSON.parse(await readFile(metadataPath(root),'utf8'));
  assert.equal(firstMetadata.schemaVersion,1);
  assert.equal(firstMetadata.appVersion,'1.0.0');
  assert.equal(firstMetadata.kernelVersion,KERNEL_VERSION);
  assert.deepEqual(firstMetadata.result.options,jsonValue(decorateAdvancedOptions(ENGINE_ID,rawOptions)));
  await engines.advanced(ENGINE_ID);
  assert.equal(fixtureData.detections,1,'the freshly populated cache is available before install returns');

  await engines.install(ENGINE_ID,{reinstall:true});
  assert.equal(fixtureData.detections,2,'reinstall refreshes the schema even when the kernel version is unchanged');
  const refreshed=JSON.parse(await readFile(metadataPath(root),'utf8'));
  assert.deepEqual(refreshed.result.options,jsonValue(decorateAdvancedOptions(ENGINE_ID,refreshedRawOptions)));
  assert.equal(fixtureData.calls.filter(call=>call.command===UV_PATH&&call.args[0]==='pip').length,2);
 }finally{
  engines?.close();
  await rm(root,{recursive:true,force:true});
 }
});

test('failed advanced detection is not persisted and a retry can succeed',async()=>{
 const root=await mkdtemp(join(tmpdir(),'advanced-cache-failure-'));
 const cacheDir=join(root,'cache');
 let failed=true;
 const fixtureData=fixture({root,optionsFailure:()=>failed});
 let engines;
 try{
  engines=enginesFor(root,cacheDir,fixtureData,'1.0.0');
  const failure=await engines.advanced(ENGINE_ID);
  assert.equal(failure.reason,'Kernel advanced options could not be queried.');
  assert.equal(fixtureData.detections,1);
  await assert.rejects(readFile(metadataPath(root),'utf8'));

  failed=false;
  const recovered=await engines.advanced(ENGINE_ID);
  assert.deepEqual(recovered.options,decorateAdvancedOptions(ENGINE_ID,rawOptions));
  assert.equal(fixtureData.detections,2,'a failed detection must be retried');
  assert.equal(JSON.parse(await readFile(metadataPath(root),'utf8')).schemaVersion,1);
 }finally{
  engines?.close();
  await rm(root,{recursive:true,force:true});
 }
});

test('corrupt advanced metadata is recovered by fresh detection',async()=>{
 const root=await mkdtemp(join(tmpdir(),'advanced-cache-corrupt-'));
 const cacheDir=join(root,'cache');
 const fixtureData=fixture({root});
 let engines;
 try{
  engines=enginesFor(root,cacheDir,fixtureData,'1.0.0');
  await engines.advanced(ENGINE_ID);
  engines.close();
  await writeFile(metadataPath(root),'{not valid json');

  engines=enginesFor(root,cacheDir,fixtureData,'1.0.0');
  const recovered=await engines.advanced(ENGINE_ID);
  assert.deepEqual(recovered.options,decorateAdvancedOptions(ENGINE_ID,rawOptions));
  assert.equal(fixtureData.detections,2);
  const repaired=JSON.parse(await readFile(metadataPath(root),'utf8'));
  assert.deepEqual(repaired.result, jsonValue(recovered));
 }finally{
  engines?.close();
  await rm(root,{recursive:true,force:true});
 }
});
