import test from 'node:test';
import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts,degrees} from 'pdf-lib';
import {hasNativeInspector,extractPdfJsPositions} from './pdf-extractor.mjs';

test('native inspector availability matches published target architectures',()=>{
 for(const [platform,arch,available] of [['darwin','arm64',true],['darwin','x64',false],['win32','x64',true],['win32','ia32',false],['linux','x64',true],['linux','armv7l',false],['linux','arm',false]])assert.equal(hasNativeInspector(platform,arch),available);
});
test('portable extraction preserves selected pages, display-frame positions and font sizes',async()=>{
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
 const first=pdf.addPage([400,600]);first.drawText('Portable reader',{x:40,y:500,size:20,font});
 const second=pdf.addPage([400,600]);second.drawText('Second page',{x:60,y:400,size:16,font});
 const bytes=await pdf.save(),items=await extractPdfJsPositions(bytes,[1]);
 assert.equal(items.length,1);assert.equal(items[0].text,'Portable reader');assert.equal(items[0].page,1);assert.equal(items[0].fontSize,20);assert.equal(items[0].x,40);assert.equal(items[0].y,500);assert.ok(items[0].width>100);
 assert.equal((await extractPdfJsPositions(bytes,[2]))[0].text,'Second page');
 first.setRotation(degrees(90));const rotated=await extractPdfJsPositions(await pdf.save(),[1]);assert.ok(Math.abs(rotated[0].rotation)===90);
 await assert.rejects(extractPdfJsPositions(bytes,[3]));
});
