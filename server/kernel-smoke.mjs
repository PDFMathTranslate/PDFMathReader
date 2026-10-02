// Explicit integration smoke: real kernels, local simulated provider, no paid requests.
import assert from 'node:assert/strict';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {extractTextWithPositionsAsync} from '@firecrawl/pdf-inspector';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir,homedir} from 'node:os';
import {join} from 'node:path';
import {startServer} from './index.mjs';
const dir=await mkdtemp(join(tmpdir(),'preview-integration-'));
let active=0,peak=0,calls=0,failProvider=false;
const backend=await startServer({port:0,development:false,cacheDir:dir,runtimeHomeRoot:join(dir,'engine-homes'),kernelDiagnostic:message=>console.log(message),enginesRoot:join(homedir(),'Library/Application Support/PDFMathReader/engines'),getApiKey:()=> 'simulation-only',providerFetch:async(_url,options)=>{
 assert.equal(options.headers.Authorization,'Bearer simulation-only');assert.equal(JSON.parse(options.body).stream,false);
 if(failProvider)return new Response(JSON.stringify({error:{message:'synthetic 401'}}),{status:401,headers:{'Content-Type':'application/json'}});calls++;active++;peak=Math.max(peak,active);
 try{await new Promise(r=>setTimeout(r,400));return new Response(JSON.stringify({id:'mock',object:'chat.completion',created:1,model:'mock',choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:'Texte traduit pour ce paragraphe scientifique.'}}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}}),{headers:{'Content-Type':'application/json'}});}finally{active--;}
}});
const result={};
try{
 const source=await PDFDocument.create(),font=await source.embedFont(StandardFonts.Helvetica);
 for(let n=1;n<=2;n++){const p=source.addPage(n===1?[612,792]:[792,612]);for(let j=1;j<=3;j++)p.drawText(`Concurrent fixture ${Date.now()} page ${n} paragraph ${j}.`,{font,x:50,y:p.getHeight()-90*j,size:14});}
 const bytes=await source.save();
 for(const engine of ['pdf_math_fast','pdf_math_precise']){
  peak=0;const before=calls;
  const request=page=>fetch(backend.origin+'/api/math-page?'+new URLSearchParams({engine,page,language:'French',threads:2,pageLimit:2}),{method:'POST',headers:{'Content-Type':'application/pdf'},body:bytes});
  const outputs=await Promise.all([1,2].map(async page=>{const response=await request(page);if(!response.ok)throw Error(JSON.stringify(await response.json()));const layout=await (await fetch(backend.origin+'/api/math-layout/'+response.headers.get('X-Layout-Key'))).json();await writeFile(`/tmp/${engine}-layout-${page}.json`,JSON.stringify(layout,null,2));assert.ok(layout.paragraphs.length>=1);assert.equal(new Set(layout.paragraphs.map(b=>b.id)).size,layout.paragraphs.length);assert.ok(layout.paragraphs.some(b=>b.text.includes('Concurrent fixture')));assert.ok(layout.paragraphs.some(b=>b.translation.includes('Texte traduit')));for(const b of layout.paragraphs){assert.equal(b.page,page);for(const box of [b.sourceBox,b.translatedBox]){assert.ok(Number.isFinite(box.x)&&Number.isFinite(box.y));assert.ok(box.width>0&&box.height>0);}}const output=Buffer.from(await response.arrayBuffer());const pdf=await PDFDocument.load(output);assert.equal(pdf.getPageCount(),1);assert.equal(pdf.getPage(0).getWidth(),page===1?612:792);const text=(await extractTextWithPositionsAsync(output,[1],{frame:'display'})).map(i=>i.text).join(' ');assert.ok(text.includes('Texte traduit'));await writeFile(`/tmp/${engine}-integration-${page}.pdf`,output);return output;}));
  assert.ok(calls>before);assert.equal(peak,2);
  const beforeCache=calls;assert.equal((await request(2)).status,200);assert.equal(calls,beforeCache);
  result[engine]={passed:true,pages:outputs.length,readableTranslation:true,pairedParagraphLayout:true,peakProviderRequests:peak,cachedWithoutRequest:true};console.log(engine,'passed');
 }
 failProvider=true;const started=Date.now();const failure=await fetch(backend.origin+'/api/math-page?engine=pdf_math_fast&page=1&language=German&threads=2',{method:'POST',headers:{'Content-Type':'application/pdf'},body:bytes});assert.equal(failure.status,422);assert.match((await failure.json()).error,/rejected the configured API key/);assert.ok(Date.now()-started<15000);result.providerFailureVisible=true;failProvider=false;
 const controller=new AbortController();const pending=fetch(backend.origin+'/api/math-page?engine=pdf_math_fast&page=1&language=German&threads=2',{method:'POST',headers:{'Content-Type':'application/pdf'},body:bytes,signal:controller.signal});setTimeout(()=>controller.abort(),100);await assert.rejects(pending,{name:'AbortError'});result.cancellation=true;
 await writeFile('/tmp/preview-kernel-integration.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await backend.close();await rm(dir,{recursive:true,force:true});}
