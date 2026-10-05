const ENGINES=Object.freeze(['pdf_inspector','pdf_math_fast','pdf_math_precise']);
const ENGINE_SET=new Set(ENGINES);
const SERVICE_ID=/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const OUTCOMES=new Set(['success','error']);
const PROTOTYPE_NAMES=new Set([...Object.getOwnPropertyNames(Object.prototype),'prototype']);

function isRecord(value){
 return value!==null&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);
}

export function isTranslationServiceOutcome(value){return OUTCOMES.has(value);}

export function isValidTranslationServiceHistory(value){
 if(!isRecord(value))return false;
 for(const engine of Reflect.ownKeys(value)){
  if(typeof engine!=='string'||!ENGINE_SET.has(engine)||PROTOTYPE_NAMES.has(engine)||!isRecord(value[engine]))return false;
  for(const service of Reflect.ownKeys(value[engine])){
   const entry=value[engine][service];
   if(entry===null&&typeof service==='string'&&SERVICE_ID.test(service)&&!PROTOTYPE_NAMES.has(service))continue;
   if(typeof service!=='string'||!SERVICE_ID.test(service)||PROTOTYPE_NAMES.has(service)||!isRecord(entry))return false;
   if(!isTranslationServiceOutcome(entry.status)||!Number.isSafeInteger(entry.updatedAt)||entry.updatedAt<0)return false;
   for(const key of Reflect.ownKeys(entry))if(key!=='status'&&key!=='updatedAt')return false;
  }
 }
 return true;
}

export function cloneTranslationServiceHistory(value){
 const clone={};
 if(!isRecord(value))return clone;
 for(const engine of ENGINES){
  const services=value[engine];
  if(!isRecord(services))continue;
  const next={};
  for(const [service,entry] of Object.entries(services)){
   if(!SERVICE_ID.test(service)||PROTOTYPE_NAMES.has(service)||!isRecord(entry)||!isTranslationServiceOutcome(entry.status)||!Number.isSafeInteger(entry.updatedAt)||entry.updatedAt<0)continue;
   next[service]={status:entry.status,updatedAt:entry.updatedAt};
  }
  if(Object.keys(next).length)clone[engine]=next;
 }
 return clone;
}

// Request ordering lives in memory. It prevents an older parallel request from
// replacing a newer result without persisting sequence numbers in preferences.
export function createTranslationServiceHistoryTracker({now=Date.now}={}){
 let history={};
 let sequence=0,lastTimestamp=0;
 const latest=new Map();
 const keyFor=(kernel,service)=>`${kernel}\u0000${service}`;
 const timestamp=()=>{
  const value=Number(now());
  lastTimestamp=Math.max(Number.isSafeInteger(value)&&value>=0?value:Date.now(),lastTimestamp+1);return lastTimestamp;
 };
 return {
  load(value){history=cloneTranslationServiceHistory(value);return cloneTranslationServiceHistory(history);},
  snapshot(){return cloneTranslationServiceHistory(history);},
  begin({kernel,service,epoch,startedAt=timestamp()}={}){
   if(!ENGINE_SET.has(kernel)||typeof service!=='string'||!SERVICE_ID.test(service)||PROTOTYPE_NAMES.has(service))return null;
   const start=Number.isSafeInteger(startedAt)&&startedAt>=0?startedAt:timestamp();
   return {kernel,service,epoch,sequence:++sequence,startedAt:start};
  },
  record(request,outcome,currentEpoch){
   if(!request||!ENGINE_SET.has(request.kernel)||typeof request.service!=='string'||!SERVICE_ID.test(request.service)||PROTOTYPE_NAMES.has(request.service)||!isTranslationServiceOutcome(outcome))return false;
   if(currentEpoch!==undefined&&request.epoch!==currentEpoch)return false;
   const key=keyFor(request.kernel,request.service),previous=latest.get(key);
   if((history[request.kernel]?.[request.service]?.updatedAt??0)>request.startedAt)return false;
   if(previous!==undefined&&request.sequence<=previous)return false;
   latest.set(key,request.sequence);
   history[request.kernel]??={};
   history[request.kernel][request.service]={status:outcome,updatedAt:request.startedAt};
   return true;
  },
  reset(kernel,service){
   if(!ENGINE_SET.has(kernel)||typeof service!=='string'||!SERVICE_ID.test(service)||PROTOTYPE_NAMES.has(service))return false;
   latest.set(keyFor(kernel,service),++sequence);
   const existed=!!history[kernel]?.[service];
   if(history[kernel]){delete history[kernel][service];if(!Object.keys(history[kernel]).length)delete history[kernel];}
   return existed;
  },
  clear(){history={};latest.clear();return {};}
 };
}

// A patch touches only the named services; null invalidates obsolete outcomes.
export function mergeTranslationServiceHistory(current,patch){
 const next=cloneTranslationServiceHistory(current);
 if(!isValidTranslationServiceHistory(patch))return next;
 for(const [kernel,services] of Object.entries(patch))for(const [service,entry] of Object.entries(services)){
  if(entry===null){if(next[kernel]){delete next[kernel][service];if(!Object.keys(next[kernel]).length)delete next[kernel];}continue;}
  if((next[kernel]?.[service]?.updatedAt??0)>entry.updatedAt)continue;
  next[kernel]??={};next[kernel][service]={status:entry.status,updatedAt:entry.updatedAt};
 }
 return next;
}
