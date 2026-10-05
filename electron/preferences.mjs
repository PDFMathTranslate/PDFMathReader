import {cloneTranslationServiceHistory,isValidTranslationServiceHistory,mergeTranslationServiceHistory} from '../src/provider-history.mjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {replaceFile} from './atomic-file.mjs';
import {dirname} from 'node:path';

import {LANGUAGE_CODES,isCustomLanguageCode} from '../src/translation-languages.mjs';
const LANGUAGE_OPTIONS=Object.keys(LANGUAGE_CODES);
const KERNEL_ENGINE_IDS=Object.freeze(['pdf_math_fast','pdf_math_precise']);
const KERNEL_ENGINE_SET=new Set(KERNEL_ENGINE_IDS);
const SERVICE_ENGINE_SET=new Set(['pdf_inspector',...KERNEL_ENGINE_IDS]);
const KERNEL_OPTION_NAME=/^[a-z][a-z0-9_]*$/;
const SERVICE_ID=/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const SERVICE_FIELD_ID=/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const PROTOTYPE_NAMES=new Set([...Object.getOwnPropertyNames(Object.prototype),'prototype']);
const DEFAULT_PREFERENCES=Object.freeze({
 engine:'pdf_inspector',direction:'vertical',columns:1,fit:'width',zoom:1,translationMode:'reading',
 autoCheckUpdates:true,cacheLimitMB:null,documentOpenMode:'translation',interactionMode:'reading',restoreDocuments:true,reduceResourceUsage:true,reduceBackgroundFrameRate:true,reuseTranslations:true,emphasizeTopicSentences:false,emphasizeInformation:false,emphasizeResearchFindings:true,emphasizeOrdinals:true,emphasizeKeyVerbs:true,emphasizeLogicalConnectives:true,
 appearance:'system',accentColor:'system',reduceMotion:false,reduceTransparency:false,reducePadding:false,
 language:'Simplified Chinese',sourceLanguage:'English',concurrency:2,pageConcurrency:2,automatic:true,layoutVisible:false,defaultPageCropEnabled:false,defaultPageCropX:0,defaultPageCropY:0,autoAlignDocumentWidth:false,
 kernelAdvancedOptions:{},autoHideHeader:true,uiLanguage:'system'
});
const KNOWN_KEYS=Object.freeze(Object.keys(DEFAULT_PREFERENCES));
const OPTIONAL_KEYS=Object.freeze(['translationServices','translationServiceHistory']);
const PREFERENCE_KEYS=Object.freeze([...KNOWN_KEYS,...OPTIONAL_KEYS]);
const KNOWN_KEY_SET=new Set(PREFERENCE_KEYS);

function isObject(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function isRecord(value){if(!isObject(value))return false;const prototype=Object.getPrototypeOf(value);return prototype===Object.prototype||prototype===null;}
function isValidZoom(value){return Number.isFinite(value)&&value>=.1&&value<=4;}
function isValidPageCropRatio(value){return Number.isFinite(value)&&value>=0&&value<=.5;}
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
const SECRET_SERVICE_FIELD=/(?:api[_-]?key|auth[_-]?key|access[_-]?token)|(?:^|[_-])(token|secret|password|credential|key)(?:$|[_-])/i;
function isValidServiceValue(value){return typeof value==='string'&&value.length<=16384&&!/[\r\n]/.test(value)||typeof value==='number'&&Number.isFinite(value)||typeof value==='boolean';}
function isValidServiceValues(value){
 if(!isRecord(value))return false;
 for(const key of Reflect.ownKeys(value))if(typeof key!=='string'||!SERVICE_FIELD_ID.test(key)||PROTOTYPE_NAMES.has(key)||SECRET_SERVICE_FIELD.test(key)||!isValidServiceValue(value[key]))return false;
 return true;
}
function isValidTranslationServices(value){
 if(!isRecord(value))return false;
 for(const engine of Reflect.ownKeys(value)){
  if(typeof engine!=='string'||!SERVICE_ENGINE_SET.has(engine)||PROTOTYPE_NAMES.has(engine))return false;
  const config=value[engine];if(!isRecord(config)||typeof config.id!=='string'||!SERVICE_ID.test(config.id)||!isValidServiceValues(config.values||{}))return false;
  if(config.profiles!==undefined){if(!isRecord(config.profiles))return false;for(const service of Reflect.ownKeys(config.profiles)){if(typeof service!=='string'||!SERVICE_ID.test(service)||PROTOTYPE_NAMES.has(service))return false;const profile=config.profiles[service];if(!isRecord(profile)||!isValidServiceValues(profile.values||{}))return false;}}
 }
 return true;
}
function cloneServiceValues(value){const clone={};if(!isRecord(value))return clone;for(const [key,entry] of Object.entries(value))if(SERVICE_FIELD_ID.test(key)&&isValidServiceValue(entry)&&!SECRET_SERVICE_FIELD.test(key))clone[key]=entry;return clone;}
function cloneTranslationServices(value){
 const clone={};if(!isRecord(value))return clone;
 for(const engine of ['pdf_inspector',...KERNEL_ENGINE_IDS]){
  const config=value[engine];if(!isRecord(config)||typeof config.id!=='string')continue;
  const next={id:config.id,values:cloneServiceValues(config.values),profiles:{}};
  if(isRecord(config.profiles))for(const [service,profile] of Object.entries(config.profiles))if(isRecord(profile))next.profiles[service]={values:cloneServiceValues(profile.values)};
  clone[engine]=next;
 }
 return clone;
}
function clonePreferences(value){const clone={...value,kernelAdvancedOptions:cloneKernelAdvancedOptions(value?.kernelAdvancedOptions)};if(Object.prototype.hasOwnProperty.call(value||{},'translationServices'))clone.translationServices=cloneTranslationServices(value.translationServices);if(Object.hasOwn(value||{},'translationServiceHistory'))clone.translationServiceHistory=cloneTranslationServiceHistory(value.translationServiceHistory);return clone;}

const VALIDATORS={
 autoCheckUpdates:value=>typeof value==='boolean',
 cacheLimitMB:value=>value===null||[512,1024,2048,5120,10240].includes(value),
 documentOpenMode:value=>['translation','original','manual'].includes(value),
 restoreDocuments:value=>typeof value==='boolean',
 reduceResourceUsage:value=>typeof value==='boolean',
 reduceBackgroundFrameRate:value=>typeof value==='boolean',
 reuseTranslations:value=>typeof value==='boolean',
 emphasizeTopicSentences:value=>typeof value==='boolean',
 emphasizeInformation:value=>typeof value==='boolean',
 emphasizeResearchFindings:value=>typeof value==='boolean',
 emphasizeOrdinals:value=>typeof value==='boolean',
 emphasizeKeyVerbs:value=>typeof value==='boolean',
 emphasizeLogicalConnectives:value=>typeof value==='boolean',
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
 language:value=>(LANGUAGE_OPTIONS.includes(value)||isCustomLanguageCode(value)),
 sourceLanguage:value=>(LANGUAGE_OPTIONS.includes(value)||isCustomLanguageCode(value)),
 concurrency:isValidConcurrency,
 pageConcurrency:isValidConcurrency,
 automatic:value=>typeof value==='boolean',
 layoutVisible:value=>typeof value==='boolean',
 defaultPageCropEnabled:value=>typeof value==='boolean',
 defaultPageCropX:isValidPageCropRatio,
 defaultPageCropY:isValidPageCropRatio,
 autoAlignDocumentWidth:value=>typeof value==='boolean',
 kernelAdvancedOptions:isValidKernelAdvancedOptions,
 autoHideHeader:value=>typeof value==='boolean',
 uiLanguage:value=>['system','en','zh-CN','zh-TW','fr','es','ja','ko'].includes(value),
 translationServiceHistory:isValidTranslationServiceHistory,
 translationServices:isValidTranslationServices
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
 layoutVisible:'Invalid layout visibility preference',defaultPageCropEnabled:'Invalid default page crop enabled preference',defaultPageCropX:'Invalid default page crop X preference',defaultPageCropY:'Invalid default page crop Y preference',autoAlignDocumentWidth:'Invalid auto-align document width preference',kernelAdvancedOptions:'Invalid kernel advanced options',
 autoHideHeader:'Invalid auto-hide header preference',
 translationServiceHistory:'Invalid translation service history',uiLanguage:'Invalid UI language preference',translationServices:'Invalid translation service preferences'
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
 for(const key of PREFERENCE_KEYS)if(VALIDATORS[key](value[key]))next[key]=key==='kernelAdvancedOptions'?cloneKernelAdvancedOptions(value[key]):key==='translationServices'?cloneTranslationServices(value[key]):key==='translationServiceHistory'?cloneTranslationServiceHistory(value[key]):value[key];
 if(!VALIDATORS.sourceLanguage(value.sourceLanguage)){const entry=Object.entries(LANGUAGE_CODES).find(([,code])=>code===value.kernelAdvancedOptions?.pdf_math_fast?.lang_in);if(entry)next.sourceLanguage=entry[0];}
 if(next.kernelAdvancedOptions.pdf_math_fast)delete next.kernelAdvancedOptions.pdf_math_fast.lang_in;
 return next;
}

function invalidPreference(message='Invalid reader preferences'){throw Error(message);}

function validate(value,partial=false){
 if(!isObject(value))invalidPreference();
 for(const key of PREFERENCE_KEYS){
  const present=Object.prototype.hasOwnProperty.call(value,key),optional=OPTIONAL_KEYS.includes(key);
  if((present||!partial&&!optional)&&!VALIDATORS[key](value[key]))invalidPreference(VALIDATION_MESSAGES[key]);
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
   if(Object.hasOwn(value||{},'translationServiceHistory'))next.translationServiceHistory=mergeTranslationServiceHistory(state.translationServiceHistory,value.translationServiceHistory);
   validate(next);
   if(Object.prototype.hasOwnProperty.call(next,'translationServices'))next.translationServices=cloneTranslationServices(next.translationServices);
   const saved=clonePreferences(next);
   state=saved;
   writes=writes.catch(()=>{}).then(async()=>{await mkdir(dirname(path),{recursive:true});await writeFile(path+'.tmp',JSON.stringify(saved));await replaceFile(path+'.tmp',path);});
   return writes;
  }
 };
}
