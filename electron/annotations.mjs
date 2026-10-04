import {editPDFPages} from './page-edits.mjs';
import {transformPageAnnotations} from './page-edit-annotations.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {dirname,join} from 'node:path';
import {mkdir,open,readFile,unlink,stat} from 'node:fs/promises';
import {PDFDict,PDFDocument,PDFHexString,PDFName,PDFString} from 'pdf-lib';
import {replaceFile} from './atomic-file.mjs';

const MAX_KEY_LENGTH=1024;
const MAX_ANNOTATIONS=10000;
const MAX_TEXT_LENGTH=100000;
const MAX_RECT_COUNT=256;
const MAX_COORDINATE=1000000;
const MAX_PDF_BYTES=50*1024*1024;
const MANAGED_PREFIX='PDFMathReader:';
const HEX_COLOR=/^#[\da-f]{6}(?:[\da-f]{2})?$/i;

function invalid(message){throw Error(message);}

export function validateAnnotationKey(key){
 if(typeof key!=='string'||!key.trim()||key.length>MAX_KEY_LENGTH||/[\u0000-\u001f\u007f]/.test(key))invalid('Invalid annotation document key.');
 return key;
}

function finiteNumber(value,name,{minimum=0,positive=false}={}){
 if(typeof value!=='number'||!Number.isFinite(value)||value<minimum||(positive&&value<=0)||value>MAX_COORDINATE)invalid(`Invalid annotation ${name}.`);
 return value;
}

function validateRect(rect,name='annotation rectangle'){
 if(!rect||typeof rect!=='object'||Array.isArray(rect))invalid(`Invalid ${name}.`);
 return {
  x:finiteNumber(rect.x,`${name} x`),
  y:finiteNumber(rect.y,`${name} y`),
  width:finiteNumber(rect.width,`${name} width`,{positive:true}),
  height:finiteNumber(rect.height,`${name} height`,{positive:true})
 };
}

function validateTimestamp(value,name){
 if(typeof value!=='string'||value.length>128||!Number.isFinite(Date.parse(value)))invalid(`Invalid annotation ${name}.`);
 return value;
}

export function validateAnnotation(value,index=0){
 if(!value||typeof value!=='object'||Array.isArray(value))invalid(`Invalid annotation ${index}.`);
 if(typeof value.id!=='string'||!value.id.trim()||value.id.length>256||/[\u0000-\u001f\u007f]/.test(value.id))invalid(`Invalid annotation ${index} id.`);
 if(!Number.isSafeInteger(value.page)||value.page<1||value.page>1000000)invalid(`Invalid annotation ${index} page.`);
 if(value.kind!=='highlight'&&value.kind!=='comment')invalid(`Invalid annotation ${index} kind.`);
 if(value.origin!=='source'&&value.origin!=='translation')invalid(`Invalid annotation ${index} origin.`);
 if(typeof value.text!=='string'||value.text.length>MAX_TEXT_LENGTH)invalid(`Invalid annotation ${index} text.`);
 if(typeof value.comment!=='string'||value.comment.length>MAX_TEXT_LENGTH)invalid(`Invalid annotation ${index} comment.`);
 if(typeof value.color!=='string'||!HEX_COLOR.test(value.color))invalid(`Invalid annotation ${index} color.`);
 if(!Array.isArray(value.rects)||value.rects.length<1||value.rects.length>MAX_RECT_COUNT)invalid(`Invalid annotation ${index} rectangles.`);
 const rects=value.rects.map((rect,rectIndex)=>validateRect(rect,`annotation ${index} rectangle ${rectIndex}`));
 validateTimestamp(value.createdAt,'created-at');
 const result={id:value.id,page:value.page,kind:value.kind,origin:value.origin,text:value.text,comment:value.comment,color:value.color,rects,createdAt:value.createdAt};
 if(value.blockId!==undefined){
  if((typeof value.blockId!=='string'&&typeof value.blockId!=='number')||typeof value.blockId==='number'&&!Number.isSafeInteger(value.blockId)||typeof value.blockId==='string'&&(!value.blockId.length||value.blockId.length>256))invalid(`Invalid annotation ${index} block id.`);
  result.blockId=value.blockId;
 }
 if(value.nativeRef!==undefined){if(typeof value.nativeRef!=='string'||!/^\d+ \d+ R$/.test(value.nativeRef))invalid('Invalid annotation native reference.');result.nativeRef=value.nativeRef;}
 if(value.dateUnknown!==undefined)result.dateUnknown=!!value.dateUnknown;
 if(value.author!==undefined){if(typeof value.author!=='string'||value.author.length>1000)invalid('Invalid annotation author.');result.author=value.author;}
 if(value.translationRect!==undefined)result.translationRect=validateRect(value.translationRect,'translation rectangle');
 if(value.sourceRect!==undefined)result.sourceRect=validateRect(value.sourceRect,`annotation ${index} source rectangle`);
 if(value.modifiedAt!==undefined)result.modifiedAt=validateTimestamp(value.modifiedAt,'modified-at');
 return result;
}

export function validateAnnotations(value){
 if(!Array.isArray(value)||value.length>MAX_ANNOTATIONS)invalid('Invalid annotations.');
 return value.map((annotation,index)=>validateAnnotation(annotation,index));
}

function clone(value){return value.map(annotation=>({...annotation,rects:annotation.rects.map(rect=>({...rect})),...(annotation.sourceRect?{sourceRect:{...annotation.sourceRect}}:{})}));}

function keyDigest(key){return createHash('sha256').update(key,'utf8').digest('hex');}

function asBytes(value){
 if(value===undefined||value===null)return undefined;
 if(!(value instanceof Uint8Array)&&!Buffer.isBuffer(value))invalid('Invalid annotation PDF bytes.');
 if(value.byteLength>MAX_PDF_BYTES)invalid('Annotation PDF exceeds the 50 MiB limit.');
 return Buffer.from(value);
}

function sourceValue(source){
 if(typeof source==='string')return {path:source,reliable:true};
 if(!source||typeof source!=='object'||Array.isArray(source))return {};
 const path=typeof source.path==='string'&&source.path?source.path:undefined;
 return {path,reliable:source.reliable!==false,bytes:asBytes(source.bytes)};
}

function colorArray(color){
 const value=color.slice(1,7);
 return [0,1,2].map(index=>parseInt(value.slice(index*2,index*2+2),16)/255);
}

function textValue(dict,key){
 const value=dict.lookupMaybe(PDFName.of(key),PDFString,PDFHexString);
 return value?.decodeText?.();
}

function managedAnnotation(dict){return textValue(dict,'NM')?.startsWith(MANAGED_PREFIX)===true;}

function clampRect(rect,width,height){
 const left=Math.max(0,Math.min(width,rect.x)),top=Math.max(0,Math.min(height,rect.y));
 const right=Math.max(0,Math.min(width,rect.x+rect.width)),bottom=Math.max(0,Math.min(height,rect.y+rect.height));
 if(right<=left||bottom<=top)return null;
 return {x:left,y:top,width:right-left,height:bottom-top};
}

function pageViewport(page){
 const crop=page.getCropBox(),rotation=((page.getRotation().angle%360)+360)%360;
 return {crop,rotation,width:rotation%180?crop.height:crop.width,height:rotation%180?crop.width:crop.height};
}

function viewportPointToPDF(point,geometry){
 const {crop,rotation}=geometry;
 if(rotation===90)return {x:crop.x+point.y,y:crop.y+point.x};
 if(rotation===180)return {x:crop.x+crop.width-point.x,y:crop.y+point.y};
 if(rotation===270)return {x:crop.x+crop.width-point.y,y:crop.y+crop.height-point.x};
 return {x:crop.x+point.x,y:crop.y+crop.height-point.y};
}

function viewportRectToPDF(rect,geometry){
 const points=[
  viewportPointToPDF({x:rect.x,y:rect.y},geometry),
  viewportPointToPDF({x:rect.x+rect.width,y:rect.y},geometry),
  viewportPointToPDF({x:rect.x,y:rect.y+rect.height},geometry),
  viewportPointToPDF({x:rect.x+rect.width,y:rect.y+rect.height},geometry)
 ];
 const x=Math.min(...points.map(point=>point.x)),y=Math.min(...points.map(point=>point.y));
 const right=Math.max(...points.map(point=>point.x)),top=Math.max(...points.map(point=>point.y));
 return {x,y,width:right-x,height:top-y};
}

function annotationContents(annotation){
 const operation=annotation.kind==='highlight'?'高亮':'批注';
 const origin=annotation.origin==='translation'?'译文':'原文';
 return [`[${origin}${operation}${annotation.kind==='highlight'?` ${annotation.color}`:''}]`,annotation.text,annotation.comment].filter(Boolean).join('\n');
}

function addManagedAnnotation(page,annotation,context){
 const geometry=pageViewport(page),width=geometry.width,height=geometry.height;
 const rectangles=annotation.rects.map(rect=>clampRect(rect,width,height)).filter(Boolean).map(rect=>viewportRectToPDF(rect,geometry));
 if(!rectangles.length)invalid(`Annotation ${annotation.id} is outside its PDF page.`);
 const translationHighlight=annotation.origin==='translation'&&annotation.kind==='highlight';
 const isText=annotation.kind==='comment'||translationHighlight;
 const markerViewport=isText?(clampRect(annotation.sourceRect||annotation.rects[0],width,height)||clampRect(annotation.rects[0],width,height)):null;
 const markerRect=markerViewport?viewportRectToPDF(markerViewport,geometry):null;
 if(isText&&!markerRect)invalid(`Annotation ${annotation.id} has no usable source rectangle.`);
 const bounds=markerRect||{
  x:Math.min(...rectangles.map(rect=>rect.x)),
  y:Math.min(...rectangles.map(rect=>rect.y)),
  width:Math.max(...rectangles.map(rect=>rect.x+rect.width))-Math.min(...rectangles.map(rect=>rect.x)),
  height:Math.max(...rectangles.map(rect=>rect.y+rect.height))-Math.min(...rectangles.map(rect=>rect.y))
 };
 const dict=context.obj({Type:'Annot',Subtype:isText?'Text':'Highlight',Rect:context.obj([bounds.x,bounds.y,bounds.x+bounds.width,bounds.y+bounds.height]),F:4,C:context.obj(colorArray(annotation.color)),P:page.ref});
 dict.set(PDFName.of('NM'),PDFHexString.fromText(MANAGED_PREFIX+annotation.id));
 dict.set(PDFName.of('T'),PDFHexString.fromText(annotation.author||'PDFMathReader'));
 dict.set(PDFName.of('M'),PDFString.fromDate(new Date(annotation.modifiedAt||annotation.createdAt)));
 dict.set(PDFName.of('Contents'),PDFHexString.fromText(annotationContents(annotation)));
 dict.set(PDFName.of('PDFMathReader'),PDFHexString.fromText(JSON.stringify(annotation)));
 if(isText){
  dict.set(PDFName.of('Name'),PDFName.of('Comment'));
  dict.set(PDFName.of('Open'),context.obj(false));
 }else{
  const quadPoints=[];
  for(const rect of rectangles){
   const top=rect.y+rect.height,bottom=rect.y;
   quadPoints.push(rect.x,top,rect.x+rect.width,top,rect.x,bottom,rect.x+rect.width,bottom);
  }
  dict.set(PDFName.of('QuadPoints'),context.obj(quadPoints));
 }
 return context.register(dict);
}

export async function embedAnnotations(bytes,annotations,nativeRefs=[]){
 if(!Array.isArray(nativeRefs)||nativeRefs.some(ref=>typeof ref!=='string'||!/^\d+ \d+ R$/.test(ref)))invalid('Invalid annotation native references.');
 const input=asBytes(bytes);
 const normalized=validateAnnotations(annotations);
 const pdf=await PDFDocument.load(input,{updateMetadata:false});
 return embedAnnotationDocument(pdf,normalized,nativeRefs,input);
}

// Reuse an already parsed document during import. Preserve the original bytes
// when there is nothing to replace, including unrelated links and form widgets.
export async function embedAnnotationDocument(pdf,annotations,nativeRefs=[],originalBytes){
 if(!Array.isArray(nativeRefs)||nativeRefs.some(ref=>typeof ref!=='string'||!/^\d+ \d+ R$/.test(ref)))invalid('Invalid annotation native references.');
 const normalized=validateAnnotations(annotations),replaced=new Set(nativeRefs);
 let changed=normalized.length>0;
 const context=pdf.context;
 const pages=pdf.getPages();
 for(const page of pages){
  const annots=page.node.Annots();
  if(!annots)continue;
  const retained=[];
  for(let index=0;index<annots.size();index++){
   const dict=annots.lookupMaybe(index,PDFDict);
   if(dict?.get(PDFName.of('Subtype'))?.toString()==='/Popup'&&replaced.has(dict.get(PDFName.of('Parent'))?.toString()))continue;
   if((!dict||!managedAnnotation(dict))&&!replaced.has(annots.get(index).toString()))retained.push(annots.get(index));
  }
  if(retained.length===annots.size())continue;
  changed=true;
  if(retained.length)page.node.set(PDFName.Annots,context.obj(retained));
  else page.node.delete(PDFName.Annots);
 }
 for(const annotation of normalized){
  const page=pages[annotation.page-1];
  if(!page)invalid(`Annotation ${annotation.id} references a missing PDF page.`);
  const ref=addManagedAnnotation(page,annotation,context);
  const annots=page.node.Annots()||context.obj([]);annots.push(ref);page.node.set(PDFName.Annots,annots);
 }
 if(!changed&&originalBytes)return asBytes(originalBytes);
 return Buffer.from(await pdf.save({useObjectStreams:false,updateFieldAppearances:false}));
}

export async function stripManagedAnnotations(bytes){
 return embedAnnotations(asBytes(bytes),[]);
}

async function durableWrite(path,data){
 await mkdir(dirname(path),{recursive:true});
 const temporary=`${path}.${randomUUID()}.tmp`;
 let handle;
 try{
  const existing=await stat(path).catch(error=>{if(error.code==='ENOENT')return null;throw error;});handle=await open(temporary,'w',existing?existing.mode&0o777:0o600);await handle.writeFile(data);await handle.sync();await handle.close();handle=null;
  await replaceFile(temporary,path);
  try{const directory=await open(dirname(path),'r');await directory.sync();await directory.close();}catch{}
 }finally{
  if(handle)await handle.close().catch(()=>{});
  await unlink(temporary).catch(()=>{});
 }
}

async function readIfPresent(path){
 try{return Buffer.from(await readFile(path));}catch(error){if(error?.code==='ENOENT')return undefined;throw error;}
}

export async function createAnnotationStore(root){
 if(typeof root!=='string'||!root)invalid('Invalid annotation storage directory.');
 await mkdir(root,{recursive:true});
 let writes=Promise.resolve();const settingsPath=join(root,'annotation-settings.json');let settings={counts:{},deleteHintShown:false};try{const saved=JSON.parse(await readFile(settingsPath,'utf8'));settings={counts:Object.fromEntries(Object.entries(saved.counts||{}).filter(([color,count])=>HEX_COLOR.test(color)&&Number.isSafeInteger(count)&&count>0)),deleteHintShown:!!saved.deleteHintShown};}catch{}
 const metadataPath=key=>join(root,`${keyDigest(key)}.json`);
 const cachePath=key=>join(root,`${keyDigest(key)}.pdf`);
 async function load(key){
  const normalizedKey=validateAnnotationKey(key);await writes;
  const path=metadataPath(normalizedKey);
  try{
   const parsed=JSON.parse((await readFile(path,'utf8')));
   const value=Array.isArray(parsed)?parsed:parsed?.key===normalizedKey?parsed.annotations:undefined;
   return value===undefined?[]:clone(validateAnnotations(value));
  }catch(error){
   if(error?.code==='ENOENT'||error instanceof SyntaxError)return [];
   if(error?.message?.startsWith('Invalid annotation'))return [];
   throw error;
  }
 }
 async function performSave(key,annotations,rawSource,nativeRefs,editedBytes){
  let previous=[];try{previous=JSON.parse(await readFile(metadataPath(key),'utf8')).annotations||[];}catch{}const source=sourceValue(rawSource);
  let sourceBytes=editedBytes,sourcePathReadable=false;
  if(source.path&&source.reliable){
   sourceBytes??=await readFile(source.path);sourcePathReadable=true;
  }
  sourceBytes??=source.bytes;
  sourceBytes??=await readIfPresent(cachePath(key));
  if(sourceBytes){
   const rewritten=await embedAnnotations(sourceBytes,annotations,nativeRefs);
   await durableWrite(cachePath(key),rewritten);
   if(sourcePathReadable)await durableWrite(source.path,rewritten);
  }
  const record={version:1,key,annotations,nativeRefs,updatedAt:new Date().toISOString()};
  await durableWrite(metadataPath(key),JSON.stringify(record));
  let changed=false;for(const a of annotations)if(a.kind==='highlight'&&!a.nativeRef&&!previous.some(b=>b.id===a.id)){settings.counts[a.color]=(settings.counts[a.color]||0)+1;changed=true;}if(changed)await durableWrite(settingsPath,JSON.stringify(settings));
  return {saved:true};
 }
 async function save(value,source){
  const key=validateAnnotationKey(value?.key),annotations=validateAnnotations(value?.annotations),nativeRefs=value?.nativeRefs||[];if(!Array.isArray(nativeRefs)||nativeRefs.length>10000||nativeRefs.some(ref=>typeof ref!=='string'||!/^\d+ \d+ R$/.test(ref)))invalid('Invalid annotation native references.');
  const operation=writes.then(()=>performSave(key,annotations,source,[...nativeRefs]));writes=operation.catch(()=>{});return operation;
 }
 async function editPages(value,rawSource){
  const key=validateAnnotationKey(value?.key),items=validateAnnotations(value?.annotations),nativeRefs=value?.nativeRefs||[];
  if(!['rotate','align-width','align-height'].includes(value?.action))invalid('Invalid page edit action.');
  if(!Array.isArray(nativeRefs)||nativeRefs.some(ref=>typeof ref!=='string'||!/^\d+ \d+ R$/.test(ref)))invalid('Invalid annotation native references.');
  const operation=writes.then(async()=>{
   const source=sourceValue(rawSource);
   const original=source.path&&source.reliable?await readFile(source.path):await readIfPresent(cachePath(key))||source.bytes;
   if(!original)throw Error('No PDF source available for editing.');
   const result=await editPDFPages(original,{action:value.action,page:value.page});
   const updated=transformPageAnnotations(items,result.transforms);
   await performSave(key,updated,source,[...nativeRefs],result.bytes);
   return {bytes:new Uint8Array(await readFile(cachePath(key))),annotations:updated};
  });
  writes=operation.catch(()=>{});return operation;
 }
 async function loadState(key){const annotations=await load(key);let nativeRefs=[];try{const record=JSON.parse(await readFile(metadataPath(key),'utf8'));nativeRefs=record.nativeRefs||[];}catch{}return {annotations,nativeRefs};}
 async function palette(){await writes;const custom=Object.entries(settings.counts).filter(([color])=>!['#fff36a','#86ff86'].includes(color.toLowerCase())).sort((a,b)=>b[1]-a[1]);return {favorite:custom[0]?.[0]||'#82ddff',deleteHintShown:settings.deleteHintShown};}
 function markDeleteHint(){const operation=writes.then(async()=>{settings.deleteHintShown=true;await durableWrite(settingsPath,JSON.stringify(settings));});writes=operation.catch(()=>{});return operation;}
 return {load,loadState,save,editPages,palette,markDeleteHint,metadataPath,cachePath,flush:()=>writes};
}

export const managedAnnotationPrefix=MANAGED_PREFIX;
