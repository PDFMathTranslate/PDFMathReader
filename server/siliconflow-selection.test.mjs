import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from './index.mjs';
import {groupProviders} from '../src/provider-groups.mjs';

test('explicit SiliconFlow free service is configured and available on all kernels and explicitly uses the free proxy even with an OpenAI key',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'siliconflow-selection-')),calls=[];
 const backend=await startServer({port:0,development:false,cacheDir:directory,enginesRoot:join(directory,'engines'),getApiKey:()=> 'fixture-openai-key',localTranslationImpl:{available:async()=>false,close:async()=>{}},providerFetch:async(url,options)=>{
  if(url.endsWith('/check'))return Response.json({status:'ok'});
  calls.push(url);return Response.json({content:'Traduction du test'});
 }});
 const post=(path,body)=>fetch(backend.origin+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  await post('/api/developer/enabled',{enabled:true});
  for(const engine of ['pdf_inspector','pdf_math_fast','pdf_math_precise']){
   const catalog=await (await fetch(backend.origin+'/api/engines/'+engine+'/services')).json();
   const service=catalog.services.find(item=>item.id==='siliconflow-free');assert.ok(service,engine);assert.deepEqual(service.fields,[]);
   assert.ok(groupProviders(catalog.services)[0].services.some(item=>item.id==='siliconflow-free'));
   if(engine!=='pdf_inspector')continue;
   const result=await post('/api/developer/test',{kind:'provider',engine,language:'French',sourceLanguage:'English',concurrency:1,pageConcurrency:1,advancedOptions:{},translationService:{id:'siliconflow-free',values:{}}});
   assert.equal(result.status,200);const body=await result.json();assert.equal(body.status,'success',JSON.stringify(body));
  }
  assert.equal(calls.length,1);assert.ok(calls.every(url=>url.includes('pdf2zh-next.com/chatproxy')));
 }finally{await backend.close();await rm(directory,{recursive:true,force:true});}
});
