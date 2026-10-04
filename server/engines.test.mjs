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
