import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createReaderPreferences} from '../electron/preferences.mjs';

test('translation service preferences allow Inspector profiles and never serialize secret fields',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'pdfmathreader-translation-preferences-'));
 try{
  const path=join(directory,'reader.json'),preferences=await createReaderPreferences(path);
  for(const field of ['OPENAI_API_KEY','AnythingLLM_APIKEY','AUTH_KEY','ACCESS_TOKEN','openai_api_key','key'])assert.throws(()=>preferences.save({translationServices:{pdf_inspector:{id:'openai',values:{[field]:'secret'}}}}));
  const value={translationServices:{pdf_inspector:{id:'openai',values:{OPENAI_BASE_URL:'https://example.test',model:'fixture'},profiles:{'302ai':{values:{model:'302'}}}}}};
  await preferences.save(value);await preferences.flush();
  assert.deepEqual(preferences.load().translationServices,value.translationServices);
  const serialized=await readFile(path,'utf8');assert.equal(serialized.includes('secret'),false);assert.equal(serialized.includes('OPENAI_API_KEY'),false);
  assert.deepEqual((await createReaderPreferences(path)).load().translationServices,value.translationServices);
 }finally{await rm(directory,{recursive:true,force:true});}
});
