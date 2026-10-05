import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,isAbsolute} from 'node:path';
import {replaceFile} from './atomic-file.mjs';
import {validateReadingView} from './recents.mjs';
function entry(value){
 if(!value||typeof value.path!=='string'||!isAbsolute(value.path))return null;
 let view;try{if(value.view)view=validateReadingView(value.view);}catch{}
 return {path:value.path,...view?{view}:{}};
}
export async function createDocumentSession(path){
 let saved={documents:[],last:null};try{const data=JSON.parse(await readFile(path,'utf8'));saved={documents:Array.isArray(data.documents)?data.documents.map(entry).filter(Boolean):[],last:entry(data.last)};}catch{}
 const live=new Map();let last=saved.last,writes=Promise.resolve(),serialized=JSON.stringify(saved);
 function persist(){const data=JSON.stringify({documents:[...live.values()],last});if(data===serialized)return writes;serialized=data;writes=writes.catch(()=>{}).then(async()=>{await mkdir(dirname(path),{recursive:true});await writeFile(path+'.tmp',data);await replaceFile(path+'.tmp',path);}).catch(error=>{if(serialized===data)serialized=null;throw error;});return writes;}
 return {
  restore:()=>structuredClone(saved.documents.length?saved.documents:saved.last?[saved.last]:[]),
  open(key,value){const document=entry(value);if(!document)throw Error('Invalid session document');live.set(key,document);last=document;return persist();},
  update(key,view){const current=live.get(key);if(current){const next={path:current.path,view:validateReadingView(view)};live.set(key,next);if(last===current)last=next;}return persist();},
  close(key){const current=live.get(key);if(current){last=current;live.delete(key);}return persist();},
  saveOnQuit(){return persist();},
  flush:()=>writes
 };
}
