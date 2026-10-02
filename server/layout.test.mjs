import {test} from 'node:test';
import assert from 'node:assert/strict';
import {paragraphs} from './layout.mjs';
const run=(text,x,y,w=100)=>({text,x,y,width:w,height:12,fontSize:12});
test('flips visible page coordinates and joins lines without merging columns',()=>{
 const blocks=paragraphs([run('Left first',40,700),run('Right first',330,700),run('Left next',40,684),run('Right next',330,684)],792);
 assert.equal(blocks.length,2);assert.equal(blocks[0].text,'Left first Left next');assert.equal(blocks[1].text,'Right first Right next');assert.equal(blocks[0].y,80);assert.equal(blocks[0].height,28);
});
test('separates paragraph gaps and removes non-text and rotated runs',()=>{
 const blocks=paragraphs([run('One',40,700),run('Two',40,650),{...run('Rotated',50,500),rotation:90},{...run('Image',50,400),itemType:'Image'}],792);assert.equal(blocks.length,2);
});

test('indented first lines do not leave wrapped source text outside paragraph coverage',()=>{
 const source=[run('Indented first line',56,700,140),run('Wrapped second line',40,684,150),run('Wrapped third line',40,668,160)];
 const blocks=paragraphs(source,792);assert.equal(blocks.length,1);
 const block=blocks[0];assert.equal(block.x,40);assert.equal(block.width,160);assert.equal(block.y,80);assert.equal(block.height,44);
 for(const item of source){assert.ok(block.x<=item.x);assert.ok(block.x+block.width>=item.x+item.width);assert.ok(block.y<=792-item.y-item.height);assert.ok(block.y+block.height>=792-item.y);}
});
test('hanging indentation retains the full union without swallowing another column',()=>{
 const blocks=paragraphs([run('First',40,700,100),run('Indented continuation',56,684,150),run('Final',40,668,100),run('Other column',330,684,100)],792);
 assert.equal(blocks.length,2);assert.equal(blocks[0].x,40);assert.equal(blocks[0].width,166);assert.equal(blocks[1].x,330);
});
test('same-line runs with slightly different baselines preserve their leftmost bounds',()=>{
 const blocks=paragraphs([run('Earlier',42,701,50),run('Lower',40,700,100)],792);
 assert.equal(blocks.length,1);assert.equal(blocks[0].x,40);assert.equal(blocks[0].width,100);assert.equal(blocks[0].y,79);assert.equal(blocks[0].height,13);
});
