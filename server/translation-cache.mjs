import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';

// The exact key retains the original on-disk format. A separate pointer records
// the last compatible result without making provider credentials part of it.
export function createTranslationCache({directory,keyFor,readResult,fallbackKeyFors=[]}){
 const compatibleKey=keyFor(undefined),pointer=join(directory,`${compatibleKey}.translation.json`);
 async function remember(model,key){
  await mkdir(directory,{recursive:true});
  const temporary=`${pointer}.${randomUUID()}.tmp`;
  await writeFile(temporary,JSON.stringify({model,key}));await rename(temporary,pointer);
 }
 async function lookup(model,{reuseTranslations=true}={}){
  const candidates=[model];
  if(reuseTranslations){
   try{const saved=JSON.parse(await readFile(pointer,'utf8'));if(typeof saved.model==='string'&&saved.key===keyFor(saved.model))candidates.push(saved.model);}catch{}
   // Existing caches predate the compatible-result pointer. Probe the shipped
   // providers using the unchanged exact key, then migrate successful hits.
   candidates.push('gpt-4.1-mini','siliconflow-free');
  }
  for(const candidate of new Set(candidates)){
   const key=keyFor(candidate);
   let result;try{result=await readResult(key);}catch{continue;}
   // An optional index write must never turn a valid cache hit into a retranslation.
   await remember(candidate,key).catch(()=>{});
   return {result,key,model:candidate};
  }
  // Layout-only upgrades can retain prior translated PDFs when explicitly
  // allowed by the caller. Keep their original keys and layout metadata.
  if(reuseTranslations)for(const fallbackKeyFor of fallbackKeyFors){
   const hit=await createTranslationCache({directory,keyFor:fallbackKeyFor,readResult}).lookup(model);
   if(hit)return hit;
  }
  return null;
 }
 return {lookup,remember};
}
