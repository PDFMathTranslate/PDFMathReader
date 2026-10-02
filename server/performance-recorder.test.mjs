import test from 'node:test';
import assert from 'node:assert/strict';
import {createPerformanceRecorder} from '../src/performance-recorder.mjs';

test('first screen is measured after two paint frames and transport is scoped to this document',async()=>{
 const previousRAF=globalThis.requestAnimationFrame,frames=[];globalThis.requestAnimationFrame=fn=>frames.push(fn);
 let time=100,total={requests:4,requestBodyBytes:12,responseBodyBytes:80,uploadBytes:8},saved;
 const recorder=createPerformanceRecorder({now:()=>time,fetchStats:async()=>({...total}),native:{sample:async()=>({privateBytes:64}),save:async report=>saved=report}});
 try{
  await recorder.start(200);time=150;recorder.mark('pdfReady');recorder.pages(1000);recorder.painted();
  assert.equal((await recorder.snapshot()).firstScreenMs,null);time=160;frames.shift()();assert.equal((await recorder.snapshot()).firstScreenMs,null);time=180;frames.shift()();
  total={requests:6,requestBodyBytes:212,responseBodyBytes:100,uploadBytes:208};const report=await recorder.finish();
  assert.equal(report.firstScreenMs,80);assert.equal(report.stages.pdfReady,50);assert.equal(report.pageCount,1000);assert.equal(report.transport.requestBodyBytes,200);assert.equal(report.transport.responseBodyBytes,20);assert.equal(saved.fileBytes,200);
  await recorder.start(10);assert.equal((await recorder.snapshot()).firstScreenMs,null);
 }finally{recorder.destroy();globalThis.requestAnimationFrame=previousRAF;}
});

test('stale first-paint frames cannot be assigned to a newly opened document',async()=>{
 const previousRAF=globalThis.requestAnimationFrame,frames=[];globalThis.requestAnimationFrame=fn=>frames.push(fn);
 const recorder=createPerformanceRecorder({fetchStats:async()=>null});
 try{await recorder.start(10);recorder.painted();await recorder.start(20);frames.shift()();frames.shift()();assert.equal((await recorder.snapshot()).firstScreenMs,null);}finally{recorder.destroy();globalThis.requestAnimationFrame=previousRAF;}
});

test('long tasks outside a scroll interval and from a previous document are excluded',async()=>{
 const previous=globalThis.PerformanceObserver;let deliver,time=100;
 globalThis.PerformanceObserver=class{constructor(callback){deliver=entries=>callback({getEntries:()=>entries});}observe(){}disconnect(){}};
 const recorder=createPerformanceRecorder({now:()=>time,fetchStats:async()=>null});
 try{await recorder.start(10);deliver([{startTime:0,duration:200}]);assert.equal((await recorder.snapshot()).scrollLongTasks.count,0);time=300;recorder.scroll();deliver([{startTime:300,duration:75}]);assert.equal((await recorder.snapshot()).scrollLongTasks.maxMs,75);time=500;await recorder.start(20);deliver([{startTime:300,duration:75}]);assert.equal((await recorder.snapshot()).scrollLongTasks.count,0);}finally{recorder.destroy();globalThis.PerformanceObserver=previous;}
});
