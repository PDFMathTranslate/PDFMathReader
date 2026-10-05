import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createReaderPreferences} from '../electron/preferences.mjs';

const DEFAULT_PREFERENCES={
 engine:'pdf_inspector',direction:'vertical',columns:1,fit:'width',zoom:1,translationMode:'reading',
 cacheLimitMB:null,documentOpenMode:'translation',interactionMode:'reading',restoreDocuments:true,reduceResourceUsage:true,reduceBackgroundFrameRate:true,reuseTranslations:true,emphasizeTopicSentences:false,emphasizeInformation:false,
 appearance:'system',accentColor:'system',reduceMotion:false,reduceTransparency:false,reducePadding:false,
 language:'Simplified Chinese',sourceLanguage:'English',concurrency:2,pageConcurrency:2,automatic:true,layoutVisible:false,defaultPageCropEnabled:false,defaultPageCropX:0,defaultPageCropY:0,autoAlignDocumentWidth:false,
 kernelAdvancedOptions:{},
 autoHideHeader:true,uiLanguage:'system'
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
 const preferences=await createReaderPreferences(path);assert.equal(preferences.load().reduceResourceUsage,true);assert.equal(preferences.load().interactionMode,'reading');assert.equal(preferences.load().reduceBackgroundFrameRate,true);
 assert.throws(()=>preferences.save({reduceResourceUsage:'false'}));assert.throws(()=>preferences.save({reduceBackgroundFrameRate:'false'}));
 await preferences.save({reduceResourceUsage:false,reduceBackgroundFrameRate:false,interactionMode:'comparison'});
 const reloaded=(await createReaderPreferences(path)).load();assert.equal(reloaded.reduceResourceUsage,false);assert.equal(reloaded.interactionMode,'comparison');assert.equal(reloaded.reduceBackgroundFrameRate,false);
 }finally{await rm(dir,{recursive:true,force:true});}
 });

test('cache size preference validates allowed limits and persists across reloads',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'cache-preference-'));const path=join(dir,'preferences.json');
 try{const store=await createReaderPreferences(path);assert.equal(store.load().cacheLimitMB,null);for(const value of [512,1024,2048,5120,10240,null]){await store.save({cacheLimitMB:value});assert.equal((await createReaderPreferences(path)).load().cacheLimitMB,value);}assert.throws(()=>store.save({cacheLimitMB:3}),/Invalid reader preferences/);assert.equal(store.load().cacheLimitMB,null);}
 finally{await rm(dir,{recursive:true,force:true});}
});

test('page crop and document width preferences default, persist, and validate boundaries',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'page-crop-preferences-'));const path=join(dir,'preferences.json');
 try{
  const store=await createReaderPreferences(path);
  assert.deepEqual(((value)=>({defaultPageCropEnabled:value.defaultPageCropEnabled,defaultPageCropX:value.defaultPageCropX,defaultPageCropY:value.defaultPageCropY,autoAlignDocumentWidth:value.autoAlignDocumentWidth}))(store.load()),{defaultPageCropEnabled:false,defaultPageCropX:0,defaultPageCropY:0,autoAlignDocumentWidth:false});
  await store.save({defaultPageCropEnabled:true,defaultPageCropX:.5,defaultPageCropY:0,autoAlignDocumentWidth:true});
  assert.deepEqual(((value)=>({defaultPageCropEnabled:value.defaultPageCropEnabled,defaultPageCropX:value.defaultPageCropX,defaultPageCropY:value.defaultPageCropY,autoAlignDocumentWidth:value.autoAlignDocumentWidth}))( (await createReaderPreferences(path)).load()),{defaultPageCropEnabled:true,defaultPageCropX:.5,defaultPageCropY:0,autoAlignDocumentWidth:true});
  await store.save({defaultPageCropX:0,defaultPageCropY:.5,defaultPageCropEnabled:false,autoAlignDocumentWidth:false});
  const reloaded=(await createReaderPreferences(path)).load();
  assert.equal(reloaded.defaultPageCropX,0);assert.equal(reloaded.defaultPageCropY,.5);assert.equal(reloaded.defaultPageCropEnabled,false);assert.equal(reloaded.autoAlignDocumentWidth,false);
  for(const value of [-Number.EPSILON,.5+Number.EPSILON,Number.NaN,Number.POSITIVE_INFINITY,Number.NEGATIVE_INFINITY,'0.25',null])assert.throws(()=>store.save({defaultPageCropX:value}),/Invalid default page crop X preference/);
  for(const value of [-Number.EPSILON,.5+Number.EPSILON,Number.NaN,Number.POSITIVE_INFINITY,Number.NEGATIVE_INFINITY,'0.25',null])assert.throws(()=>store.save({defaultPageCropY:value}),/Invalid default page crop Y preference/);
  for(const value of [0,1,'true',null])assert.throws(()=>store.save({defaultPageCropEnabled:value}),/Invalid default page crop enabled preference/);
  for(const value of [0,1,'false',null])assert.throws(()=>store.save({autoAlignDocumentWidth:value}),/Invalid auto-align document width preference/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
