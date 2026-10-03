import {test} from 'node:test';
import assert from 'node:assert/strict';
import {motionCanvasSize,rectangleTransform} from '../src/document-motion.mjs';

test('Windows motion textures bound large PDF backing stores and preserve aspect ratio',()=>{
 const size=motionCanvasSize(8000,12000);
 assert.ok(size.width*size.height<=2*1024*1024);
 assert.ok(Math.abs(size.width/size.height-2/3)<.001);
 assert.deepEqual(motionCanvasSize(640,900),{width:640,height:900});
 const wide=motionCanvasSize(12000,8000);
 assert.ok(wide.width*wide.height<=2*1024*1024);
 assert.ok(Math.abs(wide.width/wide.height-1.5)<.002);
});

test('snapshot pixel resolution does not affect document corner mapping',()=>{
 assert.equal(rectangleTransform({left:100,top:80,width:600,height:900},{left:20,top:10,width:120,height:180}),
  'translate(-80px, -70px) scale(0.2, 0.2)');
});
