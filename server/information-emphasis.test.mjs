import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
 importantInformationRanges,
 informationTextSegments,
 informationRunRanges,
 mergeInformationRects
} from '../src/information-emphasis.mjs';

const nativeRun=(text,x,y,width,height=10)=>({text,x,y,width,height});
const segment=(text,start,end,topic,important)=>({text:text.slice(start,end),start,end,topic,important});

function markedText(groups){
 let text='🙂 ';
 const expected=[];
 const phrases=[];
 for(const [category,words] of groups){
  for(const word of words){
   const start=text.length;
   text+=word;
   expected.push({start,end:start+word.length,category});
   phrases.push(word);
   text+=phrases.length===groups.flatMap(([,items])=>items).length?'.':', ';
  }
 }
 return {text,expected};
}

test('importantInformationRanges finds the complete English vocabulary with UTF 16 offsets',()=>{
 const {text,expected}=markedText([
  ['results',['RESULTS','findings']],
  ['ordinals',['FIRST','second','THIRD']],
  ['logic',['HOWEVER','therefore','IN CONTRAST']],
  ['discovery',['SUPPORT','supports','SUPPORTED','supporting','FALSIFY','falsifies','FALSIFIED','suggest','SUGGESTS','suggested','INDICATE','indicates','INDICATED','DEMONSTRATE','reveal','DISCOVER']],
  ['comparison',['HIGHER','lower','GREATER THAN','compared with']]
 ]);
 const ranges=importantInformationRanges(text);

 assert.deepEqual(ranges,expected);
 assert.equal(ranges[0].start,'🙂 '.length);
 for(let index=0;index<ranges.length;index++){
  const current=ranges[index];
  assert.equal(text.slice(current.start,current.end),text.slice(expected[index].start,expected[index].end));
  if(index)assert.ok(ranges[index-1].end<=current.start);
 }
});

test('importantInformationRanges is case insensitive but requires English whole words',()=>{
 const text='unsupported supporters firstborn indication; SUPPORT, First, INDICATED.';
 const supportStart=text.indexOf('SUPPORT');
 const firstStart=text.indexOf('First');
 const indicatedStart=text.indexOf('INDICATED');
 assert.deepEqual(importantInformationRanges(text),[
  {start:supportStart,end:supportStart+'SUPPORT'.length,category:'discovery'},
  {start:firstStart,end:firstStart+'First'.length,category:'ordinals'},
  {start:indicatedStart,end:indicatedStart+'INDICATED'.length,category:'discovery'}
 ]);
});

test('importantInformationRanges handles simplified and traditional Chinese phrases without overlap',()=>{
 const groups=[
  ['results',['结果','結果']],
  ['discovery',['发现','發現','支持','证伪','證偽','反对','反對','表明']],
  ['ordinals',['首先','其次']],
  ['logic',['然而','因此']],
  ['comparison',['相比','高于','高於']]
 ];
 const text=groups.flatMap(([,words])=>words).join('');
 const expected=[];
 let start=0;
 for(const [category,words] of groups){
  for(const word of words){
   expected.push({start,end:start+word.length,category});
   start+=word.length;
  }
 }

 const ranges=importantInformationRanges(text);
 assert.deepEqual(ranges,expected);
 for(let index=1;index<ranges.length;index++)assert.ok(ranges[index-1].end<=ranges[index].start);
});

test('informationTextSegments keeps both features off as one unchanged plain text segment',()=>{
 const text='Findings support the claim. Later.';
 assert.deepEqual(informationTextSegments(text,{topicEnd:0,emphasizeInformation:false}),[
  {text,start:0,end:text.length,topic:false,important:false}
 ]);
});

test('informationTextSegments splits the first sentence and information keywords while preserving flags',()=>{
 const text='Findings support the claim. Later findings.';
 const topicEnd='Findings support the claim.'.length;
 const laterStart=text.indexOf('findings',topicEnd);
 const expected=[
  segment(text,0,'Findings'.length,true,true),
  segment(text,'Findings'.length,'Findings '.length,true,false),
  segment(text,'Findings '.length,'Findings support'.length,true,true),
  segment(text,'Findings support'.length,topicEnd,true,false),
  segment(text,topicEnd,laterStart,false,false),
  segment(text,laterStart,laterStart+'findings'.length,false,true),
  segment(text,laterStart+'findings'.length,text.length,false,false)
 ];

 assert.deepEqual(informationTextSegments(text,{topicEnd,emphasizeInformation:true}),expected);
 assert.equal(expected.map(item=>item.text).join(''),text);
});

test('informationTextSegments treats HTML like input as literal text and preserves punctuation',()=>{
 const text='<b>Findings</b> & support <i>plain</i>.';
 const findingsStart=text.indexOf('Findings');
 const findingsEnd=findingsStart+'Findings'.length;
 const supportStart=text.indexOf('support');
 const supportEnd=supportStart+'support'.length;
 const expected=[
  segment(text,0,findingsStart,true,false),
  segment(text,findingsStart,findingsEnd,true,true),
  segment(text,findingsEnd,supportStart,true,false),
  segment(text,supportStart,supportEnd,true,true),
  segment(text,supportEnd,text.length,true,false)
 ];

 const actual=informationTextSegments(text,{topicEnd:text.length,emphasizeInformation:true});
 assert.deepEqual(actual,expected);
 assert.equal(actual.map(item=>item.text).join(''),text);
});

test('informationRunRanges maps a contiguous PDF split word to both native runs',()=>{
 const runs=[
  nativeRun('res',10,10,18),
  nativeRun('ults',28,10,24)
 ];
 assert.deepEqual(informationRunRanges(runs),[
  {index:0,start:0,end:3,category:'results'},
  {index:1,start:0,end:4,category:'results'}
 ]);
});

test('informationRunRanges does not merge separate same line PDF words',()=>{
 const runs=[
  nativeRun('res',10,10,18),
  nativeRun('ults',36,10,24)
 ];
 assert.deepEqual(informationRunRanges(runs),[]);
});

test('informationRunRanges maps line wrap hyphenation to original ranges including the hyphen',()=>{
 const runs=[
  nativeRun('sup-',10,10,28),
  nativeRun('ported',10,22,48)
 ];
 assert.deepEqual(informationRunRanges(runs),[
  {index:0,start:0,end:4,category:'discovery'},
  {index:1,start:0,end:6,category:'discovery'}
 ]);
});

test('mergeInformationRects merges touching and overlapping boxes on one line',()=>{
 const rects=[
  {x:10,y:20,width:8,height:10},
  {x:18,y:20,width:12,height:10},
  {x:28,y:20,width:7,height:10}
 ];
 assert.deepEqual(mergeInformationRects(rects),[
  {x:10,y:20,width:25,height:10}
 ]);
});

test('mergeInformationRects keeps distant keywords and different lines separate',()=>{
 const rects=[
  {x:10,y:20,width:8,height:10},
  {x:30,y:20,width:8,height:10},
  {x:10,y:40,width:8,height:10}
 ];
 assert.deepEqual(mergeInformationRects(rects),rects);
});
