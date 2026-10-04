import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,stat,realpath,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createLimiter,createEngines,prepareKernelAssets,pythonResourcePath,definitions,kernelPythonPath,findUv} from './engines.mjs';
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
