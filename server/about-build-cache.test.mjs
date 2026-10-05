import test from 'node:test';
import assert from 'node:assert/strict';
test('About build snapshot loads lazily, shares concurrent and subsequent reads, retries failures',async()=>{
 const original=globalThis.fetch;
 let calls=0;
 const snapshot={version:'1.2.3',recentFeatures:[]};
 try{
  globalThis.fetch=async url=>{assert.equal(url,'/build-info.json');calls++;return {ok:calls!==1,json:async()=>snapshot};};
  const {loadBuildInfo}=await import('../src/build-info.mjs?cache-test');
  assert.equal(calls,0);
  await assert.rejects(loadBuildInfo(),/unavailable/);
  const [first,second]=await Promise.all([loadBuildInfo(),loadBuildInfo()]);
  assert.equal(first,snapshot);assert.equal(second,snapshot);assert.equal(await loadBuildInfo(),snapshot);assert.equal(calls,2);
 }finally{globalThis.fetch=original;}
});
