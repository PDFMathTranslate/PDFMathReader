import {createHash,randomUUID} from 'node:crypto';

export const MAX_DOCUMENTS=2;
export const MAX_DOCUMENT_BYTES=50*1024*1024;
export const MAX_TOTAL_DOCUMENT_BYTES=100*1024*1024;

const PDF_MAGIC=Buffer.from('%PDF');
const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class DocumentStoreError extends Error{
 constructor(message,code,status=400){super(message);this.name='DocumentStoreError';this.code=code;this.status=status;}
}

export function isDocumentId(value){return typeof value==='string'&&UUID_PATTERN.test(value);}

export function isPDFBytes(value){
 return (Buffer.isBuffer(value)||value instanceof Uint8Array)&&Buffer.from(value.subarray(0,1024)).includes(PDF_MAGIC);
}

function toBuffer(value){
 if(Buffer.isBuffer(value))return value;
 if(value instanceof Uint8Array)return Buffer.from(value);
 throw new DocumentStoreError('PDF body is required.','MISSING_DOCUMENT',400);
}

export function createDocumentStore({maxDocuments=MAX_DOCUMENTS,maxBytes=MAX_TOTAL_DOCUMENT_BYTES,maxDocumentBytes=MAX_DOCUMENT_BYTES}={}){
 const documents=new Map();
 let uploads=0;
 let uploadBytes=0;
 let activeBytes=0;

 function register(input){
  const bytes=toBuffer(input);
  if(!bytes.length||!isPDFBytes(bytes))throw new DocumentStoreError('The document is not a readable PDF.','INVALID_PDF',400);
  if(bytes.length>maxDocumentBytes)throw new DocumentStoreError('Choose a PDF smaller than 50 MiB.','DOCUMENT_TOO_LARGE',413);
  if(documents.size>=maxDocuments||activeBytes+bytes.length>maxBytes)throw new DocumentStoreError('Document storage is full. Close an open document before registering another.','DOCUMENT_CAPACITY',409);
  const id=randomUUID();
  const documentHash=createHash('sha256').update(bytes);
  documents.set(id,{id,bytes,size:bytes.length,documentHash});
  uploads++;
  uploadBytes+=bytes.length;
  activeBytes+=bytes.length;
  return id;
 }

 function get(id){return documents.get(id)?.bytes;}
 function getEntry(id){
  const entry=documents.get(id);
  return entry?{id:entry.id,bytes:entry.bytes,size:entry.size,documentHash:entry.documentHash}:undefined;
 }
 function remove(id){
  const entry=documents.get(id);
  if(!entry)return false;
  documents.delete(id);
  activeBytes-=entry.size;
  return true;
 }
 function clear(){documents.clear();activeBytes=0;}
 function stats(){return {uploads,uploadBytes,activeBytes};}

 return {register,get,getEntry,delete:remove,remove,clear,stats,size:()=>documents.size};
}
