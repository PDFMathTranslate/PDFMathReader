import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {degrees,PDFDict,PDFDocument,PDFHexString,PDFName} from 'pdf-lib';
import {createAnnotationStore,managedAnnotationPrefix,stripManagedAnnotations} from '../electron/annotations.mjs';

const createdAt='2026-10-04T00:00:00.000Z';
const rect=(x,y,width,height)=>({x,y,width,height});

function addExternalAnnotation(pdf,page){
 const context=pdf.context,annotation=context.obj({Type:'Annot',Subtype:'Text',Rect:context.obj([24,24,42,42]),Contents:PDFHexString.fromText('external')});
 annotation.set(PDFName.of('NM'),PDFHexString.fromText('ExternalKeep'));
 const annots=page.node.Annots()||context.obj([]);annots.push(context.register(annotation));page.node.set(PDFName.Annots,annots);
}

function pageAnnotations(page){
 const annots=page.node.Annots();if(!annots)return [];
 return Array.from({length:annots.size()},(_,index)=>annots.lookup(index,PDFDict));
}

function decoded(dict,key){return dict.lookupMaybe(PDFName.of(key),PDFHexString)?.decodeText();}

function managed(page){return pageAnnotations(page).filter(annotation=>decoded(annotation,'NM')?.startsWith(managedAnnotationPrefix));}

function fixtureAnnotations(){
 return [
  {id:'source-highlight',page:1,kind:'highlight',origin:'source',text:'source words',comment:'',color:'#fff36a',rects:[rect(50,100,100,12),rect(50,114,80,12)],createdAt},
  {id:'source-comment',page:1,kind:'comment',origin:'source',text:'source note target',comment:'remember this',color:'#86ff86',rects:[rect(100,200,55,13)],sourceRect:rect(590,200,14,14),createdAt},
  {id:'translation-highlight',page:2,kind:'highlight',origin:'translation',text:'translated words',comment:'translation note',color:'#82ddff',rects:[rect(20,40,90,14)],sourceRect:rect(100,200,14,14),createdAt}
 ];
}

test('annotation store round-trips metadata, embeds standard annotations, rewrites only managed entries, and preserves external entries',async()=>{
 const root=await mkdtemp(join(tmpdir(),'annotation-store-')),sourcePath=join(root,'fixture.pdf');
 try{
  const source=await PDFDocument.create(),first=source.addPage([612,792]),second=source.addPage([500,700]);
  second.setCropBox(20,30,500,700);second.setRotation(degrees(90));addExternalAnnotation(source,first);await writeFile(sourcePath,await source.save());
  const store=await createAnnotationStore(join(root,'sidecar')),annotations=fixtureAnnotations();
  assert.deepEqual(await store.save({key:'recent-document',annotations},{path:sourcePath,reliable:true}),{saved:true});
  assert.deepEqual(await store.load('recent-document'),annotations);
  const written=await PDFDocument.load(await readFile(sourcePath));
  assert.equal(pageAnnotations(written.getPage(0)).length,3);
  assert.equal(managed(written.getPage(0)).length,2);
  assert.equal(managed(written.getPage(1)).length,1);
  assert.equal(decoded(pageAnnotations(written.getPage(0))[0],'NM'),'ExternalKeep');
  const sourceHighlight=managed(written.getPage(0)).find(annotation=>decoded(annotation,'NM')?.endsWith('source-highlight'));
  assert.equal(decoded(sourceHighlight,'Contents'),'[原文高亮 #fff36a]\nsource words');
  assert.match(sourceHighlight.lookup(PDFName.of('Subtype')).toString(),/Highlight/);
  const translated=managed(written.getPage(1))[0];
  assert.match(translated.lookup(PDFName.of('Subtype')).toString(),/Text/);
  assert.equal(decoded(translated,'Contents'),'[译文高亮 #82ddff]\ntranslated words\ntranslation note');
  const translatedRect=translated.lookup(PDFName.of('Rect')).toString();
  assert.equal(translatedRect,'[ 220 130 234 144 ]');

  const replacement=[annotations[2]];
  await store.save({key:'recent-document',annotations:replacement},{path:sourcePath,reliable:true});
  const updated=await PDFDocument.load(await readFile(sourcePath));
  assert.equal(managed(updated.getPage(0)).length,0);
  assert.equal(pageAnnotations(updated.getPage(0)).length,1);
  assert.equal(decoded(pageAnnotations(updated.getPage(0))[0],'NM'),'ExternalKeep');
  assert.equal(managed(updated.getPage(1)).length,1);
  const cleaned=await PDFDocument.load(await stripManagedAnnotations(await readFile(sourcePath)));
  assert.equal(managed(cleaned.getPage(0)).length,0);assert.equal(managed(cleaned.getPage(1)).length,0);
  assert.equal(decoded(pageAnnotations(cleaned.getPage(0))[0],'NM'),'ExternalKeep');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('fingerprint-only documents persist sidecar metadata and serialize concurrent saves',async()=>{
 const root=await mkdtemp(join(tmpdir(),'annotation-sidecar-'));
 try{
  const store=await createAnnotationStore(root),base={page:1,kind:'comment',origin:'source',text:'text',comment:'comment',color:'#fff36a',rects:[rect(1,1,5,5)],createdAt};
  const first={...base,id:'first'},second={...base,id:'second'};
  await Promise.all([store.save({key:'fingerprint-only',annotations:[first]}),store.save({key:'fingerprint-only',annotations:[second]})]);
  assert.deepEqual(await store.load('fingerprint-only'),[second]);
  await stat(store.metadataPath('fingerprint-only'));
  await assert.rejects(store.save({key:'bad\nkey',annotations:[]}),/Invalid annotation document key/);
  const record=JSON.parse(await readFile(store.metadataPath('fingerprint-only'),'utf8'));assert.equal(record.key,'fingerprint-only');assert.equal(record.annotations[0].id,'second');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('native comments and highlights import, migrate, recover from copied PDF, and delete without affecting other entries',async()=>{
 const {importPDFAnnotations}=await import('../electron/annotation-import.mjs');const root=await mkdtemp(join(tmpdir(),'annotation-native-')),path=join(root,'native.pdf');
 try{
  const pdf=await PDFDocument.create(),page=pdf.addPage([300,400]);addExternalAnnotation(pdf,page);
  const dict=pdf.context.obj({Type:'Annot',Subtype:'Highlight',Rect:pdf.context.obj([20,200,120,214]),QuadPoints:pdf.context.obj([20,214,120,214,20,200,120,200]),C:pdf.context.obj([0,1,0])});page.node.Annots().push(pdf.context.register(dict));
  await writeFile(path,await pdf.save());const original=await readFile(path),imported=await importPDFAnnotations(original);assert.equal(imported.annotations.length,2);assert.equal(imported.nativeRefs.length,2);assert.equal(imported.annotations.find(a=>a.kind==='highlight').color,'#00ff00');
  const store=await createAnnotationStore(join(root,'store'));await store.save({key:'native',annotations:imported.annotations,nativeRefs:imported.nativeRefs},{path,reliable:true});
  const recovered=await importPDFAnnotations(await readFile(path));assert.equal(recovered.annotations.length,2);assert.equal(recovered.nativeRefs.length,0);assert.equal(recovered.annotations.find(a=>a.kind==='comment').comment,'external');
  const written=await PDFDocument.load(await readFile(path));assert.equal(pageAnnotations(written.getPage(0)).length,2);assert.equal(managed(written.getPage(0)).length,2);
  await store.save({key:'native',annotations:[],nativeRefs:imported.nativeRefs},{path,reliable:true});assert.equal(pageAnnotations((await PDFDocument.load(await readFile(path))).getPage(0)).length,0);
  assert.deepEqual((await store.loadState('native')).nativeRefs,imported.nativeRefs);
  await assert.rejects(store.save({key:'missing',annotations:[]},{path:join(root,'missing.pdf'),reliable:true}),/ENOENT/);
 }finally{await rm(root,{recursive:true,force:true});}
});
