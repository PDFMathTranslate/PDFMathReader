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

test('centered title lines share one translation box despite different left edges',()=>{
 const title=(text,x,y,width)=>({...run(text,x,y,width),height:24,fontSize:24,isBold:true});
 const source=[title('Using Synthetic Controls:',160,680,292),title('Feasibility, Data Requirements, and',90,650,432),title('Methodological Aspects',170,620,272)];
 const blocks=paragraphs([...source,run('Author',250,580,100)],792);
 assert.equal(blocks.length,2);
 assert.equal(blocks[0].text,'Using Synthetic Controls: Feasibility, Data Requirements, and Methodological Aspects');
 assert.equal(blocks[0].textAlign,'center');
 assert.equal(blocks[0].x,90);assert.equal(blocks[0].width,432);assert.equal(blocks[0].height,84);
 for(const item of source){assert.ok(blocks[0].x<=item.x);assert.ok(blocks[0].x+blocks[0].width>=item.x+item.width);}
});

test('overlapping horizontal extents alone do not merge differently centered headings',()=>{
 const title=(text,x,y,width)=>({...run(text,x,y,width),height:24,fontSize:24,isBold:true});
 const blocks=paragraphs([title('First heading',50,680,260),title('Separate heading',140,650,300)],792);
 assert.equal(blocks.length,2);
});

test('repeated first-line indentation starts new paragraphs at ordinary line spacing',()=>{
 const blocks=paragraphs([run('First opening',56,700,184),run('First continuation',40,684,200),run('First ending',40,668,200),run('Second opening',56,652,184),run('Second ending',40,636,200)],792);
 assert.equal(blocks.length,2);assert.equal(blocks[0].text,'First opening First continuation First ending');assert.equal(blocks[1].text,'Second opening Second ending');
});

test('short sentence-ending lines separate flush-left paragraphs',()=>{
 const blocks=paragraphs([run('Long opening',40,700,200),run('Ends here.',40,684,90),run('Next paragraph',40,668,200),run('Continues here',40,652,200)],792);
 assert.equal(blocks.length,2);assert.equal(blocks[0].text,'Long opening Ends here.');
});

test('full-width sentence endings still wrap within a paragraph',()=>{
 const blocks=paragraphs([run('Opening sentence.',40,700,200),run('Next sentence.',40,684,200),run('Another sentence.',40,668,200)],792);
 assert.equal(blocks.length,1);
});

test('learned line spacing detects modest paragraph gaps',()=>{
 const blocks=paragraphs([run('First',40,700,200),run('Second',40,684,200),run('Third',40,668,200),run('Fourth',40,652,200),run('New paragraph',40,631,200),run('Continuation',40,615,200)],792);
 assert.equal(blocks.length,2);assert.equal(blocks[1].text,'New paragraph Continuation');
});

test('list items stay separate while wrapped item text stays together',()=>{
 const blocks=paragraphs([run('1. First item',40,700,200),run('Continuation',50,684,190),run('2. Second item',40,668,200),run('Continuation',50,652,190)],792);
 assert.equal(blocks.length,2);assert.equal(blocks[0].text,'1. First item Continuation');
});

test('ordinary body lines cannot merge solely through matching centers',()=>{
 const blocks=paragraphs([run('Body paragraph',40,700,200),run('Different paragraph',70,684,140)],792);
 assert.equal(blocks.length,2);
});
