import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createReaderPreferences} from '../electron/preferences.mjs';
import {cloneTranslationServiceHistory,createTranslationServiceHistoryTracker,isValidTranslationServiceHistory,mergeTranslationServiceHistory} from '../src/provider-history.mjs';
test('history records only explicit outcomes, protects newer requests and invalidates changed configurations',()=>{
 let now=100;const tracker=createTranslationServiceHistoryTracker({now:()=>now});
 const older=tracker.begin({kernel:'pdf_math_fast',service:'openai',epoch:1});now++;
 const newer=tracker.begin({kernel:'pdf_math_fast',service:'openai',epoch:1});
 assert.equal(tracker.record(older,null,1),false);
 assert.equal(tracker.record(newer,'success',1),true);
 tracker.load(tracker.snapshot());assert.equal(tracker.record(older,'error',1),false);
 const pending=tracker.begin({kernel:'pdf_math_fast',service:'openai',epoch:1});tracker.reset('pdf_math_fast','openai');
 assert.equal(tracker.record(pending,'error',1),false);
 const current=tracker.begin({kernel:'pdf_math_fast',service:'openai',epoch:2});
 assert.equal(tracker.record(current,'error',1),false);assert.equal(tracker.record(current,'error',2),true);
 assert.equal(tracker.snapshot().pdf_math_fast.openai.status,'error');
 const recovery=tracker.begin({kernel:'pdf_math_fast',service:'openai',epoch:2});assert.equal(tracker.record(recovery,'success',2),true);
 assert.equal(tracker.snapshot().pdf_math_fast.openai.status,'success');
 assert.equal(tracker.begin({kernel:'unknown',service:'openai'}),null);assert.equal(tracker.begin({kernel:'pdf_inspector',service:'__proto__'}),null);
});
test('history patches isolate kernels/services, sanitize records and reject stale cross-window outcomes',()=>{
 const stored={pdf_inspector:{openai:{status:'success',updatedAt:20}},pdf_math_fast:{openai:{status:'error',updatedAt:10}}};
 const merged=mergeTranslationServiceHistory(stored,{pdf_inspector:{openai:{status:'error',updatedAt:19},custom:{status:'error',updatedAt:21}}});
 assert.equal(merged.pdf_inspector.openai.status,'success');assert.equal(merged.pdf_math_fast.openai.status,'error');
 const reset=mergeTranslationServiceHistory(merged,{pdf_inspector:{custom:null}});assert.equal(reset.pdf_inspector.custom,undefined);assert.equal(reset.pdf_inspector.openai.status,'success');
 const unsafe={pdf_inspector:{openai:{status:'error',updatedAt:5,message:'private-fixture',key:'private-fixture'}}};
 assert.equal(isValidTranslationServiceHistory(unsafe),false);assert(!JSON.stringify(cloneTranslationServiceHistory(unsafe)).includes('private-fixture'));
 assert.equal(isValidTranslationServiceHistory({pdf_inspector:{openai:{status:'error',updatedAt:Infinity}}}),false);
});
test('shared preferences merge independent history patches and persist only outcomes and timestamps',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'provider-history-'));const path=join(directory,'preferences.json');
 try{
  const preferences=await createReaderPreferences(path);
  await Promise.all([preferences.save({translationServiceHistory:{pdf_inspector:{openai:{status:'error',updatedAt:10}}}}),preferences.save({translationServiceHistory:{pdf_math_fast:{openai:{status:'success',updatedAt:11}}}})]);
  await preferences.save({translationServiceHistory:{pdf_inspector:{openai:{status:'success',updatedAt:12}}}});
  await preferences.save({translationServiceHistory:{pdf_inspector:{openai:{status:'error',updatedAt:9}}}});
  let reloaded=await createReaderPreferences(path);assert.equal(reloaded.load().translationServiceHistory.pdf_inspector.openai.status,'success');assert.equal(reloaded.load().translationServiceHistory.pdf_math_fast.openai.status,'success');
  await preferences.save({translationServiceHistory:{pdf_inspector:{openai:null}}});reloaded=await createReaderPreferences(path);assert.equal(reloaded.load().translationServiceHistory.pdf_inspector,undefined);
  const stored=JSON.parse(await readFile(path,'utf8'));assert.deepEqual(Object.keys(stored.translationServiceHistory.pdf_math_fast.openai).sort(),['status','updatedAt']);
  assert.throws(()=>preferences.save({translationServiceHistory:{pdf_inspector:{openai:{status:'error',updatedAt:2,key:'private-fixture'}}}}));
 }finally{await rm(directory,{recursive:true,force:true});}
});
