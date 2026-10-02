import {readFile,writeFile,rename,rm,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';

export async function createCredentials({path,safeStorage,platform=process.platform,environment=()=>process.env.OPENAI_API_KEY}){
 let saved='',storageError='',environmentDisabled=false;
 const disabledPath=path+'.environment-disabled';
 try{await readFile(disabledPath);environmentDisabled=true;}catch(error){if(error.code!=='ENOENT')throw error;}
 const effectiveEnvironment=()=>environmentDisabled?'':environment();
 const available=()=>platform==='darwin' && safeStorage.isEncryptionAvailable();
 const status=()=>({configured:!!(saved||effectiveEnvironment()),keySource:saved?'saved':effectiveEnvironment()?'environment':'none',keyStorageAvailable:available(),keyStorageError:storageError});
 const secure=async()=>{if(!available() || !await safeStorage.isAsyncEncryptionAvailable())throw Error('macOS secure storage is unavailable. No key was saved.');};
 try{
  const encrypted=await readFile(path);
  await secure();saved=(await safeStorage.decryptStringAsync(encrypted)).result;
 }catch(error){if(error.code!=='ENOENT')storageError='Saved key could not be unlocked. Clear it or try again.';}
 let operation=Promise.resolve();
 const serial=action=>{const next=operation.then(action);operation=next.catch(()=>{});return next;};
 return {
  status,getKey:()=>saved||effectiveEnvironment()||'',
  save:key=>serial(async()=>{
   if(typeof key!=='string' || !key.trim() || key.length>4096 || /[\r\n]/.test(key))throw Error('Enter a valid API key.');
   await secure();
   let encrypted;try{encrypted=await safeStorage.encryptStringAsync(key.trim());}catch{throw Error('macOS could not encrypt the key. No key was saved.');}
   const temp=`${path}.${randomUUID()}.tmp`;
   try{await mkdir(dirname(path),{recursive:true});await writeFile(temp,encrypted,{mode:0o600});await rename(temp,path);}catch{await rm(temp,{force:true});throw Error('Could not save the encrypted key.');}
   saved=key.trim();storageError='';return status();
  }),
  clear:()=>serial(async()=>{try{await mkdir(dirname(path),{recursive:true});await writeFile(disabledPath,'disabled\n',{mode:0o600});environmentDisabled=true;await rm(path,{force:true});}catch{throw Error('Could not clear the saved key.');}saved='';storageError='';return status();})
 };
}
