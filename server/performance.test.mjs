import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from './index.mjs';
import {bodyByteLength,createPerformanceTracker} from './performance.mjs';
import {appendPerformanceReport,kibibytesToBytes,loadPerformanceReports,memoryMetricToBytes,writePerformanceReports} from '../electron/performance-tracker.mjs';

test('HTTP performance tracker counts stream bytes and keeps layout timing separate from extraction',()=>{
 const tracker=createPerformanceTracker({now:()=>100,uploadStats:()=>({uploadBytes:17})});
 assert.equal(bodyByteLength('é'),2);assert.equal(bodyByteLength(Buffer.from([1,2,3])),3);
 tracker.recordLayout(8.5);tracker.recordNativeExtraction(3.25);
 assert.deepEqual(tracker.snapshot(),{schemaVersion:1,requests:0,requestBodyBytes:0,responseBodyBytes:0,layout:{requests:1,totalDurationMs:8.5,maxDurationMs:8.5,lastDurationMs:8.5},nativeExtraction:{requests:1,totalDurationMs:3.25,maxDurationMs:3.25,lastDurationMs:3.25},uploadBytes:17});
});

test('performance report validation accepts the fixed recorder schema and rejects plaintext fields',()=>{
 const memory={schemaVersion:1,sampledAtMs:10,scope:{rendererPid:1,backendPid:2,mainPid:3,gpuPids:[4]},scoped:{renderer:{pid:1,workingSetBytes:1024,peakWorkingSetBytes:2048},backend:{pid:2,workingSetBytes:1024,peakWorkingSetBytes:2048},total:{workingSetBytes:2048,peakWorkingSetBytes:4096}},shared:{main:{pid:3,workingSetBytes:1024,peakWorkingSetBytes:2048},gpu:[],total:{workingSetBytes:1024,peakWorkingSetBytes:2048}},aggregate:{workingSetBytes:3072,peakWorkingSetBytes:6144}};
 const report={schemaVersion:1,openedAt:10,fileBytes:20,pageCount:2,firstScreenMs:30,stages:{fileRead:null,upload:2,pdfReady:3,pageGeometry:4,recentHistory:5,restoreView:6},scrollLongTasks:{count:1,totalMs:4,maxMs:4,samples:[{startMs:10,durationMs:4}]},memory,transport:{scope:'since-document-open',timingScope:'window-session',requests:2,requestBodyBytes:20,responseBodyBytes:30,uploadBytes:20,layout:{requests:1,totalDurationMs:3,maxDurationMs:3,lastDurationMs:3},nativeExtraction:{requests:1,totalDurationMs:2,maxDurationMs:2,lastDurationMs:2}},resize:{count:1,layoutCommits:2,snapshotTransitions:3}};
 const capped=Array.from({length:21},()=>report).reduce((reports)=>appendPerformanceReport(reports,report),[]);
 assert.equal(capped.length,20);assert.equal(appendPerformanceReport([],report)[0].memory.aggregate.peakWorkingSetBytes,6144);
 assert.throws(()=>appendPerformanceReport([],{...report,path:'/private/secret.pdf'}),/Unsupported performance report field/);
 assert.throws(()=>appendPerformanceReport([],{...report,secret:'plain text'}),/Unsupported performance report field/);
});

test('Electron metric KiB conversion produces explicit byte units',()=>{
 assert.equal(kibibytesToBytes(1.5),1536);
 assert.deepEqual(memoryMetricToBytes({memory:{workingSetSize:7,peakWorkingSetSize:11}}),{workingSetBytes:7168,peakWorkingSetBytes:11264});
});

test('performance reports persist as a capped latest-20 list',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'performance-reports-'));const path=join(dir,'performance.json');
 try{
  const reports=Array.from({length:21},(_,index)=>({schemaVersion:1,openedAt:new Date(2026,0,1,0,0,index).toISOString(),firstScreenMs:index}));
  await writePerformanceReports(path,reports);const loaded=await loadPerformanceReports(path);assert.equal(loaded.length,20);assert.equal(loaded[0].firstScreenMs,1);assert.equal(loaded.at(-1).firstScreenMs,20);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('authenticated performance endpoint reports cumulative transport bytes and uploadBytes',async()=>{
 const cacheDir=await mkdtemp(join(tmpdir(),'performance-api-'));
 const backend=await startServer({port:0,development:false,cacheDir,token:'performance-test-token'});
 const headers={'X-Preview-Token':'performance-test-token'};
 try{
  assert.equal((await fetch(backend.origin+'/api/performance')).status,403);
  const first=await fetch(backend.origin+'/api/performance',{headers});const baseline=await first.json();assert.equal(first.status,200);
  const bytes=Buffer.from('%PDF-1.7');const upload=await fetch(backend.origin+'/api/documents',{method:'POST',headers:{...headers,'Content-Type':'application/pdf'},body:bytes});assert.equal(upload.status,201);await upload.text();
  const currentResponse=await fetch(backend.origin+'/api/performance',{headers});const current=await currentResponse.json();
  assert.equal(current.schemaVersion,1);assert.ok(current.requests>=baseline.requests+2);assert.ok(current.requestBodyBytes>=bytes.length);assert.ok(current.responseBodyBytes>baseline.responseBodyBytes);assert.equal(current.uploadBytes,bytes.length);assert.deepEqual(current.layout,{requests:0,totalDurationMs:0,maxDurationMs:0,lastDurationMs:0});assert.deepEqual(current.nativeExtraction,{requests:0,totalDurationMs:0,maxDurationMs:0,lastDurationMs:0});
 }finally{await backend.close();await rm(cacheDir,{recursive:true,force:true});}
});
