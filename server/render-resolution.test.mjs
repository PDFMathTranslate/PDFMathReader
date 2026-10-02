import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderPixelRatio} from '../src/render-resolution.mjs';
test('visible zoomed pages retain Retina resolution beyond the old 16 MiB limit',()=>{
 assert.equal(renderPixelRatio(1600,2200,2,true),2);
 assert.ok(renderPixelRatio(1600,2200,2,false)<2);
 assert.equal(renderPixelRatio(800,1100,3,true),3);
});
test('large pages remain bounded by backing store memory and canvas dimensions',()=>{
 for(const visible of [true,false])for(const [width,height] of [[4000,6000],[500,40000]]){
  const ratio=renderPixelRatio(width,height,3,visible);
  assert.ok(width*height*ratio*ratio*4<=(visible?64:16)*1024*1024+1);
  assert.ok(Math.max(width,height)*ratio<=16384);
 }
});
