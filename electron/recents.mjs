import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {dirname,basename} from 'node:path';
import {randomUUID} from 'node:crypto';
const maxThumbnailLength=200000;
const maxUnpinnedRecents=10;
const pngDataURL=/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;
const readingViewFields=['page','offsetX','offsetY','zoom','fit','direction','columns','sidebar','showTranslations'];
const translationStatusFields=['totalPages','completedPages','partialPages','failedPages','engine','language','updatedAt'];
const translationEngines=new Set(['pdf_inspector','pdf_math_fast','pdf_math_precise']);
function validateThumbnail(thumbnail){
 if(typeof thumbnail!=='string'||thumbnail.length>maxThumbnailLength||!pngDataURL.test(thumbnail))throw Error('Invalid recent document thumbnail.');
 return thumbnail;
}
function storedThumbnail(thumbnail){try{return validateThumbnail(thumbnail);}catch{return undefined;}}
export function validateReadingView(view){
 if(!view||typeof view!=='object'||Array.isArray(view))throw Error('Invalid recent document view.');
 const keys=Reflect.ownKeys(view);
 if(keys.length!==readingViewFields.length+['sidebarMode','cropX','cropY'].filter(key=>Object.hasOwn(view,key)).length||readingViewFields.some(key=>!Object.hasOwn(view,key)))throw Error('Invalid recent document view.');
 if(!Number.isInteger(view.page)||view.page<1||view.page>1000000)throw Error('Invalid recent document view.');
 if(!Number.isFinite(view.offsetX)||view.offsetX<-16||view.offsetX>16||!Number.isFinite(view.offsetY)||view.offsetY<-16||view.offsetY>16)throw Error('Invalid recent document view.');
 if(!Number.isFinite(view.zoom)||view.zoom<.1||view.zoom>4)throw Error('Invalid recent document view.');
 if(!['width','height','manual'].includes(view.fit)||!['vertical','horizontal'].includes(view.direction)||![1,2,4].includes(view.columns)||typeof view.sidebar!=='boolean'||typeof view.showTranslations!=='boolean')throw Error('Invalid recent document view.');
 if(Object.hasOwn(view,'sidebarMode')&&!['thumbnails','outline','annotations'].includes(view.sidebarMode))throw Error('Invalid recent document sidebar mode.');
 for(const key of ['cropX','cropY'])if(Object.hasOwn(view,key)&&(!Number.isFinite(view[key])||view[key]<0||view[key]>.8))throw Error('Invalid page crop.');
 return {...Object.fromEntries(['cropX','cropY'].filter(key=>Object.hasOwn(view,key)).map(key=>[key,view[key]])),...(Object.hasOwn(view,'sidebarMode')?{sidebarMode:view.sidebarMode}:{}),page:view.page,offsetX:view.offsetX,offsetY:view.offsetY,zoom:view.zoom,fit:view.fit,direction:view.direction,columns:view.columns,sidebar:view.sidebar,showTranslations:view.showTranslations};
}
function storedReadingView(view){try{return validateReadingView(view);}catch{return undefined;}}
function cloneReadingView(view){return view===undefined?undefined:{...view};}
export function validateTranslationStatus(status){
 if(!status||typeof status!=='object'||Array.isArray(status))throw Error('Invalid recent document translation status.');
 const keys=Reflect.ownKeys(status);
 if(keys.length!==translationStatusFields.length||translationStatusFields.some(key=>!Object.hasOwn(status,key)))throw Error('Invalid recent document translation status.');
 if(!Number.isInteger(status.totalPages)||status.totalPages<0||!Number.isInteger(status.completedPages)||status.completedPages<0||status.completedPages>status.totalPages||!Number.isInteger(status.partialPages)||status.partialPages<0||status.partialPages>status.totalPages||!Number.isInteger(status.failedPages)||status.failedPages<0||status.failedPages>status.totalPages||status.completedPages+status.partialPages+status.failedPages>status.totalPages)throw Error('Invalid recent document translation status.');
 if(!translationEngines.has(status.engine)||typeof status.language!=='string'||status.language.length>100||!Number.isFinite(status.updatedAt))throw Error('Invalid recent document translation status.');
 return {totalPages:status.totalPages,completedPages:status.completedPages,partialPages:status.partialPages,failedPages:status.failedPages,engine:status.engine,language:status.language,updatedAt:status.updatedAt};
}
function storedTranslationStatus(status){try{return validateTranslationStatus(status);}catch{return undefined;}}
function cloneTranslationStatus(status){return status===undefined?undefined:{...status};}
function normalizeEntries(entries){
 const pinned=[],unpinned=[];
 for(const entry of entries)(entry.pinned?pinned:unpinned).push(entry);
 return [...pinned,...unpinned.slice(0,maxUnpinnedRecents)];
}
function listedEntry(entry){
 const result={id:entry.id,name:basename(entry.path),thumbnail:entry.thumbnail,pinned:entry.pinned===true};
 if(entry.view!==undefined)result.view=cloneReadingView(entry.view);
 if(entry.translationStatus!==undefined)result.translationStatus=cloneTranslationStatus(entry.translationStatus);
 return result;
}
export async function createRecents(path){
 let entries=[];try{const stored=JSON.parse(await readFile(path,'utf8'));entries=normalizeEntries((Array.isArray(stored)?stored:[]).filter(e=>e&&typeof e.id==='string'&&typeof e.path==='string').map(e=>{const entry={id:e.id,path:e.path,pinned:e.pinned===true},thumbnail=storedThumbnail(e.thumbnail),view=storedReadingView(e.view),translationStatus=storedTranslationStatus(e.translationStatus);if(thumbnail!==undefined)entry.thumbnail=thumbnail;if(view!==undefined)entry.view=view;if(translationStatus!==undefined)entry.translationStatus=translationStatus;return entry;}));}catch{}
 let writes=Promise.resolve();
 function persist(){const data=JSON.stringify(entries);writes=writes.catch(()=>{}).then(async()=>{await mkdir(dirname(path),{recursive:true});await writeFile(path+'.tmp',data);await rename(path+'.tmp',path);});return writes;}
 return {list:()=>entries.map(listedEntry),path:id=>entries.find(e=>e.id===id)?.path,async remember(file,thumbnail){const current=entries.find(e=>e.path===file),entry={id:current?.id||randomUUID(),path:file,pinned:current?.pinned===true};if(thumbnail===undefined){if(current?.thumbnail!==undefined)entry.thumbnail=current.thumbnail;}else entry.thumbnail=validateThumbnail(thumbnail);if(current?.view!==undefined)entry.view=cloneReadingView(current.view);if(current?.translationStatus!==undefined)entry.translationStatus=cloneTranslationStatus(current.translationStatus);entries=normalizeEntries([entry,...entries.filter(e=>e.path!==file)]);await persist();return this.list();},async setThumbnail(id,thumbnail){const entry=entries.find(e=>e.id===id);if(!entry)throw Error('Document no longer in history.');entry.thumbnail=validateThumbnail(thumbnail);await persist();return this.list();},async setView(id,view){const validated=validateReadingView(view),entry=entries.find(e=>e.id===id);if(!entry)return this.list();entry.view=validated;await persist();return this.list();},async setTranslationStatus(id,status){const validated=validateTranslationStatus(status),entry=entries.find(e=>e.id===id);if(!entry)return this.list();entry.translationStatus=validated;await persist();return this.list();},async clearTranslationStatus(id){const entry=entries.find(e=>e.id===id);if(!entry)return this.list();delete entry.translationStatus;await persist();return this.list();},async setPinned(id,pinned){if(typeof pinned!=='boolean')throw Error('Invalid recent document pinned state.');const entry=entries.find(e=>e.id===id);if(!entry)return this.list();entry.pinned=pinned;entries=normalizeEntries(entries);await persist();return this.list();},async remove(id){const index=entries.findIndex(e=>e.id===id);if(index<0)throw Error('Document no longer in history.');entries.splice(index,1);await persist();return this.list();},async clear(){entries=entries.filter(entry=>entry.pinned);await persist();return this.list();},flush:()=>writes};
}
