import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServiceCredentials} from '../electron/service-credentials.mjs';

function fakeSafeStorage(){
 return {
  isEncryptionAvailable:()=>true,
  isAsyncEncryptionAvailable:async()=>true,
  encryptStringAsync:async value=>Buffer.from(`encrypted:${Buffer.from(value).toString('base64')}`),
  decryptStringAsync:async value=>({result:Buffer.from(String(value)).toString().replace(/^encrypted:/,'').trim()?Buffer.from(Buffer.from(String(value)).toString().replace(/^encrypted:/,'').trim(),'base64').toString():''})
 };
}

test('service credentials preserve uppercase and digit-leading service ids without plaintext on disk',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pdfmathreader-service-credentials-'));
 try{
  const path=join(directory,'credentials.enc'),safeStorage=fakeSafeStorage(),store=await createServiceCredentials({path,safeStorage,platform:'darwin'});
  await Promise.all([
   store.save({engine:'pdf_math_fast',service:'302ai',values:{OPENAI_API_KEY:'fast-secret'}}),
   store.save({engine:'pdf_math_precise',service:'openai',values:{OPENAI_API_KEY:'next-secret'}})
  ]);
  await store.flush();
  const encrypted=await readFile(path,'utf8');assert.equal(encrypted.includes('fast-secret'),false);assert.equal(encrypted.includes('next-secret'),false);
  assert.deepEqual(await store.load(),{pdf_math_fast:{'302ai':{OPENAI_API_KEY:'fast-secret'}},pdf_math_precise:{openai:{OPENAI_API_KEY:'next-secret'}}});
  const reopened=await createServiceCredentials({path,safeStorage,platform:'darwin'});
  assert.deepEqual(await reopened.load({engine:'pdf_math_fast',service:'302ai'}),{OPENAI_API_KEY:'fast-secret'});
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('serialized saves build from the latest state and clear missing services safely',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pdfmathreader-service-credentials-race-'));
 try{
  const path=join(directory,'credentials.enc'),store=await createServiceCredentials({path,safeStorage:fakeSafeStorage(),platform:'darwin'});
  await Promise.all([
   store.save({engine:'pdf_inspector',service:'openai',values:{key:'inspector-secret'}}),
   store.save({engine:'pdf_inspector',service:'302ai',values:{AnythingLLM_APIKEY:'anything-secret'}})
  ]);
  assert.deepEqual(await store.load(),{pdf_inspector:{openai:{key:'inspector-secret'},'302ai':{AnythingLLM_APIKEY:'anything-secret'}}});
  await store.clear({engine:'pdf_inspector',service:'missing'});
  await store.clear({engine:'pdf_inspector',service:'302ai'});
  assert.deepEqual(await store.load(),{pdf_inspector:{openai:{key:'inspector-secret'}}});
 }finally{await rm(directory,{recursive:true,force:true});}
});
