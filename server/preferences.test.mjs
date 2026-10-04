import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createReaderPreferences} from '../electron/preferences.mjs';

const DEFAULT_PREFERENCES={
 engine:'pdf_inspector',direction:'vertical',columns:1,fit:'width',zoom:1,translationMode:'reading',
 documentOpenMode:'translation',interactionMode:'reading',restoreDocuments:true,reduceResourceUsage:true,reuseTranslations:true,emphasizeTopicSentences:false,emphasizeInformation:false,
 appearance:'system',accentColor:'system',reduceMotion:false,reduceTransparency:false,reducePadding:false,
 language:'Simplified Chinese',sourceLanguage:'English',concurrency:2,pageConcurrency:2,automatic:true,layoutVisible:false,
 kernelAdvancedOptions:{},
 autoHideHeader:true,uiLanguage:'en'
};

const withPreferences=(overrides={},unknown={})=>({...DEFAULT_PREFERENCES,...overrides,...unknown});

test('partial saves keep every current setting and unknown key',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'partial-preferences-'));
 try{
  const path=join(dir,'reader.json'),preferences=await createReaderPreferences(path);
  const initial=withPreferences({engine:'pdf_math_precise',direction:'horizontal',columns:4,fit:'manual',zoom:1.8,translationMode:'full',documentOpenMode:'manual',appearance:'dark',accentColor:'#a1B2c3',reduceMotion:true,reduceTransparency:true,language:'Japanese',concurrency:11,pageConcurrency:8,automatic:false,layoutVisible:true},{futureSetting:{revision:3}});
  await preferences.save(initial);
  const beforeInvalid=preferences.load();
  assert.throws(()=>preferences.save({language:'Esperanto'}));
  assert.throws(()=>preferences.save({documentOpenMode:'invalid'}));
  assert.deepEqual(preferences.load(),beforeInvalid);
  assert.deepEqual((await createReaderPreferences(path)).load(),beforeInvalid);
  await preferences.save({fit:'width',zoom:1});
  assert.deepEqual(preferences.load(),{...initial,fit:'width',zoom:1});
  await preferences.save({language:'French',pageConcurrency:3});
  const expected={...initial,fit:'width',zoom:1,language:'French',pageConcurrency:3};
  assert.deepEqual(preferences.load(),expected);
  await preferences.flush();
  assert.deepEqual((await createReaderPreferences(path)).load(),expected);
 }finally{await rm(dir,{recursive:true,force:true});}
});

 test('unset preferences default to resource saving and reading mode while explicit choices persist',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'resource-preferences-'));
 try{
 const path=join(dir,'reader.json');await writeFile(path,JSON.stringify({restoreDocuments:false}));
 const preferences=await createReaderPreferences(path);assert.equal(preferences.load().reduceResourceUsage,true);assert.equal(preferences.load().interactionMode,'reading');
 assert.throws(()=>preferences.save({reduceResourceUsage:'false'}));
 await preferences.save({reduceResourceUsage:false,interactionMode:'comparison'});
 const reloaded=(await createReaderPreferences(path)).load();assert.equal(reloaded.reduceResourceUsage,false);assert.equal(reloaded.interactionMode,'comparison');
 }finally{await rm(dir,{recursive:true,force:true});}
 });
