import test from 'node:test';
import assert from 'node:assert/strict';
import {translationPages} from '../src/translation-scope.mjs';

test('keeps the legacy reading order and clips boundaries',()=>{
 assert.deepEqual(translationPages('reading',3,5),[3,4,2,5,1]);
 assert.deepEqual(translationPages('reading',1,2),[1,2]);
 assert.deepEqual(translationPages('reading',5,5),[5,4,3]);
 assert.deepEqual(translationPages('reading',1,0),[]);
});

test('prioritizes a jumped viewport and its next screen after settling',()=>{
 const options={visible:[8,9,9,0,30],ahead:[10,11,8],direction:1,moving:false};
 assert.deepEqual(translationPages('reading',9,20,options),[9,8,10,11,7]);
});

test('moving translation stays limited to the current page and viewport',()=>{
 assert.deepEqual(translationPages('reading',9,20,{visible:[8,9,10],ahead:[11,12],direction:1,moving:true}),[9,8,10]);
});

test('backward reading prioritizes pages behind the viewport before opposite neighbors',()=>{
 assert.deepEqual(translationPages('reading',10,20,{visible:[9,10],ahead:[8,7],direction:-1,moving:false}),[10,9,8,7,11,12]);
});

test('multicolumn viewport order is retained while the current page stays first',()=>{
 assert.deepEqual(translationPages('reading',6,12,{visible:[5,6,7,8],ahead:[9,10],direction:1,moving:true}),[6,5,7,8]);
 assert.deepEqual(translationPages('reading',6,12,{visible:[5,6,7,8],ahead:[9,10],direction:1,moving:false}),[6,5,7,8,9,10,4]);
});

test('full translation prioritizes current, viewport, and ahead pages',()=>{
 assert.deepEqual(translationPages('full',5,8,{visible:[3,5,4],ahead:[7,6,3]}),[5,3,4,7,6,1,2,8]);
 assert.deepEqual(translationPages('full',1,3),[1,2,3]);
});
