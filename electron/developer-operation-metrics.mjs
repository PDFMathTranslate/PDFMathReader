import {performance} from 'node:perf_hooks';
export function createOperationMetrics(capacity=1000){
 const operations=[],fileOpens=[],communications=[];
 const push=(items,value)=>{items.push(value);if(items.length>capacity)items.shift();};
 const average=items=>items.length?items.reduce((sum,value)=>sum+value,0)/items.length:null;
 return {
  operation(duration){if(Number.isFinite(duration)&&duration>=0)push(operations,duration);},
  fileOpen(duration){if(Number.isFinite(duration)&&duration>=0)push(fileOpens,duration);},
  communication(duration,error){if(Number.isFinite(duration)&&duration>=0)push(communications,{duration,error:!!error});},
  snapshot(){const errorCount=communications.filter(item=>item.error).length;return {mainOperationMetrics:{operationCount:operations.length,averageOperationMs:average(operations),fileOpenCount:fileOpens.length,averageFileOpenMs:average(fileOpens)},backendCommunicationMetrics:{requestCount:communications.length,errorCount,errorRate:communications.length?errorCount/communications.length:null,averageCommunicationMs:average(communications.map(item=>item.duration))}};},
 };
}
export function trackBackendCommunications(session,origin,metrics){
 const pending=new Map(),filter={urls:[origin+'/api/*']};
 session.webRequest.onBeforeRequest(filter,(details,reply)=>{const path=new URL(details.url).pathname;if(!/^\/api\/(developer|performance)(\/|$)/.test(path))pending.set(details.id,performance.now());reply({cancel:false});});
 const finish=(details,failed)=>{const start=pending.get(details.id);pending.delete(details.id);if(start!==undefined)metrics.communication(performance.now()-start,failed||details.statusCode>=400);};
 session.webRequest.onCompleted(filter,details=>finish(details,false));
 session.webRequest.onErrorOccurred(filter,details=>finish(details,true));
 return ()=>pending.clear();
}
