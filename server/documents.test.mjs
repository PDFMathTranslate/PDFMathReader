import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readSystemPDF} from '../electron/documents.mjs';
import {PDFDocument,StandardFonts} from 'pdf-lib';
import {createDocumentStore,isDocumentId} from './documents.mjs';
import {startServer} from './index.mjs';
test('OS PDF delivery validates files and exposes bytes without filesystem paths',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'system-pdf-'));
 try{
  const path=join(dir,'fixture.pdf');await writeFile(path,'%PDF-1.7\nfixture');
  const received=await readSystemPDF(path);assert.equal(received.name,'fixture.pdf');assert.equal(received.bytes instanceof Uint8Array,true);assert.equal(received.path,undefined);
  await writeFile(join(dir,'bad.pdf'),'not a PDF');await assert.rejects(readSystemPDF(join(dir,'bad.pdf')));
  await assert.rejects(readSystemPDF(join(dir,'file.txt')));
 }finally{await rm(dir,{recursive:true,force:true});}
});

function validPDFBytes(){
 return Buffer.from('%PDF-1.7\nfixture');
}

test('document store rejects capacity without evicting active documents and invalidates deletes',()=>{
 const store=createDocumentStore({maxDocuments:2,maxBytes:100,maxDocumentBytes:100});
 const bytes=validPDFBytes();
 const first=store.register(bytes),second=store.register(bytes);
 assert.throws(()=>store.register(bytes),error=>error.code==='DOCUMENT_CAPACITY'&&error.status===409);
 assert.equal(store.get(first),bytes);assert.equal(store.get(second),bytes);
 assert.equal(store.delete('not-a-uuid'),false);assert.equal(store.delete(first),true);assert.equal(store.get(first),undefined);
 assert.equal(store.stats().activeBytes,bytes.length);
 store.clear();assert.equal(store.size(),0);assert.equal(store.stats().activeBytes,0);
});

test('authenticated registration supports multiple JSON layouts for one stored document',async()=>{
 const source=await PDFDocument.create();const font=await source.embedFont(StandardFonts.Helvetica);const page=source.addPage([612,792]);page.drawText('Registration fixture',{x:48,y:700,size:16,font});
 const bytes=Buffer.from(await source.save());
 const cacheDir=join(tmpdir(),'document-api-cache-'+crypto.randomUUID());
 const backend=await startServer({port:0,development:false,cacheDir,token:'document-test-token',diagnostics:true});
 const headers={'X-Preview-Token':'document-test-token','Content-Type':'application/pdf'};
 try{
  assert.equal((await fetch(backend.origin+'/api/documents',{method:'POST',headers:{'Content-Type':'application/pdf'},body:bytes})).status,403);
  const upload=await fetch(backend.origin+'/api/documents',{method:'POST',headers,body:bytes});
  assert.equal(upload.status,201);const {id}=await upload.json();assert.ok(isDocumentId(id));
  const stats=await (await fetch(backend.origin+'/api/document-stats',{headers})).json();assert.deepEqual(stats,{uploads:1,uploadBytes:bytes.length,activeBytes:bytes.length});
  for(const pageNumber of [1,1]){
   const response=await fetch(backend.origin+'/api/layout',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({documentId:id,page:pageNumber,height:792})});
   assert.equal(response.status,200);const layout=await response.json();assert.equal(layout.engine,'pdf-inspector');assert.ok(layout.paragraphs.some(item=>item.text.includes('Registration fixture')));
  }
  const secondUpload=await fetch(backend.origin+'/api/documents',{method:'POST',headers,body:bytes});assert.equal(secondUpload.status,201);const {id:secondId}=await secondUpload.json();
  const full=await fetch(backend.origin+'/api/documents',{method:'POST',headers,body:bytes});assert.equal(full.status,409);
  assert.equal((await fetch(backend.origin+'/api/layout',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({documentId:'bad-id',page:1,height:792})})).status,400);
  assert.equal((await fetch(backend.origin+'/api/layout',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({documentId:id,page:0,height:792})})).status,400);
  assert.equal((await fetch(backend.origin+'/api/layout',{method:'POST',headers})).status,400);
  assert.equal((await fetch(backend.origin+'/api/documents/not-a-uuid',{method:'DELETE',headers})).status,404);
  assert.equal((await fetch(backend.origin+'/api/documents/'+id,{method:'DELETE',headers})).status,204);
  assert.equal((await fetch(backend.origin+'/api/documents/'+secondId,{method:'DELETE',headers})).status,204);
  assert.equal(backend.documentStats().activeBytes,0);
  const malformed=await fetch(backend.origin+'/api/documents',{method:'POST',headers,body:Buffer.from('not a PDF')});assert.equal(malformed.status,400);
 }finally{await backend.close();await rm(cacheDir,{recursive:true,force:true});}
 assert.equal(backend.documentStats().activeBytes,0);
});
