import {test} from 'node:test';
import assert from 'node:assert/strict';
import {firstSentenceLength,topicSentenceRanges} from '../src/topic-sentences.mjs';

const run=(text,x,y,width=160,height=10,extra={})=>({text,x,y,width,height,fontSize:extra.fontSize??height,...extra});

test('firstSentenceLength keeps leading offsets, closes quotes, and handles abbreviations and decimals',()=>{
 const text='  Dr. Smith reports 3.14. “Next sentence.”';
 assert.equal(firstSentenceLength(text), '  Dr. Smith reports 3.14.'.length);
 assert.equal(firstSentenceLength('Hello.”   Next.'), 'Hello.”'.length);
 assert.equal(firstSentenceLength('「这是第一句。」下一句。', 'en_US'), '「这是第一句。」'.length);
 assert.equal(firstSentenceLength('Dr. Smith reports 3.14. Next.', 'en_US'), 'Dr. Smith reports 3.14.'.length);
});

test('firstSentenceLength segments CJK sentences',()=>{
 assert.equal(firstSentenceLength('这是第一句。第二句。','zh'), '这是第一句。'.length);
 assert.equal(firstSentenceLength('첫 문장입니다. 다음 문장입니다.','ko'), '첫 문장입니다.'.length);
});

test('topicSentenceRanges limits a single run to its first sentence',()=>{
 const text='First sentence. Second sentence.';
 assert.deepEqual(topicSentenceRanges([run(text,10,10)]), [{index: 0, start: 0, end: 'First sentence.'.length}]);
});

test('topicSentenceRanges joins same-paragraph lines and maps offsets back to runs',()=>{
 const runs=[
  run('First sentence starts',20,10),
  run('on the next line.',20,22),
  run('Second sentence.',20,34)
 ];
 assert.deepEqual(topicSentenceRanges(runs), [
  {index: 0, start: 0, end: runs[0].text.length},
  {index: 1, start: 0, end: runs[1].text.length}
 ]);
});

test('topicSentenceRanges keeps CJK line joins unspaced and preserves decimal abbreviations',()=>{
 const runs=[run('Dr. Smith uses 3.14.',10,10),run('这是下一句。',10,22)];
 assert.deepEqual(topicSentenceRanges(runs), [{index: 0, start: 0, end: runs[0].text.length}]);
 const cjk=[run('这是第一句',10,10),run('继续。第二句。',10,22)];
 assert.deepEqual(topicSentenceRanges(cjk), [
  {index: 0, start: 0, end: cjk[0].text.length},
  {index: 1, start: 0, end: '继续。'.length}
 ]);
});

test('topicSentenceRanges uses explicit paragraph boxes for overlapping columns',()=>{
 const runs=[
  run('Left starts',10,10,80),
  run('Right starts',210,10,80),
  run('left ends. Left next.',10,22,80),
  run('right ends. Right next.',210,22,80)
 ];
 const boxes=[
  {id:'left',x:0,y:0,width:100,height:60},
  {id:'right',x:200,y:0,width:100,height:60}
 ];
 assert.deepEqual(topicSentenceRanges(runs,boxes), [
  {index:0,start:0,end:runs[0].text.length},
  {index:2,start:0,end:'left ends.'.length},
  {index:1,start:0,end:runs[1].text.length},
  {index:3,start:0,end:'right ends.'.length}
 ].sort((a,b)=>a.index-b.index));
});

test('topicSentenceRanges falls back to vertical gaps, indentation, and font size',()=>{
 const runs=[
  run('First paragraph begins',20,10,160,10,{fontSize:10}),
  run('and finishes. Later.',20,22,160,10,{fontSize:10}),
  run('Second paragraph starts',42,52,160,14,{fontSize:14}),
  run('and has more. Later.',42,68,160,14,{fontSize:14})
 ];
 assert.deepEqual(topicSentenceRanges(runs), [
  {index:0,start:0,end:runs[0].text.length},
  {index:1,start:0,end:'and finishes.'.length},
  {index:2,start:0,end:runs[2].text.length},
  {index:3,start:0,end:'and has more.'.length}
 ]);
});
