import {test} from 'node:test';
import assert from 'node:assert/strict';
import {paragraphs} from './layout.mjs';
const run=(text,x,y,w=100)=>({text,x,y,width:w,height:12,fontSize:12});
test('flips visible page coordinates and joins lines without merging columns',()=>{
 const blocks=paragraphs([run('Left first',40,700),run('Right first',330,700),run('Left next',40,684),run('Right next',330,684)],792);
 assert.equal(blocks.length,2);assert.equal(blocks[0].text,'Left first Left next');assert.equal(blocks[1].text,'Right first Right next');assert.equal(blocks[0].y,80);assert.equal(blocks[0].height,28);
});
