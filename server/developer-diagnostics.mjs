const DEFAULT_MAX_EVENTS=500;
const DEFAULT_MAX_MESSAGE=4096;
const DEFAULT_MAX_TASKS=128;

const CREDENTIAL_FIELD=/^(?:key|api[_-]?key|access[_-]?token|token|auth(?:orization)?|bearer|cookie|credential|password|passwd|secret|private[_-]?key|proxy[_-]?token)$/i;
const PAYLOAD_FIELD=/^(?:text|source[_-]?text|target[_-]?text|prompt|content|contents|message|messages|payload|body|input|output|translation)$/i;
const SENSITIVE_FIELD=/(?:\bkey\b|api[_-]?key|access[_-]?token|\btoken\b|auth(?:orization)?|bearer|cookie|credential|password|passwd|secret|private[_-]?key|proxy[_-]?token)/i;

function valuesFromSecrets(secrets){
 try{
  const value=typeof secrets==='function'?secrets():secrets;
  return (Array.isArray(value)?value:[value]).filter(item=>typeof item==='string'&&item.length>0).sort((a,b)=>b.length-a.length);
 }catch{return [];} 
}

function limitText(value,maxLength=DEFAULT_MAX_MESSAGE){
 const text=String(value??'');
 if(text.length<=maxLength)return text;
 return `${text.slice(0,Math.max(0,maxLength-32))}… [truncated ${text.length-maxLength+32} chars]`;
}

function redactFields(text){
 // This covers JSON-ish logs, CLI assignments, URLs, and Python reprs without
 // requiring the diagnostic path to parse arbitrary stdout/stderr.
 return text.replace(/((?:["'`])?(?:key|api[_-]?key|access[_-]?token|token|authorization|bearer|cookie|credential|password|passwd|secret|private[_-]?key|proxy[_-]?token|text|source[_-]?text|target[_-]?text|prompt|content|contents|message|messages|payload|body|input|output|translation)(?:["'`])?\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\[redacted\]|([^\s,}\]]+))/gi,'$1[redacted]');
}

export function redactDiagnosticText(value,{secrets=[],maxLength=DEFAULT_MAX_MESSAGE}={}){
 let text=String(value??'');
 for(const secret of valuesFromSecrets(secrets))text=text.replaceAll(secret,'[redacted]');
 text=text.replace(/\bBearer\s+[^\s,}]+/gi,'Bearer [redacted]');
 text=redactFields(text);
 return limitText(text,maxLength);
}

export function redactArgv(file,args=[],{secrets=[],maxLength=DEFAULT_MAX_MESSAGE}={}){
 const values=[file,...(Array.isArray(args)?args:[])].map(value=>String(value??''));
 let redactNext=false;
 return values.map(value=>{
  if(redactNext){redactNext=false;return '[redacted]';}
  const assignment=value.match(/^((?:--?|\/)?(?:key|api[_-]?key|access[_-]?token|token|authorization|bearer|cookie|credential|password|passwd|secret|private[_-]?key|proxy[_-]?token)(?:=|:))(.+)$/i);
  if(assignment)return `${assignment[1]}[redacted]`;
  const flag=value.replace(/=.*$/,'');
  if((SENSITIVE_FIELD.test(flag)||/^--key$/i.test(flag))&&/^--?/.test(flag))redactNext=true;
  return redactDiagnosticText(value,{secrets,maxLength});
 });
}

export function summarizeStdinCommand(value,{secrets=[]}={}){
 const text=Buffer.isBuffer(value)?value.toString('utf8'):String(value??'');
 const bytes=Buffer.byteLength(text);
 let parsed;
 try{parsed=JSON.parse(text);}catch{}
 if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed)){
  const keys=Object.keys(parsed).slice(0,32);
  const payloadKeys=keys.filter(key=>PAYLOAD_FIELD.test(key)||CREDENTIAL_FIELD.test(key));
  const safeKeys=keys.filter(key=>!SENSITIVE_FIELD.test(key)&&!PAYLOAD_FIELD.test(key)).join(',')||'none';
  return `stdin command json keys=${safeKeys} redactedFields=${payloadKeys.length} bytes=${bytes}`;
 }
 const lines=text.split(/\r?\n/).filter(Boolean).length;
 return `stdin command payload redacted bytes=${bytes} lines=${lines}`;
}

function safePid(value){
 const pid=Number(value);
 return Number.isInteger(pid)&&pid>0?pid:null;
}

function safeTask(task,secrets,maxMessage){
 if(!task||typeof task!=='object')return null;
 const result={};
 for(const [key,value] of Object.entries(task).slice(0,32)){
  if(SENSITIVE_FIELD.test(key)||PAYLOAD_FIELD.test(key))continue;
  if(value===undefined||typeof value==='function')continue;
  if(typeof value==='number'&&Number.isFinite(value))result[key]=value;
  else if(typeof value==='boolean'||value===null)result[key]=value;
  else if(typeof value==='string')result[key]=redactDiagnosticText(value,{secrets,maxLength:maxMessage});
 }
 return result;
}

function safeProcess(processInfo,secrets,maxMessage){
 if(!processInfo||typeof processInfo!=='object')return null;
 const result={};
 for(const [key,value] of Object.entries(processInfo).slice(0,32)){
  if(SENSITIVE_FIELD.test(key)||PAYLOAD_FIELD.test(key))continue;
  if(value===undefined||typeof value==='function')continue;
  if(typeof value==='number'&&Number.isFinite(value))result[key]=value;
  else if(typeof value==='boolean'||value===null)result[key]=value;
  else if(typeof value==='string')result[key]=redactDiagnosticText(value,{secrets,maxLength:maxMessage});
 }
 return result;
}

function safeStatus(status,secrets,maxMessage){
 const result={};
 for(const [key,value] of Object.entries(status||{}).slice(0,32)){
  if(value===undefined||typeof value==='function')continue;
  if(typeof value==='string')result[key]=redactDiagnosticText(value,{secrets,maxLength:maxMessage});
  else if(typeof value==='number'&&Number.isFinite(value))result[key]=value;
  else if(typeof value==='boolean'||value===null)result[key]=value;
 }
 return result;
}

export function createDeveloperDiagnostics({maxEvents=DEFAULT_MAX_EVENTS,maxMessageLength=DEFAULT_MAX_MESSAGE,maxTasks=DEFAULT_MAX_TASKS,now=()=>Date.now(),secrets=[]}={}){
 const eventLimit=Math.max(1,Math.min(5000,Number(maxEvents)||DEFAULT_MAX_EVENTS));
 const taskLimit=Math.max(1,Math.min(1000,Number(maxTasks)||DEFAULT_MAX_TASKS));
 const messageLimit=Math.max(128,Math.min(64*1024,Number(maxMessageLength)||DEFAULT_MAX_MESSAGE));
 let enabled=false;
 let nextEventId=1;
 let events=[];

 function currentSecrets(){return valuesFromSecrets(secrets);}
 function clear(){events=[];}
 function setEnabled(value){
  enabled=value===true;
  if(!enabled)clear();
  return enabled;
 }
 function record({kind='diagnostic',kernel=null,pid=null,message=''}={}){
  if(!enabled)return null;
  const event={
   id:nextEventId++,
   time:new Date(now()).toISOString(),
   kind:String(kind),
   kernel:kernel==null?null:String(kernel),
   pid:safePid(pid),
   message:redactDiagnosticText(message,{secrets:currentSecrets(),maxLength:messageLimit})
  };
  events.push(event);
  if(events.length>eventLimit)events.splice(0,events.length-eventLimit);
  return event;
 }
 function snapshot({tasks=[],queues=[],processes=[],processesStatus={available:true}}={}){
  const currentSecretsValue=currentSecrets();
  const status=processesStatus&&typeof processesStatus==='object'?safeStatus(processesStatus,currentSecretsValue,messageLimit):{available:true};
  if(!enabled)return {schemaVersion:1,enabled:false,events:[],tasks:[],queues:[],processes:[],processesStatus:status};
  return {
   schemaVersion:1,
   enabled:true,
   events:events.map(event=>({...event,message:redactDiagnosticText(event.message,{secrets:currentSecretsValue,maxLength:messageLimit})})),
   tasks:Array.from(tasks||[]).slice(0,taskLimit).map(task=>safeTask(task,currentSecretsValue,messageLimit)).filter(Boolean),
   queues:Array.from(queues||[]).slice(0,64).map(queue=>safeTask(queue,currentSecretsValue,messageLimit)).filter(Boolean),
   processes:Array.from(processes||[]).slice(0,taskLimit).map(processInfo=>safeProcess(processInfo,currentSecretsValue,messageLimit)).filter(Boolean),
   processesStatus:status
  };
 }
 return {
  isEnabled:()=>enabled,
  setEnabled,
  clear,
  record,
  snapshot,
  redact:(value,options={})=>redactDiagnosticText(value,{...options,secrets:[...currentSecrets(),...(options.secrets||[])]}),
  limits:{events:eventLimit,messageLength:messageLimit,tasks:taskLimit}
 };
}
