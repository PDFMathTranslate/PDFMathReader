const DEFAULT_EVENT_LIMIT=200;
const MAX_EVENT_LIMIT=5_000;
const MAX_MESSAGE_LENGTH=4_096;
const COLLECTOR_EVENT_ID_BASE=1_000_000_000;

export const RECENT_DEBUG_LOG_ENGINES=Object.freeze(['pdf_inspector','pdf_math_fast','pdf_math_precise']);
const ENGINE_SET=new Set(RECENT_DEBUG_LOG_ENGINES);

export function isRecentDebugLogEngine(value){return typeof value==='string'&&ENGINE_SET.has(value);}

function eventPid(value){return Number.isInteger(value)&&value>0?value:null;}

function eventTime(now){
 try{return new Date(now()).toISOString();}
 catch{return new Date().toISOString();}
}

function boundedLimit(value,defaultValue=DEFAULT_EVENT_LIMIT){
 const number=Number(value);
 return Number.isFinite(number)?Math.max(1,Math.min(MAX_EVENT_LIMIT,Math.floor(number))):defaultValue;
}

function eventKey(event){return [event.time,event.kind,event.kernel,event.pid,event.message].map(value=>String(value??'')).join('\u001f');}

function eventTimeValue(value){
 const time=Date.parse(value);
 return Number.isFinite(time)?time:null;
}

export function mergeRecentDebugLogEvents(sources,{limit=DEFAULT_EVENT_LIMIT}={}){
 const seen=new Set(),events=[];
 for(const source of sources||[]){
  for(const event of source||[]){
   if(!event||typeof event!=='object')continue;
   const key=eventKey(event);
   if(seen.has(key))continue;
   seen.add(key);events.push({...event,__order:events.length});
  }
 }
 events.sort((left,right)=>{
  const leftTime=eventTimeValue(left.time),rightTime=eventTimeValue(right.time);
  if(leftTime!==null&&rightTime!==null&&leftTime!==rightTime)return leftTime-rightTime;
  if(leftTime!==null&&rightTime===null)return -1;
  if(leftTime===null&&rightTime!==null)return 1;
  return left.__order-right.__order;
 });
 return events.slice(-boundedLimit(limit)).map(({__order,...event})=>event);
}

export function createRecentDebugLogs({maxEvents=DEFAULT_EVENT_LIMIT,now=()=>Date.now(),redact=value=>String(value??'')}={}){
 const eventLimit=boundedLimit(maxEvents);
 const events=[];
 const activeRequests=new Map();
 let nextEventId=COLLECTOR_EVENT_ID_BASE;

 function begin(kernel){
  if(!isRecentDebugLogEngine(kernel))return null;
  activeRequests.set(kernel,(activeRequests.get(kernel)||0)+1);
  let ended=false;
  return {
   kernel,
   end(){
    if(ended)return;
    ended=true;
    const count=activeRequests.get(kernel)||0;
    if(count<=1)activeRequests.delete(kernel);else activeRequests.set(kernel,count-1);
   }
  };
 }

 function record(event,{diagnosticEvent}={}){
  const kernel=event?.kernel;
  if(!isRecentDebugLogEngine(kernel)||(activeRequests.get(kernel)||0)<1)return null;
  const source=diagnosticEvent&&typeof diagnosticEvent==='object'?diagnosticEvent:event||{};
  let message;
  try{message=String(redact(source.message,{maxLength:MAX_MESSAGE_LENGTH}));}
  catch{message='[redacted]';}
  const normalized={
   id:Number.isSafeInteger(source.id)&&source.id>0?source.id:nextEventId++,
   time:typeof source.time==='string'&&source.time?source.time:eventTime(now),
   kind:String(source.kind??event.kind??'diagnostic').slice(0,128),
   kernel,
   pid:eventPid(source.pid??event.pid),
   message:message.slice(0,MAX_MESSAGE_LENGTH)
  };
  // Keep locally generated ids separate from ids copied from developer diagnostics.
  if(normalized.id>=nextEventId)nextEventId=normalized.id+1;
  events.push(normalized);
  if(events.length>eventLimit)events.splice(0,events.length-eventLimit);
  return {...normalized};
 }

 function snapshot(kernel){
  if(!isRecentDebugLogEngine(kernel))return [];
  return events.filter(event=>event.kernel===kernel).map(event=>({...event}));
 }

 return {
  begin,
  record,
  snapshot,
  activeCount:kernel=>isRecentDebugLogEngine(kernel)?activeRequests.get(kernel)||0:0,
  size:()=>events.length,
  limit:eventLimit
 };
}
