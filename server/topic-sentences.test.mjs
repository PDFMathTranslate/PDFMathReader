import {test} from 'node:test';
import assert from 'node:assert/strict';
import {topicParagraphBoxes,topicSentenceLength,topicSentenceRanges} from '../src/topic-sentences.mjs';
import {paragraphs} from './layout.mjs';

test('topic sentences start on indented first lines and use original or translated paragraph boundaries',()=>{
 const run=(text,x,y,width=250)=>({text,x,y,width,height:10,fontSize:10});
 const first='我关于审查如何影响个体的发现，或许可以解释为何';
 const middle='我们看到许多政权采用多孔的审查策略，尽管这些方法容';
 const last='易被规避。虽然许多人会认为少数有能力的公民能够绕过审查。';
 const tail='后续内容说明同一段落中的具体论据。'.repeat(8);
 const runs=[run(first,88,124,230),run(middle,67,138),run(last,67,152),run(tail,67,166),
  run('另一个段落的首句',88,180,230),run('在下一行结束。'+tail,67,194)];
 const expected=[{index:0,start:0,end:first.length},{index:1,start:0,end:middle.length},
  {index:2,start:0,end:'易被规避。'.length},{index:4,start:0,end:runs[4].text.length},
  {index:5,start:0,end:'在下一行结束。'.length}];
 assert.deepEqual(topicSentenceRanges(runs,[],'zh'),expected,'returning from first-line indent must not discard the paragraph start');
 const detected=paragraphs(runs.map(r=>({...r,y:300-r.y-r.height})),300);
 assert.equal(detected.length,2,'Inspector must keep indented first lines in their paragraphs');
 assert.deepEqual(topicSentenceRanges(runs,topicParagraphBoxes(detected),'zh'),expected);
 const blocks=[
  {id:'first',math:true,sourceBox:{x:400,y:124,width:260,height:54},translatedBox:{x:67,y:124,width:260,height:54}},
  {id:'second',math:true,sourceBox:{x:400,y:180,width:260,height:24},translatedBox:{x:67,y:180,width:260,height:24}}
 ];
 const translated=topicParagraphBoxes(blocks,true),original=topicParagraphBoxes(blocks);
 assert.equal(translated.length,2,'math kernel paragraphs must supply their bounds');
 assert.equal(translated[0].id,'first');assert.equal(translated[0].x,67);assert.equal(original[0].x,400);
 assert.deepEqual(topicSentenceRanges(runs,translated,'zh'),expected);
 assert.deepEqual(topicSentenceRanges(runs.map(r=>({...r,x:r.x+333})),original,'zh'),expected);
 const columns=[runs[0],run('右栏首句。'+tail,400,124),...runs.slice(1,4)];
 assert.deepEqual(topicSentenceRanges(columns,[translated[0],{id:'right',x:400,y:124,width:260,height:54}],'zh'),[
  expected[0],{index:1,start:0,end:'右栏首句。'.length},{...expected[1],index:2},{...expected[2],index:3}
 ]);
 const smallFootnote=run('14 See the citation. Another short sentence.',67,218);
 assert.deepEqual(topicSentenceRanges([...runs,{...smallFootnote,height:7,fontSize:7}],[],'zh'),expected);
 const continuation=run('众所周知会引发公众反弹。'+tail,67,50);
 const footnote=run('14 See Diamond (2015, p. 151). '+Array(65).fill('citation').join(' ')+'. Another note.',67,220);
 const pageBlocks=[
  {id:'continued',text:'known to spark popular backlash. More discussion.',fontSize:10,translatedBox:{x:67,y:50,width:260,height:10}},
  ...blocks.map(b=>({...b,text:'My findings explain censorship. '+tail,fontSize:10})),
  {id:'note',text:footnote.text,fontSize:7,translatedBox:{x:67,y:220,width:260,height:7}}
 ];
 assert.deepEqual(topicSentenceRanges([continuation,...runs,{...footnote,height:7,fontSize:7}],topicParagraphBoxes(pageBlocks,true),'zh'),expected.map(r=>({...r,index:r.index+1})),
  'page continuations and numbered small-font notes must not become topic sentences');
 assert.equal(topicParagraphBoxes([{...pageBlocks[2],text:'2026 results show a change.'}],true)[0].eligible,true,'body text beginning with a number remains eligible');
 assert.equal(topicSentenceLength('这是短段落的首句。后面还有一句。','zh'),0);
 assert.equal(topicSentenceLength('这是一个没有分句的长句'.repeat(15)+'。','zh'),0);
});
