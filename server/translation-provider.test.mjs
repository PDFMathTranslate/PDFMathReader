import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTranslationProvider,selectTranslationProvider,FREE_ENDPOINTS} from './translation-provider.mjs';
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});

test('configured key routes only to OpenAI and aborted fallback sends no translation',async()=>{
 const calls=[];const client=createTranslationProvider(async(url,options)=>{calls.push({url,options});return json({status:'ok'});});
 await client.complete(selectTranslationProvider('test-key'),{messages:[]},new AbortController().signal);assert.equal(calls.length,1);assert.equal(calls[0].url,'https://api.openai.com/v1/chat/completions');assert.equal(calls[0].options.headers.Authorization,'Bearer test-key');
 const controller=new AbortController();controller.abort();await assert.rejects(client.complete(selectTranslationProvider(),{},controller.signal));assert.equal(calls.filter(call=>FREE_ENDPOINTS.includes(call.url)).length,0);
});
