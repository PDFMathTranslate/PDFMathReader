import test from 'node:test';
import assert from 'node:assert/strict';
import {annotationDisplaysTranslation,annotationLineRects,annotationRailX,annotationNotePositions} from '../src/annotation-display.mjs';

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
