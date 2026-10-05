// Real installed kernels send custom service credentials/model/base URL to a local fixture.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {homedir,tmpdir} from 'node:os';
import {join} from 'node:path';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {startServer} from './index.mjs';
const directory=await mkdtemp(join(tmpdir(),'translation-services-'));
const requests=[];
const fixture=createServer(async(req,res)=>{
 let raw='';for await(const chunk of req)raw+=chunk;
 const body=JSON.parse(raw);requests.push({url:req.url,key:req.headers.authorization,model:body.model});
 assert.equal(req.headers.authorization,'Bearer local-service-fixture');
 assert.equal(body.model,'custom-fixture-model');
 const completion={id:'fixture',object:'chat.completion',model:body.model,choices:[{index:0,message:{role:'assistant',content:'Une traduction locale vérifiée.'},finish_reason:'stop'}]};
 if(body.stream){res.setHeader('Content-Type','text/event-stream');res.end('data: '+JSON.stringify({...completion,object:'chat.completion.chunk',choices:[{index:0,delta:{content:'Une traduction locale vérifiée.'},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n');}
 else {res.setHeader('Content-Type','application/json');res.end(JSON.stringify(completion));}
});
await new Promise(resolve=>fixture.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${fixture.address().port}/v1`;
const localTexts=[],realApple=process.env.APPLE_NATIVE_SMOKE==='1';
const backend=await startServer({localTranslationImpl:realApple?undefined:{available:async()=>true,close:async()=>{},translate:async({text,source,target})=>{assert.equal(source,'en');assert.equal(target,'fr');assert.ok(!text.includes('You are a professional'));localTexts.push(text);return 'Une traduction native simulée.';}},port:0,development:false,cacheDir:directory,enginesRoot:join(homedir(),'Library/Application Support/PDFMathReader/engines'),runtimeHomeRoot:join(tmpdir(),'preview-kernel-test-homes')});
try{
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),page=pdf.addPage();
 page.drawText('This is a scientific paragraph for custom translation service testing.',{font,x:45,y:700,size:14});
 const upload=await fetch(backend.origin+'/api/documents',{method:'POST',headers:{'Content-Type':'application/pdf'},body:await pdf.save()});
 const {id:documentId}=await upload.json();
 const report={};
 for(const engine of ['pdf_math_fast','pdf_math_precise']){
  const catalog=await (await fetch(backend.origin+`/api/engines/${engine}/services`)).json();
  const service=catalog.services.find(service=>service.id.toLowerCase()==='openai');assert.ok(service,JSON.stringify(catalog));
  const values={};for(const field of service.fields){if(/api_key|^key$/.test(field.id))values[field.id]='local-service-fixture';else if(/base_url/.test(field.id))values[field.id]=base;else if(/model$/.test(field.id))values[field.id]='custom-fixture-model';}
  const before=requests.length;
  const response=await fetch(backend.origin+'/api/math-page?'+new URLSearchParams({engine,page:1,language:'French',threads:1,pageLimit:1}),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({documentId,sourceLanguage:'English',translationService:{id:service.id,values},reuseTranslations:false})});
  if(!response.ok)throw Error(engine+': '+await response.text());
  const layout=await(await fetch(backend.origin+'/api/math-layout/'+response.headers.get('X-Layout-Key'))).json();
  assert.ok(layout.paragraphs.some(p=>p.translation.includes('traduction locale')));assert.ok(requests.length>before);
  assert.ok(requests.slice(before).every(r=>r.url==='/v1/chat/completions'));
  report[engine]={service:service.id,providerRequests:requests.length-before,verifiedCustomKey:true,verifiedCustomModel:true,verifiedCustomBaseURL:true,translatedLayout:true,serviceCount:catalog.services.length};
 }
 for(const engine of ['pdf_math_fast','pdf_math_precise']){
  const before=localTexts.length;
  const response=await fetch(backend.origin+'/api/math-page?'+new URLSearchParams({engine,page:1,language:'French',threads:1,pageLimit:1}),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({documentId,sourceLanguage:'English',translationService:{id:'apple-local',values:{}},reuseTranslations:false})});
  if(!response.ok)throw Error(engine+' native adapter: '+await response.text());
  const layout=await(await fetch(backend.origin+'/api/math-layout/'+response.headers.get('X-Layout-Key'))).json();
  if(realApple)assert.ok(layout.paragraphs.some(p=>p.translation&&p.translation!==p.text));else{assert.ok(localTexts.length>before);assert.ok(layout.paragraphs.some(p=>p.translation.includes('native simul')));}
  report[engine].nativeAdapter={verifiedRawSourceText:!realApple,translatedLayout:true,realAppleAPI:realApple};
 }
 await writeFile(realApple?'/tmp/pdfmathreader-translation-native-smoke.json':'/tmp/pdfmathreader-translation-services-smoke.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await backend.close();await new Promise(resolve=>fixture.close(resolve));await rm(directory,{recursive:true,force:true});}
