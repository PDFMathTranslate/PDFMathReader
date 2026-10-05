import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {existsSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {replaceFile} from '../electron/atomic-file.mjs';

const KERNELS=new Set(['pdf_math_fast','pdf_math_precise']);
const ID=/^[a-z0-9][a-z0-9_-]{0,100}$/i;
const FIELD=/^[a-z][a-z0-9_]{0,150}$/i;
const unsafe=new Set(['__proto__','constructor','prototype']);
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const clone=value=>JSON.parse(JSON.stringify(value));

function validCatalog(value,id){
 return value?.id===id&&typeof value.version==='string'&&Array.isArray(value.services)&&value.services.every(service=>ID.test(service.id)&&!unsafe.has(service.id)&&Array.isArray(service.fields)&&service.fields.every(field=>FIELD.test(field.id)&&!unsafe.has(field.id)&&typeof field.env==='string'&&FIELD.test(field.env)&&['string','number','boolean'].includes(field.type)));
}

export function createKernelServiceCatalog({root,pythonResourcesPath,runExec,python,check,appVersion='development'}){
 const memory=new Map(),pending=new Map();
 const path=id=>join(root,'.translation-services',id+'.json');
 async function load(id){
  const state=await check(id);
  if(!state.available)return {id,version:state.version||'',services:[],reason:state.reason||'Kernel is not installed.'};
  const version=state.version;
  const known=memory.get(id);if(known?.version===version)return clone(known.result);
  try{
   const saved=JSON.parse(await readFile(path(id),'utf8'));
   if(saved.schemaVersion===2&&saved.appVersion===appVersion&&saved.version===version&&validCatalog(saved.result,id)){
    memory.set(id,{version,result:saved.result});return clone(saved.result);
   }
  }catch{}
  await mkdir(root,{recursive:true});const home=await mkdtemp(join(root,'kernel-services-'));
  try{
   const temporary=join(home,'tmp');await mkdir(temporary,{recursive:true});
   const packaged=typeof pythonResourcesPath==='string'?join(pythonResourcesPath,'kernel-services.py'):null;
   const script=packaged&&existsSync(packaged)?packaged:fileURLToPath(new URL('../electron/kernel-services.py',import.meta.url));
   const env={...process.env,HOME:home,TMPDIR:temporary,TMP:temporary,TEMP:temporary,XDG_CONFIG_HOME:join(home,'.config'),XDG_CACHE_HOME:join(home,'.cache'),PYTHONPYCACHEPREFIX:join(root,'kernel-services-pycache')};
   const {stdout}=await runExec(python(id),[script,id],{env,cwd:home,timeout:120000,maxBuffer:4*1024*1024});
   const result=JSON.parse(stdout.trim());if(!validCatalog(result,id))throw Error('Invalid upstream translation service metadata');
   // A provider's shipped placeholder key is not a user configuration default.
   for(const service of result.services)for(const field of service.fields)if(field.secret)field.default=null;
   result.version=version;memory.set(id,{version,result});
   const target=path(id),stage=target+'.'+randomUUID()+'.tmp';
   try{await mkdir(join(root,'.translation-services'),{recursive:true});await writeFile(stage,JSON.stringify({schemaVersion:2,appVersion,version,result}));await replaceFile(stage,target);}catch{}finally{await rm(stage,{force:true}).catch(()=>{});}
   return clone(result);
  }finally{await rm(home,{recursive:true,force:true});}
 }
 function get(id){
  if(!KERNELS.has(id))return Promise.reject(Error('Unknown kernel'));
  if(pending.has(id))return pending.get(id).then(clone);
  const task=load(id).finally(()=>{if(pending.get(id)===task)pending.delete(id);});pending.set(id,task);return task.then(clone);
 }
 async function invalidate(id){
  if(!KERNELS.has(id))throw Error('Unknown kernel');
  await pending.get(id)?.catch(()=>{});memory.delete(id);await rm(path(id),{force:true});
 }
 return {get,invalidate};
}

export function buildKernelServiceConfig(kernel,selection,catalog){
 if(!KERNELS.has(kernel)||!record(selection)||typeof selection.id!=='string'||!record(selection.values??{}))throw Error('Invalid translation service configuration');
 if(catalog?.reason)throw Error(catalog.reason);
 const service=catalog?.services?.find(service=>service.id===selection.id);if(!service)throw Error('Unsupported translation service for this kernel');
 const raw=selection.values||{},env={},identity={},secrets=[];
 for(const name of Object.keys(raw))if(!service.fields.some(field=>field.id===name))throw Error(`Unknown translation service field: ${name}`);
 for(const field of service.fields){
  let value=Object.hasOwn(raw,field.id)?raw[field.id]:field.default;
  if(field.required&&typeof value==='string'&&!value.trim())throw Error(`${field.label||field.id} is required`);
  if(value===null||value===undefined||value===''){
   if(field.required)throw Error(`${field.label||field.id} is required`);
   continue;
  }
  if(field.type==='boolean'){if(typeof value!=='boolean')throw Error(`${field.id} must be a boolean`);}
  else if(field.type==='number'){
   if(typeof value!=='number'||!Number.isFinite(value)||field.integer&&!Number.isInteger(value)||field.min!==undefined&&value<field.min||field.max!==undefined&&value>field.max||field.exclusiveMin!==undefined&&value<=field.exclusiveMin||field.exclusiveMax!==undefined&&value>=field.exclusiveMax)throw Error(`Invalid numeric value for ${field.id}`);
  }else if(typeof value!=='string'||value.length>16384||/[\r\n\0]/.test(value))throw Error(`Invalid value for ${field.id}`);
  if(field.choices&&!field.choices.includes(value))throw Error(`Invalid choice for ${field.id}`);
  if(/(?:base_url|endpoint|host)$/i.test(field.id)&&typeof value==='string'){
   let url;try{url=new URL(value);}catch{throw Error(`Invalid URL for ${field.id}`);}
   if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error(`Invalid URL for ${field.id}`);
  }
  env[field.env]=String(value);
  if(field.secret)secrets.push(String(value));else identity[field.id]=value;
 }
 const model=service.fields.find(field=>/(?:^|_)model$/i.test(field.id));
 const selectedModel=model?env[model.env]:undefined;
 return {args:kernel==='pdf_math_fast'?['-s',service.id+(selectedModel?':'+selectedModel:'')]:['--'+service.id.replaceAll('_','-')],env,cacheIdentity:{service:service.id,values:identity},secrets,model:selectedModel||service.id};
}
