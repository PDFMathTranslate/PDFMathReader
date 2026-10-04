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

test('paragraph API cache-only probes avoid provider calls and do not fall back across models',async()=>{
 const root=await mkdtemp(join(tmpdir(),'paragraph-cache-only-api-'));let calls=0;
 const text='Cache-only paragraph',language='Simplified Chinese',legacyText='Strict model paragraph',legacyModel='gpt-4.1-mini',legacyKey=digest({text:legacyText,language,model:legacyModel,prompt:1});
 await writeFile(join(root,legacyKey+'.json'),JSON.stringify({translation:'旧模型译文',key:legacyKey,model:legacyModel}));
 const backend=await startServer({port:0,development:false,cacheDir:root,getApiKey:()=>null,providerFetch:async url=>{if(url.endsWith('/check'))return Response.json({status:'ok'});calls++;return Response.json({content:'新译文'});}});
 const post=body=>fetch(backend.origin+'/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,language,...body})});
 try{
  const miss=await post({cacheOnly:true});assert.equal(miss.status,204);assert.equal(calls,0);
  const actual=await (await post({cacheOnly:false})).json();assert.equal(actual.translation,'新译文');assert.equal(actual.cached,false);assert.equal(calls,1);
  const probe=await post({cacheOnly:true});assert.equal(probe.status,200);const cached=await probe.json();assert.equal(cached.translation,'新译文');assert.equal(cached.cached,true);assert.equal(calls,1);
  assert.equal((await post({cacheOnly:1})).status,400);assert.equal(calls,1);
  const strict=await fetch(backend.origin+'/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:legacyText,language,cacheOnly:true,reuseTranslations:false})});assert.equal(strict.status,204);assert.equal(calls,1);
 }finally{await backend.close();await rm(root,{recursive:true,force:true});}
});

test('layout-only update reuses legacy cache after restart without weakening strict mode or document isolation',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'translation-upgrade-'));
 try{
  const keyFor=(model,schema=4,document='one')=>digest({document,language:'zh',version:'1.0',model,layoutSchema:schema});
  const readResult=key=>readFile(join(directory,key+'.pdf'));
  const oldKey=keyFor('custom-model',3);
  await writeFile(join(directory,oldKey+'.pdf'),'old translated PDF');
  await createTranslationCache({directory,keyFor:model=>keyFor(model,3),readResult}).remember('custom-model',oldKey);
  const updated=()=>createTranslationCache({directory,keyFor,readResult,fallbackKeyFors:[model=>keyFor(model,3)]});
  const hit=await updated().lookup('siliconflow-free');
  assert.equal(hit.key,oldKey);assert.equal(hit.model,'custom-model');assert.equal(hit.result.toString(),'old translated PDF');
  assert.equal(await updated().lookup('siliconflow-free',{reuseTranslations:false}),null);
  assert.equal(await createTranslationCache({directory,keyFor:model=>keyFor(model,4,'two'),readResult,fallbackKeyFors:[model=>keyFor(model,3,'two')]}).lookup('siliconflow-free'),null);
  await writeFile(join(directory,keyFor('siliconflow-free')+'.pdf'),'current translated PDF');
  assert.equal((await updated().lookup('siliconflow-free')).result.toString(),'current translated PDF');
 }finally{await rm(directory,{recursive:true,force:true});}
});
