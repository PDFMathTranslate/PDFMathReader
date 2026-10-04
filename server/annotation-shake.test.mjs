import assert from 'node:assert/strict';
import test from 'node:test';
import {createAnnotationShake,updateAnnotationShake} from '../src/annotation-shake.mjs';

function pointFor(axis,offset,x=100,y=200){
 if(axis==='x')return [x+offset,y];
 return [x,y+offset];
}

for(const axis of ['x','y'])for(const startingDirection of [1,-1]){
 test(`${axis} shake recognizes both back-and-forth cycles from ${startingDirection > 0 ? 'positive' : 'negative'} movement`,()=>{
  const state=createAnnotationShake(100,200),results=[];
  for(const offset of [0,80,-80,80,-80])results.push(updateAnnotationShake(state,...pointFor(axis,startingDirection*offset)));
  assert.deepEqual(results,[false,false,false,false,true]);
  assert.equal(updateAnnotationShake(state,...pointFor(axis,startingDirection*80)),true);
 });
}

test('fine-grained 4 px steps recognize reversals at the 12 px threshold',()=>{
 const state=createAnnotationShake(100,200),results=[];
 for(const x of [104,108,112,108,104,100,104,108,112,108,104,100])results.push(updateAnnotationShake(state,x,200));
 assert.deepEqual(results.slice(0,-1),Array(11).fill(false));
 assert.equal(results.at(-1),true);
});

test('monotonic movement never recognizes a shake',()=>{
 const state=createAnnotationShake(0,0);
 for(const x of [1,6,12,24,48,96,192])assert.equal(updateAnnotationShake(state,x,0),false);
});

test('jitter below the 12 px reversal threshold never recognizes a shake',()=>{
 const state=createAnnotationShake(0,0),results=[];
 for(const x of [12,1,12,2,12,3,12,4,12])results.push(updateAnnotationShake(state,x,0));
 assert.deepEqual(results,Array(results.length).fill(false));
});

test('one shake with only two reversals does not recognize',()=>{
 const state=createAnnotationShake(0,0);
 for(const x of [80,-80,80])assert.equal(updateAnnotationShake(state,x,0),false);
});

test('reversals split across axes do not combine into a shake',()=>{
 const state=createAnnotationShake(0,0),results=[];
 for(const point of [[20,0],[-20,0],[20,0],[20,20],[20,-20],[20,20]])results.push(updateAnnotationShake(state,...point));
 assert.deepEqual(results,Array(results.length).fill(false));
});
