import {test} from 'node:test';
import assert from 'node:assert/strict';
import {chmod,mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLocalTranslation} from './local-translation.mjs';

async function temporaryDirectory(){return mkdtemp(join(tmpdir(),'pdfmathreader-local-translation-'));}

function fakeCompiler(response,{delaySeconds=0,onStart}={}){
 let calls=0;
 const execFileImpl=async(_file,args)=>{
  calls++;
  onStart?.();
  const output=args[args.indexOf('-o')+1];
  const json=JSON.stringify(response).replaceAll("'",`'"'"'`);
  const script=delaySeconds
   ? `#!/bin/sh\nsleep ${delaySeconds}\nprintf '%s\\n' '${json}'\n`
   : `#!/bin/sh\nread line\nprintf '%s\\n' '${json}'\n`;
  await writeFile(output,script);
  await chmod(output,0o755);
 };
 return {execFileImpl,get calls(){return calls;}};
}

test('local adapter compiles once per source hash and returns the native translation string',async()=>{
 const root=await temporaryDirectory();
 try{
  const source=join(root,'local-translation.swift');await writeFile(source,'source version one');
  const fake=fakeCompiler({translation:'Bonjour le monde'});
  const adapter=createLocalTranslation({platform:'darwin',systemVersion:'26.0',source,cacheRoot:join(root,'cache'),resourcesPath:join(root,'resources'),execFileImpl:fake.execFileImpl});
  assert.equal(await adapter.available(),true);
  assert.equal(await adapter.available(),true);
  assert.equal(await adapter.translate({text:'Hello world',source:'en',target:'fr'}),'Bonjour le monde');
  assert.equal(fake.calls,1,'the Swift helper should be reused from its source-hash cache');
  await adapter.close();
 }finally{await rm(root,{recursive:true,force:true});}
});

test('adapter rejects before compiling on unsupported macOS',async()=>{
 const adapter=createLocalTranslation({platform:'darwin',systemVersion:'25.6',execFileImpl:()=>{throw Error('must not compile');}});
 assert.equal(await adapter.available(),false);
 await assert.rejects(adapter.translate({text:'Hello',source:'en',target:'fr'}),/macOS 26 or later/);
 await adapter.close();
});

test('native model errors remain actionable and do not fall back to a cloud service',async()=>{
 const root=await temporaryDirectory();
 try{
  const helper=join(root,'local-translation');
  const message='Apple translation models for en and fr are not installed. Open System Settings > General > Language & Region > Translation Languages and download both languages, then retry.';
  await writeFile(helper,`#!/bin/sh\nread line\nprintf '%s\\n' '${JSON.stringify({error:{message,code:'language_models_unavailable'}})}'\n`);await chmod(helper,0o755);
  const adapter=createLocalTranslation({platform:'darwin',systemVersion:'26.0',resourcesPath:root});
  assert.equal(await adapter.available(),true);
  await assert.rejects(adapter.translate({text:'Hello',source:'en',target:'fr'}),error=>error.message===message);
  await adapter.close();
 }finally{await rm(root,{recursive:true,force:true});}
});

test('abort terminates a native request and close aborts a compiler',async()=>{
 const root=await temporaryDirectory();
 try{
  const source=join(root,'local-translation.swift');await writeFile(source,'slow source');
  const fake=fakeCompiler({translation:'late'},{delaySeconds:5});
  const adapter=createLocalTranslation({platform:'darwin',systemVersion:'26.0',source,cacheRoot:join(root,'cache'),resourcesPath:join(root,'resources'),execFileImpl:fake.execFileImpl});
  const controller=new AbortController();
  const request=adapter.translate({text:'Hello',source:'en',target:'fr',signal:controller.signal});
  setTimeout(()=>controller.abort(new Error('caller aborted')),20);
  await assert.rejects(request,/caller aborted/);
  await adapter.close();

  let compilerStarted;
  const started=new Promise(resolve=>{compilerStarted=resolve;});
  const compileAdapter=createLocalTranslation({platform:'darwin',systemVersion:'26.0',source,cacheRoot:join(root,'other-cache'),resourcesPath:join(root,'other-resources'),execFileImpl:(_file,_args,{signal})=>new Promise((_resolve,reject)=>{
   compilerStarted();
   signal.addEventListener('abort',()=>reject(Error('compiler aborted')),{once:true});
  })});
  const availability=compileAdapter.available();await started;await compileAdapter.close();assert.equal(await availability,false);
 }finally{await rm(root,{recursive:true,force:true});}
});
