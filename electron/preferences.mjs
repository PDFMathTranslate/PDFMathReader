import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {dirname} from 'node:path';

const LANGUAGE_OPTIONS=['Simplified Chinese','Traditional Chinese','English','Japanese','Korean','French','German','Spanish'];
const DEFAULT_PREFERENCES=Object.freeze({
 engine:'pdf_inspector',direction:'vertical',columns:1,fit:'width',zoom:1,translationMode:'reading',
 interactionMode:'comparison',
 appearance:'system',accentColor:'system',reduceMotion:false,reduceTransparency:false,reducePadding:false,
 language:'Simplified Chinese',concurrency:4,pageConcurrency:2,automatic:true,layoutVisible:false
});
const KNOWN_KEYS=Object.freeze(Object.keys(DEFAULT_PREFERENCES));
const KNOWN_KEY_SET=new Set(KNOWN_KEYS);

function isObject(value){return value&&typeof value==='object'&&!Array.isArray(value);}
function isValidZoom(value){return Number.isFinite(value)&&value>=.1&&value<=4;}
function isValidAccentColor(value){return value==='system'||(typeof value==='string'&&/^#[\da-f]{6}$/i.test(value));}
function isValidConcurrency(value){return Number.isInteger(value)&&value>=1&&value<=12;}

const VALIDATORS={
 engine:value=>['pdf_inspector','pdf_math_fast','pdf_math_precise'].includes(value),
 direction:value=>['vertical','horizontal'].includes(value),
 columns:value=>[1,2,4].includes(value),
 fit:value=>['width','height','manual'].includes(value),
 zoom:isValidZoom,
 translationMode:value=>['full','reading'].includes(value),
 interactionMode:value=>['reading','comparison'].includes(value),
 appearance:value=>['light','dark','system'].includes(value),
 accentColor:isValidAccentColor,
 reduceMotion:value=>typeof value==='boolean',
 reduceTransparency:value=>typeof value==='boolean',
 reducePadding:value=>typeof value==='boolean',
 language:value=>LANGUAGE_OPTIONS.includes(value),
 concurrency:isValidConcurrency,
 pageConcurrency:isValidConcurrency,
 automatic:value=>typeof value==='boolean',
 layoutVisible:value=>typeof value==='boolean'
};
const VALIDATION_MESSAGES={
 translationMode:'Invalid translation mode',interactionMode:'Invalid interaction mode',direction:'Invalid layout direction',columns:'Invalid layout columns',
 engine:'Invalid translation kernel',appearance:'Invalid appearance',accentColor:'Invalid accent color',
 reduceMotion:'Invalid reduce motion preference',reduceTransparency:'Invalid reduce transparency preference',reducePadding:'Invalid reduce padding preference',
 language:'Invalid language preference',concurrency:'Invalid concurrency preference',
 pageConcurrency:'Invalid page concurrency preference',automatic:'Invalid automatic translation preference',
 layoutVisible:'Invalid layout visibility preference'
};

function copyUnknown(value){
 const unknown=Object.create(null);
 if(!isObject(value))return unknown;
 for(const [key,entry] of Object.entries(value))if(!KNOWN_KEY_SET.has(key))unknown[key]=entry;
 return unknown;
}

function upgrade(value){
 const next={...DEFAULT_PREFERENCES,...copyUnknown(value)};
 if(!isObject(value))return next;
 for(const key of KNOWN_KEYS)if(VALIDATORS[key](value[key]))next[key]=value[key];
 return next;
}

function invalidPreference(message='Invalid reader preferences'){throw Error(message);}

function validate(value,partial=false){
 if(!isObject(value))invalidPreference();
 for(const key of KNOWN_KEYS){
  if((!partial||Object.prototype.hasOwnProperty.call(value,key))&&!VALIDATORS[key](value[key]))invalidPreference(VALIDATION_MESSAGES[key]);
 }
}

export async function createReaderPreferences(path){
 let state={...DEFAULT_PREFERENCES};
 try{state=upgrade(JSON.parse(await readFile(path,'utf8')));}catch{}
 let writes=Promise.resolve();
 return {
  load:()=>({...state}),
  flush:()=>writes,
  save(value){
   const next={...state,...(isObject(value)?value:{})};
   validate(value,true);
   validate(next);
   state=next;
   writes=writes.catch(()=>{}).then(async()=>{await mkdir(dirname(path),{recursive:true});await writeFile(path+'.tmp',JSON.stringify(next));await rename(path+'.tmp',path);});
   return writes;
  }
 };
}
