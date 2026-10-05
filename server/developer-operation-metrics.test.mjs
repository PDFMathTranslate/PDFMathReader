import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createOperationMetrics,trackBackendCommunications} from '../electron/developer-operation-metrics.mjs';
test('bounded operation and request metrics use weighted counts and unavailable empty samples',()=>{
 const metrics=createOperationMetrics(2);assert.equal(metrics.snapshot().mainOperationMetrics.averageOperationMs,null);assert.equal(metrics.snapshot().backendCommunicationMetrics.errorRate,null);
 for(const value of [10,20,40])metrics.operation(value);metrics.fileOpen(100);metrics.communication(10,false);metrics.communication(30,true);metrics.communication(NaN,true);
 assert.deepEqual(metrics.snapshot(),{mainOperationMetrics:{operationCount:2,averageOperationMs:30,fileOpenCount:1,averageFileOpenMs:100},backendCommunicationMetrics:{requestCount:2,errorCount:1,errorRate:.5,averageCommunicationMs:20}});
});
test('backend tracker counts failed requests once and excludes monitor polling',()=>{
 const listeners={},session={webRequest:Object.fromEntries(['onBeforeRequest','onCompleted','onErrorOccurred'].map(name=>[name,(_filter,callback)=>listeners[name]=callback]))},metrics=createOperationMetrics();const stop=trackBackendCommunications(session,'http://localhost:1234',metrics);
 const before=(id,path)=>listeners.onBeforeRequest({id,url:'http://localhost:1234'+path},value=>assert.equal(value.cancel,false));
 before(1,'/api/config');listeners.onCompleted({id:1,statusCode:200});before(2,'/api/translate');listeners.onErrorOccurred({id:2});listeners.onCompleted({id:2,statusCode:500});before(3,'/api/developer/snapshot');listeners.onCompleted({id:3,statusCode:500});
 assert.equal(metrics.snapshot().backendCommunicationMetrics.requestCount,2);assert.equal(metrics.snapshot().backendCommunicationMetrics.errorRate,.5);stop();
});
