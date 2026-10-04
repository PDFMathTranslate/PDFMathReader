import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,mkdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {createTranslationCache} from './translation-cache.mjs';
import {startServer} from './index.mjs';

const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
test('compatible cache survives restart for custom models and strict mode stays isolated',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'translation-cache-'));
 try{
  const keyFor=model=>digest({document:'one',language:'zh',model});
  const readResult=key=>readFile(join(directory,key+'.pdf'));
  const key=keyFor('custom-model');await writeFile(join(directory,key+'.pdf'),'translated');
  await createTranslationCache({directory,keyFor,readResult}).remember('custom-model',key);
  const reopened=createTranslationCache({directory,keyFor,readResult});
  assert.equal((await reopened.lookup('siliconflow-free')).model,'custom-model');
  assert.equal(await reopened.lookup('siliconflow-free',{reuseTranslations:false}),null);
  const different=createTranslationCache({directory,keyFor:model=>digest({document:'two',language:'zh',model}),readResult});
  assert.equal(await different.lookup('siliconflow-free'),null);
  for(const context of [{document:'one',language:'ja'},{document:'one',language:'zh',version:'new'},{document:'one',language:'zh',layoutSchema:4},{document:'one',language:'zh',advancedOptions:{prompt:'different'}}]){
   const incompatible=createTranslationCache({directory,keyFor:model=>digest({...context,model}),readResult});
   assert.equal(await incompatible.lookup('siliconflow-free'),null);
  }
  await writeFile(join(directory,keyFor('siliconflow-free')+'.pdf'),'current');
  assert.equal((await reopened.lookup('siliconflow-free')).result.toString(),'current');
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('legacy math page cache is reused across providers without a worker or provider call',async()=>{
 const root=await mkdtemp(join(tmpdir(),'math-cache-api-')),cacheDir=join(root,'translations'),math=join(cacheDir,'math');let calls=0;
 const pdf=Buffer.from('%PDF-1.7\nfixture');
 const keyFor=model=>createHash('sha256').update(pdf).update(JSON.stringify({id:'pdf_math_fast',version:'1.9.12',page:255,language:'Simplified Chinese',model,prompt:2,layoutSchema:3})).digest('hex');
 const key=keyFor('gpt-4.1-mini');await mkdir(math,{recursive:true});await writeFile(join(math,key+'.pdf'),'cached translated page');await writeFile(join(math,key+'.layout.json'),JSON.stringify({paragraphs:[]}));
 const backend=await startServer({port:0,development:false,cacheDir,getApiKey:()=>null,findUvImpl:async()=>({available:true,path:'/fixture/uv'}),execImpl:async()=>({stdout:'1.9.12\n'}),providerFetch:async()=>{calls++;throw Error('Must not call provider');}});
 const post=(path,body)=>fetch(backend.origin+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 try{
  const upload=await fetch(backend.origin+'/api/documents',{method:'POST',headers:{'Content-Type':'application/pdf'},body:pdf});const {id}=await upload.json();
  const url='/api/math-page?engine=pdf_math_fast&page=255&language=Simplified%20Chinese';
  const hit=await post(url,{documentId:id,sourceLanguage:'English'});assert.equal(hit.status,200);assert.equal(hit.headers.get('X-Translation-Cache'),'hit');assert.equal(hit.headers.get('X-Translation-Model'),'gpt-4.1-mini');assert.equal(hit.headers.get('X-Layout-Key'),key);assert.equal(await hit.text(),'cached translated page');assert.equal(calls,0);
  const reports=await (await fetch(backend.origin+'/api/kernel-performance')).json();assert.equal(reports.reports[0].providerCalls,0);assert.equal(reports.reports[0].cached,true);
  const invalid=await post(url,{documentId:id,reuseTranslations:'yes'});assert.equal(invalid.status,400);
  const strict=await post(url,{documentId:id,reuseTranslations:false});assert.equal(strict.status,422);assert.equal(calls,0);
 }finally{await backend.close();await rm(root,{recursive:true,force:true});}
});

test('paragraph API reuses legacy translations by default, strict mode invokes current provider',async()=>{
 const root=await mkdtemp(join(tmpdir(),'paragraph-cache-api-'));let calls=0;
 const text='Prior translated paragraph',language='Simplified Chinese',model='gpt-4.1-mini',key=digest({text,language,model,prompt:1});await writeFile(join(root,key+'.json'),JSON.stringify({translation:'已有译文',key,model}));
 const backend=await startServer({port:0,development:false,cacheDir:root,getApiKey:()=>null,providerFetch:async url=>{if(url.endsWith('/check'))return Response.json({status:'ok'});calls++;return Response.json({content:'新译文'});}});
 const post=body=>fetch(backend.origin+'/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,language,...body})});
 try{
  const existing=await (await post({})).json();assert.equal(existing.translation,'已有译文');assert.equal(existing.cached,true);assert.equal(existing.model,model);assert.equal(calls,0);
  const fresh=await (await post({reuseTranslations:false})).json();assert.equal(fresh.translation,'新译文');assert.equal(fresh.cached,false);assert.equal(calls,1);
  const again=await (await post({reuseTranslations:false})).json();assert.equal(again.cached,true);assert.equal(calls,1);
  assert.equal((await post({reuseTranslations:1})).status,400);
 }finally{await backend.close();await rm(root,{recursive:true,force:true});}
});
