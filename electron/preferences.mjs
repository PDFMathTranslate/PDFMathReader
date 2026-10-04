import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {replaceFile} from './atomic-file.mjs';
import {dirname} from 'node:path';

const LANGUAGE_OPTIONS=['Simplified Chinese','Traditional Chinese','English','Japanese','Korean','French','German','Spanish'];
const KERNEL_ENGINE_IDS=Object.freeze(['pdf_math_fast','pdf_math_precise']);
const KERNEL_ENGINE_SET=new Set(KERNEL_ENGINE_IDS);
const KERNEL_OPTION_NAME=/^[a-z][a-z0-9_]*$/;
const PROTOTYPE_NAMES=new Set([...Object.getOwnPropertyNames(Object.prototype),'prototype']);
const DEFAULT_PREFERENCES=Object.freeze({
 engine:'pdf_inspector',direction:'vertical',columns:1,fit:'width',zoom:1,translationMode:'reading',
 documentOpenMode:'translation',interactionMode:'comparison',restoreDocuments:true,reuseTranslations:true,emphasizeTopicSentences:false,emphasizeInformation:false,
 appearance:'system',accentColor:'system',reduceMotion:false,reduceTransparency:false,reducePadding:false,
 language:'Simplified Chinese',sourceLanguage:'English',concurrency:2,pageConcurrency:2,automatic:true,layoutVisible:false,
 kernelAdvancedOptions:{},autoHideHeader:true,uiLanguage:'en'
});
const KNOWN_KEYS=Object.freeze(Object.keys(DEFAULT_PREFERENCES));
const KNOWN_KEY_SET=new Set(KNOWN_KEYS);

function isObject(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function isRecord(value){if(!isObject(value))return false;const prototype=Object.getPrototypeOf(value);return prototype===Object.prototype||prototype===null;}
function isValidZoom(value){return Number.isFinite(value)&&value>=.1&&value<=4;}
function isValidAccentColor(value){return value==='system'||(typeof value==='string'&&/^#[\da-f]{6}$/i.test(value));}
function isValidConcurrency(value){return Number.isInteger(value)&&value>=1&&value<=12;}
function isValidKernelOptionValue(value){return Number.isFinite(value)||typeof value==='boolean'||(typeof value==='string'&&value.length<=4000);}
function isValidKernelAdvancedOptions(value){
 if(!isRecord(value))return false;
 for(const engine of Reflect.ownKeys(value)){
  if(typeof engine!=='string'||!KERNEL_ENGINE_SET.has(engine)||PROTOTYPE_NAMES.has(engine))return false;
  const options=value[engine];
  if(!isRecord(options))return false;
  for(const key of Reflect.ownKeys(options))if(typeof key!=='string'||!KERNEL_OPTION_NAME.test(key)||PROTOTYPE_NAMES.has(key)||!isValidKernelOptionValue(options[key]))return false;
 }
 return true;
}
function cloneKernelAdvancedOptions(value){
 const clone={};
 if(!isRecord(value))return clone;
 for(const engine of KERNEL_ENGINE_IDS){
  if(!Object.prototype.hasOwnProperty.call(value,engine))continue;
  const options=value[engine];
  if(!isRecord(options))continue;
  clone[engine]={};
  for(const key of Reflect.ownKeys(options))if(typeof key==='string')clone[engine][key]=options[key];
 }
 return clone;
}
function clonePreferences(value){return {...value,kernelAdvancedOptions:cloneKernelAdvancedOptions(value?.kernelAdvancedOptions)};}

const VALIDATORS={
 documentOpenMode:value=>['translation','original','manual'].includes(value),
 restoreDocuments:value=>typeof value==='boolean',
 reuseTranslations:value=>typeof value==='boolean',
 emphasizeTopicSentences:value=>typeof value==='boolean',
 emphasizeInformation:value=>typeof value==='boolean',
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
 sourceLanguage:value=>LANGUAGE_OPTIONS.includes(value),
 concurrency:isValidConcurrency,
 pageConcurrency:isValidConcurrency,
 automatic:value=>typeof value==='boolean',
 layoutVisible:value=>typeof value==='boolean',
 kernelAdvancedOptions:isValidKernelAdvancedOptions,
 autoHideHeader:value=>typeof value==='boolean',
 uiLanguage:value=>['en','zh-CN','zh-TW','fr','es','ja','ko'].includes(value)
};
const VALIDATION_MESSAGES={
 documentOpenMode:'Invalid document opening mode',
 restoreDocuments:'Invalid document restoration preference',
 reuseTranslations:'Invalid translation reuse preference',
 translationMode:'Invalid translation mode',interactionMode:'Invalid interaction mode',direction:'Invalid layout direction',columns:'Invalid layout columns',
 engine:'Invalid translation kernel',appearance:'Invalid appearance',accentColor:'Invalid accent color',
 reduceMotion:'Invalid reduce motion preference',reduceTransparency:'Invalid reduce transparency preference',reducePadding:'Invalid reduce padding preference',
 sourceLanguage:'Invalid source language preference',language:'Invalid language preference',concurrency:'Invalid concurrency preference',
 pageConcurrency:'Invalid page concurrency preference',automatic:'Invalid automatic translation preference',
 layoutVisible:'Invalid layout visibility preference',kernelAdvancedOptions:'Invalid kernel advanced options',
 autoHideHeader:'Invalid auto-hide header preference',
 uiLanguage:'Invalid UI language preference'
};

function copyUnknown(value){
 const unknown=Object.create(null);
 if(!isObject(value))return unknown;
 for(const [key,entry] of Object.entries(value))if(!KNOWN_KEY_SET.has(key))unknown[key]=entry;
 return unknown;
}

function upgrade(value){
 const next={...DEFAULT_PREFERENCES,...copyUnknown(value)};
 next.kernelAdvancedOptions=cloneKernelAdvancedOptions(DEFAULT_PREFERENCES.kernelAdvancedOptions);
 if(!isObject(value))return next;
 for(const key of KNOWN_KEYS)if(VALIDATORS[key](value[key]))next[key]=key==='kernelAdvancedOptions'?cloneKernelAdvancedOptions(value[key]):value[key];
 if(!VALIDATORS.sourceLanguage(value.sourceLanguage)){const codes=['zh','zh-TW','en','ja','ko','fr','de','es'];const index=codes.indexOf(value.kernelAdvancedOptions?.pdf_math_fast?.lang_in);if(index>=0)next.sourceLanguage=LANGUAGE_OPTIONS[index];}
 if(next.kernelAdvancedOptions.pdf_math_fast)delete next.kernelAdvancedOptions.pdf_math_fast.lang_in;
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
 let state=clonePreferences(DEFAULT_PREFERENCES);
 try{state=upgrade(JSON.parse(await readFile(path,'utf8')));}catch{}
 let writes=Promise.resolve();
 return {
  load:()=>clonePreferences(state),
  flush:()=>writes,
  save(value){
   const next={...state,...(isObject(value)?value:{})};
   validate(value,true);
   validate(next);
   const saved=clonePreferences(next);
   state=saved;
   writes=writes.catch(()=>{}).then(async()=>{await mkdir(dirname(path),{recursive:true});await writeFile(path+'.tmp',JSON.stringify(saved));await replaceFile(path+'.tmp',path);});
   return writes;
  }
 };
}
