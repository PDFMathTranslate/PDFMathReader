import {orderedAnnotations} from './sidebar-navigation.mjs';

const dateGroups=['today','week','month','older','unknown'];

function asText(value){
 try{return String(value??'');}catch{return '';}
}

function folded(value){
 return asText(value).normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase();
}

function normalizeColor(value){
 return asText(value).trim().toLowerCase();
}

function localDate(year,month,day){
 const date=new Date(0);
 date.setFullYear(year,month-1,day);
 date.setHours(0,0,0,0);
 return date;
}

function parseDate(value){
 if(value===undefined||value===null||value==='')return null;
 if(value instanceof Date)return Number.isNaN(value.getTime())?null:new Date(value.getTime());
 if(typeof value==='string'){
  const match=/^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if(match){
   const date=localDate(Number(match[1]),Number(match[2]),Number(match[3]));
   if(date.getFullYear()===Number(match[1])&&date.getMonth()+1===Number(match[2])&&date.getDate()===Number(match[3]))return date;
   return null;
  }
 }
 try{
  const date=new Date(value);
  return Number.isNaN(date.getTime())?null:date;
 }catch{return null;}
}

function localDay(value){
 const date=value instanceof Date?parseDate(value):parseDate(value);
 if(!date)return null;
 return Math.floor(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())/86400000);
}

function chapterEntries(outline){
 const entries=[];
 function visit(items,parentDepth=0){
  if(!Array.isArray(items))return;
  for(const item of items){
   if(!item||typeof item!=='object')continue;
   const id=item.id;
   if(id===undefined||id===null||asText(id).trim()==='')continue;
   const explicitDepth=Number(item.depth);
   const inferredDepth=Math.max(0,asText(id).split('.').length-1);
   const depth=Number.isFinite(explicitDepth)?explicitDepth:Math.max(parentDepth,inferredDepth);
   const page=Number(item.page);
   if(Number.isInteger(page)&&page>=1)entries.push({id,title:item.title??'',page,depth});
   visit(item.items,depth+1);
  }
 }
 visit(outline);
 return entries;
}

export function annotationChapters(outline){
 return chapterEntries(outline).map(({id,title,page})=>({id,title,page}));
}

function chapterAt(page,chapters){
 const number=Number(page);
 if(!Number.isFinite(number))return null;
 let selected=null;
 for(const chapter of chapters){
  if(chapter.page>number)continue;
  if(!selected||chapter.page>selected.page||(chapter.page===selected.page&&chapter.depth>selected.depth))selected=chapter;
 }
 return selected;
}

function dateGroup(createdAt,nowDay){
 const day=localDay(createdAt);
 if(day===null||nowDay===null)return 'unknown';
 const age=nowDay-day;
 if(age===0)return 'today';
 if(age>=1&&age<=6)return 'week';
 if(age>=7&&age<=29)return 'month';
 return 'older';
}

function sortableCreatedAt(value){
 if(value instanceof Date){
  try{return value.toISOString();}catch{return '';}
 }
 return asText(value);
}

function orderedRecords(records){
 const prepared=records.map((record,index)=>{
  const item=record.item||{};
  return {...item,rects:Array.isArray(item.rects)?item.rects:[],createdAt:sortableCreatedAt(item.createdAt),__annotationBrowserIndex:index};
 });
 return orderedAnnotations(prepared).map(item=>records[item.__annotationBrowserIndex]);
}

function optionSet(value,normalize=value=>asText(value)){
 if(value===undefined||value===null||value==='')return null;
 const values=Array.isArray(value)?value:[value];
 return new Set(values.map(normalize));
}

function boundDay(value){return value===undefined||value===null||value===''?null:localDay(value);}

function sectionLabel(group,key,record){
 if(group==='color')return record.color||'unknown';
 if(group==='chapter')return record.chapter?.title||'unknown';
 return key;
}

function orderedSectionKeys(group,buckets,chapters){
 const keys=[...buckets.keys()];
 if(group==='date')return dateGroups.map(value=>`date:${value}`).filter(key=>buckets.has(key));
 if(group==='kind'){
  const preferred=['kind:highlight','kind:comment'];
  return [...preferred.filter(key=>buckets.has(key)),...keys.filter(key=>!preferred.includes(key))];
 }
 if(group==='chapter'){
  const preferred=[];
  for(const chapter of chapters){
   const key=`chapter:${asText(chapter.id)}`;
   if(!preferred.includes(key))preferred.push(key);
  }
  preferred.push('chapter:unknown');
  return [...preferred.filter(key=>buckets.has(key)),...keys.filter(key=>!preferred.includes(key))];
 }
 return keys;
}

export function annotationSections(annotations,outline,options={},now=new Date()){
 const config=options&&typeof options==='object'?options:{};
 const chapters=chapterEntries(outline);
 const nowDay=localDay(now);
 const query=folded(config.query).trim();
 const kinds=optionSet(config.kind,value=>asText(value));
 const colorFilter=config.color===undefined||config.color===null||config.color===''?null:normalizeColor(config.color);
 const chapterFilter=config.chapter===undefined||config.chapter===null||config.chapter===''?null:asText(config.chapter);
 const from=boundDay(config.from),to=boundDay(config.to);
 const records=[];
 for(const item of Array.isArray(annotations)?annotations:[]){
  if(!item||typeof item!=='object')continue;
  const text=folded(item.text),comment=folded(item.comment);
  if(query&&!text.includes(query)&&!comment.includes(query))continue;
  const kind=asText(item.kind);
  if(kinds&&!kinds.has(kind))continue;
  const color=normalizeColor(item.color);
  if(colorFilter!==null&&color!==colorFilter)continue;
  const chapter=chapterAt(item.page,chapters),chapterKey=chapter?asText(chapter.id):'unknown';
  if(chapterFilter!==null&&chapterKey!==chapterFilter)continue;
  const created=localDay(item.createdAt);
  if(from!==null&&(created===null||created<from))continue;
  if(to!==null&&(created===null||created>to))continue;
  records.push({item,color,chapter,date:dateGroup(item.createdAt,nowDay)});
 }
 const ordered=orderedRecords(records);
 if(!ordered.length)return [];
 const group=['none','kind','date','color','chapter'].includes(config.group)?config.group:'none';
 if(group==='none')return [{key:'all',label:'all',items:ordered.map(record=>record.item)}];
 const buckets=new Map();
 for(const record of ordered){
  let key;
  if(group==='kind')key=`kind:${asText(record.item.kind||'unknown')}`;
  else if(group==='date')key=`date:${record.date}`;
  else if(group==='color')key=`color:${record.color||'unknown'}`;
  else key=`chapter:${record.chapter?asText(record.chapter.id):'unknown'}`;
  if(!buckets.has(key))buckets.set(key,[]);
  buckets.get(key).push(record);
 }
 return orderedSectionKeys(group,buckets,chapters).map(key=>{
  const items=orderedRecords(buckets.get(key)).map(record=>record.item);
  return {key,label:sectionLabel(group,key,items.length?{...buckets.get(key)[0],item:items[0]}:{}),items};
 });
}
