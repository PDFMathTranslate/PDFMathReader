import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {writeFile} from 'node:fs/promises';
export async function verifyCoverage(window,backend,token){
 const evaluate=code=>window.webContents.executeJavaScript(code),pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 async function wait(code){for(let i=0;i<150;i++){if(await evaluate(code))return;await pause(100);}throw Error('Coverage assertion timed out: '+code);}
 const doc=await PDFDocument.create(),font=await doc.embedFont(StandardFonts.Helvetica),page=doc.addPage([612,792]);
 page.drawText('Indented first line begins here',{x:66,y:700,size:12,font});
 page.drawText('Wrapped second line begins at the left margin',{x:50,y:684,size:12,font});
 page.drawText('Wrapped third line remains at the left margin',{x:50,y:668,size:12,font});
 page.drawRectangle({x:400,y:680,width:16,height:16});
 const bytes=await doc.save(),response=await fetch(backend.origin+'/api/layout?page=1&height=792',{method:'POST',headers:{'Content-Type':'application/pdf','X-Preview-Token':token},body:bytes});assert.equal(response.status,200);
 const layout=await response.json(),block=layout.paragraphs.find(p=>p.text.includes('Indented first line')&&p.text.includes('Wrapped third line'));assert.ok(block,'real Inspector extraction must group the indented paragraph');assert.ok(Math.abs(block.x-50)<.1,'source left edge must include wrapped lines');
 await wait(`!!document.querySelector('[aria-label="Translation settings"]')`);
 await evaluate(`document.querySelector('[aria-label="Translation settings"]').click();true`);
 await wait(`!!document.querySelector('.kernel-switcher')`);
 await evaluate(`Array.from(document.querySelectorAll('.kernel-switcher button')).find(b=>b.textContent==='Ultra fast').click();true`);
 await wait(`document.querySelector('.kernel-switcher [aria-checked=true]').textContent==='Ultra fast'&&!document.querySelector('.kernel-switcher button').disabled`);
 await evaluate(`document.querySelector('[aria-label="Close settings"]').click();true`);
 const encoded=Buffer.from(bytes).toString('base64');
 await evaluate(`(()=>{const data=new DataTransfer();data.items.add(new File([Uint8Array.from(atob(${JSON.stringify(encoded)}),c=>c.charCodeAt(0))],'Portrait and landscape.pdf',{type:'application/pdf'}));const input=document.querySelector('input[type=file]');input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
 await wait(`document.querySelector('.paragraph.translated')?.textContent.includes('Mock translated paragraph')`);await pause(1000);

 async function pixels(region){const image=await window.webContents.capturePage({x:Math.floor(region.x),y:Math.floor(region.y),width:Math.ceil(region.width),height:Math.ceil(region.height)}),bitmap=image.toBitmap();let dark=0;for(let i=0;i<bitmap.length;i+=4)if(bitmap[i]<100&&bitmap[i+1]<100&&bitmap[i+2]<100&&bitmap[i+3]>200)dark++;return dark;}
 const results=[];
 for(const zoom of [1,1.5]){
  // Use the actual native zoom menu action; manual scale remains independent of Chromium zoom.
  await evaluate(`(()=>{const select=document.querySelector('[aria-label="Zoom"]');select.value=${JSON.stringify(String(zoom))};select.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);await pause(700);
  const region=await evaluate(`(()=>{const r=document.querySelector('.page>canvas').getBoundingClientRect(),s=r.width/612;return {left:{x:r.left+50*s,y:r.top+115*s,width:12*s,height:9*s},figure:{x:r.left+403*s,y:r.top+99*s,width:8*s,height:8*s}};})()`);
  const correctStyle=await evaluate(`document.querySelector('.paragraph.translated').getAttribute('style')`);
  await evaluate(`(()=>{const p=document.querySelector('.paragraph.translated'),s=parseFloat(document.querySelector('.page>canvas').style.width)/612;p.style.left=(66*s)+'px';p.style.width=(${block.width}*s-16*s)+'px';return true;})()`);await pause(200);
  const legacy=await pixels(region.left);assert.ok(legacy>5,'old first-line-only bounds must reproduce exposed source glyphs');
  if(zoom===1)await writeFile('/tmp/pdfmathreader-ultrafast-coverage-before.png',(await window.webContents.capturePage()).toPNG());
  await evaluate(`document.querySelector('.paragraph.translated').setAttribute('style',${JSON.stringify(correctStyle)});true`);await pause(200);
  const covered=await pixels(region.left);if(covered){console.log(JSON.stringify({block,region,overlay:await evaluate(`(()=>{const p=document.querySelector('.paragraph.translated'),r=p.getBoundingClientRect(),s=getComputedStyle(p);return {left:r.left,top:r.top,width:r.width,height:r.height,text:p.textContent,font:s.fontSize,background:s.backgroundColor,shadow:s.boxShadow};})()`)}));await writeFile('/tmp/pdfmathreader-ultrafast-coverage-failure.png',(await window.webContents.capturePage()).toPNG());}assert.equal(covered,0,'translated overlay must completely cover original left-edge glyphs');assert.ok(await pixels(region.figure)>5,'neighboring figure must remain visible');
  await evaluate(`document.querySelector('.paragraph.translated').click();true`);await pause(1000);const original=await pixels(region.left);assert.ok(original>5,'original toggle must restore the real left-edge glyphs');
  await evaluate(`document.querySelector('.paragraph').click();true`);await pause(1000);assert.equal(await pixels(region.left),0);
  results.push({scale:zoom,leftEdgeFullyCovered:true,originalGlyphsRestored:true,neighboringFigurePreserved:true,originalDarkPixels:original,legacyExposedDarkPixels:legacy});
 }
 await writeFile('/tmp/pdfmathreader-ultrafast-coverage.png',(await window.webContents.capturePage()).toPNG());
 const result={realInspectorGeometry:true,indentedParagraphUnion:true,mockOnly:true,results};await writeFile('/tmp/pdfmathreader-ultrafast-coverage.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));window.close();
}
