import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createAppUpdates,compareVersions,releaseLink,UPDATE_INTERVAL,UPDATE_STARTUP_DELAY,RELEASE_API} from '../electron/app-updates.mjs';
const release=(version='v0.2.0')=>({tag_name:version,html_url:`https://github.com/PDFMathTranslate/PDFMathReader/releases/tag/${version}`,draft:false,prerelease:false,assets:[{name:'PDFMathReader-darwin-arm64.zip',browser_download_url:`https://github.com/PDFMathTranslate/PDFMathReader/releases/download/${version}/PDFMathReader-darwin-arm64.zip`}]});
const response=(status,data)=>({status,ok:status>=200&&status<300,headers:new Headers({etag:'"release-test"'}),json:async()=>data});
test('compares release versions numerically and treats prerelease as older than stable',()=>{
 assert.equal(compareVersions('v1.10.0','1.9.9'),1);assert.equal(compareVersions('0.1.0','0.2.0'),-1);
 assert.equal(compareVersions('1.0.0','1.0.0-beta.3'),1);assert.equal(compareVersions('1.0.0-beta.10','1.0.0-beta.2'),1);
 assert.equal(compareVersions('1.0.0+build','v1.0.0'),0);assert.equal(compareVersions('nightly','0.1.0'),null);
 assert.equal(releaseLink('https://evil.test/PDFMathTranslate/PDFMathReader/releases/tag/v2'),null);
});
test('empty release repository is a normal status; failures and invalid releases stay distinct',async()=>{
 let next=response(404);const updates=await createAppUpdates({currentVersion:'0.1.0',fetchImpl:async()=>next});
 assert.equal((await updates.check()).status,'no-release');
 next=response(429);assert.equal((await updates.check()).error,'rate-limit');
 next=response(200,release('nightly'));assert.equal((await updates.check()).error,'invalid-release');
 next=response(200,{...release(),prerelease:true});assert.equal((await updates.check()).error,'invalid-release');
 next=response(200,release('v0.1.0'));assert.equal((await updates.check()).status,'up-to-date');
 next=response(200,release('v0.0.9'));assert.equal((await updates.check()).status,'up-to-date');
 updates.stop();
});
test('shares checks, selects architecture asset, persists and revalidates with ETag',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'reader-app-updates-')),path=join(folder,'updates.json');
 try{
  let calls=0,finish;const events=[];
  const updates=await createAppUpdates({currentVersion:'0.1.0',path,platform:'darwin',arch:'arm64',onChange:state=>events.push(state),fetchImpl:async url=>{assert.equal(url,RELEASE_API);calls++;return new Promise(resolve=>finish=resolve);}});
  const first=updates.check(),second=updates.check();assert.equal(first,second);assert.equal(calls,1);assert.equal(updates.status().status,'checking');
  finish(response(200,release()));const state=await first;assert.equal(state.status,'available');assert.match(state.downloadUrl,/darwin-arm64.zip$/);assert.equal(events.at(-1).latestVersion,'0.2.0');updates.stop();
  const restored=await createAppUpdates({currentVersion:'0.2.0',path,platform:'win32',arch:'x64',fetchImpl:async(_url,options)=>{assert.equal(options.headers['If-None-Match'],'"release-test"');return response(304);}});
  assert.equal(restored.status().status,'up-to-date');assert.equal(restored.status().downloadUrl,null);assert.equal((await restored.check()).status,'up-to-date');restored.stop();
 }finally{await rm(folder,{recursive:true,force:true});}
});
test('lazy startup and interval checks stop when disabled; manual checks still work',async()=>{
 let calls=0,id=0;const timers=new Map();const setTimer=(callback,delay)=>{const key=++id;timers.set(key,{callback,delay});return key;},clearTimer=key=>timers.delete(key);
 const updates=await createAppUpdates({currentVersion:'0.1.0',setTimer,clearTimer,fetchImpl:async()=>{calls++;return response(404);}});
 assert.equal(calls,0);updates.start();assert.equal([...timers.values()][0].delay,UPDATE_STARTUP_DELAY);
 await [...timers.values()][0].callback();assert.equal(calls,1);assert.ok([...timers.values()].some(timer=>timer.delay===UPDATE_INTERVAL));
 updates.setAutomatic(false);const before=calls;await updates.check();assert.equal(calls,before+1);assert.equal(updates.status().automatic,false);
 updates.stop();
});
test('network failures and shutdown aborts do not produce false up-to-date results',async()=>{
 const updates=await createAppUpdates({currentVersion:'0.1.0',fetchImpl:async()=>{throw Error('offline');}});
 assert.equal((await updates.check()).error,'network');assert.equal(updates.status().checkedAt,null);updates.stop();
 let signal;const closing=await createAppUpdates({currentVersion:'0.1.0',fetchImpl:(_url,options)=>{signal=options.signal;return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted'))));}});
 const pending=closing.check();closing.stop();await pending;assert.equal(signal.aborted,true);
});
