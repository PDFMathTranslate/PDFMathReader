import test from 'node:test';
import assert from 'node:assert/strict';
import {annotationChapters,annotationSections} from '../src/annotation-browser.mjs';

const now=new Date(2026,9,4,12,0,0,0);

function localStamp(daysAgo,hour=12){
 const date=new Date(now);
 date.setDate(date.getDate()-daysAgo);
 date.setHours(hour,0,0,0);
 return date.toISOString();
}

function annotation(id,page,createdAt,extra={}){
 return {id,page,kind:'highlight',color:'#AABBCC',text:id,comment:'',rects:[{x:page,y:id.length,width:20,height:10}],createdAt,...extra};
}

test('annotationSections applies compound search, kind, color, and inclusive local date filters',()=>{
 const annotations=[
  annotation('cafe',3,localStamp(1),{text:'Café résumé',comment:'Keep this'}),
  annotation('other-kind',2,localStamp(1),{kind:'comment',text:'Café',color:'#ddeeff'}),
  annotation('other-color',1,localStamp(1),{text:'Café',color:'#ffffff'}),
  annotation('outside',4,localStamp(3),{text:'Café'})
 ];
 const sections=annotationSections(annotations,[],{query:'CAFE',kind:'highlight',color:'#aabbcc',from:'2026-10-03',to:'2026-10-03'},now);
 assert.deepEqual(sections,[{key:'all',label:'all',items:[annotations[0]]}]);
});

test('color grouping normalizes hex values and labels missing colors as unknown',()=>{
 const annotations=[
  annotation('upper',1,localStamp(0),{color:'#ABCDEF'}),
  annotation('lower',2,localStamp(0),{color:'#abcdef'}),
  annotation('missing',3,localStamp(0),{color:undefined})
 ];
 const sections=annotationSections(annotations,[],{group:'color'},now);
 assert.deepEqual(sections.map(section=>[section.key,section.label,section.items.map(item=>item.id)]),[
  ['color:#abcdef','#abcdef',['upper','lower']],
  ['color:unknown','unknown',['missing']]
 ]);
});

test('date groups use mutually exclusive local boundaries and retain unknown dates',()=>{
 const annotations=[
  annotation('today',1,localStamp(0)),
  annotation('week-boundary',2,localStamp(6)),
  annotation('month-boundary',3,localStamp(7)),
  annotation('month-last',4,localStamp(29)),
  annotation('older-boundary',5,localStamp(30)),
  annotation('invalid',6,'not-a-date'),
  annotation('missing',7,undefined)
 ];
 const sections=annotationSections(annotations,[],{group:'date'},now);
 assert.deepEqual(sections.map(section=>section.key),['date:today','date:week','date:month','date:older','date:unknown']);
 assert.deepEqual(sections.map(section=>section.items.map(item=>item.id)),[
  ['today'],['week-boundary'],['month-boundary','month-last'],['older-boundary'],['invalid','missing']
 ]);
 const inclusive=annotationSections(annotations,[],{from:'2026-09-05',to:'2026-10-04'},now);
 assert.deepEqual(inclusive[0].items.map(item=>item.id),['today','week-boundary','month-boundary','month-last']);
});

test('annotationChapters keeps usable pages and chapter grouping chooses the latest deepest start',()=>{
 const outline=[
  {id:'intro',title:'Introduction',depth:0,page:1},
  {id:'intro.details',title:'Details',depth:1,page:3},
  {id:'intro.details.deep',title:'Deep details',depth:2,page:3},
  {id:'methods',title:'Methods',depth:0,page:5},
  {id:'unresolved',title:'Unresolved',depth:0,page:null}
 ];
 assert.deepEqual(annotationChapters(outline),[
  {id:'intro',title:'Introduction',page:1},
  {id:'intro.details',title:'Details',page:3},
  {id:'intro.details.deep',title:'Deep details',page:3},
  {id:'methods',title:'Methods',page:5}
 ]);
 const annotations=[
  annotation('page-6',6,localStamp(0)),
  annotation('page-3',3,localStamp(0)),
  annotation('page-2',2,localStamp(0)),
  annotation('page-1',1,localStamp(0)),
  annotation('before-outline',0,localStamp(0))
 ];
 const sections=annotationSections(annotations,outline,{group:'chapter'},now);
 assert.deepEqual(sections.map(section=>[section.key,section.label,section.items.map(item=>item.id)]),[
  ['chapter:intro','Introduction',['page-1','page-2']],
  ['chapter:intro.details.deep','Deep details',['page-3']],
  ['chapter:methods','Methods',['page-6']],
  ['chapter:unknown','unknown',['before-outline']]
 ]);
});

test('group items use orderedAnnotations page and rectangle ordering without mutating input',()=>{
 const annotations=[
  annotation('late',2,localStamp(0),{rects:[{x:10,y:20,width:10,height:10}]}),
  annotation('first',1,localStamp(0),{rects:[{x:10,y:20,width:10,height:10}]}),
  annotation('top',2,localStamp(0),{rects:[{x:10,y:10,width:10,height:10}]}),
  annotation('left',2,localStamp(0),{rects:[{x:5,y:20,width:10,height:10}]})
 ];
 const before=annotations.map(item=>item.id);
 const sections=annotationSections(annotations,[],{},now);
 assert.deepEqual(sections[0].items.map(item=>item.id),['first','top','left','late']);
 assert.deepEqual(annotations.map(item=>item.id),before);
});
