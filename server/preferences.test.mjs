import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createReaderPreferences} from '../electron/preferences.mjs';

const DEFAULT_PREFERENCES={
 engine:'pdf_inspector',direction:'vertical',columns:1,fit:'width',zoom:1,translationMode:'reading',
 interactionMode:'comparison',restoreDocuments:true,reuseTranslations:true,
 appearance:'system',accentColor:'system',reduceMotion:false,reduceTransparency:false,reducePadding:false,
 language:'Simplified Chinese',sourceLanguage:'English',concurrency:2,pageConcurrency:2,automatic:true,layoutVisible:false,
 kernelAdvancedOptions:{},
 autoHideHeader:true,uiLanguage:'en'
};

const withPreferences=(overrides={},unknown={})=>({...DEFAULT_PREFERENCES,...overrides,...unknown});

test('fit preferences survive a new app instance and reject invalid data',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'reader-preferences-'));
 try{
  const path=join(dir,'reader.json'),first=await createReaderPreferences(path);
  assert.equal(first.load().fit,'width');
  await Promise.all([first.save({fit:'manual',zoom:1.4}),first.save({fit:'height',zoom:.8,translationMode:'reading'})]);
  const reopened=await createReaderPreferences(path);
  assert.deepEqual(reopened.load(),withPreferences({fit:'height',zoom:.8}));
  await reopened.save({translationMode:'full'});
  assert.equal((await createReaderPreferences(path)).load().translationMode,'full');
  await reopened.save({engine:'pdf_inspector',translationMode:'reading',direction:'vertical',columns:1});
  await reopened.save({fit:'width',zoom:1,direction:'horizontal',columns:4});
  const layout=(await createReaderPreferences(path)).load();
  assert.equal(layout.direction,'horizontal');
  assert.equal(layout.columns,4);
  await reopened.save({fit:'height',zoom:.8,translationMode:'reading'});
  assert.throws(()=>reopened.save({fit:'width',zoom:1,columns:3}));
  assert.throws(()=>reopened.save({fit:'window',zoom:100}));
  assert.deepEqual(reopened.load(),withPreferences({fit:'height',zoom:.8,direction:'horizontal',columns:4}));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('kernel survives reopening and legacy window saves without reverting the selection',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'kernel-preferences-'));
 try{
  const path=join(dir,'reader.json'),first=await createReaderPreferences(path);
  for(const engine of ['pdf_math_fast','pdf_math_precise','pdf_inspector']){
   await first.save({fit:'width',zoom:1,engine});
   await first.save({fit:'height',zoom:.8});
   assert.equal((await createReaderPreferences(path)).load().engine,engine);
  }
  assert.throws(()=>first.save({engine:'invalid'}));
  assert.equal(first.load().engine,'pdf_inspector');
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('appearance preferences persist and survive layout-only saves',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'appearance-preferences-'));
 try{
  const path=join(dir,'reader.json'),preferences=await createReaderPreferences(path);
  await preferences.save({fit:'width',zoom:1,appearance:'dark',accentColor:'#a1B2c3',reduceMotion:true,reduceTransparency:true,reducePadding:true});
  await preferences.save({fit:'height',zoom:.8,direction:'horizontal',columns:2});
  assert.deepEqual((await createReaderPreferences(path)).load(),withPreferences({fit:'height',zoom:.8,direction:'horizontal',columns:2,appearance:'dark',accentColor:'#a1B2c3',reduceMotion:true,reduceTransparency:true,reducePadding:true}));
  await preferences.save({appearance:'light',accentColor:'system',reduceMotion:false,reduceTransparency:false});
  const updated=preferences.load();
  assert.equal(updated.appearance,'light');
  assert.equal(updated.accentColor,'system');
  assert.throws(()=>preferences.save({appearance:'sepia'}));
  assert.throws(()=>preferences.save({accentColor:'#abcd'}));
  assert.throws(()=>preferences.save({reduceMotion:'yes'}));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('legacy JSON upgrades new settings without discarding valid fields or unknown keys',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'legacy-preferences-'));
 try{
  const path=join(dir,'reader.json');
  await writeFile(path,JSON.stringify({
   engine:'pdf_math_precise',direction:'horizontal',columns:2,fit:'manual',zoom:1.5,translationMode:'full',
   appearance:'dark',accentColor:'#a1B2c3',reduceMotion:true,reduceTransparency:true,
   futureSetting:{revision:3}
  }));
  const preferences=await createReaderPreferences(path);
  assert.deepEqual(preferences.load(),withPreferences({engine:'pdf_math_precise',direction:'horizontal',columns:2,fit:'manual',zoom:1.5,translationMode:'full',appearance:'dark',accentColor:'#a1B2c3',reduceMotion:true,reduceTransparency:true},{futureSetting:{revision:3}}));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('invalid loaded fields fall back independently while other fields remain valid',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'invalid-upgrade-preferences-'));
 try{
  const path=join(dir,'reader.json');
  await writeFile(path,JSON.stringify({
   engine:'pdf_math_fast',direction:'horizontal',columns:4,fit:'manual',zoom:1.8,translationMode:'full',
   appearance:'dark',accentColor:'#a1B2c3',reduceMotion:true,reduceTransparency:true,
   language:'Esperanto',concurrency:9,pageConcurrency:7,automatic:false,layoutVisible:true,
   futureSetting:'keep-me'
  }));
  const preferences=await createReaderPreferences(path);
  assert.deepEqual(preferences.load(),withPreferences({engine:'pdf_math_fast',direction:'horizontal',columns:4,fit:'manual',zoom:1.8,translationMode:'full',appearance:'dark',accentColor:'#a1B2c3',reduceMotion:true,reduceTransparency:true,concurrency:9,pageConcurrency:7,automatic:false,layoutVisible:true},{futureSetting:'keep-me'}));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('partial saves keep every current setting and unknown key',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'partial-preferences-'));
 try{
  const path=join(dir,'reader.json'),preferences=await createReaderPreferences(path);
  const initial=withPreferences({engine:'pdf_math_precise',direction:'horizontal',columns:4,fit:'manual',zoom:1.8,translationMode:'full',appearance:'dark',accentColor:'#a1B2c3',reduceMotion:true,reduceTransparency:true,language:'Japanese',concurrency:11,pageConcurrency:8,automatic:false,layoutVisible:true},{futureSetting:{revision:3}});
  await preferences.save(initial);
  const beforeInvalid=preferences.load();
  assert.throws(()=>preferences.save({language:'Esperanto'}));
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

test('new settings survive reopening',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'new-settings-preferences-'));
 try{
  const path=join(dir,'reader.json'),preferences=await createReaderPreferences(path);
  const expected=withPreferences({language:'Korean',concurrency:12,pageConcurrency:12,automatic:false,layoutVisible:true});
  await preferences.save({language:'Korean',concurrency:12,pageConcurrency:12,automatic:false,layoutVisible:true});
  await preferences.flush();
  assert.deepEqual((await createReaderPreferences(path)).load(),expected);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('kernel advanced options persist across a new app instance',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'kernel-advanced-preferences-'));
 try{
  const path=join(dir,'reader.json'),preferences=await createReaderPreferences(path);
  const kernelAdvancedOptions={pdf_math_fast:{option_dest:'fast',threads:2},pdf_math_precise:{option_dest:'precise',use_cache:true}};
  await preferences.save({kernelAdvancedOptions});
  const reopened=(await createReaderPreferences(path)).load();
  assert.deepEqual(reopened.kernelAdvancedOptions,kernelAdvancedOptions);
  assert.notEqual(reopened.kernelAdvancedOptions.pdf_math_fast,reopened.kernelAdvancedOptions.pdf_math_precise);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('invalid nested kernel advanced options are rejected without changing state',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'kernel-advanced-invalid-preferences-'));
 try{
  const path=join(dir,'reader.json'),preferences=await createReaderPreferences(path);
  const withProto=JSON.parse('{"pdf_math_fast":{"__proto__":true}}');
  const invalid=[
   null,[],{pdf_inspector:{}},{pdf_math_fast:null},{pdf_math_fast:[]},{pdf_math_fast:{Bad:1}},
   {pdf_math_fast:{_bad:1}},{pdf_math_fast:{constructor:1}},{pdf_math_fast:{prototype:1}},withProto,
   {pdf_math_fast:{option_dest:NaN}},{pdf_math_fast:{option_dest:Infinity}},{pdf_math_fast:{option_dest:{}}},
   {pdf_math_fast:{option_dest:'x'.repeat(4001)}}
  ];
  for(const kernelAdvancedOptions of invalid)assert.throws(()=>preferences.save({kernelAdvancedOptions}),/Invalid kernel advanced options/);
  assert.deepEqual(preferences.load(),withPreferences());
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('kernel advanced option maps are isolated from save and load mutations',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'kernel-advanced-mutation-preferences-'));
 try{
  const path=join(dir,'reader.json'),preferences=await createReaderPreferences(path);
  const kernelAdvancedOptions={pdf_math_fast:{option_dest:'fast'},pdf_math_precise:{option_dest:'precise'}};
  await preferences.save({kernelAdvancedOptions});
  kernelAdvancedOptions.pdf_math_fast.option_dest='changed';
  kernelAdvancedOptions.pdf_math_precise.injected=true;
  const loaded=preferences.load();
  assert.deepEqual(loaded.kernelAdvancedOptions,{pdf_math_fast:{option_dest:'fast'},pdf_math_precise:{option_dest:'precise'}});
  loaded.kernelAdvancedOptions.pdf_math_fast.option_dest='changed';
  loaded.kernelAdvancedOptions.pdf_math_precise.injected=true;
  assert.deepEqual(preferences.load().kernelAdvancedOptions,{pdf_math_fast:{option_dest:'fast'},pdf_math_precise:{option_dest:'precise'}});
  assert.deepEqual((await createReaderPreferences(path)).load().kernelAdvancedOptions,{pdf_math_fast:{option_dest:'fast'},pdf_math_precise:{option_dest:'precise'}});
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('unrelated saves merge defaults while preserving current kernel maps',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'kernel-advanced-partial-preferences-'));
 try{
  const path=join(dir,'reader.json'),preferences=await createReaderPreferences(path);
  const kernelAdvancedOptions={pdf_math_fast:{option_dest:'fast'},pdf_math_precise:{option_dest:'precise'}};
  await preferences.save({kernelAdvancedOptions,autoHideHeader:false,uiLanguage:'zh-CN'});
  await preferences.save({fit:'height',zoom:.8});
  assert.deepEqual((await createReaderPreferences(path)).load(),withPreferences({fit:'height',zoom:.8,kernelAdvancedOptions,autoHideHeader:false,uiLanguage:'zh-CN'}));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('header visibility and UI language preferences persist and reject invalid values',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'header-language-preferences-'));
 try{
  const path=join(dir,'reader.json'),preferences=await createReaderPreferences(path);
  assert.equal(preferences.load().autoHideHeader,true);
  assert.equal(preferences.load().uiLanguage,'en');
  await preferences.save({autoHideHeader:false,uiLanguage:'zh-CN'});
  assert.deepEqual((await createReaderPreferences(path)).load(),withPreferences({autoHideHeader:false,uiLanguage:'zh-CN'}));
  assert.throws(()=>preferences.save({autoHideHeader:'yes'}),/Invalid auto-hide header preference/);
  assert.throws(()=>preferences.save({uiLanguage:'unsupported'}),/Invalid UI language preference/);
  assert.deepEqual(preferences.load(),withPreferences({autoHideHeader:false,uiLanguage:'zh-CN'}));
  await preferences.save({autoHideHeader:true,uiLanguage:'ja'});
  assert.deepEqual((await createReaderPreferences(path)).load(),withPreferences({autoHideHeader:true,uiLanguage:'ja'}));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('interaction mode persists, rejects invalid values, and defaults legacy files to comparison',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'interaction-mode-preferences-'));
 try{
  const path=join(dir,'reader.json'),preferences=await createReaderPreferences(path);
  assert.equal(preferences.load().interactionMode,'comparison');
  await preferences.save({interactionMode:'reading'});
  assert.equal((await createReaderPreferences(path)).load().interactionMode,'reading');
  assert.throws(()=>preferences.save({interactionMode:'invalid'}),/Invalid interaction mode/);
  assert.equal(preferences.load().interactionMode,'reading');
  await writeFile(path,JSON.stringify({engine:'pdf_math_precise',fit:'manual',interactionMode:'invalid'}));
  assert.equal((await createReaderPreferences(path)).load().interactionMode,'comparison');
  await writeFile(path,JSON.stringify({engine:'pdf_math_precise',fit:'manual'}));
  assert.equal((await createReaderPreferences(path)).load().interactionMode,'comparison');
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('source language migrates from Fast advanced settings and persists across kernels',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'reader-source-language-')),path=join(dir,'preferences.json');
 try{
  await writeFile(path,JSON.stringify({kernelAdvancedOptions:{pdf_math_fast:{lang_in:'fr',vfont:'math'}}}));
  const preferences=await createReaderPreferences(path);
  assert.equal(preferences.load().sourceLanguage,'French');
  assert.deepEqual(preferences.load().kernelAdvancedOptions.pdf_math_fast,{vfont:'math'});
  await preferences.save({sourceLanguage:'Japanese',engine:'pdf_math_precise'});
  assert.equal((await createReaderPreferences(path)).load().sourceLanguage,'Japanese');
  assert.throws(()=>preferences.save({sourceLanguage:'invalid'}),/Invalid source language/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('all seven interface languages survive save and reopen',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'reader-seven-locales-')),path=join(dir,'preferences.json');
 try{for(const uiLanguage of ['en','zh-CN','zh-TW','fr','es','ja','ko']){
  const preferences=await createReaderPreferences(path);await preferences.save({uiLanguage});
  assert.equal((await createReaderPreferences(path)).load().uiLanguage,uiLanguage);
 }}finally{await rm(dir,{recursive:true,force:true});}
});

test('startup restoration defaults on and persists an explicit opt-out',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'reader-preferences-'));try{
 const path=join(dir,'prefs.json'),prefs=await createReaderPreferences(path);assert.equal(prefs.load().restoreDocuments,true);
 await prefs.save({restoreDocuments:false});assert.equal((await createReaderPreferences(path)).load().restoreDocuments,false);
 assert.throws(()=>prefs.save({restoreDocuments:'false'}));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('translation reuse defaults on and persists an explicit opt-out',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'reader-preferences-'));try{
 const path=join(dir,'prefs.json'),prefs=await createReaderPreferences(path);assert.equal(prefs.load().reuseTranslations,true);
 await prefs.save({reuseTranslations:false});assert.equal((await createReaderPreferences(path)).load().reuseTranslations,false);
 assert.throws(()=>prefs.save({reuseTranslations:'false'}),/Invalid translation reuse preference/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
