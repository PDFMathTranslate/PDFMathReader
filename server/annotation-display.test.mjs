import test from 'node:test';
import assert from 'node:assert/strict';
import {annotationDisplaysTranslation,annotationLineRects,annotationRailX,annotationNotePositions} from '../src/annotation-display.mjs';

test('overlapping text runs form one highlight line without changing saved rectangles',()=>{
 const rects=[{x:10,y:100,width:300,height:20},{x:10,y:108,width:300,height:14},{x:10,y:140,width:160,height:22}];
 const original=structuredClone(rects);
 assert.deepEqual(annotationLineRects(rects),[{x:10,y:100,width:300,height:22},rects[2]]);
 assert.deepEqual(rects,original);
});

test('font metric variations merge across a line while separate lines stay separate',()=>{
 assert.deepEqual(annotationLineRects([{x:70,y:12,width:40,height:10},{x:10,y:10,width:60,height:16},{x:10,y:30,width:100,height:16}]),[
  {x:10,y:10,width:100,height:16},{x:10,y:30,width:100,height:16}
 ]);
});

test('whole-page translation loaded while viewing original does not hide source highlights',()=>{
 const block={math:true,translation:'Translated paragraph',translated:true};
 const page={mathDocument:{},blocks:[block]};
 assert.equal(annotationDisplaysTranslation(page,false,block),false);
 assert.equal(annotationDisplaysTranslation(page,true,block),true);
 assert.equal(annotationDisplaysTranslation(page,false,block),false);
 assert.equal(annotationDisplaysTranslation(page,false,undefined),false);
 assert.equal(annotationDisplaysTranslation(page,true,undefined),true);
});

test('paragraph annotations follow their own rendered overlay, not another translated paragraph',()=>{
 const translated={translation:'Translated',translated:true};
 const original={translation:'Translated',translated:false};
 const page={blocks:[translated,original]};
 assert.equal(annotationDisplaysTranslation(page,true,undefined),false);
 assert.equal(annotationDisplaysTranslation(page,true,original),false);
 assert.equal(annotationDisplaysTranslation(page,true,translated),true);
 assert.equal(annotationDisplaysTranslation(page,true,{translation:'',translated:true}),false);
});

test('page marker rail clears text and keeps the complete button within the page at every zoom',()=>{
 for(const zoom of [.5,1,2,4]){
  assert.equal(annotationRailX(600,450,zoom),450+8/zoom);
  const edge=annotationRailX(600,598,zoom);
  assert.equal(edge+34/zoom+8/zoom,600);
 }
});

test('overlapping markers stack vertically and pull upward at the page bottom',()=>{
 const notes=[{id:'b',y:100},{id:'a',y:100},{id:'c',y:110}];
 assert.deepEqual([...annotationNotePositions(notes,600,1)],[['a',100],['b',140],['c',180]]);
 const bottom=annotationNotePositions([{id:'a',y:570},{id:'b',y:570}],600,1);
 assert.deepEqual([...bottom],[['a',526],['b',566]]);
 assert.deepEqual(notes,[{id:'b',y:100},{id:'a',y:100},{id:'c',y:110}]);
 assert.deepEqual([...annotationNotePositions([{id:'a',y:100},{id:'b',y:100}],600,2)],[['a',100],['b',120]]);
});
