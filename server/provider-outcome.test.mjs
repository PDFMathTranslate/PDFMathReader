import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nativeProviderFailure,mathProviderOutcome} from './provider-outcome.mjs';
test('math service history ignores cached results, probes, PDF and cancellation errors',()=>{
 assert.equal(mathProviderOutcome({cached:true,native:true}),null);
 assert.equal(mathProviderOutcome({cacheOnly:true,native:true}),null);
 assert.equal(mathProviderOutcome({error:new Error('Invalid PDF layout'),native:true}),null);
 assert.equal(mathProviderOutcome({error:new Error('Kernel is unavailable'),native:true}),null);
 assert.equal(mathProviderOutcome({error:Object.assign(new Error('Cancelled'),{name:'AbortError'}),providerError:'proxy cancelled'}),null);
 assert.equal(mathProviderOutcome({native:false,providerCalls:0}),null);
 assert.equal(mathProviderOutcome({native:true}), 'success');
 assert.equal(mathProviderOutcome({providerCalls:3}), 'success');
 assert.equal(mathProviderOutcome({error:new Error('Kernel failed'),providerError:'provider rejected request'}),'error');
});
test('native history requires explicit upstream failure evidence',()=>{
 for(const message of ['openai.AuthenticationError: Error code: 401','openai.RateLimitError','httpx.HTTPStatusError: 503 Service Unavailable','openai.APIConnectionError'])assert.equal(nativeProviderFailure(new Error(message)),true);
 for(const message of ['PDF page 401 failed','502 paragraphs detected','ParseError: invalid PDF','Layout unavailable','Unknown service'])assert.equal(nativeProviderFailure(new Error(message)),false);
});

test('Inspector response history marks real service outcomes, excluding cache hits and invalid requests',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {startServer}=await import('./index.mjs');
 const directory=await mkdtemp(join(tmpdir(),'provider-outcomes-'));let reject=false;
 const backend=await startServer({port:0,development:false,cacheDir:directory,providerFetch:async()=>reject?Response.json({error:'fixture rejection'},{status:401}):Response.json({choices:[{message:{content:'Bonjour'}}]})});
 try{
  const request=(text,values={key:'fixture-only',model:'fixture-model',base_url:'http://localhost:9001/v1'})=>fetch(backend.origin+'/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text,language:'French',translationService:{id:'openai',values}})});
  const success=await request('First paragraph');assert.equal(success.headers.get('X-Translation-Outcome'),'success');await success.text();
  const cached=await request('First paragraph');assert.equal(cached.headers.get('X-Translation-Outcome'),null);await cached.text();
  const invalid=await request('Invalid profile',{base_url:'file:///bad'});assert.equal(invalid.headers.get('X-Translation-Outcome'),null);await invalid.text();
  reject=true;const failure=await request('Second paragraph');assert.equal(failure.status,502);assert.equal(failure.headers.get('X-Translation-Outcome'),'error');await failure.text();
 }finally{await backend.close();await rm(directory,{recursive:true,force:true});}
});
