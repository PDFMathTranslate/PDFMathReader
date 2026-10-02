import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {dirname,basename} from 'node:path';
import {randomUUID} from 'node:crypto';
const maxThumbnailLength=200000;
const pngDataURL=/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/;
const readingViewFields=['page','offsetX','offsetY','zoom','fit','direction','columns','sidebar','showTranslations'];
function validateThumbnail(thumbnail){
 if(typeof thumbnail!=='string'||thumbnail.length>maxThumbnailLength||!pngDataURL.test(thumbnail))throw Error('Invalid recent document thumbnail.');
 return thumbnail;
}
function storedThumbnail(thumbnail){try{return validateThumbnail(thumbnail);}catch{return undefined;}}
export function validateReadingView(view){
 if(!view||typeof view!=='object'||Array.isArray(view))throw Error('Invalid recent document view.');
 const keys=Reflect.ownKeys(view);
 if(keys.length!==readingViewFields.length||readingViewFields.some(key=>!Object.hasOwn(view,key)))throw Error('Invalid recent document view.');
 if(!Number.isInteger(view.page)||view.page<1||view.page>1000000)throw Error('Invalid recent document view.');
 if(!Number.isFinite(view.offsetX)||view.offsetX<-16||view.offsetX>16||!Number.isFinite(view.offsetY)||view.offsetY<-16||view.offsetY>16)throw Error('Invalid recent document view.');
 if(!Number.isFinite(view.zoom)||view.zoom<.1||view.zoom>4)throw Error('Invalid recent document view.');
 if(!['width','height','manual'].includes(view.fit)||!['vertical','horizontal'].includes(view.direction)||![1,2,4].includes(view.columns)||typeof view.sidebar!=='boolean'||typeof view.showTranslations!=='boolean')throw Error('Invalid recent document view.');
 return {page:view.page,offsetX:view.offsetX,offsetY:view.offsetY,zoom:view.zoom,fit:view.fit,direction:view.direction,columns:view.columns,sidebar:view.sidebar,showTranslations:view.showTranslations};
}
function storedReadingView(view){try{return validateReadingView(view);}catch{return undefined;}}
function cloneReadingView(view){return view===undefined?undefined:{...view};}
function listedEntry(entry){
 const result={id:entry.id,name:basename(entry.path),thumbnail:entry.thumbnail};
 if(entry.view!==undefined)result.view=cloneReadingView(entry.view);
 return result;
}
export async function createRecents(path){
 let entries=[];try{entries=JSON.parse(await readFile(path,'utf8')).filter(e=>typeof e.id==='string'&&typeof e.path==='string').slice(0,10).map(e=>{const entry={id:e.id,path:e.path},thumbnail=storedThumbnail(e.thumbnail),view=storedReadingView(e.view);if(thumbnail!==undefined)entry.thumbnail=thumbnail;if(view!==undefined)entry.view=view;return entry;});}catch{}
 let writes=Promise.resolve();
 function persist(){const data=JSON.stringify(entries);writes=writes.catch(()=>{}).then(async()=>{await mkdir(dirname(path),{recursive:true});await writeFile(path+'.tmp',data);await rename(path+'.tmp',path);});return writes;}
 return {list:()=>entries.map(listedEntry),path:id=>entries.find(e=>e.id===id)?.path,async remember(file,thumbnail){const current=entries.find(e=>e.path===file),entry={id:current?.id||randomUUID(),path:file};if(thumbnail===undefined){if(current?.thumbnail!==undefined)entry.thumbnail=current.thumbnail;}else entry.thumbnail=validateThumbnail(thumbnail);if(current?.view!==undefined)entry.view=cloneReadingView(current.view);entries=[entry,...entries.filter(e=>e.path!==file)].slice(0,10);await persist();return this.list();},async setThumbnail(id,thumbnail){const entry=entries.find(e=>e.id===id);if(!entry)throw Error('Document no longer in history.');entry.thumbnail=validateThumbnail(thumbnail);await persist();return this.list();},async setView(id,view){const validated=validateReadingView(view),entry=entries.find(e=>e.id===id);if(!entry)return this.list();entry.view=validated;await persist();return this.list();},async clear(){entries=[];await persist();return [];},flush:()=>writes};
}
