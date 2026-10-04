import {test} from 'node:test';
import assert from 'node:assert/strict';
import {searchSegments} from '../src/document-search.mjs';
test('PDF search spans text runs, ignores layout whitespace, and keeps matching coordinates',()=>{
 const a={x:10,y:20,width:30,height:12},b={x:40,y:20,width:30,height:12};
 const segments=[{text:'Hello ',box:a},{text:'WORLD',box:b},{text:'hello world',box:a}];
 assert.deepEqual(searchSegments(segments,'helloworld').map(m=>m.boxes),[[a,b],[a]]);
 assert.equal(searchSegments([{text:'译 文Ａ',box:a}],'译文a').length,1);
 assert.deepEqual(searchSegments(segments,' '),[]);
 const first={},second={};
 const paragraphs=[{text:'2017: other words ',box:a,block:first},{text:'Miller',box:b,block:first},{text:'Miller only',box:a,block:second}];
 assert.deepEqual(searchSegments(paragraphs,'Miller 2017').map(m=>m.boxes),[[a,b]]);
 assert.equal(searchSegments(paragraphs,'2017 Miller Miller').length,1);
 assert.equal(searchSegments([{text:'Miller',box:a,block:first},{text:'2017',box:b,block:second}],'Miller 2017').length,0);

});
