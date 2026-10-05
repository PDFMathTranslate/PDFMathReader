import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from './index.mjs';
import {withSharedOpenAIKey,isProviderConfigured} from '../src/provider-groups.mjs';
import {configuredMenuServices} from '../src/menu-options.mjs';
test('desktop backend has private origin, authenticates API, and releases its port',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'preview-backend-'));
 const backend=await startServer({port:0,development:false,cacheDir:dir,token:'test-only-token',getApiKey:()=> 'shared-test-key',providerFetch:async(url,options)=>{
  if(url.endsWith('/check'))return Response.json({status:'ok'});
  if(url.includes('api.openai.com'))assert.equal(options.headers.Authorization,'Bearer shared-test-key');
  return Response.json(url.includes('chatproxy')?{content:'测试译文'}:{choices:[{message:{content:'测试译文'}}]});
 }});
 try{
  assert.equal((await fetch(backend.origin+'/api/config')).status,403);
  const headers={'X-Preview-Token':'test-only-token'};
  assert.equal((await fetch(backend.origin+'/api/config',{headers})).status,200);
  const catalog=await (await fetch(backend.origin+'/api/engines/pdf_inspector/services',{headers})).json();
  assert.equal(catalog.services.find(service=>service.id==='auto').label.includes('OpenAI'),false);
  const shared=withSharedOpenAIKey(catalog.services,{},true);
  assert(isProviderConfigured(catalog.services.find(service=>service.id==='openai'),{},shared));
  assert(configuredMenuServices(catalog,{},shared).some(item=>item.value==='openai'));
  assert.equal(withSharedOpenAIKey(catalog.services,{openai:{key:'override'}},true).openai.key,'override');
  for(const [id,expected] of [['auto','siliconflow-free'],['openai','openai']]){
   const response=await fetch(backend.origin+'/api/translate',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({text:'hello',language:'Simplified Chinese',reuseTranslations:false,translationService:{id,values:{}}})});
   assert.equal(response.status,200,await response.clone().text());
   assert.equal(response.headers.get('X-Translation-Service'),expected);
  }
  assert.equal((await fetch(backend.origin+'/api/config',{headers:{...headers,Origin:'https://example.com'}})).status,403);
 }finally{await backend.close();await rm(dir,{recursive:true,force:true});}
 await assert.rejects(fetch(backend.origin));
});
