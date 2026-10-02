import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,stat,realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createLimiter,createEngines,prepareKernelAssets} from './engines.mjs';
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
