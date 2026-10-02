import {test} from 'node:test';
import assert from 'node:assert/strict';
import {searchSegments} from '../src/document-search.mjs';
test('PDF search spans text runs, ignores layout whitespace, and keeps matching coordinates',()=>{
 const a={x:10,y:20,width:30,height:12},b={x:40,y:20,width:30,height:12};
 const segments=[{text:'Hello ',box:a},{text:'WORLD',box:b},{text:'hello world',box:a}];
 assert.deepEqual(searchSegments(segments,'hello world').map(m=>m.boxes),[[a,b],[a]]);
 assert.equal(searchSegments([{text:'译 文Ａ',box:a}],'译文a').length,1);
 assert.deepEqual(searchSegments(segments,' '),[]);
});
