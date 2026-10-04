import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderPixelRatio,scrollPixelRatio} from '../src/render-resolution.mjs';

test('scrolling preserves native screen density for ordinary PDF pages',()=>{
 for(const screenRatio of [1,1.5,2,3]){
  assert.equal(scrollPixelRatio(500,700,screenRatio),screenRatio);
  assert.equal(scrollPixelRatio(900,1200,screenRatio),renderPixelRatio(900,1200,screenRatio,false));
 }
 assert.equal(scrollPixelRatio(800,1100,2),2);
});

test('scrolling oversized pages stays within the preview memory and dimension limits',()=>{
 for(const [width,height] of [[4000,6000],[500,40000]]){
  const ratio=scrollPixelRatio(width,height,3);
  assert.ok(width*height*ratio*ratio*4<=16*1024*1024+1);
  assert.ok(Math.max(width,height)*ratio<=16384);
  assert.ok(ratio<=renderPixelRatio(width,height,3,true));
 }
});

test('large pages remain bounded by backing store memory and canvas dimensions',()=>{
 for(const visible of [true,false])for(const [width,height] of [[4000,6000],[500,40000]]){
  const ratio=renderPixelRatio(width,height,3,visible);
  assert.ok(width*height*ratio*ratio*4<=(visible?64:16)*1024*1024+1);
  assert.ok(Math.max(width,height)*ratio<=16384);
 }
});
