// Real installed kernels and local simulated provider: no paid requests.
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir,homedir} from 'node:os';
import {join} from 'node:path';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {startServer} from './index.mjs';
import {createHash} from 'node:crypto';
const root=await mkdtemp(join(tmpdir(),'pdfmathreader-advanced-'));
let calls=0;
const server=await startServer({port:0,development:false,cacheDir:join(root,'cache'),runtimeHomeRoot:join(root,'home'),enginesRoot:join(homedir(),'Library/Application Support/PDFMathReader/engines'),getApiKey:()=> 'simulation-only',providerFetch:async()=>{calls++;return new Response(JSON.stringify({id:'mock',object:'chat.completion',choices:[{index:0,finish_reason:'stop',message:{role:'assistant',content:'Texte traduit pour vérifier les options avancées.'}}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}}),{headers:{'Content-Type':'application/json'}});}});
const result={};
try{
 const source=await PDFDocument.create(),font=await source.embedFont(StandardFonts.Helvetica),page=source.addPage([612,792]);
 page.drawText('Advanced settings integration fixture with ordinary text.',{font,x:48,y:680,size:14});
 const bytes=await source.save();
 const upload=await fetch(server.origin+'/api/documents',{method:'POST',headers:{'Content-Type':'application/pdf'},body:bytes});assert.equal(upload.status,201);const {id}=await upload.json();
 for(const engine of ['pdf_math_fast','pdf_math_precise']){
  const response=await fetch(server.origin+'/api/engines/'+engine+'/advanced');assert.equal(response.status,200);const schema=await response.json();assert.ok(schema.options.length>= (engine==='pdf_math_fast'?2:20));
  const names=schema.options.map(option=>option.id);
  assert.ok(names.includes(engine==='pdf_math_fast'?'vfont':'min_text_length'));
  if(engine==='pdf_math_precise'){assert.equal(schema.options.find(option=>option.id==='translate_table_text').default,true);assert.equal(schema.options.find(option=>option.id==='no_auto_extract_glossary').default,true);}
  const options=engine==='pdf_math_fast'?{vfont:'a^'}:{min_text_length:1,translate_table_text:false,primary_font_family:'serif'};
  const request=(advancedOptions,sourceLanguage)=>fetch(server.origin+'/api/math-page?'+new URLSearchParams({engine,page:1,language:'French',threads:2,pageLimit:1}),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({documentId:id,advancedOptions,sourceLanguage})});
  const state=(await (await fetch(server.origin+'/api/engines')).json()).engines.find(item=>item.id===engine);
  const legacyKey=createHash('sha256').update(bytes).update(JSON.stringify({id:engine,version:state.version,page:1,language:'French',model:process.env.OPENAI_MODEL||'gpt-4.1-mini',prompt:2,layoutSchema:2})).digest('hex');
  const defaultResult=await request({});assert.equal(defaultResult.status,200);assert.equal(defaultResult.headers.get('X-Layout-Key'),legacyKey,'default options preserve legacy cache keys');
  const beforeInvalid=calls;const invalid=await request({unknown_option:true});assert.equal(invalid.status,422);assert.equal(calls,beforeInvalid,'invalid options must fail before provider requests');
  const before=calls,translated=await request(options);if(!translated.ok)throw Error(JSON.stringify(await translated.json()));const pdf=await PDFDocument.load(await translated.arrayBuffer());assert.equal(pdf.getPageCount(),1);assert.ok(calls>before);
  const beforeCache=calls;assert.equal((await request(options)).status,200);assert.equal(calls,beforeCache);
  const changed=engine==='pdf_math_fast'?{vfont:'b^'}:{...options,min_text_length:2};const fresh=await request(changed);if(!fresh.ok)throw Error(JSON.stringify(await fresh.json()));assert.ok(calls>beforeCache,'different advanced values must not reuse old translation cache');
  const sourceChanged=await request({},'Japanese');if(!sourceChanged.ok)throw Error(await sourceChanged.text());assert.notEqual(sourceChanged.headers.get('X-Layout-Key'),legacyKey,'source language separates cached translations');
  result[engine]={sourceLanguage:true,options:schema.options.length,translated:true,rejectsUnknownBeforeProvider:true,cacheSeparatesOptions:true,legacyDefaultCacheKey:true};
 }
 await writeFile('/tmp/pdfmathreader-advanced-integration.json',JSON.stringify(result,null,2));console.log(result);
}finally{await server.close();await rm(root,{recursive:true,force:true});}
