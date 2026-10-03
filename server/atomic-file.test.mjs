import test from 'node:test';
import assert from 'node:assert/strict';
import {replaceFile} from '../electron/atomic-file.mjs';

test('Windows file replacement retries transient locks and preserves the same source and target',async()=>{
 const calls=[],delays=[];
 await replaceFile('temporary','saved',{platform:'win32',renameFile:async(...paths)=>{calls.push(paths);if(calls.length<=3)throw Object.assign(Error('locked'),{code:['EPERM','EACCES','EBUSY'][calls.length-1]});},pause:async delay=>delays.push(delay)});
 assert.deepEqual(delays,[25,50,100]);assert.equal(calls.length,4);assert.ok(calls.every(paths=>paths[0]==='temporary'&&paths[1]==='saved'));
});
test('permanent locks are bounded; other platforms and unrelated errors fail immediately',async()=>{
 for(const [platform,code,attempts] of [['win32','EPERM',8],['win32','ENOENT',1],['darwin','EPERM',1]]){
  let count=0;const failure=Object.assign(Error('failure'),{code});
  await assert.rejects(replaceFile('temporary','saved',{platform,renameFile:async()=>{count++;throw failure;},pause:async()=>{}}),error=>error===failure);
  assert.equal(count,attempts);
 }
});
