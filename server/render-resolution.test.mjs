import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderPixelRatio,scrollPixelRatio} from '../src/render-resolution.mjs';

test('large pages remain bounded by backing store memory and canvas dimensions',()=>{
 for(const visible of [true,false])for(const [width,height] of [[4000,6000],[500,40000]]){
  const ratio=renderPixelRatio(width,height,3,visible);
  assert.ok(width*height*ratio*ratio*4<=(visible?64:16)*1024*1024+1);
  assert.ok(Math.max(width,height)*ratio<=16384);
 }
});
