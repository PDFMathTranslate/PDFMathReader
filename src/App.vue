<script setup>
import {ref,shallowRef,reactive,computed,watch,nextTick,onMounted,onBeforeUnmount,markRaw} from 'vue';
import {loadPDFRuntime} from './pdf-runtime.mjs';
import {buildReaderLayout,visibleReaderWindow,buildThumbnailLayout,visibleThumbnailWindow} from './reader-layout.mjs';
import {pageNote as getPageNote} from './page-note.mjs';
function pageNote(p){return getPageNote(p,engine.value);}
import ReaderPage from './ReaderPage.vue';
import {createResizeSnapshot} from './resize-snapshot.mjs';
import {createPerformanceRecorder} from './performance-recorder.mjs';
const performanceRecorder=createPerformanceRecorder({fetchStats:()=>api('/api/performance')});
window.previewPerformanceReport=()=>performanceRecorder.snapshot();
import {translationPages} from './translation-scope.mjs';
import {BitmapCache} from './bitmap-cache.mjs';
import {snapshot,revealPDF} from './text-reveal.mjs';
let getDocument,pdfWorker;async function ensurePDF(){if(!getDocument){const runtime=await loadPDFRuntime();pdfWorker??=new runtime.PDFWorker({name:'PDFMathReader'});getDocument=source=>runtime.getDocument({...source,worker:pdfWorker});}}
const recentDocuments=ref([]);
const renderMetrics={pageFrames:0,thumbnailFrames:0,cacheHits:0,viewportLookups:0,geometryReads:0,openedAt:0,firstPageMs:null,peakResidentBytes:0};
let recentPreviewGeneration=0;
async function pagePreview(pdfDocument){
 if(!foreground.value)return '';
 const page=await pdfDocument.getPage(1),bounds=page.getViewport({scale:1});
 const canvas=window.document.createElement('canvas');
 for(const size of [360,260,180]){
  const viewport=page.getViewport({scale:size/Math.max(bounds.width,bounds.height)});
  canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
  if(!foreground.value)return '';
  const task=page.render({canvasContext:canvas.getContext('2d'),viewport,background:'#ffffff'});pageTasks.set(canvas,task);
  try{await task.promise;}finally{if(pageTasks.get(canvas)===task)pageTasks.delete(canvas);}
  if(!foreground.value)return '';
  const image=canvas.toDataURL('image/png');if(image.length<=200000)return image;
 }
 return '';
}
async function loadRecentPreviews(){
 const generation=++recentPreviewGeneration;
 for(const entry of [...recentDocuments.value]){
  if(pageHidden()||window.previewActivityActive===false)return;
  if(generation!==recentPreviewGeneration)return;
  if(entry.thumbnail)continue;
  let task;
  try{
   const {bytes}=await window.previewRecents.preview(entry.id);
   if(generation!==recentPreviewGeneration)return;
   await ensurePDF();task=getDocument({data:new Uint8Array(bytes)});
   const image=await pagePreview(await task.promise);
   if(generation!==recentPreviewGeneration||!recentDocuments.value.some(item=>item.id===entry.id))return;
   if(image){await window.previewRecents.setThumbnail(entry.id,image);const current=recentDocuments.value.find(item=>item.id===entry.id);if(current&&generation===recentPreviewGeneration)current.thumbnail=image;}
  }catch{const current=recentDocuments.value.find(item=>item.id===entry.id);if(current&&generation===recentPreviewGeneration)current.previewUnavailable=true;}
  finally{await task?.destroy();}
 }
}
async function openRecent(id){const token=epoch;try{if((pages.value.length||loading.value)&&window.previewRecents.openWindow){await window.previewRecents.openWindow(id);return;}const document=await window.previewRecents.open(id);if(token!==epoch)return;await importFile(new File([document.bytes],document.name,{type:'application/pdf'}),document.ticket);}catch{if(token===epoch)error.value='This PDF is unavailable. It may have been moved or deleted.';}}
async function clearRecent(){++recentPreviewGeneration;try{recentDocuments.value=await window.previewRecents.clear();}catch{error.value='Could not clear document history.';}}
const fileInput=ref(),reader=ref(),pages=shallowRef([]),title=ref('PDFMathReader'),active=ref(1),zoom=ref(1),sidebar=ref(true),settings=ref(false),language=ref(localStorage.getItem('language')||'Simplified Chinese'),concurrency=ref(4),automatic=ref(true),layoutVisible=ref(false),error=ref(''),loading=ref(false),configured=ref(false),model=ref(''),reading=ref('Ready to read'),showTranslations=ref(true);
const fullscreen=ref(false);let stopFullscreen;
watch(fullscreen,()=>{dismissPopovers();nextTick(()=>resizeFit(true));});
const testMode=window.previewTestMode===true;
const pageHidden=()=>document.hidden&&!window.previewRenderInBackground;
const activityActive=ref(true),foreground=ref(!pageHidden());let stopActivity;
function updateForeground(){const value=activityActive.value&&!pageHidden();foreground.value=value;window.previewActivityActive=value;if(!value){resizeSnapshot.cancel();void saveReadingView();clearTimeout(timer);cancelAnimationFrame(viewportFrame);viewportFrame=0;++renderEpoch;++thumbnailEpoch;pageTasks.forEach(task=>task.cancel());pageTasks.clear();revealControllers.forEach(c=>c.abort());revealControllers.clear();reading.value='Paused';}else{scheduleViewport();void renderThumbnails();void loadRecentPreviews();settle();}}

const selectedParagraph=ref(null);
const direction=ref('vertical'),columns=ref(1);
const restoringView=ref(false);let currentRecentId=null,readingSaveTimer;
function readingView(){
 const el=reader.value,p=pages.value[active.value-1],host=p&&pageEls.get(p.number);if(!el||!host)return null;
 const bounds=el.getBoundingClientRect(),box=host.getBoundingClientRect(),style=getComputedStyle(el);
 return {page:p.number,offsetX:Math.max(-16,Math.min(16,(bounds.left+parseFloat(style.paddingLeft)-box.left)/box.width)),offsetY:Math.max(-16,Math.min(16,(bounds.top+parseFloat(style.paddingTop)-box.top)/box.height)),zoom:zoom.value,fit:fitMode.value,direction:direction.value,columns:columns.value,sidebar:sidebar.value,showTranslations:showTranslations.value};
}
async function saveReadingView(){clearTimeout(readingSaveTimer);if(restoringView.value||loading.value||!currentRecentId)return;const view=readingView();if(view)try{await window.previewRecents?.setView(currentRecentId,view);}catch{error.value='Could not save the reading position.';}}
function scheduleReadingSave(){if(restoringView.value||loading.value||!currentRecentId)return;clearTimeout(readingSaveTimer);readingSaveTimer=setTimeout(saveReadingView,180);}
window.previewSaveReadingView=async()=>{await performanceRecorder.finish();await saveReadingView();};
async function restoreReadingView(view){
 if(view){direction.value=view.direction;columns.value=view.columns;sidebar.value=view.sidebar;showTranslations.value=view.showTranslations;fitMode.value=view.fit;zoom.value=view.zoom;active.value=Math.min(pages.value.length,Math.max(1,view.page));pageEntry.value=active.value;}
 mountAroundPage(active.value);await nextTick();applyFit();await nextTick();updateReaderInsets();applyFit();await nextTick();
 const el=reader.value,host=pageEls.get(active.value);if(!el||!host)return;
 // A page-relative anchor survives viewport, scrollbar and fit-size changes.
 const bounds=el.getBoundingClientRect(),box=host.getBoundingClientRect(),style=getComputedStyle(el);
 el.scrollLeft+=box.left-bounds.left-parseFloat(style.paddingLeft)+(view?.offsetX||0)*box.width;
 el.scrollTop+=box.top-bounds.top-parseFloat(style.paddingTop)+(view?.offsetY||0)*box.height;
}

const fitMode=ref(['width','height','manual'].includes(localStorage.getItem('readerFit'))?localStorage.getItem('readerFit'):'width');
const languageInput=ref(),kernelInput=ref(),navigator=ref(),navigatorVisible=ref(false),pageEntry=ref(1);
const translationMode=ref(localStorage.getItem('translationMode')==='full'?'full':'reading');
const translationModes=[{id:'full',label:'完整翻译',description:'打开文档即翻译全部'},{id:'reading',label:'降低翻译请求',description:'只在阅读时翻译当页和上下两页'}];
function scopePages(){return new Set(translationPages(translationMode.value,active.value,pages.value.length));}
function pruneTranslationQueue(){const allowed=scopePages();for(let i=pageQueue.length-1;i>=0;i--)if(!allowed.has(pageQueue[i].p.number)){const {p}=pageQueue.splice(i,1)[0];if(p.status==='queued')p.status=p.blocks.length?'ready':'idle';}for(let i=queue.length-1;i>=0;i--)if(!queue[i].manual&&!allowed.has(queue[i].page)){const job=queue.splice(i,1)[0];if(job.block.status==='queued')job.block.status='idle';}}
function modeKeys(e){let i=translationModes.findIndex(m=>m.id===translationMode.value);if(e.key==='ArrowLeft'||e.key==='Home')i=0;else if(e.key==='ArrowRight'||e.key==='End')i=1;else return;e.preventDefault();const group=e.currentTarget;translationMode.value=translationModes[i].id;nextTick(()=>group?.querySelector('[aria-checked="true"]')?.focus());}
watch(translationMode,()=>{localStorage.setItem('translationMode',translationMode.value);saveView();pruneTranslationQueue();settle();});
watch(active,pruneTranslationQueue);
const kernelOptions=[{id:'pdf_inspector',label:'Ultra fast'},{id:'pdf_math_fast',label:'Fast'},{id:'pdf_math_precise',label:'Precise'}];
let resizeObserver,navigatorTimer,stopActions,kernelFocusPending=false;
if(fitMode.value==='manual')zoom.value=Math.min(3,Math.max(.25,Number(localStorage.getItem('readerZoom'))||1));
function updateReaderInsets(){
 const el=reader.value;if(!el)return false;
 const style=getComputedStyle(el),inline=Math.max(0,(el.offsetWidth-el.clientWidth-parseFloat(style.borderLeftWidth)-parseFloat(style.borderRightWidth))/2),block=Math.max(0,el.offsetHeight-el.clientHeight-parseFloat(style.borderTopWidth)-parseFloat(style.borderBottomWidth));
 const layout=el.querySelector('.page-layout'),available=el.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);
 const contentWidth=layout?layout.getBoundingClientRect().width-parseFloat(getComputedStyle(layout).paddingRight):0;
 const end=contentWidth>available+1?inline*2:0;
 let changed=false;
 for(const [name,value] of [['--scrollbar-inline-inset',inline],['--scrollbar-block-inset',block],['--overflow-end-inset',end]]){const pixels=Math.min(48,value)+'px';if(el.style.getPropertyValue(name)!==pixels){el.style.setProperty(name,pixels);changed=true;}}
 return changed;
}
const fitRowWidth=computed(()=>{const widths=Array(columns.value).fill(0);pages.value.forEach((page,index)=>widths[index%columns.value]=Math.max(widths[index%columns.value],page.width));return widths.reduce((sum,width)=>sum+width,0);});
let fitAdjusting=false;
function applyFit(){updateReaderInsets();const p=currentPage.value,el=reader.value;if(!p||!el||fitMode.value==='manual')return;const style=getComputedStyle(el);const width=el.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight);const count=direction.value==='vertical'?columns.value:1;const layout=el.querySelector('.page-layout'),gap=layout?parseFloat(getComputedStyle(layout).columnGap)||0:24;const availableWidth=(width-gap*(count-1))/count;const height=el.clientHeight-parseFloat(style.paddingTop)-parseFloat(style.paddingBottom);const frame=pageEls.get(p.number),border=frame?getComputedStyle(frame):null;const borderWidth=border?parseFloat(border.borderLeftWidth)+parseFloat(border.borderRightWidth):0,borderHeight=border?parseFloat(border.borderTopWidth)+parseFloat(border.borderBottomWidth):0;const scale=Math.max(.1,Math.min(4,fitMode.value==='width'?(availableWidth-borderWidth)/(count>1?fitRowWidth.value/count:p.width):(height-borderHeight)/(count>1?Math.max(...pages.value.slice(Math.floor((p.number-1)/count)*count,Math.floor((p.number-1)/count)*count+count).map(page=>page.height)):p.height)));
 if(Math.abs(scale-zoom.value)<.0001)return;
 // Anchor the visible part of the active page before preceding pages resize.
 const bounds=el.getBoundingClientRect(),box=frame?.getBoundingClientRect();
 const point=box?{x:Math.max(box.left,bounds.left+parseFloat(style.paddingLeft)),y:Math.max(box.top,bounds.top+parseFloat(style.paddingTop))}:null;
 const anchor=box?{x:(point.x-box.left)/box.width,y:(point.y-box.top)/box.height}:null,token=epoch;
 if(anchor&&fitMode.value==='width'&&count===1){anchor.x=0;point.x=bounds.left+parseFloat(style.paddingLeft);}
 fitAdjusting=true;el.dataset.fitting='true';zoom.value=scale;
 nextTick(()=>{
  if(token!==epoch){fitAdjusting=false;delete el.dataset.fitting;return;}
  const after=frame?.isConnected?frame.getBoundingClientRect():null;
  if(after&&anchor){el.scrollTop+=after.top+anchor.y*after.height-point.y;el.scrollLeft+=after.left+anchor.x*after.width-point.x;}
  fitAdjusting=false;delete el.dataset.fitting;scheduleViewport();
 });
}
let fitFrame=0,fitResizeTimer,fitResizing=false;
const workspace=ref(),resizeActive=ref(false);
const resizeSnapshot=createResizeSnapshot({workspace:()=>workspace.value,reader:()=>reader.value,flush:nextTick,metric:name=>performanceRecorder.resize(name),state:value=>{const wasActive=resizeActive.value;resizeActive.value=value;if(value){fitResizing=true;++renderEpoch;pageTasks.forEach(task=>task.cancel());pageTasks.clear();revealControllers.forEach(controller=>controller.abort());revealControllers.clear();}else{fitResizing=false;if(wasActive)nextTick(observeThumbnails);}},commit:async()=>{fitResizing=true;await nextTick();applyFit();await nextTick();await renderPages(false,true);fitResizing=false;observeThumbnails();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));scheduleReadingSave();}});
let sidebarChange=Promise.resolve();
function toggleSidebar(){if(!pages.value.length||restoringView.value)return;const token=epoch;sidebarChange=sidebarChange.then(()=>{if(token===epoch&&pages.value.length&&!restoringView.value)return resizeSnapshot.toggle(()=>sidebar.value=!sidebar.value);}).catch(()=>{error.value='Could not update the window layout.';});}
let lastWindowWidth=innerWidth,lastWindowHeight=innerHeight;
function resizeFit(force=false){if(restoringView.value||!pages.value.length)return;if(force!==true&&lastWindowWidth===innerWidth&&lastWindowHeight===innerHeight)return;lastWindowWidth=innerWidth;lastWindowHeight=innerHeight;fitResizing=true;resizeSnapshot.resize();}
let loadingPreferences=true;
function saveView(force=false){if(loadingPreferences||(restoringView.value&&!force))return;window.previewPreferences?.save({...force?{engine:engine.value}:{},fit:fitMode.value,zoom:zoom.value,translationMode:translationMode.value,direction:direction.value,columns:columns.value}).catch(()=>{error.value='Could not save reading preferences.';});}
function chooseFit(mode){fitMode.value=mode;localStorage.setItem('readerFit',mode);applyFit();saveView();}
function changeZoom(delta){fitMode.value='manual';localStorage.setItem('readerFit','manual');zoom.value=Math.min(4,Math.max(.1,Math.round((zoom.value+delta)*10000)/10000));saveView();}
let previewScrolling=false,previewTimer,previewFlushing=false;const pendingPreview=new Map(),canvasCache=new WeakMap();
function interruptPreview(){if(!previewScrolling){previewScrolling=true;revealControllers.forEach(c=>c.abort());revealControllers.clear();}clearTimeout(previewTimer);previewTimer=setTimeout(()=>{previewScrolling=false;void renderPages();flushPreview();},180);}
function queuePreview(p){pendingPreview.set(p.number,p);if(!previewScrolling&&!pinching.value)requestAnimationFrame(flushPreview);}
async function flushPreview(){if(!foreground.value||previewFlushing||previewScrolling||pinching.value)return;previewFlushing=true;try{const token=epoch;for(const [number,p] of pendingPreview){if(previewScrolling||pinching.value||token!==epoch)return;pendingPreview.delete(number);const host=pageEls.get(number);if(!host)continue;const rect=host.getBoundingClientRect(),bounds=reader.value.getBoundingClientRect();if(rect.bottom<bounds.top||rect.top>bounds.bottom||rect.right<bounds.left||rect.left>bounds.right)continue;const page=await (p.mathDocument&&showTranslations.value?p.mathDocument.getPage(1):pdf.getPage(number));if(token!==epoch)return;const changed=canvasCache.get(canvasEls.get(number))?.page!==page;const previous=changed&&p.mathDocument?snapshot(canvasEls.get(number)):null;if(await draw(page,canvasEls.get(number),zoom.value)&&changed&&previous&&!previewScrolling)animatePDF(p,page,previous);}}finally{previewFlushing=false;if(pendingPreview.size&&!previewScrolling&&!pinching.value)requestAnimationFrame(flushPreview);}}
const pinching=ref(false);let pinchFrame=0,pinchTimer,pinchDelta=0,pinchPoint;
function pinchWheel(e){
 if(!e.ctrlKey){interruptPreview();return;}if(!pages.value.length)return;
 e.preventDefault();
 if(!pinching.value){pinching.value=true;dismissPopovers();revealControllers.forEach(c=>c.abort());revealControllers.clear();pageTasks.forEach(task=>task.cancel());++renderEpoch;fitMode.value='manual';localStorage.setItem('readerFit','manual');}
 pinchDelta+=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?reader.value.clientHeight:1);pinchPoint={x:e.clientX,y:e.clientY};
 if(!pinchFrame)pinchFrame=requestAnimationFrame(applyPinch);
 clearTimeout(pinchTimer);pinchTimer=setTimeout(finishPinch,160);
}
async function applyPinch(){
 pinchFrame=0;const delta=pinchDelta;pinchDelta=0;const el=reader.value;if(!el||!pinchPoint)return;
 const point=pinchPoint,hosts=[...pageEls.values()];const host=hosts.find(h=>{const r=h.getBoundingClientRect();return point.y>=r.top&&point.y<=r.bottom;})||pageEls.get(active.value);if(!host)return;
 const before=host.getBoundingClientRect(),x=(point.x-before.left)/before.width,y=(point.y-before.top)/before.height;
 zoom.value=Math.min(4,Math.max(.1,zoom.value*Math.exp(-delta*.01)));
 await nextTick();const after=host.getBoundingClientRect();el.scrollLeft+=after.left+x*after.width-point.x;el.scrollTop+=after.top+y*after.height-point.y;
}
async function finishPinch(){const token=epoch;if(pinchFrame){cancelAnimationFrame(pinchFrame);await applyPinch();}pinching.value=false;await nextTick();await renderPages();if(token!==epoch)return;saveView();settle();}
function manualZoom(){fitMode.value='manual';localStorage.setItem('readerFit','manual');saveView();}
function hideNavigatorLater(){clearTimeout(navigatorTimer);navigatorTimer=setTimeout(()=>{if(!navigator.value?.contains(document.activeElement))navigatorVisible.value=false;},1000);}
function holdNavigator(){clearTimeout(navigatorTimer);}
function showNavigator(){navigatorVisible.value=!!pages.value.length;hideNavigatorLater();}
function submitPage(){go(Number(pageEntry.value));}
async function openSettings(target){selectedParagraph.value=null;settings.value=true;await nextTick();if(target==='language'){languageInput.value?.focus();try{languageInput.value?.showPicker?.();}catch{}}else if(target==='kernel'){kernelFocusPending=engineBusy.value;kernelInput.value?.querySelector('[aria-checked="true"]')?.focus();}}
function chooseKernel(id){kernelFocusPending=!!kernelInput.value?.contains(document.activeElement);engine.value=id;}
function kernelKeys(e){const current=kernelOptions.findIndex(k=>k.id===engine.value);const index=e.key==='ArrowRight'?Math.min(2,current+1):e.key==='ArrowLeft'?Math.max(0,current-1):e.key==='Home'?0:e.key==='End'?2:null;if(index===null)return;e.preventDefault();if(engineBusy.value)return;kernelFocusPending=true;engine.value=kernelOptions[index].id;nextTick(()=>kernelInput.value?.querySelector('[aria-checked="true"]')?.focus());}
function readerAction(action){if(action.startsWith('layout:'))direction.value=action.split(':')[1];else if(action.startsWith('columns:'))columns.value=Number(action.split(':')[1]);else if(action==='close-document')void closeDocument();else if(action==='recents'){if((pages.value.length||loading.value)&&window.previewWindow?.new)void window.previewWindow.new();else void closeDocument();}else if(action==='preferences')openSettings();else if(action==='open')fileInput.value?.click();else if(action==='translation')showTranslations.value=!showTranslations.value;else if(action==='zoom-in')changeZoom(.1);else if(action==='zoom-out')changeZoom(-.1);else if(action==='sidebar'){if(pages.value.length)toggleSidebar();}else if(action==='settings')settings.value?settings.value=false:openSettings();else if(action==='language'||action==='kernel')openSettings(action);else if(action==='fit-width')chooseFit('width');else if(action==='fit-height')chooseFit('height');else if(action.startsWith('percent:'))go(Math.max(1,Math.ceil(pages.value.length*Number(action.split(':')[1])/100)));}
function dismissPopovers(){settings.value=false;selectedParagraph.value=null;kernelFocusPending=false;error.value='';}
function outsidePopover(e){if(e.type==="focusin"&&kernelFocusPending&&engineBusy.value)return;if(e.target instanceof Element&&e.target.closest('.settings,.error-banner,[aria-label="Translation settings"]'))return;dismissPopovers();}
function popoverFocusOut(e){if(kernelFocusPending&&engineBusy.value)return;if(e.relatedTarget&&!e.currentTarget.contains(e.relatedTarget))dismissPopovers();}
function keyboard(e){if(e.key==='Escape'){dismissPopovers();return;}if(e.altKey||(platform==='darwin'?(!e.metaKey||e.ctrlKey):(!e.ctrlKey||e.metaKey)))return;const keys={w:'close-document',o:'open',r:'translation',b:'sidebar',',':'settings',l:'language',k:'kernel','+':'zoom-in','=':'zoom-in','-':'zoom-out'};const key=e.key.toLowerCase(),action=keys[key]||(/^\d$/.test(key)?'percent:'+(key==='0'?100:Number(key)*10):null);if(action){e.preventDefault();readerAction(action);}}


const keyEntry=ref(''),keyBusy=ref(false),keyMessage=ref(''),keySource=ref('none'),keyStorageAvailable=ref(false);
const desktopCredentials=window.previewCredentials;
const platform=window.previewAppearance?.platform||(/Mac/i.test(navigator.platform)?'darwin':/Win/i.test(navigator.platform)?'win32':/Linux/i.test(navigator.platform)?'linux':'web');
const contentGlass=window.previewAppearance?.contentGlass===true;
const engine=ref(localStorage.getItem('engine')||'pdf_inspector'),engineState=ref(null),uvState=ref(null),engineBusy=ref(false),pageConcurrency=ref(2);const pageQueue=[];let pageRunning=0;
async function checkEngine(){const id=engine.value;engineState.value=null;engineBusy.value=true;try{const state=await api('/api/engines/'+id);if(engine.value===id)engineState.value=state;}catch(e){error.value=e.message;}finally{if(engine.value===id){engineBusy.value=false;if(kernelFocusPending){kernelFocusPending=false;await nextTick();kernelInput.value?.querySelector('[aria-checked="true"]')?.focus();}}}}
async function installEngine(){engineBusy.value=true;try{engineState.value=await api('/api/engines/'+engine.value+'/install',{method:'POST'});}catch(e){error.value=e.message;}finally{engineBusy.value=false;}}
function schedulePages(){pruneTranslationQueue();const candidates=translationPages(translationMode.value,active.value,pages.value.length).map(n=>pages.value[n-1]);for(const p of candidates)if(p.status==='idle'||(p.status==='ready'&&engine.value==='pdf_inspector'&&p.blocks.some(b=>b.status==='idle'&&!b.translation))){p.status='queued';pageQueue.push({p,token:epoch});}pumpPages();}
function pumpPages(){if(!foreground.value&&translationMode.value!=='full')return;while(pageRunning<pageConcurrency.value&&pageQueue.length){const job=pageQueue.shift();if(job.token!==epoch)continue;pageRunning++;processPage(job.p).finally(()=>{pageRunning--;pumpPages();});}}
async function mathPage(p,token){error.value='';p.status='detecting';p.message='Translating page…';try{const controller=new AbortController();controllers.add(controller);let response;try{response=await fetch('/api/math-page?'+new URLSearchParams({engine:engine.value,page:p.number,language:language.value,threads:concurrency.value,pageLimit:pageConcurrency.value}),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({documentId}),signal:controller.signal});if(!response.ok)throw Error((await response.json()).error);const data=await response.arrayBuffer();const layout=await api('/api/math-layout/'+response.headers.get('X-Layout-Key'));if(token!==epoch)return;p.blocks=layout.paragraphs.map(b=>reactive({...b,math:true,status:'ready',translated:true,cached:false,error:''}));p.mathDocument=markRaw(await getDocument({data}).promise);}finally{controllers.delete(controller);}if(token!==epoch){p.mathDocument?.loadingTask.destroy();return;}p.status='ready';p.message='';queuePreview(p);}catch(e){if(token===epoch){p.status='error';p.message=e.message;error.value=e.message;}}}
function resetTranslations(){selectedParagraph.value=null;cancel();for(const p of pages.value){p.mathDocument?.loadingTask.destroy();p.mathDocument=null;p.blocks=[];p.status='idle';p.message='';}renderPages();}
watch(engine,async()=>{if(loadingPreferences)return;saveView(true);clearTimeout(timer);localStorage.setItem('engine',engine.value);resetTranslations();await checkEngine();if(engineState.value?.available)settle();});watch(pageConcurrency,pumpPages);
let stopAppearance,stopDocuments,receivingDocuments=false;
async function receiveDocuments(){if(receivingDocuments)return;receivingDocuments=true;try{let document;while(document=await window.previewDocuments.next()){if(document.error){error.value=document.error;continue;}await importFile(new File([document.bytes],document.name,{type:'application/pdf'}),document.ticket);}}catch{error.value='Could not receive the PDF from the desktop.';}finally{receivingDocuments=false;}}
function applyAppearance({accent}){if(/^#[0-9a-f]{8}$/i.test(accent))document.documentElement.style.setProperty('--accent',accent.slice(0,7));}
const keySourceLabel=computed(()=>keySource.value==='saved'?'Saved in this app':keySource.value==='environment'?'Shell environment':'No key configured');
function applyConfig(c){configured.value=c.configured;keySource.value=c.keySource||'none';keyStorageAvailable.value=!!c.keyStorageAvailable;}
async function updateKey(clear=false){keyBusy.value=true;keyMessage.value='';try{const c=await (clear?desktopCredentials.clear():desktopCredentials.save(keyEntry.value));keyEntry.value='';applyConfig(c);cancel();keyMessage.value=clear?'Saved key cleared. Environment fallback restored.':'Key securely saved. It overrides the environment.';}catch{keyMessage.value='Could not update the key. Check system secure storage and try again.';}finally{keyBusy.value=false;}}
const revealControllers=new Set();
let pdf,pendingPDFTask,bytes,documentId,epoch=0,timer,renderEpoch=0;const controllers=new Set(),pageEls=new Map(),canvasEls=new Map(),thumbEls=new Map(),queue=[];let running=0;
const currentPage=computed(()=>pages.value[active.value-1]);
const currentPageStatus=computed(()=>{const p=currentPage.value;if(!p)return 'Open a PDF to translate.';if(p.status==='queued')return 'Page queued…';if(p.status==='detecting')return engine.value==='pdf_inspector'?'Detecting layout…':'Translating page…';if(p.status==='error')return p.message||'Translation failed.';if(p.mathDocument)return 'Translated page ready.';return p.message||'Ready to translate this page.';});
const progress=computed(()=>{const all=pages.value.flatMap(p=>p.blocks);return {done:all.filter(b=>b.translation).length,total:all.length,pending:all.filter(b=>b.status==='translating'||b.status==='queued').length};});
async function api(url,options={}) {const controller=new AbortController();if(url==='/api/translate'||url.startsWith('/api/layout'))controllers.add(controller);try{const response=await fetch(url,{...options,signal:controller.signal});if(response.status===204)return null;const body=await response.json();if(!response.ok)throw Error(body.error||'Request failed');return body;}finally{controllers.delete(controller);}}
function cancel(){resizeSnapshot.cancel();clearTimeout(previewTimer);previewScrolling=false;pendingPreview.clear();cancelAnimationFrame(pinchFrame);clearTimeout(pinchTimer);pinchFrame=0;pinchDelta=0;pinching.value=false;revealControllers.forEach(c=>c.abort());revealControllers.clear();pageQueue.length=0;epoch++;renderEpoch++;pageTasks.forEach(t=>t.cancel());pageTasks.clear();controllers.forEach(c=>c.abort());controllers.clear();queue.length=0;for(const p of pages.value){if(['queued','detecting'].includes(p.status))p.status='idle';for(const b of p.blocks)if(['queued','translating'].includes(b.status))b.status='idle';}}
async function releaseDocument(){const id=documentId;documentId=undefined;if(id)try{await api('/api/documents/'+id,{method:'DELETE'});}catch{}}
async function closeDocument(){
 const documentToken=epoch;await performanceRecorder.finish();await saveReadingView();if(documentToken!==epoch)return;currentRecentId=null;
 cancel();const closingToken=epoch;await releaseDocument();if(closingToken!==epoch)return;clearTimeout(timer);clearTimeout(navigatorTimer);cancelAnimationFrame(fitFrame);fitFrame=0;clearTimeout(fitResizeTimer);fitResizing=false;
 dismissPopovers();resetBitmaps();
 const tasks=new Set([pendingPDFTask,pdf?.loadingTask,...pages.value.map(page=>page.mathDocument?.loadingTask)].filter(Boolean));
 pdf=undefined;pendingPDFTask=undefined;bytes=undefined;pages.value=[];pageEls.clear();canvasEls.clear();thumbEls.clear();pageTasks.clear();
 title.value='PDFMathReader';active.value=1;pageEntry.value=1;loading.value=false;reading.value='Ready to read';navigatorVisible.value=false;
 if(reader.value)reader.value.scrollTop=reader.value.scrollLeft=0;if(fileInput.value)fileInput.value.value='';
 const token=epoch;
 await Promise.allSettled([...tasks].map(task=>task.destroy()));
 if(token!==epoch)return;
 if(window.previewRecents){try{const entries=await window.previewRecents.list();if(token===epoch){recentDocuments.value=entries;void loadRecentPreviews();}}catch{}}
}
async function importFile(file,ticket){
 if(file&&!ticket&&(pages.value.length||loading.value)&&window.previewDocuments?.open){try{await window.previewDocuments.open(file);}catch(e){error.value=e.message;}return;}
 if(!file)return;if(testMode&&!['A quieter way to read.pdf','Portrait and landscape.pdf'].includes(file.name)){error.value='TEST APP: personal documents are disabled.';return;}if(file.size>50*1024*1024){error.value='Choose a PDF smaller than 50 MB.';return;}
 await performanceRecorder.start(file.size);const runtimeReady=ensurePDF();await saveReadingView();currentRecentId=null;restoringView.value=true;selectedParagraph.value=null;cancel();const token=epoch;await releaseDocument();if(token!==epoch)return;resetBitmaps();renderMetrics.openedAt=performance.now();renderMetrics.firstPageMs=null;loading.value=true;error.value='';for(const p of pages.value)p.mathDocument?.loadingTask.destroy();pages.value=[];pageEls.clear();canvasEls.clear();thumbEls.clear();
 try{
  bytes=new Uint8Array(await file.arrayBuffer());performanceRecorder.mark('fileRead');if(token!==epoch)return;await pdf?.loadingTask.destroy();if(token!==epoch)return;
  const registered=await api('/api/documents',{method:'POST',headers:{'Content-Type':'application/pdf'},body:bytes});if(token!==epoch){await api('/api/documents/'+registered.id,{method:'DELETE'});return;}documentId=registered.id;performanceRecorder.mark('upload');
  await runtimeReady;const task=getDocument({data:bytes});pendingPDFTask=task;const loaded=await task.promise;if(token!==epoch){void task.destroy();return;}pdf=markRaw(loaded);performanceRecorder.mark('pdfReady');performanceRecorder.pages(pdf.numPages);bytes=undefined;if(pendingPDFTask===task)pendingPDFTask=undefined;
  title.value=(testMode?'TEST — ':'')+file.name;active.value=1;const list=[];
  for(let first=1;first<=pdf.numPages;first+=16){const numbers=Array.from({length:Math.min(16,pdf.numPages-first+1)},(_,i)=>first+i),batch=await Promise.all(numbers.map(n=>pdf.getPage(n)));if(token!==epoch)return;for(let i=0;i<batch.length;i++){const v=batch[i].getViewport({scale:1});list.push(reactive({number:numbers[i],width:v.width,height:v.height,status:'idle',blocks:[],dwell:0}));}}
  performanceRecorder.mark('pageGeometry');let saved;
  if(window.previewRecents)try{const result=await window.previewRecents.remember(file,ticket);if(token!==epoch)return;recentDocuments.value=result.entries;currentRecentId=result.recentId;saved=result.view;}catch{if(token===epoch)error.value='Opened PDF, but could not save recent history.';}
  performanceRecorder.mark('recentHistory');pages.value=list;await restoreReadingView(saved);performanceRecorder.mark('restoreView');if(token!==epoch)return;observe();observeThumbnails();await renderPages();if(token!==epoch)return;restoringView.value=false;loading.value=false;saveView();await nextTick();settle();
  if(currentRecentId)try{const id=currentRecentId,thumbnail=await pagePreview(pdf);if(token!==epoch)return;if(thumbnail)await window.previewRecents.setThumbnail(id,thumbnail);}catch{if(token===epoch)error.value='Could not save the document preview.';}
 }catch(e){if(token===epoch){error.value=e.message;await releaseDocument();}}finally{if(token===epoch){restoringView.value=false;loading.value=false;scheduleReadingSave();}}
}

async function sample(){const token=epoch,r=await fetch('/sample.pdf'),data=await r.arrayBuffer();if(token!==epoch)return;await importFile(new File([data],'A quieter way to read.pdf',{type:'application/pdf'}));}
const pageTasks=new Map();
const bitmapFrames=new BitmapCache({maxBytes:64*1024*1024,maxEntries:96});
const bitmapIds=new WeakMap();let bitmapId=0,thumbnailEpoch=0,viewportFrame=0;
const renderWindow=ref(new Set()),visibleThumbnails=new Set(),visiblePages=new Set();
function releaseCanvas(canvas){if(!canvas)return;pageTasks.get(canvas)?.cancel();pageTasks.delete(canvas);canvasCache.delete(canvas);canvas.width=canvas.height=0;}
function resetBitmaps(){bitmapFrames.clear();visibleThumbnails.clear();thumbnailEpoch++;for(const canvas of [...canvasEls.values(),...thumbEls.values()])releaseCanvas(canvas);renderWindow.value=new Set();}
const layoutElement=ref(),thumbnailList=ref(),thumbnailTop=ref(0),thumbnailHeight=ref(800);
const pageLayout=computed(()=>markRaw(buildReaderLayout(pages.value,zoom.value,direction.value,columns.value)));
const thumbnailLayout=computed(()=>markRaw(buildThumbnailLayout(pages.value)));
const thumbnailItems=computed(()=>sidebar.value?visibleThumbnailWindow(thumbnailLayout.value,thumbnailTop.value,thumbnailHeight.value):[]);
const mountedPages=computed(()=>[...renderWindow.value].sort((a,b)=>a-b).map(n=>pages.value[n-1]).filter(Boolean));
function bindPage(number,el){if(el)pageEls.set(number,el);else pageEls.delete(number);}
function bindCanvas(number,el){const old=canvasEls.get(number);if(old&&old!==el)releaseCanvas(old);if(el)canvasEls.set(number,el);else canvasEls.delete(number);}
function mathSource(number,translated){return translated?pages.value[number-1].mathDocument.getPage(1):pdf.getPage(number);}
function nativeSource(number,b){return {canvas:canvasEls.get(number),page:pdf.getPage(number),scale:zoom.value,origin:{x:b.x*zoom.value-3,y:b.y*zoom.value-3},boxes:[{x:b.x*zoom.value,y:b.y*zoom.value,width:b.width*zoom.value,height:Math.max(b.height,b.fontSize*1.1)*zoom.value}]};}
function setRenderWindow(numbers){const current=renderWindow.value;if(current.size!==numbers.length||numbers.some(n=>!current.has(n)))renderWindow.value=new Set(numbers);for(const [n,canvas] of canvasEls)if(!renderWindow.value.has(n))releaseCanvas(canvas);}
function mountAroundPage(number){const layout=pageLayout.value,row=Math.floor((number-1)/layout.columns),first=Math.max(0,row-4),last=Math.min(layout.rows.length-1,row+4),numbers=[];for(let i=first;i<=last;i++)for(let n=layout.rows[i].start;n<layout.rows[i].end;n++)numbers.push(n+1);setRenderWindow(numbers);}
function viewportPages(){
 const host=layoutElement.value,el=reader.value;if(!host||!el)return [];
 renderMetrics.viewportLookups++;renderMetrics.geometryReads+=2;const rect=host.getBoundingClientRect(),bounds=el.getBoundingClientRect(),window=visibleReaderWindow(pageLayout.value,{left:bounds.left-rect.left,right:bounds.right-rect.left,top:bounds.top-rect.top,bottom:bounds.bottom-rect.top},active.value);
 for(const n of visiblePages)if(pages.value[n-1])pages.value[n-1].visible=0;
 visiblePages.clear();let best;
 for(const item of window.visible){visiblePages.add(item.number);pages.value[item.number-1].visible=item.ratio;if(!best||item.area>best.area)best=item;}
 if(best&&!fitAdjusting&&!restoringView.value&&!pinching.value&&!resizeSnapshot.active)active.value=best.number;
 setRenderWindow(window.numbers);
 return window.numbers.map(n=>pages.value[n-1]).sort((a,b)=>Number(!visiblePages.has(a.number))-Number(!visiblePages.has(b.number))||Math.abs(a.number-active.value)-Math.abs(b.number-active.value));
}
function scheduleViewport(){if(viewportFrame||!foreground.value||resizeSnapshot.active)return;viewportFrame=requestAnimationFrame(()=>{viewportFrame=0;void renderPages();});}
function bindThumbnail(number,el){const old=thumbEls.get(number);if(old===el)return;if(old)releaseCanvas(old);if(el){thumbEls.set(number,el);el.dataset.thumbnail=number;}else thumbEls.delete(number);}
const thumbnailHighlight=ref(null);
watch([active,thumbnailItems,sidebar],async()=>{
 await nextTick();
 const button=thumbEls.get(active.value)?.parentElement;
 thumbnailHighlight.value=button?.isConnected?{transform:`translate(-50%, ${button.offsetTop}px)`,width:button.offsetWidth+'px',height:button.offsetHeight+'px'}:null;
},{flush:'post'});
function thumbnailScrolling(event){showScrollbar(event);updateThumbnailViewport();}
function updateThumbnailViewport(){const root=thumbnailList.value;if(!root)return;thumbnailTop.value=root.scrollTop-parseFloat(getComputedStyle(root).paddingTop);thumbnailHeight.value=root.clientHeight;}
function observeThumbnails(){updateThumbnailViewport();void renderThumbnails();}
watch(thumbnailItems,async items=>{visibleThumbnails.clear();items.forEach(item=>visibleThumbnails.add(item.number));await nextTick();void renderThumbnails();},{flush:'post'});
async function renderThumbnails(){if(!foreground.value||resizeSnapshot.active)return;const token=++thumbnailEpoch,documentToken=epoch;for(const n of [...visibleThumbnails]){if(token!==thumbnailEpoch||documentToken!==epoch||!pdf||!foreground.value)return;const p=pages.value[n-1],page=await pdf.getPage(n);if(token!==thumbnailEpoch||documentToken!==epoch)return;if(visibleThumbnails.has(n))await draw(page,thumbEls.get(n),Math.min(128/p.width,160/p.height));}}
function scrollThumbnailTo(number){const root=thumbnailList.value,item=thumbnailLayout.value.frames[number-1];if(!root||!item)return;const top=item.offset+14,bottom=top+item.height;if(top<root.scrollTop)root.scrollTop=top;else if(bottom>root.scrollTop+root.clientHeight)root.scrollTop=bottom-root.clientHeight;updateThumbnailViewport();}
if(testMode)window.previewRenderDiagnostics=()=>({active:active.value,zoom:zoom.value,direction:direction.value,previewScrolling,fitAdjusting,resizeActive:resizeSnapshot.active,opening:loading.value,readingView:readingView(),recentId:currentRecentId,documentId,foreground:foreground.value,metrics:{...renderMetrics},totalPages:pages.value.length,mountedPages:pageEls.size,mountedThumbnails:thumbEls.size,translatedPages:pages.value.filter(p=>p.mathDocument||p.blocks.some(b=>b.translation)).length,cache:bitmapFrames.stats(),window:[...renderWindow.value],canvasMapping:[...canvasEls].map(([n,c])=>({number:n,actual:c.parentElement?.dataset.page,connected:c.isConnected,width:c.width})),pages:[...canvasEls].filter(([,c])=>c.width>0).map(([n])=>n),thumbnails:[...thumbEls].filter(([,c])=>c.width>0).map(([n])=>n),residentBytes:[...canvasEls.values(),...thumbEls.values()].reduce((n,c)=>n+c.width*c.height*4,0)});

function presentFrame(canvas,frame,page,scale,dpr){if(canvas.closest('.page')&&visiblePages.has(Number(canvas.parentElement.dataset.page)))performanceRecorder.painted();if(canvas.closest('.page')){renderMetrics.pageFrames++;if(renderMetrics.firstPageMs===null&&visiblePages.has(Number(canvas.parentElement.dataset.page)))renderMetrics.firstPageMs=performance.now()-renderMetrics.openedAt;}else renderMetrics.thumbnailFrames++;if(canvas.closest('.page')){let bytes=[...canvasEls.values()].reduce((n,c)=>n+c.width*c.height*4,0)-canvas.width*canvas.height*4+frame.width*frame.height*4;const candidates=[...canvasEls].filter(([n,c])=>c!==canvas&&!visiblePages.has(n)).sort(([a],[b])=>Math.abs(b-active.value)-Math.abs(a-active.value));for(const [,other] of candidates){if(bytes<=128*1024*1024)break;bytes-=other.width*other.height*4;releaseCanvas(other);}}if(canvas.width!==frame.width)canvas.width=frame.width;if(canvas.height!==frame.height)canvas.height=frame.height;const context=canvas.getContext('2d');context.clearRect(0,0,canvas.width,canvas.height);context.drawImage(frame,0,0);canvas.style.width=frame.width/dpr+'px';canvas.style.height=frame.height/dpr+'px';canvasCache.set(canvas,{page,scale,dpr});if(canvas.closest('.page')&&visiblePages.has(Number(canvas.parentElement.dataset.page)))resizeSnapshot.schedule();renderMetrics.peakResidentBytes=Math.max(renderMetrics.peakResidentBytes,[...canvasEls.values(),...thumbEls.values()].reduce((n,c)=>n+c.width*c.height*4,0));}
async function draw(page,canvas,scale){
 if(!foreground.value||!canvas||!canvas.isConnected)return false;
 const number=Number(canvas.closest('.page')?.dataset.page);if(number&&!renderWindow.value.has(number))return false;
 const base=page.getViewport({scale}),dpr=Math.min(devicePixelRatio,2,Math.sqrt(16*1024*1024/(base.width*base.height*4))),cached=canvasCache.get(canvas),current=pageTasks.get(canvas);
 if(cached?.page===page&&cached.scale===scale&&cached.dpr===dpr){if(current){pageTasks.delete(canvas);current.cancel();}return true;}
 if(current?.previewPage===page&&current.previewScale===scale&&current.previewDpr===dpr)return current.previewResult;
 if(current){pageTasks.delete(canvas);current.cancel();}
 if(!bitmapIds.has(page))bitmapIds.set(page,++bitmapId);
 const key=bitmapIds.get(page)+':'+scale+':'+dpr,reusable=bitmapFrames.get(key);
 if(reusable){renderMetrics.cacheHits++;presentFrame(canvas,reusable,page,scale,dpr);return true;}
 const viewport=page.getViewport({scale}),frame=document.createElement('canvas');frame.width=Math.ceil(viewport.width*dpr);frame.height=Math.ceil(viewport.height*dpr);
 const task=page.render({canvasContext:frame.getContext('2d'),viewport,transform:[dpr,0,0,dpr,0,0]});
 Object.assign(task,{previewPage:page,previewScale:scale,previewDpr:dpr});pageTasks.set(canvas,task);
 task.onContinue=continuation=>{const resume=()=>{if(pageTasks.get(canvas)!==task)return;if(previewScrolling&&!pinching.value)setTimeout(resume,32);else requestAnimationFrame(continuation);};resume();};
 task.previewResult=(async()=>{try{await task.promise;if(pageTasks.get(canvas)!==task||!canvas.isConnected)return false;presentFrame(canvas,frame,page,scale,dpr);bitmapFrames.set(key,frame);return true;}catch(e){if(e.name!=='RenderingCancelledException')throw e;return false;}finally{if(pageTasks.get(canvas)===task)pageTasks.delete(canvas);if(bitmapFrames.get(key)!==frame){frame.width=0;frame.height=0;}}})();
 return task.previewResult;
}
async function animatePDF(p,page,previous){const host=pageEls.get(p.number);if(!host||!p.blocks.length)return;const rect=host.getBoundingClientRect(),readerRect=reader.value.getBoundingClientRect();if(rect.bottom<readerRect.top||rect.top>readerRect.bottom||rect.right<readerRect.left||rect.left>readerRect.right)return;const scale=zoom.value;const boxes=p.blocks.filter(b=>b.math).map(b=>showTranslations.value?b.translatedBox:b.sourceBox).map(b=>({x:b.x*scale,y:b.y*scale,width:b.width*scale,height:b.height*scale}));const controller=new AbortController();revealControllers.add(controller);try{await revealPDF({canvas:canvasEls.get(p.number),page,scale,host,boxes,previous,signal:controller.signal});}catch{}finally{revealControllers.delete(controller);}}
async function renderPages(animate=false,force=false){if(!foreground.value||(!force&&resizeSnapshot.active))return;await nextTick();if(!foreground.value||(!force&&resizeSnapshot.active))return;const ordered=viewportPages();await nextTick();if(previewScrolling&&!force){for(const p of ordered)pendingPreview.set(p.number,p);return;}const token=++renderEpoch;for(const p of ordered){if(token!==renderEpoch||!pdf)return;const page=await (p.mathDocument&&showTranslations.value?p.mathDocument.getPage(1):pdf.getPage(p.number));if(token!==renderEpoch)return;const previous=animate&&p.mathDocument&&p.visible?snapshot(canvasEls.get(p.number)):null;await draw(page,canvasEls.get(p.number),zoom.value);if(token!==renderEpoch)return;if(previous)animatePDF(p,page,previous);
 // Visible pages take priority; release the farthest prefetch bitmap if the resident budget fills.
 let bytes=[...canvasEls.values()].reduce((n,c)=>n+c.width*c.height*4,0);for(const candidate of [...ordered].reverse()){if(bytes<=128*1024*1024)break;if(visiblePages.has(candidate.number))continue;const canvas=canvasEls.get(candidate.number);if(!canvas)continue;bytes-=canvas.width*canvas.height*4;releaseCanvas(canvas);}
 }if(updateReaderInsets()&&fitMode.value!=='manual')applyFit();}

function observe(){viewportPages();}
watch(pageLayout,()=>nextTick(scheduleViewport));
const scrollbarTimers=new Map();
function showScrollbar(event){const el=event?.currentTarget;if(!el)return;el.dataset.scrolling='true';clearTimeout(scrollbarTimers.get(el));scrollbarTimers.set(el,setTimeout(()=>{delete el.dataset.scrolling;scrollbarTimers.delete(el);},800));}
function scrolling(event){if(restoringView.value||resizeSnapshot.active)return;performanceRecorder.scroll();resizeSnapshot.invalidate();scheduleViewport();scheduleReadingSave();showScrollbar(event);interruptPreview();showNavigator();reading.value='Scrolling';clearTimeout(timer);timer=setTimeout(()=>{if(!pinching.value)settle();},650);}
function settle(){resizeSnapshot.schedule();if(!foreground.value&&translationMode.value!=='full')return;if(!previewScrolling&&!pinching.value){for(const n of visiblePages){const p=pages.value[n-1];if(p)pendingPreview.set(n,p);}flushPreview();}if(document.hidden&&translationMode.value!=='full')return;const p=pages.value[active.value-1];if(!p)return;reading.value='Reading page '+p.number;p.dwell++;if((automatic.value||translationMode.value==='full')&&engineState.value?.available)schedulePages();}
async function processPage(p,manual=false){if(!p||p.status==='detecting')return;if(!engineState.value?.available){error.value=engineState.value?.reason||'Check kernel availability first.';return;}const token=epoch;if(engine.value!=='pdf_inspector')return mathPage(p,token);if(!p.blocks.length&&p.status!=='ready'){p.status='detecting';try{const result=await api('/api/layout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({documentId,page:p.number,height:p.height})});if(token!==epoch)return;p.blocks=result.paragraphs.map(b=>reactive({...b,status:'idle',translation:'',translated:showTranslations.value,cached:false,error:''}));p.status='ready';if(!p.blocks.length)p.message='No readable text detected. This page may require OCR.';}catch(e){if(token===epoch){p.status='error';p.message=e.message;}return;}}
 if(token!==epoch)return;p.status='ready';if(!manual&&!scopePages().has(p.number))return;
 for(const b of p.blocks)if(!b.translation&&!['queued','translating'].includes(b.status)){b.status='queued';queue.push({block:b,token,language:language.value,page:p.number,manual});}pump();}
function pump(){if(!foreground.value&&translationMode.value!=='full')return;while(running<Number(concurrency.value)&&queue.length){const job=queue.shift();if(job.token!==epoch)continue;running++;translate(job).finally(()=>{running--;pump();});}}
async function translate({block:b,token,language:target}){b.status='translating';b.error='';try{const data=await api('/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:b.text,language:target,concurrency:concurrency.value})});if(token!==epoch)return;b.translation=data.translation;b.cached=data.cached;b.status='ready';resizeSnapshot.schedule();}catch(e){if(token===epoch){b.status='error';b.error=e.message;}}}
function go(n){if(!pages.value.length)return;n=Math.min(pages.value.length,Math.max(1,Math.round(Number(n)||1)));active.value=n;pageEntry.value=n;const frame=pageLayout.value.frames[n-1],el=reader.value,host=layoutElement.value;if(frame&&el&&host){const rect=host.getBoundingClientRect(),bounds=el.getBoundingClientRect(),style=getComputedStyle(el);el.scrollTop+=rect.top+frame.y-bounds.top-parseFloat(style.paddingTop);el.scrollLeft+=rect.left+frame.x-bounds.left-parseFloat(style.paddingLeft);}viewportPages();scheduleViewport();scrolling();}
function toggle(b){if(b.math||b.translation)b.translated=!b.translated;}

// Fit returned text inside the source box, retaining a scrollable minimum size.

watch(language,()=>{localStorage.setItem('language',language.value);resetTranslations();settle();});
watch(active,n=>{pageEntry.value=n;if(restoringView.value||resizeSnapshot.active)return;applyFit();nextTick(()=>scrollThumbnailTo(n));},{flush:'post'});
watch([direction,columns],async()=>{if(restoringView.value)return;dismissPopovers();saveView();await nextTick();applyFit();await nextTick();go(active.value);renderPages();saveView();});
watch(sidebar,()=>{if(!restoringView.value&&!resizeSnapshot.active)nextTick(()=>{observeThumbnails();applyFit();renderPages();});});
watch(title,value=>{document.title=value;});
watch(zoom,async()=>{if(restoringView.value)return;revealControllers.forEach(c=>c.abort());revealControllers.clear();localStorage.setItem('readerZoom',String(zoom.value));await nextTick();if(!pinching.value&&!fitResizing)await renderPages();});watch(concurrency,pump);watch(automatic,()=>{if(automatic.value)settle();});watch(showTranslations,v=>{if(restoringView.value)return;for(const p of pages.value)for(const b of p.blocks)b.translated=v;if(engine.value!=='pdf_inspector'){revealControllers.forEach(c=>c.abort());revealControllers.clear();renderPages(true);}});
function visibility(){updateForeground();if(foreground.value){pumpPages();pump();}}
watch([active,zoom,direction,columns,fitMode,sidebar,showTranslations],scheduleReadingSave);
onMounted(async()=>{if(window.previewActivity){stopActivity=window.previewActivity.onChange(value=>{activityActive.value=value;visibility();});activityActive.value=await window.previewActivity.current();foreground.value=activityActive.value&&!pageHidden();window.previewActivityActive=foreground.value;}if(window.previewRecents){recentDocuments.value=await window.previewRecents.list();void loadRecentPreviews();}if(window.previewWindow){stopFullscreen=window.previewWindow.onFullscreen(value=>fullscreen.value=value);fullscreen.value=await window.previewWindow.fullscreen();}reader.value?.addEventListener('wheel',pinchWheel,{passive:false});document.addEventListener('keydown',keyboard);document.addEventListener('pointerdown',outsidePopover);document.addEventListener('focusin',outsidePopover);window.addEventListener('blur',dismissPopovers);stopActions=window.previewActions?.onAction(readerAction);if(window.previewPreferences){const saved=await window.previewPreferences.load();engine.value=saved.engine||'pdf_inspector';direction.value=saved.direction||'vertical';columns.value=saved.columns||1;fitMode.value=saved.fit;translationMode.value=saved.translationMode||'reading';if(saved.fit==='manual')zoom.value=saved.zoom;}await nextTick();loadingPreferences=false;window.addEventListener('resize',resizeFit);resizeObserver=new ResizeObserver(resizeFit);if(reader.value)resizeObserver.observe(reader.value,{box:'content-box'});if(window.previewAppearance){applyAppearance(await window.previewAppearance.current());stopAppearance=window.previewAppearance.onChange(applyAppearance);}const startup=await api('/api/engines');uvState.value=startup.uv;engineState.value=startup.engines.find(e=>e.id===engine.value);const c=await api('/api/config');applyConfig(c);model.value=c.model;if(window.previewDocuments){stopDocuments=window.previewDocuments.onAvailable(receiveDocuments);await receiveDocuments();}document.addEventListener('visibilitychange',visibility);settle();});
onBeforeUnmount(()=>{resizeSnapshot.destroy();performanceRecorder.destroy();stopActivity?.();void releaseDocument();void saveReadingView();clearTimeout(readingSaveTimer);delete window.previewSaveReadingView;++recentPreviewGeneration;stopFullscreen?.();reader.value?.removeEventListener('wheel',pinchWheel);cancelAnimationFrame(pinchFrame);clearTimeout(pinchTimer);document.removeEventListener('keydown',keyboard);document.removeEventListener('pointerdown',outsidePopover);document.removeEventListener('focusin',outsidePopover);window.removeEventListener('blur',dismissPopovers);stopActions?.();resizeObserver?.disconnect();window.removeEventListener('resize',resizeFit);cancelAnimationFrame(fitFrame);clearTimeout(fitResizeTimer);clearTimeout(navigatorTimer);scrollbarTimers.forEach(clearTimeout);scrollbarTimers.clear();clearTimeout(previewTimer);cancelAnimationFrame(viewportFrame);resetBitmaps();stopAppearance?.();stopDocuments?.();cancel();clearTimeout(timer);void Promise.allSettled([pdf?.loadingTask,pendingPDFTask,...pages.value.map(p=>p.mathDocument?.loadingTask)].filter(Boolean).map(task=>task.destroy())).then(()=>pdfWorker?.destroy());document.removeEventListener('visibilitychange',visibility);});
</script>

<template>
 <div class="app" :data-platform="platform" :class="{desktop:desktopCredentials,'content-glass':contentGlass,'is-fullscreen':fullscreen,'background-paused':!foreground}" @dragover.prevent @drop.prevent="importFile($event.dataTransfer.files[0])">
  <nav class="toolbar" :class="{'has-document':pages.length}" aria-label="Reader navigation">
   <div v-if="platform==='darwin'" class="traffic-lights" aria-hidden="true"><i></i><i></i><i></i></div>
   <button v-if="pages.length" class="icon-button" title="Toggle thumbnails" aria-label="Toggle thumbnails" :aria-expanded="sidebar" @click="toggleSidebar"><span class="system-icon" aria-hidden="true" data-symbol="sidebar.left" style="--symbol:url('/symbols/sidebar.left.png')"></span></button>
   <div class="title"><strong :title="title">{{title}}</strong><span>{{pages.length?'PDF reader':'Open a document'}}</span></div>
   <div class="toolbar-actions">
    <template v-if="pages.length">
    <button class="icon-button" title="Zoom out" aria-label="Zoom out" @click="changeZoom(-.1)"><span class="system-icon" aria-hidden="true" data-symbol="minus.magnifyingglass" style="--symbol:url('/symbols/minus.magnifyingglass.png')"></span></button><select v-model.number="zoom" @change="manualZoom" aria-label="Zoom"><option v-for="v in [.5,.75,1,1.25,1.5,2]" :value="v">{{Math.round(v*100)}}%</option><option v-if="![.5,.75,1,1.25,1.5,2].includes(zoom)" :value="zoom">{{Math.round(zoom*100)}}%</option></select><button class="icon-button" title="Zoom in" aria-label="Zoom in" @click="changeZoom(.1)"><span class="system-icon" aria-hidden="true" data-symbol="plus.magnifyingglass" style="--symbol:url('/symbols/plus.magnifyingglass.png')"></span></button>
    <button class="icon-button fit-button" aria-label="Fit width" title="Fit width" :aria-pressed="fitMode==='width'" @click="chooseFit('width')"><span class="system-icon" aria-hidden="true" style="--symbol:url('/symbols/arrow.left.and.right.png')"></span></button>
    <button class="icon-button fit-button" aria-label="Fit height" title="Fit height" :aria-pressed="fitMode==='height'" @click="chooseFit('height')"><span class="system-icon" aria-hidden="true" style="--symbol:url('/symbols/arrow.up.and.down.png')"></span></button>
    </template>
    <button v-if="pages.length" class="icon-button translation-toggle" aria-label="Translation" :title="showTranslations?'Show original text':'Show translated text'" :aria-pressed="showTranslations" @click="showTranslations=!showTranslations"><span class="system-icon" aria-hidden="true" data-symbol="character.book.closed" style="--symbol:url('/symbols/character.book.closed.png')"></span></button>
    <button class="icon-button" aria-label="Open PDF" title="Open PDF…" @click="fileInput.click()"><span class="system-icon" aria-hidden="true" data-symbol="doc.badge.plus" style="--symbol:url('/symbols/doc.badge.plus.png')"></span></button><button class="icon-button" aria-label="Translation settings" title="Translation settings" @click="selectedParagraph=null;settings=!settings"><span class="system-icon" aria-hidden="true" data-symbol="gearshape" style="--symbol:url('/symbols/gearshape.png')"></span></button>
   </div>

  </nav>
  <input ref="fileInput" type="file" accept="application/pdf,.pdf" hidden @change="importFile($event.target.files[0]);$event.target.value=''">
  <div ref="workspace" class="workspace">
   <Transition :css="false"><aside v-if="sidebar && pages.length" class="sidebar">
    <div v-if="pages.length" class="sidebar-heading">Thumbnails</div>
    <div v-if="pages.length" ref="thumbnailList" class="thumbnail-list" @scroll.passive="thumbnailScrolling"><div class="thumbnail-inner" :style="{height:thumbnailLayout.height+'px'}"><div v-if="desktopCredentials && thumbnailHighlight" class="thumbnail-highlight" :class="{'without-motion':restoringView}" :style="thumbnailHighlight" aria-hidden="true"></div><button v-for="item in thumbnailItems" :key="item.number" class="thumb" :style="{top:item.offset+'px',height:item.height+'px','--thumbnail-width':item.width+'px'}" :class="{selected:item.number===active}" :aria-current="item.number===active?'page':undefined" :aria-label="`Go to page ${item.number}`" @click="go(item.number)"><canvas :ref="el=>bindThumbnail(item.number,el)" :width="0" :height="0" :style="{width:item.width+'px',height:item.imageHeight+'px'}"></canvas><span>{{item.number}}</span><small :style="{visibility:pages[item.number-1].mathDocument||pages[item.number-1].blocks.some(b=>b.translation)?'visible':'hidden'}">Translated</small></button></div></div>
   </aside></Transition>
   <main ref="reader" class="reader" :class="{pinching,'restoring-view':restoringView}" @scroll.passive="scrolling">
    <div v-if="!pages.length" class="empty" :class="{'has-recents':recentDocuments.length}"><div class="document-symbol"><span class="system-icon" aria-hidden="true" data-symbol="doc.text" style="--symbol:url('/symbols/doc.text.png')"></span></div><h1>Open or drop a PDF and read in your language</h1><button class="primary" @click="fileInput.click()"><span class="system-icon" aria-hidden="true" data-symbol="doc.badge.plus" style="--symbol:url('/symbols/doc.badge.plus.png')"></span><span>Open PDF…</span></button><button @click="sample">Try a sample document</button><section v-if="recentDocuments.length" class="recent-documents" aria-label="Recent documents"><div class="recent-heading"><h2>Recent documents</h2><button @click="clearRecent">Clear</button></div><div class="recent-gallery"><button v-for="document in recentDocuments" :key="document.id" class="recent-document" :data-recent-id="document.id" :title="document.name" :aria-label="'Open '+document.name" @click="openRecent(document.id)"><img v-if="document.thumbnail" :src="document.thumbnail" alt="" draggable="false"><span v-else class="recent-placeholder" :class="{'is-loading':!document.previewUnavailable}" aria-hidden="true"><span class="system-icon" style="--symbol:url('/symbols/doc.text.png')"></span><span v-if="document.previewUnavailable">Preview unavailable</span></span></button></div></section></div>
    <div v-if="pages.length" ref="layoutElement" class="page-layout virtual-layout" :class="direction" :style="{'--page-columns':columns,width:pageLayout.width+'px',height:pageLayout.height+'px'}"><ReaderPage v-for="p in mountedPages" :key="p.number" :page="p" :frame="pageLayout.frames[p.number-1]" :zoom="zoom" :translations="showTranslations" :outlined="layoutVisible" :engine="engine" :foreground="foreground&&!resizeActive" :register-host="bindPage" :register-canvas="bindCanvas" :native-source="nativeSource" :math-source="mathSource" @toggle="toggle" @retry="processPage($event,true)"/></div>
   </main>
  </div>
  <Transition name="navigator-motion"><nav v-if="navigatorVisible&&pages.length" ref="navigator" class="page-navigator" aria-label="Page navigator" @focusin="holdNavigator" @focusout="hideNavigatorLater"><button aria-label="Previous page" :disabled="active<=1" @click="go(active-1)"><span class="system-icon" aria-hidden="true" style="--symbol:url('/symbols/chevron.up.png')"></span></button><form @submit.prevent="submitPage"><input v-model.number="pageEntry" aria-label="Page number" type="number" min="1" :max="pages.length" @change="submitPage"><span>/ {{pages.length}}</span></form><button aria-label="Next page" :disabled="active>=pages.length" @click="go(active+1)"><span class="system-icon" aria-hidden="true" style="--symbol:url('/symbols/chevron.down.png')"></span></button></nav></Transition>
  <footer v-if="!desktopCredentials" class="statusbar"><span><i class="status-dot" :class="{busy:progress.pending||loading}"></i>{{loading?'Opening PDF…':reading}}</span><span v-if="progress.total">{{progress.done}} / {{progress.total}} paragraphs translated · {{pages.flatMap(p=>p.blocks).filter(b=>b.cached).length}} cached</span><span v-else>{{configured?'Translation ready':'OpenAI key not configured'}}</span><span v-if="pages.length">Page {{active}} of {{pages.length}}</span></footer>
  <div v-if="error" class="error-banner" role="alert">{{error}}<button @click="error=''" aria-label="Dismiss error"><span class="system-icon" aria-hidden="true" data-symbol="xmark" style="--symbol:url('/symbols/xmark.png')"></span></button></div>
  <section v-if="selectedParagraph" class="settings paragraph-detail" @focusout="popoverFocusOut" aria-label="Paragraph comparison"><div class="settings-heading"><h2>Paragraph</h2><button aria-label="Close paragraph comparison" @click="selectedParagraph=null"><span class="system-icon" aria-hidden="true" style="--symbol:url('/symbols/xmark.png')"></span></button></div><h3>Original</h3><p class="comparison-text">{{selectedParagraph.text}}</p><h3>Translation</h3><p class="comparison-text">{{selectedParagraph.translation}}</p><p class="muted">Page {{selectedParagraph.page}} · {{selectedParagraph.layoutLabel||selectedParagraph.layoutSource}}</p></section>
  <section v-if="settings" class="settings" @focusout="popoverFocusOut" aria-label="Translation settings"><div class="settings-heading"><h2>Translation</h2><button aria-label="Close settings" @click="settings=false"><span class="system-icon" aria-hidden="true" data-symbol="xmark" style="--symbol:url('/symbols/xmark.png')"></span></button></div><form v-if="desktopCredentials" @submit.prevent="updateKey()"><label>OpenAI API key<input v-model="keyEntry" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Enter a key to override the environment" aria-label="OpenAI API key"></label><div><button type="submit" :disabled="keyBusy||!keyEntry.trim()||!keyStorageAvailable"><span class="system-icon" aria-hidden="true" data-symbol="checkmark.circle" style="--symbol:url('/symbols/checkmark.circle.png')"></span><span>Save key</span></button><button type="button" @click="updateKey(true)" :disabled="keyBusy"><span class="system-icon" aria-hidden="true" data-symbol="trash" style="--symbol:url('/symbols/trash.png')"></span><span>Clear saved key</span></button></div><p class="muted" role="status">Effective key: {{keySourceLabel}}.{{keyStorageAvailable?' Stored keys are encrypted with macOS Keychain protection.':' Secure storage unavailable; saving is disabled.'}}</p><p v-if="keyMessage" class="muted" role="status">{{keyMessage}}</p></form><div class="kernel-setting"><span id="kernel-label">Translation kernel</span><div ref="kernelInput" class="kernel-switcher" role="radiogroup" aria-labelledby="kernel-label" :style="{'--selected':kernelOptions.findIndex(k=>k.id===engine)}" @keydown="kernelKeys"><button v-for="option in kernelOptions" :key="option.id" role="radio" :aria-checked="engine===option.id" :tabindex="engine===option.id?0:-1" :disabled="engineBusy" @click="chooseKernel(option.id)">{{option.label}}</button></div></div><p class="muted" role="status">{{engineBusy?'Checking / preparing environment…':engineState?.available?`Available · ${engineState.version}`:engineState?.reason}}<br>{{uvState?.available?uvState.version:'uv not found'}}</p><button @click="checkEngine" :disabled="engineBusy">Check version</button><button v-if="engine!=='pdf_inspector'&&!engineState?.available" @click="installEngine" :disabled="engineBusy||!uvState?.available">Install kernel with uv</button><div class="kernel-setting"><span id="translation-mode-label">翻译模式</span><div class="translation-mode-switcher" role="radiogroup" aria-labelledby="translation-mode-label" :style="{'--selected':translationModes.findIndex(m=>m.id===translationMode)}" @keydown="modeKeys"><button v-for="option in translationModes" :key="option.id" role="radio" :aria-checked="translationMode===option.id" :tabindex="translationMode===option.id?0:-1" @click="translationMode=option.id">{{option.label}}</button></div><p class="muted">{{translationModes.find(m=>m.id===translationMode).description}}</p></div><label>Parallel pages<input v-model.number="pageConcurrency" type="range" min="1" max="4"><span>{{pageConcurrency}} pages</span></label><label>Translate into<select ref="languageInput" v-model="language" aria-label="Translation language"><option>Simplified Chinese</option><option>Traditional Chinese</option><option>English</option><option>Japanese</option><option>Korean</option><option>French</option><option>German</option><option>Spanish</option></select></label><label>Parallel translations<input v-model.number="concurrency" type="range" min="1" max="8"><span>{{concurrency}} concurrent requests</span></label><label v-if="translationMode==='reading'" class="check"><input v-model="automatic" type="checkbox">Translate when scrolling stops</label><label class="check"><input v-model="layoutVisible" type="checkbox">Show paragraph boundaries</label><p role="status" class="muted" :class="pageNote(currentPage||{blocks:[]})?.kind" :title="pageNote(currentPage||{blocks:[]})?.detail">{{currentPageStatus}}</p><button @click="processPage(pages[active-1],true)" :disabled="!pages.length||engineBusy||currentPage?.status==='detecting'||currentPage?.status==='queued'">{{currentPage?.status==='detecting'?'Translating…':currentPage?.status==='error'?'Retry current page':'Translate current page'}}</button><p class="muted">{{configured?`Key configured · ${model}`:'Launch with OPENAI_API_KEY in your shell environment.'}}</p><p class="muted">PDF layout stays local. Text is sent to OpenAI for translation. Math kernels preserve PDF layout and display each completed page. Reading position and layout are saved in recent documents. Translations are cached on this device.</p><p class="muted">Click a detected paragraph to switch original / translation with any kernel. The toolbar translation icon switches the whole page.</p><p class="muted">Rongxin (rongxin@u.nus.edu)</p></section>
 </div>
</template>
