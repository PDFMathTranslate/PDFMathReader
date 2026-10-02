import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile,mkdtemp,rm,readdir,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {homedir,tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
import {PDFDocument} from 'pdf-lib';
import {translationAdvancedArgs,decorateAdvancedOptions} from './kernel-options.mjs';
const exec=promisify(execFile);

export const LANGUAGE_CODES=Object.freeze({'Simplified Chinese':'zh','Traditional Chinese':'zh-TW',English:'en',Japanese:'ja',Korean:'ko',French:'fr',German:'de',Spanish:'es'});

export const definitions={
 pdf_inspector:{label:'PDF Inspector',package:'@firecrawl/pdf-inspector'},
 pdf_math_fast:{label:'PDF Math · Fast',package:'pdf2zh',spec:'pdf2zh @ git+https://github.com/PDFMathTranslate/PDFMathTranslate.git@a799fc0ba3b863982f116e3a47a8534f1f5dc475'},
 pdf_math_precise:{label:'PDF Math · Precise',package:'pdf2zh-next',spec:'pdf2zh-next==2.8.2'}
};

export function createLimiter(max=4){
 let active=0;const waiting=[];
 return {setMax(n){max=Math.max(1,Math.min(12,Number(n)||4));drain();},run(fn){return new Promise((resolve,reject)=>{waiting.push({fn,resolve,reject});drain();});}};
 function drain(){while(active<max&&waiting.length){const job=waiting.shift();active++;Promise.resolve().then(job.fn).then(job.resolve,job.reject).finally(()=>{active--;drain();});}}
}

export async function prepareKernelAssets(assetHome,home,sharedCache=join(homedir(),'.cache','babeldoc')){
 const cache=join(home,'.cache','babeldoc');await mkdir(cache,{recursive:true});
 for(const kind of ['fonts','models','tiktoken','cmap']){
  const owned=join(assetHome,'.cache','babeldoc',kind);
  const existing=join(sharedCache,kind);
  const assets=existsSync(owned)?owned:existsSync(existing)?existing:owned;
  await mkdir(assets,{recursive:true});
  await symlink(assets,join(cache,kind),'dir');
 }
}

export async function findUv(){
 for(const path of ['uv',join(homedir(),'.local/bin/uv'),'/opt/homebrew/bin/uv','/usr/local/bin/uv']){
  try{const {stdout}=await exec(path,['--version'],{timeout:5000});if(/^uv \d/.test(stdout))return {available:true,path,version:stdout.trim()};}catch{}
 }
 return {available:false,version:null,message:'uv was not found. Install uv and reopen the app.'};
}

export function pythonResourcePath(name,resourcesPath=process.resourcesPath){
 const packaged=typeof resourcesPath==='string'?join(resourcesPath,name):null;
 return packaged&&existsSync(packaged)?packaged:fileURLToPath(new URL(`../electron/${name}`,import.meta.url));
}

export function createEngines({root,cacheDir,runtimeHomeRoot=root,pythonResourcesPath,onDiagnostic,onOutput}){
 let uv;const installing=new Map(),children=new Set(),advancedMetadata=new Map();
 const envPath=id=>join(root,id);const python=id=>join(envPath(id),'bin/python');

 async function check(id){
  if(!Object.hasOwn(definitions,id))throw Error('Unknown kernel');
  if(id==='pdf_inspector')return {id,label:definitions[id].label,installed:true,available:true,version:require('@firecrawl/pdf-inspector/package.json').version};
  const installed=existsSync(envPath(id));
  if(!uv)uv=await findUv();
  if(!uv.available)return {id,label:definitions[id].label,installed,available:false,reason:uv.message};
  try{
   const {stdout}=await exec(python(id),['-c',`import importlib.metadata, importlib.util; assert importlib.util.find_spec('${id==='pdf_math_fast'?'pdf2zh':'pdf2zh_next'}'); print(importlib.metadata.version('${definitions[id].package}'))`],{timeout:15000});
   const version=stdout.trim();if(!/^\d+\.\d+/.test(version))throw Error();
   return {id,label:definitions[id].label,installed:true,available:true,version};
  }catch{return {id,label:definitions[id].label,installed,available:false,reason:installing.has(id)?'Installing…':'Kernel environment is not installed or its version cannot be queried.'};}
 }

 async function install(id){
  if(!Object.hasOwn(definitions,id)||id==='pdf_inspector')throw Error('Unknown kernel');
  if(installing.has(id))return installing.get(id);
  const task=(async()=>{
   const state=await check(id);if(state.available)return state;
   uv=await findUv();if(!uv.available)throw Error(uv.message);
   await mkdir(root,{recursive:true});
   const env={...process.env,UV_CACHE_DIR:join(root,'uv-cache')};
   try{
    await exec(uv.path,['venv','--allow-existing','--python','3.12',envPath(id)],{env,timeout:300000,maxBuffer:1024*1024});
    await exec(uv.path,['pip','install','--python',python(id),definitions[id].spec],{env,timeout:600000,maxBuffer:2*1024*1024});
   }catch{throw Error('uv could not install this kernel. Check network access and retry.');}
   return check(id);
  })();
  installing.set(id,task);try{return await task;}finally{installing.delete(id);}
 }

 async function advanced(id,knownState){
  if(!Object.hasOwn(definitions,id))throw Error('Unknown kernel');
  if(id==='pdf_inspector')return {id,options:[]};
  const state=knownState||await check(id);
  if(!state.available)return {id,options:[],reason:state.reason};
  const cacheKey=`${id}:${state.version}`;
  if(advancedMetadata.has(cacheKey))return advancedMetadata.get(cacheKey);
  const task=(async()=>{
   const optionsHomeRoot=runtimeHomeRoot||root;await mkdir(optionsHomeRoot,{recursive:true});
   let home;
   try{
    home=await mkdtemp(join(optionsHomeRoot,'kernel-options-'));
    const isolatedTmp=join(home,'tmp');
    const env={...process.env,HOME:home,TMPDIR:isolatedTmp,TMP:isolatedTmp,TEMP:isolatedTmp,XDG_CONFIG_HOME:join(home,'.config'),XDG_CACHE_HOME:join(home,'.cache'),PYTHONPYCACHEPREFIX:join(optionsHomeRoot,'kernel-options-pycache')};
    await mkdir(isolatedTmp,{recursive:true});
    const {stdout}=await exec(python(id),[pythonResourcePath('kernel-options.py',pythonResourcesPath),id],{env,cwd:home,timeout:120000,maxBuffer:4*1024*1024});
    const raw=JSON.parse(stdout.trim());
    return {id,options:decorateAdvancedOptions(id,raw)};
   }catch{return {id,options:[],reason:'Kernel advanced options could not be queried.'};}
   finally{if(home)await rm(home,{recursive:true,force:true});}
  })();
  advancedMetadata.set(cacheKey,task);
  try{
   const result=await task;
   if(result.reason)advancedMetadata.delete(cacheKey);
   return result;
  }catch{
   advancedMetadata.delete(cacheKey);
   return {id,options:[],reason:'Kernel advanced options could not be queried.'};
  }
 }

 async function translate({id,bytes,documentHash,page,language,sourceLanguage,threads,model,proxy,signal,advancedOptions={}}){
  if(signal?.aborted)throw Error('Cancelled');
  if(sourceLanguage!==undefined&&!Object.hasOwn(LANGUAGE_CODES,sourceLanguage))throw Error('Unsupported source language');
  const state=await check(id);if(!state.available)throw Error(state.reason);
  const {overrides,args:advancedArgs}=await translationAdvancedArgs(id,advancedOptions,()=>advanced(id,state));
  const sourceHash=documentHash&&typeof documentHash.copy==='function'?documentHash.copy():createHash('sha256').update(bytes);
  const key=sourceHash.update(JSON.stringify({id,version:state.version,page,language,...sourceLanguage&&sourceLanguage!=='English'?{sourceLanguage}:{},model,prompt:2,layoutSchema:2,...Object.keys(overrides).length?{advancedOptions:overrides}:{}})).digest('hex');
  const cached=join(cacheDir,`${key}.pdf`);
  try{const result=await readFile(cached);await readFile(join(cacheDir,key+'.layout.json'));result.layoutKey=key;return result;}catch{}
  await mkdir(root,{recursive:true});
  const dir=await mkdtemp(join(root,'job-'));const input=join(dir,'input.pdf');await writeFile(input,bytes);
  const codes=LANGUAGE_CODES;
  const lang=codes[language];if(!lang)throw Error('Unsupported language');
  const assetHome=join(runtimeHomeRoot,id,'home');const home=join(dir,'home');await prepareKernelAssets(assetHome,home);
  const env={...process.env,HOME:home,OPENAI_API_KEY:proxy.token,OPENAI_BASE_URL:proxy.url,OPENAI_MODEL:model,PDF2ZH_OPENAI_API_KEY:proxy.token,PDF2ZH_OPENAI_BASE_URL:proxy.url,PDF2ZH_OPENAI_MODEL:model};delete env.OPENAI_API_KEY_REAL;
  try{
   const args=id==='pdf_math_fast'?['-m','pdf2zh.pdf2zh',input,'--mode','fast','-p',String(page),'-lo',lang,'-s',`openai:${model}`,'-t',String(threads),'-o',dir,...(Object.keys(overrides).length?advancedArgs:['--backend','cpu','--ignore-cache'])]:['-m','pdf2zh_next',input,'--openai','--pages',String(page),'--lang-out',lang,'--qps',String(threads),'--pool-max-workers',String(threads),'--output',dir,'--no-dual','--ignore-cache','--disable-config-auto-save','--watermark-output-mode','no_watermark',...advancedArgs];
   if(sourceLanguage)args.push('--lang-in',LANGUAGE_CODES[sourceLanguage]);
   await new Promise((resolve,reject)=>{
    if(signal?.aborted)return reject(Error('Cancelled'));
    const child=spawn(python(id),[pythonResourcePath('kernel-worker.py',pythonResourcesPath),id,join(dir,'layout.json'),String(page),input,...args.slice(2)],{env,cwd:dir,stdio:['ignore','ignore','pipe'],detached:process.platform!=='win32'});
    children.add(child);child.stderr.on('data',chunk=>onDiagnostic?.(String(chunk).replaceAll(proxy.token,'[redacted]')));
    const kill=()=>{try{process.kill(-child.pid,'SIGTERM');}catch{child.kill();}};const timer=setTimeout(kill,15*60*1000);signal?.addEventListener('abort',kill,{once:true});
    child.on('error',()=>reject(Error('Kernel could not start')));child.on('close',code=>{clearTimeout(timer);signal?.removeEventListener('abort',kill);children.delete(child);code===0?resolve():reject(Error(signal?.aborted?'Cancelled':'Kernel translation failed. Check its runtime assets and provider configuration.'));});
   });
   const names=await readdir(dir);const output=names.find(n=>/mono.*\.pdf$/i.test(n)||/\.mono\.pdf$/i.test(n));if(!output)throw Error('Kernel did not produce a translated PDF');
   const raw=await readFile(join(dir,output));await onOutput?.(raw,id);const document=await PDFDocument.load(raw);const index=document.getPageCount()===1?0:page-1;if(index>=document.getPageCount())throw Error('Kernel returned an unexpected page count');
   const one=await PDFDocument.create();const [selected]=await one.copyPages(document,[index]);one.addPage(selected);const result=Buffer.from(await one.save());const metadata=JSON.parse(await readFile(join(dir,'layout.json'),'utf8'));if(!Array.isArray(metadata.paragraphs))throw Error('Kernel returned invalid layout');
   await mkdir(cacheDir,{recursive:true});const temporary=cached+'.'+crypto.randomUUID()+'.tmp';await writeFile(temporary,result);await (await import('node:fs/promises')).rename(temporary,cached);const metaPath=join(cacheDir,key+'.layout.json'),metaTemp=metaPath+'.'+crypto.randomUUID()+'.tmp';await writeFile(metaTemp,JSON.stringify(metadata));await (await import('node:fs/promises')).rename(metaTemp,metaPath);result.layoutKey=key;return result;
  }finally{await rm(dir,{recursive:true,force:true});}
 }

 return {layout:async key=>{if(!/^[a-f0-9]{64}$/.test(key))throw Error('Invalid layout key');return JSON.parse(await readFile(join(cacheDir,key+'.layout.json'),'utf8'));},startup:async()=>({uv:uv=await findUv(),engines:await Promise.all(Object.keys(definitions).map(check))}),check,install,advanced,translate,close(){for(const child of children){try{process.kill(-child.pid,'SIGTERM');}catch{child.kill();}}}};
}
