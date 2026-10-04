import {test} from 'node:test';
import assert from 'node:assert/strict';
import {degrees,PDFArray,PDFDict,PDFDocument,PDFName,PDFNumber} from 'pdf-lib';
import {editPDFPages} from '../electron/page-edits.mjs';

const specs=[
 {media:[3,4,120,240],crop:[10,20,100.04,200.04],rotation:0},
 {media:[11,13,200,160],crop:[15,20,150.04,90.04],rotation:90},
 {media:[0,0,100,310],crop:[0,0,90.04,300.04],rotation:180},
 {media:[2,3,140,130],crop:[2,3,120.04,100.049],rotation:90}
];

function normalizedRotation(page){
 const angle=((page.getRotation().angle%360)+360)%360;
 return angle;
}

function geometry(page){
 const crop=page.getCropBox(),rotation=normalizedRotation(page),sideways=rotation===90||rotation===270;
 return {width:sideways?crop.height:crop.width,height:sideways?crop.width:crop.height,rotation};
}

function assertClose(actual,expected,message){
 assert.ok(Math.abs(actual-expected)<1e-7,`${message}: ${actual} != ${expected}`);
}

function annotationValues(page,key){
 const annotations=page.node.Annots();
 assert.ok(annotations,'Expected a native annotation.');
 const annotation=annotations.lookup(0,PDFDict);
 const values=annotation.lookup(PDFName.of(key),PDFArray);
 return Array.from({length:values.size()},(_,index)=>values.lookup(index,PDFNumber).asNumber());
}

async function fixture(){
 const pdf=await PDFDocument.create();
 for(const spec of specs){
  const page=pdf.addPage([spec.media[2],spec.media[3]]);
  page.setMediaBox(...spec.media);
  page.setCropBox(...spec.crop);
  page.setRotation(degrees(spec.rotation));
 }
 const page=pdf.getPage(1),context=pdf.context;
 const annotation=context.obj({
  Type:'Annot',Subtype:PDFName.of('Highlight'),
  Rect:context.obj([20,30,40,50]),
  QuadPoints:context.obj([20,50,40,50,20,30,40,30])
 });
 page.node.set(PDFName.Annots,context.obj([context.register(annotation)]));
 return new Uint8Array(await pdf.save({useObjectStreams:false}));
}

test('align-width uses rounded buckets but keeps the earliest winning dimension exact',async()=>{
 const original=await fixture(),snapshot=new Uint8Array(original);
 const result=await editPDFPages(original,{action:'align-width'});
 assert.deepEqual(original,snapshot,'editing must not mutate the input bytes');
 assert.equal(result.bytes instanceof Uint8Array,true);
 assert.equal(result.transforms.length,specs.length);
 const before=specs.map(spec=>({
  width:spec.rotation%180?spec.crop[3]:spec.crop[2],
  height:spec.rotation%180?spec.crop[2]:spec.crop[3]
 }));
 const expectedScales=[1,100.04/90.04,100.04/90.04,100.04/100.049];
 result.transforms.forEach((transform,index)=>{
  assert.equal(transform.page,index+1);
  assert.equal(transform.rotate,0,'alignment must preserve rotations');
  assert.equal(transform.width,before[index].width);
  assert.equal(transform.height,before[index].height);
  assertClose(transform.scale,expectedScales[index],`scale for page ${index+1}`);
 });

 const output=await PDFDocument.load(result.bytes),outputPages=output.getPages();
 outputPages.forEach((page,index)=>{
  const view=geometry(page);
  assertClose(view.width,100.04,`aligned width for page ${index+1}`);
  assert.equal(view.rotation,specs[index].rotation);
 });
 const factor=expectedScales[1],page=outputPages[1],crop=page.getCropBox(),media=page.getMediaBox();
 assertClose(crop.x,15*factor,'scaled CropBox x origin');
 assertClose(crop.y,20*factor,'scaled CropBox y origin');
 assertClose(crop.width,150.04*factor,'scaled CropBox width');
 assertClose(crop.height,90.04*factor,'scaled CropBox height');
 assertClose(media.x,11*factor,'scaled MediaBox x origin');
 assertClose(media.y,13*factor,'scaled MediaBox y origin');
 assertClose(media.width,200*factor,'scaled MediaBox width');
 assertClose(media.height,160*factor,'scaled MediaBox height');
 assert.deepEqual(annotationValues(page,'Rect'),[20*factor,30*factor,40*factor,50*factor]);
 assert.deepEqual(annotationValues(page,'QuadPoints'),[20*factor,50*factor,40*factor,50*factor,20*factor,30*factor,40*factor,30*factor]);
});

test('align-height scales every displayed page dimension proportionally and preserves rotations',async()=>{
 const original=await fixture(),result=await editPDFPages(original,{action:'align-height'});
 const output=await PDFDocument.load(result.bytes),outputPages=output.getPages();
 outputPages.forEach((page,index)=>{
  const view=geometry(page);
  assertClose(view.height,200.04,`aligned height for page ${index+1}`);
  assert.equal(view.rotation,specs[index].rotation);
 });
 const before=specs.map(spec=>spec.rotation%180?spec.crop[2]:spec.crop[3]);
 const expectedScales=before.map(height=>200.04/height);
 result.transforms.forEach((transform,index)=>{
  assert.equal(transform.rotate,0);
  assert.equal(transform.width,specs[index].rotation%180?specs[index].crop[3]:specs[index].crop[2]);
  assert.equal(transform.height,before[index]);
  assertClose(transform.scale,expectedScales[index],`height scale for page ${index+1}`);
 });
});

test('rotate changes only the requested page and reports its old viewport size',async()=>{
 const original=await fixture(),snapshot=new Uint8Array(original);
 const result=await editPDFPages(original,{action:'rotate',page:2});
 assert.deepEqual(original,snapshot,'rotation must not mutate the input bytes');
 assert.deepEqual(result.transforms.map(transform=>({page:transform.page,scale:transform.scale,rotate:transform.rotate,width:transform.width,height:transform.height})),[
  {page:1,scale:1,rotate:0,width:100.04,height:200.04},
  {page:2,scale:1,rotate:90,width:90.04,height:150.04},
  {page:3,scale:1,rotate:0,width:90.04,height:300.04},
  {page:4,scale:1,rotate:0,width:100.049,height:120.04}
 ]);
 const output=await PDFDocument.load(result.bytes),pages=output.getPages();
 assert.deepEqual(pages.map(normalizedRotation),[0,180,180,90]);
 assert.deepEqual(geometry(pages[1]),{width:150.04,height:90.04,rotation:180});
 assert.deepEqual(annotationValues(pages[1],'Rect'),[20,30,40,50],'native annotation geometry must survive rotation');
});

test('rejects unsupported actions and out-of-range rotate pages',async()=>{
 const bytes=await fixture();
 await assert.rejects(editPDFPages(bytes,{action:'stretch'}),/Invalid page edit action/);
 await assert.rejects(editPDFPages(bytes,{action:'rotate',page:0}),/Invalid page edit page/);
 await assert.rejects(editPDFPages(bytes,{action:'rotate',page:5}),/Invalid page edit page/);
});
