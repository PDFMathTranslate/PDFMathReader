import {createHash,randomUUID} from 'node:crypto';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {join,resolve} from 'node:path';

// Share pending translations between local backends, while keeping their jobs separate.
const pendingTranslations=new Map();
const validTranslation=data=>typeof data?.choices?.[0]?.message?.content==='string'&&!!data.choices[0].message.content.trim();
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
// Protocol used by PDFMathTranslate-next's SiliconFlowFreeTranslator.
export const FREE_ENDPOINTS=Object.freeze(['https://api1.pdf2zh-next.com/chatproxy','https://api2.pdf2zh-next.com/chatproxy']);
export function freeTranslationPrompt(text,language){
 return `You are a professional,authentic machine translation engine.\n\n;; Treat next line as plain text input and translate it into ${language}, output translation ONLY. If translation is unnecessary (e.g. proper nouns, codes, {{1}}, etc. ), return the original text. NO explanations. NO notes. Input:\n\n${text}`;
}
export function selectTranslationProvider(key){return key?{id:'openai',model:process.env.OPENAI_MODEL||'gpt-4.1-mini',key}:{id:'siliconflow-free',model:'siliconflow-free'};}
function requestBody(provider,body){
 if(provider.id==='openai')return {...body,messages:body.messages?.map(message=>({...message,content:typeof message.content==='string'?message.content.replace('Keep the formula notation {v*} unchanged.', 'Preserve every numbered formula placeholder exactly as it appears in Source Text (for example {{v0}} or {v0}). Never output the generic wildcard {v*} or invent a placeholder.'):message.content})),stream:false,model:provider.model};
 let text=(body.messages||[]).map(message=>String(message.content||'')).join('\n\n');
 // Preserve Fast's source and formula placeholders using Next's supported template.
 if(provider.kernel==='pdf_math_fast'&&text.startsWith('You are a professional, authentic machine translation engine.')){
  const source=text.match(/\n\nSource Text: ([\s\S]*)\n\nTranslated Text:$/);
  if(source)text=freeTranslationPrompt(source[1],provider.language)+'\nPreserve every numbered formula placeholder from the input exactly (for example {{v0}} or {v0}); never output {v*} or invent a placeholder.';
 }
 return {text,...body.response_format?.type==='json_object'?{requestJsonMode:true}:{}};
}
export function createTranslationProvider(providerFetch,{cacheDirectory}={}){
 let selected;
 async function endpoint(){
  selected??=Promise.any(FREE_ENDPOINTS.map(async url=>{
   const response=await providerFetch(url+'/check',{method:'POST',signal:AbortSignal.timeout(5000)});
   if(!response.ok||(await response.json()).status!=='ok')throw Error('Unavailable');
   return url;
  })).catch(()=>FREE_ENDPOINTS[0]);
  return selected;
 }
 async function request(provider,body,signal){
  if(provider.id==='openai')return providerFetch('https://api.openai.com/v1/chat/completions',{method:'POST',signal,headers:{Authorization:`Bearer ${provider.key}`,'Content-Type':'application/json'},body:JSON.stringify(requestBody(provider,body))});
  const first=await endpoint();
  const payload=requestBody(provider,body);
  for(const url of [first,...FREE_ENDPOINTS.filter(url=>url!==first)]){
   if(signal.aborted)throw signal.reason;
   let response;
   try{response=await providerFetch(url,{method:'POST',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});}catch(error){if(signal.aborted||url!==first)throw error;continue;}
   if(response.status>=500&&url===first)continue;
   if(!response.ok)return response;
   const data=await response.json();
   if(typeof data.content!=='string'||!data.content.trim())throw Error('SiliconFlow free service returned an empty translation.');
   const content=data.content.replace(/<think>[\s\S]*?<\/think>/g,'').trim();
   if(!content)throw Error('SiliconFlow free service returned an empty translation.');
   selected=Promise.resolve(url);
   return new Response(JSON.stringify({model:provider.model,choices:[{index:0,message:{role:'assistant',content},finish_reason:'stop'}]}),{headers:{'Content-Type':'application/json'}});
  }
 }
 async function complete(provider,body,signal,{cache=true,cacheScope=''}={}){
  signal.throwIfAborted();
  if(!cacheDirectory||!cache)return request(provider,body,signal);
  // Include all output-affecting request options; never include document IDs,
  // proxy tokens or provider credentials. Stream responses are buffered upstream.
  const key=createHash('sha256').update(JSON.stringify(stable({version:1,...cacheScope?{cacheScope}:{},service:provider.id,model:provider.model,body:requestBody(provider,body)}))).digest('hex');
  const [documentHash,generation]=cacheScope.split(':');
  const directory=cacheScope?join(resolve(cacheDirectory),'..','documents',documentHash,'text',generation):resolve(cacheDirectory),path=join(directory,key+'.json');
  try{const data=JSON.parse(await readFile(path,'utf8'));if(validTranslation(data))return Response.json(data);}catch{}
  signal.throwIfAborted();
  let pending=pendingTranslations.get(path);
  if(!pending){
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),60000);
   pending={controller,users:0};
   pending.promise=(async()=>{
    // A previous writer may finish between our first disk read and claiming the job.
    try{const text=await readFile(path,'utf8');if(validTranslation(JSON.parse(text)))return {text,status:200,headers:[['Content-Type','application/json']]};}catch{}
    const response=await request(provider,body,controller.signal),text=await response.text();
    if(response.ok){
     let data;try{data=JSON.parse(text);}catch{}
     if(validTranslation(data)){
      // Cache writes are optional: a full disk must not discard a valid translation.
      try{await mkdir(directory,{recursive:true});const temporary=path+'.'+randomUUID()+'.tmp';await writeFile(temporary,text);await rename(temporary,path);}catch{}
     }
    }
    return {text,status:response.status,headers:[...response.headers]};
   })().finally(()=>{clearTimeout(timeout);if(pendingTranslations.get(path)===pending)pendingTranslations.delete(path);});
   pendingTranslations.set(path,pending);
  }
  pending.users++;
  try{
   const result=await new Promise((accept,reject)=>{
    const abort=()=>reject(signal.reason);signal.addEventListener('abort',abort,{once:true});
    pending.promise.then(accept,reject).finally(()=>signal.removeEventListener('abort',abort));
    if(signal.aborted)abort();
   });
   return new Response(result.text,{status:result.status,headers:result.headers});
  }finally{if(--pending.users===0){if(pendingTranslations.get(path)===pending)pendingTranslations.delete(path);pending.controller.abort();}}
 }
 return {complete};
}
