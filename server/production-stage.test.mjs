import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {stageApplication} from '../electron/production-stage.mjs';

test('production bundle serves and extracts PDFs without an external Express installation',async()=>{
 const {stage,packages}=await stageApplication();
 let backend;
 try{
  assert.ok(!packages.includes('express'));
  await assert.rejects(access(join(stage,'node_modules/express')));
  await access(join(stage,'licenses/express/LICENSE'));
  const {startServer}=await import(pathToFileURL(join(stage,'server/index.mjs')));
  backend=await startServer({port:0,development:false,cacheDir:join(stage,'cache'),token:'package-test'});
  const headers={'X-Preview-Token':'package-test'};
  assert.equal((await fetch(backend.origin,{headers})).status,200);
  assert.equal((await fetch(backend.origin)).status,403);
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage([612,792]).drawText('Bundled extraction fixture',{x:48,y:700,size:16,font});
  const response=await fetch(backend.origin+'/api/documents',{method:'POST',headers:{...headers,'Content-Type':'application/pdf'},body:await pdf.save()});
  assert.equal(response.status,201);const {id}=await response.json();
  const layout=await fetch(backend.origin+'/api/layout',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({documentId:id,page:1,height:792})});
  assert.equal(layout.status,200);assert.ok((await layout.json()).paragraphs.some(p=>p.text.includes('Bundled extraction fixture')));
 }finally{await backend?.close();await rm(stage,{recursive:true,force:true});}
});

test('fallback target retains PDF.js and DOMMatrix but excludes frontend and build packages',async()=>{
 const {stage,packages}=await stageApplication({platform:'darwin',arch:'x64'});
 try{
  const metadata=JSON.parse(await readFile(join(stage,'package.json'),'utf8'));
  for(const name of ['pdfjs-dist','@thednp/dommatrix']){assert.ok(packages.includes(name));assert.equal(typeof metadata.dependencies[name],'string');await access(join(stage,'node_modules',name,'package.json'));}
  for(const name of ['vue','@macvue/core','@fluentui/web-components','vite','esbuild','electron','express'])assert.ok(!packages.includes(name));
  await access(join(stage,'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'));
 }finally{await rm(stage,{recursive:true,force:true});}
});
