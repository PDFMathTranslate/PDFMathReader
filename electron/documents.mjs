import {fileURLToPath} from 'node:url';
import {open} from 'node:fs/promises';
import {basename,extname,isAbsolute,resolve} from 'node:path';
const MAX_PDF_BYTES=50*1024*1024;
async function inspectSystemPDF(path,readBytes){
 if(typeof path!=='string' || extname(path).toLowerCase()!=='.pdf')throw Error('Choose a PDF document.');
 const file=await open(path,'r');
 try{
  const info=await file.stat();
  if(!info.isFile() || info.size>MAX_PDF_BYTES)throw Error('Choose a PDF smaller than 50 MB.');
  const header=Buffer.alloc(Math.min(info.size,1024));await file.read(header,0,header.length,0);
  if(!header.includes(Buffer.from('%PDF-')))throw Error('This file is not a readable PDF.');
  if(!readBytes)return true;
  const bytes=await file.readFile();
  if(bytes.length>MAX_PDF_BYTES)throw Error('Choose a PDF smaller than 50 MB.');
  return {name:basename(path),bytes:new Uint8Array(bytes)};
 }finally{await file.close();}
}
export async function validateSystemPDF(path){return inspectSystemPDF(path,false);}
export async function readSystemPDF(path){return inspectSystemPDF(path,true);}

export function pdfLaunchPaths(args,cwd){const paths=[];for(const arg of args){if(typeof arg!=='string'||arg.startsWith('-'))continue;try{const path=arg.startsWith('file:')?fileURLToPath(arg):isAbsolute(arg)?arg:resolve(cwd,arg);if(extname(path).toLowerCase()==='.pdf'&&!paths.includes(path))paths.push(path);}catch{}}return paths;}
