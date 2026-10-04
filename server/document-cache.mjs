import {readFile,mkdir,writeFile,rename,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
export function createDocumentCache(directory){
 const hashOf=hash=>hash.copy().digest('hex');
 async function scope(hash){
  const id=hashOf(hash);
  try{return id+':'+(await readFile(join(directory,'documents',id+'.generation'),'utf8')).trim();}catch(error){if(error.code!=='ENOENT')throw error;return '';}
 }
 async function clear(hash){
  const id=hashOf(hash),root=join(directory,'documents');await mkdir(root,{recursive:true});
  const file=join(root,id+'.generation'),temp=file+'.'+randomUUID()+'.tmp';
  await writeFile(temp,randomUUID());await rename(temp,file);
  await rm(join(root,id),{recursive:true,force:true});
 }
 return {scope,clear};
}
