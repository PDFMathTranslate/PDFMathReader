import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,stat,realpath,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createLimiter,createEngines,prepareKernelAssets,pythonResourcePath,definitions,kernelPythonPath,findUv} from './engines.mjs';
import {startServer} from './index.mjs';

test('global translation budget holds across simultaneous page workers and releases after failures',async()=>{
 const limiter=createLimiter(2);let active=0,peak=0;const completed=[];
 await Promise.allSettled(Array.from({length:12},(_,n)=>limiter.run(async()=>{active++;peak=Math.max(peak,active);try{await new Promise(r=>setTimeout(r,2+(n%3)*3));if(n===3)throw Error('fixture failure');completed.push(n);}finally{active--;}})));
 assert.equal(peak,2);assert.equal(active,0);assert.equal(completed.length,11);assert.ok(completed.includes(11));
});

test('cancelled queued translations release immediately without running or waiting for a slot',async()=>{
 const limiter=createLimiter(1);let release;
 const running=limiter.run(()=>new Promise(resolve=>{release=resolve;}));
 await Promise.resolve();
 const controller=new AbortController();let ran=false;
 const cancelled=limiter.run(()=>{ran=true;},{signal:controller.signal});
 controller.abort();
 await assert.rejects(cancelled,{name:'AbortError'});
 assert.equal(ran,false);
 release();await running;
 assert.equal(await limiter.run(()=>42),42);
 const aborted=new AbortController();aborted.abort();
 await assert.rejects(limiter.run(()=>{ran=true;},{signal:aborted.signal}),{name:'AbortError'});
 assert.equal(ran,false);
});

test('Fast and Precise retain compatible pre-update translated PDFs and layouts across app versions',async()=>{
 const {createHash}=await import('node:crypto');
 const root=await mkdtemp(join(tmpdir(),'kernel-cache-update-')),cacheDir=join(root,'math');
 const bytes=Buffer.from('%PDF source fixture');
 try{
  await mkdir(cacheDir,{recursive:true});
  const options={root,cacheDir,findUvImpl:async()=>({available:true,path:'fixture-uv'}),execImpl:async()=>({stdout:'1.0.0'})};
  for(const [id,layoutSchema] of [['pdf_math_fast',5],['pdf_math_precise',2]]){
   const key=createHash('sha256').update(bytes).update(JSON.stringify({id,version:'1.0.0',page:1,language:'Simplified Chinese',model:'gpt-4.1-mini',prompt:2,layoutSchema})).digest('hex');
   const metadata={paragraphs:[{id:'paragraph',text:'original',translation:'cached translation'}]};
   await writeFile(join(cacheDir,key+'.pdf'),'%PDF translated fixture');
   await writeFile(join(cacheDir,key+'.layout.json'),JSON.stringify(metadata));
   for(const appVersion of ['before-update','after-update']){
    const engines=createEngines({...options,appVersion});
    const result=await engines.translate({id,bytes,page:1,language:'Simplified Chinese',model:'siliconflow-free',reuseTranslations:true,runWorker:()=>{throw Error('Cache hits must bypass the occupied worker budget');}});
    assert.equal(result.cached,true);assert.equal(result.layoutKey,key);assert.equal(result.translationModel,'gpt-4.1-mini');
    assert.deepEqual(await engines.layout(result.layoutKey),metadata);
    engines.close();
   }
  }
 }finally{await rm(root,{recursive:true,force:true});}
});

test('kernel cache-only lookup misses without starting a worker or creating a job',async()=>{
 const root=await mkdtemp(join(tmpdir(),'kernel-cache-probe-'));
 try{
  const engines=createEngines({root,cacheDir:join(root,'math'),findUvImpl:async()=>({available:true}),execImpl:async()=>({stdout:'1.0.0'})});
  for(const id of ['pdf_math_fast','pdf_math_precise'])assert.equal(await engines.translate({id,bytes:Buffer.from('%PDF fixture'),page:1,language:'French',model:'fixture',cacheOnly:true}),null);
  const {readdir}=await import('node:fs/promises');assert.deepEqual(await readdir(root),[]);
  engines.close();
 }finally{await rm(root,{recursive:true,force:true});}
});

test('a page filled while waiting reuses its cache instead of starting another worker',async()=>{
 const {createHash}=await import('node:crypto');
 const {readdir}=await import('node:fs/promises');
 const root=await mkdtemp(join(tmpdir(),'kernel-queued-cache-')),cacheDir=join(root,'math');
 const bytes=Buffer.from('%PDF queued fixture'),id='pdf_math_fast',model='fixture';
 const key=createHash('sha256').update(bytes).update(JSON.stringify({id,version:'1.0.0',page:1,language:'French',model,prompt:2,layoutSchema:4})).digest('hex');
 try{
  const engines=createEngines({root,cacheDir,findUvImpl:async()=>({available:true}),execImpl:async()=>({stdout:'1.0.0'})});
  const result=await engines.translate({id,bytes,page:1,language:'French',model,runWorker:async fn=>{
   await mkdir(cacheDir,{recursive:true});await writeFile(join(cacheDir,key+'.pdf'),'%PDF completed by preceding worker');
   await writeFile(join(cacheDir,key+'.layout.json'),JSON.stringify({paragraphs:[]}));
   return fn();
  }});
  assert.equal(result.cached,true);assert.equal(result.layoutKey,key);
  assert.deepEqual(await readdir(root),['math']);engines.close();
 }finally{await rm(root,{recursive:true,force:true});}
});
