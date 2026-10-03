// Protocol used by PDFMathTranslate-next's SiliconFlowFreeTranslator.
export const FREE_ENDPOINTS=Object.freeze(['https://api1.pdf2zh-next.com/chatproxy','https://api2.pdf2zh-next.com/chatproxy']);
export function freeTranslationPrompt(text,language){
 return `You are a professional,authentic machine translation engine.\n\n;; Treat next line as plain text input and translate it into ${language}, output translation ONLY. If translation is unnecessary (e.g. proper nouns, codes, {{1}}, etc. ), return the original text. NO explanations. NO notes. Input:\n\n${text}`;
}
export function selectTranslationProvider(key){return key?{id:'openai',model:process.env.OPENAI_MODEL||'gpt-4.1-mini',key}:{id:'siliconflow-free',model:'siliconflow-free'};}
export function createTranslationProvider(providerFetch){
 let selected;
 async function endpoint(){
  selected??=Promise.any(FREE_ENDPOINTS.map(async url=>{
   const response=await providerFetch(url+'/check',{method:'POST',signal:AbortSignal.timeout(5000)});
   if(!response.ok||(await response.json()).status!=='ok')throw Error('Unavailable');
   return url;
  })).catch(()=>FREE_ENDPOINTS[0]);
  return selected;
 }
 async function complete(provider,body,signal){
  if(provider.id==='openai')return providerFetch('https://api.openai.com/v1/chat/completions',{method:'POST',signal,headers:{Authorization:`Bearer ${provider.key}`,'Content-Type':'application/json'},body:JSON.stringify({...body,stream:false,model:provider.model})});
  const first=await endpoint();
  let text=(body.messages||[]).map(message=>String(message.content||'')).join('\n\n');
  // Legacy's default OpenAI prompt is not accepted by the free chatproxy.
  // Preserve its source and formula placeholders using Next's supported template.
  if(provider.kernel==='pdf_math_fast'&&text.startsWith('You are a professional, authentic machine translation engine.')){
   const source=text.match(/\n\nSource Text: ([\s\S]*)\n\nTranslated Text:$/);
   if(source)text=freeTranslationPrompt(source[1],provider.language);
  }
  const payload={text,...body.response_format?.type==='json_object'?{requestJsonMode:true}:{}};
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
 return {complete};
}
