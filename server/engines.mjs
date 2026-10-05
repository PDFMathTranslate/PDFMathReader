import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile,mkdtemp,rm,readdir,symlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {homedir,tmpdir} from 'node:os';
import {createHash,randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
import {PDFDocument} from 'pdf-lib';
import {translationAdvancedArgs,decorateAdvancedOptions} from './kernel-options.mjs';
import {createTranslationCache} from './translation-cache.mjs';
import {replaceFile} from '../electron/atomic-file.mjs';
import {createKernelProcesses} from './kernel-processes.mjs';
import {createKernelServiceCatalog,buildKernelServiceConfig} from './kernel-services.mjs';
const exec=promisify(execFile);

import {LANGUAGE_CODES,isTranslationLanguageSupported} from '../src/translation-languages.mjs';
export {LANGUAGE_CODES};

export const definitions={
 pdf_inspector:{label:'PDF Inspector',package:'@firecrawl/pdf-inspector'},
 pdf_math_fast:{label:'PDF Math · Fast',package:'pdf2zh',spec:'pdf2zh @ git+https://github.com/PDFMathTranslate/PDFMathTranslate.git@a799fc0ba3b863982f116e3a47a8534f1f5dc475',updateSpec:'pdf2zh @ git+https://github.com/PDFMathTranslate/PDFMathTranslate.git',gitSpec:'pdf2zh @ git+https://github.com/PDFMathTranslate/PDFMathTranslate.git@main'},
 pdf_math_precise:{label:'PDF Math · Precise',package:'pdf2zh-next',spec:'pdf2zh-next==2.8.2',updateSpec:'pdf2zh-next',gitSpec:'pdf2zh-next @ git+https://github.com/PDFMathTranslate-next/PDFMathTranslate-next.git@main'}
};

export function createLimiter(max=4,{label='limiter',now=()=>Date.now()}={}){
 let active=0,nextTaskId=0;const waiting=[],running=new Map();
 function taskMetadata(meta){
  const safe={};
  for(const key of ['kind','label','kernel','engine','page','language','sourceLanguage','requestId']){
   const value=meta?.[key];
   if(typeof value==='string'||typeof value==='number')safe[key]=value;
  }
  return safe;
 }
 function view(job,state){return {id:job.id,label:job.meta.label||label,kind:job.meta.kind||label,state,kernel:job.meta.kernel||job.meta.engine||null,...job.meta,queuedAt:job.createdAt,startedAt:job.startedAt??null};}
 function snapshot(){
  const tasks=[...running.values()].map(job=>view(job,'running')).concat(waiting.map(job=>view(job,'queued')));
  return {label,limit:max,running:active,queued:waiting.length,tasks:tasks.slice(0,128)};
 }
 return {
  setMax(n){max=Math.max(1,Math.min(12,Number(n)||4));drain();},
  snapshot,
  run(fn,{signal,meta}={}){return new Promise((resolve,reject)=>{
   if(signal?.aborted)return reject(signal.reason||Error('Cancelled'));
   const job={id:`${label}-${++nextTaskId}`,fn,resolve,reject,signal,meta:taskMetadata(meta),createdAt:now(),startedAt:null};
   job.abort=()=>{const index=waiting.indexOf(job);if(index<0)return;waiting.splice(index,1);signal.removeEventListener('abort',job.abort);reject(signal.reason||Error('Cancelled'));};
   signal?.addEventListener('abort',job.abort,{once:true});waiting.push(job);drain();
  });}
 };
 function drain(){while(active<max&&waiting.length){const job=waiting.shift();job.signal?.removeEventListener('abort',job.abort);active++;job.startedAt=now();running.set(job.id,job);Promise.resolve().then(()=>{if(job.signal?.aborted)throw job.signal.reason||Error('Cancelled');return job.fn();}).then(job.resolve,job.reject).finally(()=>{active--;running.delete(job.id);drain();});}}
}

export async function prepareKernelAssets(assetHome,home,sharedCache=join(homedir(),'.cache','babeldoc')){
 const cache=join(home,'.cache','babeldoc');await mkdir(cache,{recursive:true});
 for(const kind of ['fonts','models','tiktoken','cmap']){
  const owned=join(assetHome,'.cache','babeldoc',kind);
  const existing=join(sharedCache,kind);
  const assets=existsSync(owned)?owned:existsSync(existing)?existing:owned;
  await mkdir(assets,{recursive:true});
  await symlink(resolve(assets),join(cache,kind),process.platform==='win32'?'junction':'dir');
 }
}

export function kernelPythonPath(environment,platform=process.platform){
 return platform==='win32'?join(environment,'Scripts','python.exe'):join(environment,'bin','python');
}

export async function findUv({platform=process.platform,home=homedir(),env=process.env,run=exec}={}){
 const candidates=platform==='win32'
  ? ['uv.exe',...(env.UV_INSTALL_DIR?[join(env.UV_INSTALL_DIR,'uv.exe')]:[]),join(home,'.local','bin','uv.exe'),join(home,'.cargo','bin','uv.exe')]
  : ['uv',join(home,'.local/bin/uv'),'/opt/homebrew/bin/uv','/usr/local/bin/uv'];
 for(const path of candidates){
  try{const {stdout}=await run(path,['--version'],{timeout:5000,windowsHide:true});if(/^uv \d/.test(stdout))return {available:true,path,version:stdout.trim()};}catch{}
 }
 return {available:false,version:null,message:'uv was not found. Install uv and reopen the app.'};
}

export function pythonResourcePath(name,resourcesPath=process.resourcesPath){
 const packaged=typeof resourcesPath==='string'?join(resourcesPath,name):null;
 return packaged&&existsSync(packaged)?packaged:fileURLToPath(new URL(`../electron/${name}`,import.meta.url));
}

export function createEngines({root,cacheDir:baseCacheDir,runtimeHomeRoot=root,appVersion='development',pythonResourcesPath,onDiagnostic,onOutput,onTiming,onKernelEvent,findUvImpl=findUv,execImpl=exec}){
 const processes=createKernelProcesses({execImpl,onEvent:onKernelEvent});const runExec=processes.exec;
 let uv;const installing=new Map(),advancedMetadata=new Map(),knownStates=new Map(),advancedBackground=new Map(),advancedFailures=new Map();
 const envPath=id=>join(root,id);const python=id=>kernelPythonPath(envPath(id));
 const metadataPath=id=>join(root,'.advanced-options',id+'.json');
 const serviceCatalog=createKernelServiceCatalog({root,pythonResourcesPath,runExec,python,check,appVersion});

 async function check(id){
  if(!Object.hasOwn(definitions,id))throw Error('Unknown kernel');
  if(id==='pdf_inspector')return {id,label:definitions[id].label,installed:true,available:true,version:require('@firecrawl/pdf-inspector/package.json').version};
  const known=knownStates.get(id);if(known&&performance.now()-known.at<30000&&!installing.has(id))return known.state;
  const installed=existsSync(envPath(id));
  if(!uv)uv=await findUvImpl({run:runExec});
  if(!uv.available)return {id,label:definitions[id].label,installed,available:false,reason:uv.message};
  try{
   const {stdout}=await runExec(python(id),['-c',`import importlib.metadata, importlib.util; assert importlib.util.find_spec('${id==='pdf_math_fast'?'pdf2zh':'pdf2zh_next'}'); print(importlib.metadata.version('${definitions[id].package}'))`],{timeout:15000},{kernel:id,name:'python'});
   const version=stdout.trim();if(!/^\d+\.\d+/.test(version))throw Error();
   const state={id,label:definitions[id].label,installed:true,available:true,version};knownStates.set(id,{state,at:performance.now()});return state;
  }catch{knownStates.delete(id);return {id,label:definitions[id].label,installed,available:false,reason:installing.has(id)?'Installing…':'Kernel environment is not installed or its version cannot be queried.'};}
 }

 async function install(id,{reinstall=false,source='release'}={}){
  if(!Object.hasOwn(definitions,id)||id==='pdf_inspector')throw Error('Unknown kernel');
  if(installing.has(id))return installing.get(id);
  const task=(async()=>{
   knownStates.delete(id);
   const state=await check(id);if(state.available&&reinstall!==true){await advanced(id,state);return state;}
   uv=await findUvImpl({run:runExec});if(!uv.available)throw Error(uv.message);
   await mkdir(root,{recursive:true});
   const env={...process.env,UV_CACHE_DIR:join(root,'uv-cache')};
   knownStates.delete(id);
   try{
    if(!state.available)await runExec(uv.path,['venv','--allow-existing','--python','3.12',envPath(id)],{env,timeout:300000,maxBuffer:1024*1024},{kernel:id,name:'uv'});
    const pipArgs=['pip','install',...(reinstall===true?['--upgrade','--reinstall',...(source==='git'?['--refresh']:[])]:[]),'--python',python(id),reinstall===true?(source==='git'?definitions[id].gitSpec:definitions[id].updateSpec):definitions[id].spec];
    await runExec(uv.path,pipArgs,{env,timeout:600000,maxBuffer:2*1024*1024},{kernel:id,name:'uv'});
   }catch{throw Error('uv could not install this kernel. Check network access and retry.');}
   const installed=await check(id);
   if(installed.available){
    await serviceCatalog.invalidate(id);
    // Installation owns refresh, including reinstalls with the same version.
    await Promise.allSettled([...advancedMetadata].filter(([key])=>key.startsWith(`${id}:`)).map(([,task])=>task));
    for(const key of advancedMetadata.keys())if(key.startsWith(`${id}:`))advancedMetadata.delete(key);
    advancedFailures.delete(id);
    await rm(metadataPath(id),{force:true});
    await advanced(id,installed);
   }
   return installed;
  })();
  installing.set(id,task);try{return await task;}finally{installing.delete(id);}
 }

 async function cachedAdvanced(id,state){
  try{
   const cached=JSON.parse(await readFile(metadataPath(id),'utf8'));
   if(cached.schemaVersion!==1||cached.appVersion!==appVersion||cached.kernelVersion!==state.version||cached.result?.id!==id||!Array.isArray(cached.result.options)||cached.result.reason)return null;
   const options=cached.result.options;
   if(!options.every(option=>option&&typeof option.id==='string'&&typeof option.flag==='string'&&['boolean','number','string'].includes(option.type)))return null;
   return {id,options:decorateAdvancedOptions(id,options)};
  }catch{return null;}
 }

 async function advanced(id,knownState,{cacheOnly=false}={}){
  if(!Object.hasOwn(definitions,id))throw Error('Unknown kernel');
  if(id==='pdf_inspector')return {id,options:[]};
  // GUI requests only read disk; probing runs in this backend utility process.
  const state=knownState||knownStates.get(id)?.state;
  if(cacheOnly){
   const cached=state?.available&&await cachedAdvanced(id,state);
   if(cached)return cached;
   if(state&&!state.available)return {id,options:[],reason:state.reason};
   if(advancedFailures.has(id)){const result=advancedFailures.get(id);advancedFailures.delete(id);return result;}
   if(!advancedBackground.has(id)){
    const task=advanced(id,state).then(result=>{if(result.reason)advancedFailures.set(id,result);}).catch(()=>{advancedFailures.set(id,{id,options:[],reason:'Kernel advanced options could not be queried.'});}).finally(()=>advancedBackground.delete(id));
    advancedBackground.set(id,task);
   }
   return {id,options:[],pending:true};
  }
  const current=state||await check(id);
  if(!current.available)return {id,options:[],reason:current.reason};
  const cacheKey=`${id}:${appVersion}:${current.version}`;
  if(advancedMetadata.has(cacheKey))return advancedMetadata.get(cacheKey);
  const task=(async()=>{
   const cached=await cachedAdvanced(id,current);if(cached)return cached;
   const optionsHomeRoot=runtimeHomeRoot||root;await mkdir(optionsHomeRoot,{recursive:true});
   let home;
   try{
    home=await mkdtemp(join(optionsHomeRoot,'kernel-options-'));
    const isolatedTmp=join(home,'tmp');
    const env={...process.env,HOME:home,TMPDIR:isolatedTmp,TMP:isolatedTmp,TEMP:isolatedTmp,XDG_CONFIG_HOME:join(home,'.config'),XDG_CACHE_HOME:join(home,'.cache'),PYTHONPYCACHEPREFIX:join(optionsHomeRoot,'kernel-options-pycache')};
    await mkdir(isolatedTmp,{recursive:true});
    const {stdout}=await runExec(python(id),[pythonResourcePath('kernel-options.py',pythonResourcesPath),id],{env,cwd:home,timeout:120000,maxBuffer:4*1024*1024},{kernel:id,name:'python'});
    const raw=JSON.parse(stdout.trim());if(!Array.isArray(raw))throw Error('Invalid advanced schema');
    const result={id,options:decorateAdvancedOptions(id,raw)};
    const directory=join(root,'.advanced-options'),target=metadataPath(id),temporary=target+'.'+randomBytes(8).toString('hex')+'.tmp';
    await mkdir(directory,{recursive:true});
    try{await writeFile(temporary,JSON.stringify({schemaVersion:1,appVersion,kernelVersion:current.version,result}));await replaceFile(temporary,target);}
    finally{await rm(temporary,{force:true});}
    return result;
   }catch{return {id,options:[],reason:'Kernel advanced options could not be queried.'};}
   finally{if(home)await rm(home,{recursive:true,force:true});}
  })();
  advancedMetadata.set(cacheKey,task);
  try{return await task;}
  catch{return {id,options:[],reason:'Kernel advanced options could not be queried.'};}
  finally{if(advancedMetadata.get(cacheKey)===task)advancedMetadata.delete(cacheKey);}
 }

 async function translate({id,bytes,documentHash,page,language,sourceLanguage,threads,model,proxy,signal,translationService,serviceIdentity,localTranslation=false,advancedOptions={},reuseTranslations=true,cacheScope='',onPageTiming,cacheOnly=false,runWorker=fn=>fn()}){
  const emitTiming=report=>{onTiming?.(report);onPageTiming?.(report);};
  const started=performance.now(),stages={};let checkpoint=started;
  const step=name=>{const now=performance.now();stages[name]=now-checkpoint;checkpoint=now;};
  if(signal?.aborted)throw Error('Cancelled');
  if(sourceLanguage!==undefined&&!isTranslationLanguageSupported(id,sourceLanguage,'source'))throw Error('Unsupported source language');
  const lang=LANGUAGE_CODES[language];if(!isTranslationLanguageSupported(id,language))throw Error('Unsupported language for this kernel');
  const known=knownStates.get(id);
  const state=known&&performance.now()-known.at<30000&&!installing.has(id)?known.state:await check(id);if(!state.available)throw Error(state.reason);
  const {overrides,args:advancedArgs}=await translationAdvancedArgs(id,advancedOptions,()=>advanced(id,state));
  const service=translationService?buildKernelServiceConfig(id,translationService,await serviceCatalog.get(id)):null;
  if(service)model=service.model;
  step('environmentAndOptions');
  const sourceHash=documentHash&&typeof documentHash.copy==='function'?documentHash.copy():createHash('sha256').update(bytes);
  const [scopeHash,scopeGeneration]=cacheScope.split(':');const cacheDir=cacheScope?join(baseCacheDir,'..','documents',scopeHash,'math',scopeGeneration):baseCacheDir;
  const layoutKey=key=>cacheScope?`${scopeHash}-${scopeGeneration}-${key}`:key;
  const currentLayoutSchema=id==='pdf_math_fast'?(['zh','ja','ko'].includes(lang.toLowerCase().split('-')[0])?5:4):3;
  const keyFor=(cacheModel,layoutSchema=currentLayoutSchema)=>sourceHash.copy().update(JSON.stringify({id,version:state.version,page,language,...sourceLanguage&&sourceLanguage!=='English'?{sourceLanguage}:{},model:cacheModel,...(service||serviceIdentity)?{service:service?.cacheIdentity||serviceIdentity}:{},prompt:2,...cacheScope?{cacheScope}:{},layoutSchema,...Object.keys(overrides).length?{advancedOptions:overrides}:{}})).digest('hex');
  const key=keyFor(model);
  const cache=createTranslationCache({directory:cacheDir,keyFor,fallbackKeyFors:currentLayoutSchema===5?[]:[cacheModel=>keyFor(cacheModel,currentLayoutSchema-1)],readResult:async cachedKey=>{const result=await readFile(join(cacheDir,`${cachedKey}.pdf`));const metadata=JSON.parse(await readFile(join(cacheDir,cachedKey+'.layout.json'),'utf8'));if(!Array.isArray(metadata.paragraphs))throw Error('Invalid cached layout');return result;}});
  const cached=join(cacheDir,`${key}.pdf`);
  const hit=await cache.lookup(model,{reuseTranslations});
  if(hit){const result=hit.result;result.layoutKey=layoutKey(hit.key);result.cached=true;result.translationModel=hit.model;step('cacheLookup');emitTiming({engine:id,cached:true,model:hit.model,totalMs:performance.now()-started,stages});return result;}
  step('cacheLookup');
  if(cacheOnly)return null;
  return runWorker(async()=>{
  if(signal?.aborted)throw Error('Cancelled');
  // Exclude scheduling delay from input preparation; the API reports queueMs.
  checkpoint=performance.now();
  // Another queued request for the same page may have filled the cache.
  const queuedHit=await cache.lookup(model,{reuseTranslations});step('cacheRecheck');
  if(queuedHit){const result=queuedHit.result;result.layoutKey=layoutKey(queuedHit.key);result.cached=true;result.translationModel=queuedHit.model;emitTiming({engine:id,cached:true,model:queuedHit.model,totalMs:performance.now()-started,stages});return result;}
  await mkdir(root,{recursive:true});
  const dir=await mkdtemp(join(root,'job-'));
  try{
  const input=join(dir,'input.pdf');await writeFile(input,bytes);
  const assetHome=join(runtimeHomeRoot,id,'home');const home=join(dir,'home');await prepareKernelAssets(assetHome,home);
  const env={...process.env,HOME:home,OPENAI_API_KEY:proxy.token,OPENAI_BASE_URL:proxy.url,OPENAI_MODEL:model,PDF2ZH_OPENAI_API_KEY:proxy.token,PDF2ZH_OPENAI_BASE_URL:proxy.url,PDF2ZH_OPENAI_MODEL:model};delete env.OPENAI_API_KEY_REAL;
  if(service)Object.assign(env,service.env);
  if(localTranslation)env.PDFMATHREADER_LOCAL_TRANSLATION='1';
   const args=id==='pdf_math_fast'?['-m','pdf2zh.pdf2zh',input,'--mode','fast','-p',String(page),'-lo',lang,'-s',`openai:${model}`,'-t',String(threads),'-o',dir,...(Object.keys(overrides).length?advancedArgs:['--backend','cpu','--ignore-cache'])]:['-m','pdf2zh_next',input,'--openai','--pages',String(page),'--lang-out',lang,'--qps',String(threads),'--pool-max-workers',String(threads),'--output',dir,'--no-dual','--ignore-cache','--disable-config-auto-save','--watermark-output-mode','no_watermark',...advancedArgs];
   if(sourceLanguage)args.push('--lang-in',LANGUAGE_CODES[sourceLanguage]);
   if(localTranslation&&id==='pdf_math_precise'&&!args.includes('--no-auto-extract-glossary'))args.push('--no-auto-extract-glossary');
   if(service){if(id==='pdf_math_fast'){const index=args.indexOf('-s');args.splice(index,2,...service.args);}else args.splice(args.indexOf('--openai'),1,...service.args);}
   step('prepareInput');
   await new Promise((resolve,reject)=>{
    if(signal?.aborted)return reject(Error('Cancelled'));
    const child=processes.spawn(python(id),[pythonResourcePath('kernel-worker.py',pythonResourcesPath),id,join(dir,'layout.json'),String(page),input,...args.slice(2)],{env,cwd:dir,stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'},{kernel:id,name:'kernel-worker',secrets:[proxy?.token,...(service?.secrets||[])]});
    child.stderr.on('data',chunk=>{let message=String(chunk);for(const secret of [proxy.token,...(service?.secrets||[])])if(secret)message=message.replaceAll(secret,'[redacted]');onDiagnostic?.(message);});
    const kill=()=>{void processes.terminate(child).catch(error=>onDiagnostic?.(error.message));};const timer=setTimeout(kill,15*60*1000);signal?.addEventListener('abort',kill,{once:true});
    child.on('error',()=>reject(Error('Kernel could not start')));child.on('close',code=>{clearTimeout(timer);signal?.removeEventListener('abort',kill);code===0?resolve():reject(Error(signal?.aborted?'Cancelled':'Kernel translation failed. Check its runtime assets and provider configuration.'));});
   });
   step('kernelProcess');
   let worker;try{worker=JSON.parse(await readFile(join(dir,'layout.json.timing.json'),'utf8'));}catch{}
   const names=await readdir(dir);const output=names.find(n=>/mono.*\.pdf$/i.test(n)||/\.mono\.pdf$/i.test(n));if(!output)throw Error('Kernel did not produce a translated PDF');
   const raw=await readFile(join(dir,output));await onOutput?.(raw,id);const document=await PDFDocument.load(raw);const index=document.getPageCount()===1?0:page-1;if(index>=document.getPageCount())throw Error('Kernel returned an unexpected page count');
   const one=await PDFDocument.create();const [selected]=await one.copyPages(document,[index]);one.addPage(selected);const result=Buffer.from(await one.save());const metadata=JSON.parse(await readFile(join(dir,'layout.json'),'utf8'));if(!Array.isArray(metadata.paragraphs))throw Error('Kernel returned invalid layout');
   await mkdir(cacheDir,{recursive:true});const temporary=cached+'.'+crypto.randomUUID()+'.tmp';await writeFile(temporary,result);await (await import('node:fs/promises')).rename(temporary,cached);const metaPath=join(cacheDir,key+'.layout.json'),metaTemp=metaPath+'.'+crypto.randomUUID()+'.tmp';await writeFile(metaTemp,JSON.stringify(metadata));await (await import('node:fs/promises')).rename(metaTemp,metaPath);await cache.remember(model,key).catch(()=>{});result.layoutKey=layoutKey(key);result.cached=false;result.translationModel=model;step('outputAndCache');emitTiming({engine:id,cached:false,totalMs:performance.now()-started,stages,worker});return result;
  }finally{await rm(dir,{recursive:true,force:true});}
  });
 }

 function tasks(){
  return [
   ...[...installing.keys()].map(kernel=>({id:`install-${kernel}`,label:'Kernel installation',kind:'kernel-install',kernel,state:'running'})),
   ...[...advancedMetadata.keys()].map(key=>({id:`advanced-${key}`,label:'Advanced options',kind:'kernel-advanced-options',kernel:key.split(':')[0],state:'running'})),
   ...[...advancedBackground.keys()].map(kernel=>({id:`advanced-background-${kernel}`,label:'Advanced options',kind:'kernel-advanced-options',kernel,state:'running'}))
  ];
 }
 return {layout:async key=>{const scoped=key.match(/^([a-f0-9]{64})-([a-f0-9-]{36})-([a-f0-9]{64})$/);if(scoped)return JSON.parse(await readFile(join(baseCacheDir,'..','documents',scoped[1],'math',scoped[2],scoped[3]+'.layout.json'),'utf8'));if(!/^[a-f0-9]{64}$/.test(key))throw Error('Invalid layout key');return JSON.parse(await readFile(join(baseCacheDir,key+'.layout.json'),'utf8'));},startup:async()=>({uv:uv=await findUvImpl({run:runExec}),engines:await Promise.all(Object.keys(definitions).map(check))}),check,install,advanced,services:serviceCatalog.get,translate,tasks,observeProcess:(child,file,metadata={})=>processes.observe(child,file,metadata),processes:processes.snapshot,close:processes.close};
}
