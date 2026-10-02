<script setup>
import AppearanceSettings from './AppearanceSettings.vue';
import AdvancedSettings from './AdvancedSettings.vue';
import TranslationServiceOptions from './TranslationServiceOptions.vue';
import WindowsMenu from './WindowsMenu.vue';
import {shortcutAction} from '../electron/window-chrome.mjs';
import {menuLabel} from '../electron/menu-i18n.mjs';
import {ref,shallowRef,reactive,computed,watch,nextTick,onMounted,onBeforeUnmount,markRaw} from 'vue';
import {loadPDFRuntime} from './pdf-runtime.mjs';
import {buildReaderLayout,visibleReaderWindow,buildThumbnailLayout,visibleThumbnailWindow} from './reader-layout.mjs';
import {pageNote as getPageNote} from './page-note.mjs';
function pageNote(p){return getPageNote(p,engine.value);}
import ReaderPage from './ReaderPage.vue';
import {searchSegments,pdfSearchSegments} from './document-search.mjs';
import {MacButton,MacSegmentedControl,MacSegment,MacSwitch,MacSlider,MacPopUpButton,MacPopUpButtonItem,MacSecureField,MacSearchField} from './platform-controls.mjs';
import {createPerformanceRecorder} from './performance-recorder.mjs';
const performanceRecorder=createPerformanceRecorder({fetchStats:()=>api('/api/performance')});
window.previewPerformanceReport=()=>performanceRecorder.snapshot();
import {translationPages} from './translation-scope.mjs';
import {renderPixelRatio} from './render-resolution.mjs';
import {BitmapCache} from './bitmap-cache.mjs';
import {snapshot,revealPDF} from './text-reveal.mjs';
import {createScrubInput,formatPercentValue,parsePercentValue} from './scrub-input.mjs';
import {clampZoom,startZoomMotion,zoomStep} from './zoom-motion.mjs';
import {uiLanguage,t,setUILanguage} from './i18n.mjs';
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
async function openRecent(id){const token=epoch;try{if((pages.value.length||loading.value)&&window.previewRecents.openWindow){await window.previewRecents.openWindow(id);return;}const document=await window.previewRecents.open(id);if(token!==epoch)return;await importFile(new File([document.bytes],document.name,{type:'application/pdf'}),document.ticket);}catch{if(token===epoch)error.value=t('error.thisPDFUnavailable');}}
async function clearRecent(){++recentPreviewGeneration;try{recentDocuments.value=await window.previewRecents.clear();}catch{error.value=t('error.clearDocumentHistory');}}
const fileInput=ref(),reader=ref(),pages=shallowRef([]),title=ref('PDFMathReader'),active=ref(1),zoom=ref(1),sidebar=ref(true),sidebarLeaving=ref(false),settings=ref(false),language=ref(localStorage.getItem('language')||'Simplified Chinese'),concurrency=ref(4),automatic=ref(true),layoutVisible=ref(false),error=ref(''),loading=ref(false),configured=ref(false),model=ref(''),reading=ref(t('reading.ready')),showTranslations=ref(true);
const searchOpen=ref(false),searchQuery=ref(''),searchInput=ref(),searchResults=shallowRef([]),searchIndex=ref(-1),searchBusy=ref(false),searchFailure=ref('');
const searchHit=computed(()=>searchResults.value[searchIndex.value]||null);
const searchTextCache=new WeakMap();let searchGeneration=0,searchTimer;
async function openSearch(){if(!pages.value.length)return;settings.value=false;searchOpen.value=true;await nextTick();searchInput.value?.focus();}
function closeSearch(){searchOpen.value=false;searchResults.value=[];searchIndex.value=-1;++searchGeneration;searchBusy.value=false;clearTimeout(searchTimer);}
async function indexedText(document,number){let cache=searchTextCache.get(document);if(!cache){cache=new Map();searchTextCache.set(document,cache);}if(!cache.has(number))cache.set(number,pdfSearchSegments(await document.getPage(number)));return cache.get(number);}
async function runSearch(){
 const generation=++searchGeneration,token=epoch,query=searchQuery.value;searchResults.value=[];searchIndex.value=-1;searchFailure.value='';
 if(!searchOpen.value||!query.trim()||!pdf){searchBusy.value=false;return;}
 searchBusy.value=true;const translated=showTranslations.value;
 try{
  for(const p of pages.value){
   if(generation!==searchGeneration||token!==epoch)return;
   let segments;
   if(!translated)segments=await indexedText(pdf,p.number);
   else if(p.mathDocument)segments=await indexedText(p.mathDocument,1);
   else segments=p.blocks.filter(b=>b.translation&&!b.math).map(b=>({text:b.translation,block:b,box:{x:b.x,y:b.y,width:b.width,height:b.height}}));
   if(generation!==searchGeneration||token!==epoch)return;
   const matches=searchSegments(segments,query).map(match=>({...match,page:p.number}));
   if(matches.length){searchResults.value=[...searchResults.value,...matches];if(searchIndex.value<0){searchIndex.value=0;await locateSearch();}}
   await new Promise(resolve=>setTimeout(resolve,0));
  }
 }catch{if(generation===searchGeneration)searchFailure.value=t('error.searchDocument');}
 finally{if(generation===searchGeneration)searchBusy.value=false;}
}
function scheduleSearch(){clearTimeout(searchTimer);++searchGeneration;searchBusy.value=false;searchTimer=setTimeout(runSearch,180);}
async function locateSearch(){const hit=searchHit.value;if(!hit)return;const token=epoch;for(const block of hit.blocks)block.translated=showTranslations.value;go(hit.page);await nextTick();if(token!==epoch||hit!==searchHit.value)return;const host=pageEls.get(hit.page),el=reader.value,box=hit.boxes[0];if(!host||!el||!box)return;const bounds=el.getBoundingClientRect(),rect=host.getBoundingClientRect();el.scrollTop+=rect.top+box.y*zoom.value-bounds.top-el.clientHeight*.35;el.scrollLeft+=rect.left+box.x*zoom.value-bounds.left-el.clientWidth*.25;scheduleViewport();}
function nextSearch(delta=1){if(!searchResults.value.length)return;searchIndex.value=(searchIndex.value+delta+searchResults.value.length)%searchResults.value.length;void locateSearch();}
watch([searchQuery,showTranslations],scheduleSearch);
watch(()=>searchOpen.value?pages.value.map(p=>p.blocks.map(b=>b.translation||'').join('')).join(''):null,scheduleSearch);
watch(searchOpen,value=>{if(value)scheduleSearch();});

const fullscreen=ref(false);let stopFullscreen;
watch(fullscreen,()=>{dismissPopovers();nextTick(()=>resizeFit(true));});
const testMode=window.previewTestMode===true;
const pageHidden=()=>document.hidden&&!window.previewRenderInBackground;
const activityActive=ref(true),foreground=ref(!pageHidden());let stopActivity;
function updateForeground(){const value=activityActive.value&&!pageHidden();foreground.value=value;window.previewActivityActive=value;if(!value){cancelResize();void saveReadingView();clearTimeout(timer);cancelAnimationFrame(viewportFrame);viewportFrame=0;++renderEpoch;++thumbnailEpoch;pageTasks.forEach(task=>task.cancel());pageTasks.clear();revealControllers.forEach(c=>c.abort());revealControllers.clear();reading.value=t('reading.paused');}else{scheduleViewport();void renderThumbnails();void loadRecentPreviews();settle();}}

const interactionMode=ref('comparison');
const hoveredParagraph=shallowRef(null),copyToast=ref('');let copyToastTimer;
function notifyCopy(message){clearTimeout(copyToastTimer);copyToast.value=message;copyToastTimer=setTimeout(()=>copyToast.value='',1800);}
async function copyHoveredParagraph(){
 const focused=document.activeElement;
 if(interactionMode.value==='reading'||!hoveredParagraph.value||focused?.matches('input,textarea,[contenteditable="true"]')||String(window.getSelection()||'').trim()){document.execCommand('copy');return;}
 const block=hoveredParagraph.value,text=block.translation&&block.translated?block.translation:block.text;
 if(!text)return;
 try{if(window.previewClipboard)await window.previewClipboard.writeText(text);else await window.navigator.clipboard.writeText(text);notifyCopy(t('copy.paragraphCopied'));}catch{notifyCopy(t('copy.failed'));}
}
const selectedParagraph=ref(null);
const autoHideHeader=ref(true),immersiveHeaderHidden=ref(false);let immersiveLastPosition=0,immersiveTravel=0,immersiveIntentUntil=0,immersiveLightsTimer;
const windowsMenu=ref(),windowsMenuOpen=ref(false);
function revealHeader(){immersiveHeaderHidden.value=false;immersiveTravel=0;}
function immersiveIntent(event){if(!autoHideHeader.value||event.ctrlKey||event.metaKey)return;immersiveIntentUntil=performance.now()+1500;}
function immersiveScroll(){const el=reader.value;if(!el)return;const position=direction.value==='horizontal'?el.scrollLeft:el.scrollTop,delta=position-immersiveLastPosition;immersiveLastPosition=position;
 if(!autoHideHeader.value){if(immersiveHeaderHidden.value)revealHeader();return;}
 if(!pages.value.length||loading.value||restoringView.value||fitResizing||pinching.value||settings.value||searchOpen.value||windowsMenuOpen.value||selectedParagraph.value||performance.now()>immersiveIntentUntil){immersiveTravel=0;return;}
 if(position<=2){revealHeader();return;}if(Math.abs(delta)<.5)return;
 immersiveTravel=Math.sign(delta)===Math.sign(immersiveTravel)?immersiveTravel+delta:delta;
 if(immersiveTravel>=18){immersiveHeaderHidden.value=true;immersiveTravel=0;}else if(immersiveTravel<=-6)revealHeader();
}
function immersivePointer(event){if(!autoHideHeader.value||event.clientY<=12)revealHeader();}
watch(autoHideHeader,enabled=>{if(!enabled){clearTimeout(immersiveLightsTimer);revealHeader();void window.previewWindow?.setHeaderHidden?.(false);}});
watch(immersiveHeaderHidden,hidden=>{clearTimeout(immersiveLightsTimer);if(!autoHideHeader.value){if(hidden)immersiveHeaderHidden.value=false;void window.previewWindow?.setHeaderHidden?.(false);return;}if(hidden)immersiveLightsTimer=setTimeout(()=>window.previewWindow?.setHeaderHidden?.(true),180);else void window.previewWindow?.setHeaderHidden?.(false);});


const direction=ref('vertical'),columns=ref(1);
watch([direction,settings,searchOpen,()=>pages.value.length],()=>{revealHeader();immersiveIntentUntil=0;nextTick(()=>{immersiveLastPosition=direction.value==='horizontal'?reader.value?.scrollLeft||0:reader.value?.scrollTop||0;});});
const restoringView=ref(false);let currentRecentId=null,readingSaveTimer;
function readingView(){
 const el=reader.value,p=pages.value[active.value-1],host=p&&pageEls.get(p.number);if(!el||!host)return null;
 const bounds=el.getBoundingClientRect(),box=host.getBoundingClientRect(),style=getComputedStyle(el);
 return {page:p.number,offsetX:Math.max(-16,Math.min(16,(bounds.left+parseFloat(style.paddingLeft)-box.left)/box.width)),offsetY:Math.max(-16,Math.min(16,(bounds.top+parseFloat(style.paddingTop)-box.top)/box.height)),zoom:zoom.value,fit:fitMode.value,direction:direction.value,columns:columns.value,sidebar:sidebar.value,showTranslations:showTranslations.value};
}
async function saveReadingView(){clearTimeout(readingSaveTimer);if(restoringView.value||loading.value||!currentRecentId)return;const view=readingView();if(view)try{await window.previewRecents?.setView(currentRecentId,view);}catch{error.value=t('error.saveReadingPosition');}}
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
const sourceLanguage=ref('English');
const languageOptions=['Simplified Chinese','Traditional Chinese','English','Japanese','Korean','French','German','Spanish'];
const languageKeys=['simplifiedChinese','traditionalChinese','english','japanese','korean','french','german','spanish'];
function languageLabel(name){return t('languages.'+languageKeys[languageOptions.indexOf(name)]);}
const languageMenuOpen=ref(false);
const languageInput=ref(),kernelInput=ref(),navigator=ref(),pageInput=ref(),zoomInput=ref(),navigatorVisible=ref(false),pageEntry=ref(1),zoomEntry=ref(formatPercentValue(zoom.value));
const translationMode=ref(localStorage.getItem('translationMode')==='full'?'full':'reading');
const translationModes=[{id:'full',labelKey:'translation.full',descriptionKey:'translation.fullDescription'},{id:'reading',labelKey:'translation.reading',descriptionKey:'translation.readingDescription'}];
function scopePages(){return new Set(translationPages(translationMode.value,active.value,pages.value.length));}
function pruneTranslationQueue(){const allowed=scopePages();for(let i=pageQueue.length-1;i>=0;i--)if(!allowed.has(pageQueue[i].p.number)){const {p}=pageQueue.splice(i,1)[0];if(p.status==='queued')p.status=p.blocks.length?'ready':'idle';}for(let i=queue.length-1;i>=0;i--)if(!queue[i].manual&&!allowed.has(queue[i].page)){const job=queue.splice(i,1)[0];if(job.block.status==='queued')job.block.status='idle';}}
function modeKeys(e){let i=translationModes.findIndex(m=>m.id===translationMode.value);if(e.key==='ArrowLeft'||e.key==='Home')i=0;else if(e.key==='ArrowRight'||e.key==='End')i=1;else return;e.preventDefault();const group=e.currentTarget;translationMode.value=translationModes[i].id;nextTick(()=>group?.querySelector('.macvue-segment[data-state="on"]')?.focus());}
watch(translationMode,()=>{localStorage.setItem('translationMode',translationMode.value);saveView();pruneTranslationQueue();settle();});
watch(active,pruneTranslationQueue);
const kernelOptions=[{id:'pdf_inspector',labelKey:'engine.ultraFast'},{id:'pdf_math_fast',labelKey:'engine.fast'},{id:'pdf_math_precise',labelKey:'engine.precise'}];
let resizeObserver,navigatorTimer,stopActions,kernelFocusPending=false;
if(fitMode.value==='manual'){zoom.value=Math.min(3,Math.max(.25,Number(localStorage.getItem('readerZoom'))||1));zoomEntry.value=formatPercentValue(zoom.value);}
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
const workspace=ref();
let resizeRenderTimer,resizeDrawing=false,lastResizeDraw=0;
function cancelResize(){cancelAnimationFrame(fitFrame);fitFrame=0;clearTimeout(fitResizeTimer);clearTimeout(resizeRenderTimer);fitResizing=false;}
async function renderResize(){resizeRenderTimer=undefined;if(resizeDrawing||!foreground.value)return;resizeDrawing=true;lastResizeDraw=performance.now();try{await renderPages(false,true);}finally{resizeDrawing=false;if(fitResizing)scheduleResizeDraw();}}
function scheduleResizeDraw(){if(resizeRenderTimer||resizeDrawing)return;resizeRenderTimer=setTimeout(renderResize,Math.max(0,100-(performance.now()-lastResizeDraw)));}
function toggleSidebar(){if(!pages.value.length||restoringView.value)return;sidebarLeaving.value=sidebar.value;sidebar.value=!sidebar.value;nextTick(()=>resizeFit(true));}
function resizeFit(){if(restoringView.value||!pages.value.length||!foreground.value)return;fitResizing=true;clearTimeout(fitResizeTimer);if(!fitFrame)fitFrame=requestAnimationFrame(()=>{fitFrame=0;applyFit();scheduleResizeDraw();});fitResizeTimer=setTimeout(async()=>{fitResizing=false;clearTimeout(resizeRenderTimer);resizeRenderTimer=undefined;await nextTick();applyFit();await nextTick();await renderPages(false,true);observeThumbnails();scheduleReadingSave();},160);}
let loadingPreferences=true,applyingSavedSettings=false,stopPreferences;
function cloneKernelAdvancedOptions(value){
 const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 const clone=entry=>entry&&typeof entry==='object'&&!Array.isArray(entry)?{...entry}:{};
 return {pdf_math_fast:clone(source.pdf_math_fast),pdf_math_precise:clone(source.pdf_math_precise)};
}
function currentKernelAdvancedOptions(){return cloneKernelAdvancedOptions(kernelAdvancedOptions.value)[engine.value]||{};}
function applySavedSettings(saved){applyingSavedSettings=true;if(saved.interactionMode)interactionMode.value=saved.interactionMode;if(saved.language)language.value=saved.language;if(saved.sourceLanguage)sourceLanguage.value=saved.sourceLanguage;if(saved.uiLanguage)setUILanguage(saved.uiLanguage);if(saved.autoHideHeader!==undefined)autoHideHeader.value=!!saved.autoHideHeader;if(saved.concurrency!==undefined)concurrency.value=saved.concurrency;if(saved.pageConcurrency!==undefined)pageConcurrency.value=saved.pageConcurrency;if(saved.automatic!==undefined)automatic.value=saved.automatic;if(saved.layoutVisible!==undefined)layoutVisible.value=saved.layoutVisible;if(saved.kernelAdvancedOptions!==undefined)kernelAdvancedOptions.value=cloneKernelAdvancedOptions(saved.kernelAdvancedOptions);nextTick(()=>{applyingSavedSettings=false;});}
function saveView(force=false){if(loadingPreferences||applyingSavedSettings||(restoringView.value&&!force))return;window.previewPreferences?.save({...force?{engine:engine.value}:{},interactionMode:interactionMode.value,language:language.value,sourceLanguage:sourceLanguage.value,uiLanguage:uiLanguage.value,autoHideHeader:autoHideHeader.value,concurrency:concurrency.value,pageConcurrency:pageConcurrency.value,automatic:automatic.value,layoutVisible:layoutVisible.value,kernelAdvancedOptions:cloneKernelAdvancedOptions(kernelAdvancedOptions.value),appearance:appearanceChoice.value,accentColor:accentColor.value,reduceMotion:reduceMotion.value,reduceTransparency:reduceTransparency.value,reducePadding:reducePadding.value,fit:fitMode.value,zoom:zoom.value,translationMode:translationMode.value,direction:direction.value,columns:columns.value}).catch(()=>{error.value=t('error.requestFailed');});}
let zoomRequest=null,zoomAnimation=null,zoomRenderTimer=0,zoomRenderGeneration=0,zoomMotionGeneration=0,zoomTargetPending=false;
function captureZoomAnchor(){
 const el=reader.value,host=pageEls.get(active.value);if(!el||!host)return null;
 const bounds=el.getBoundingClientRect(),rect=host.getBoundingClientRect();
 const point={x:Math.min(rect.right,Math.max(rect.left,bounds.left+bounds.width/2)),y:Math.min(rect.bottom,Math.max(rect.top,bounds.top+bounds.height/2))};
 return {page:active.value,x:(point.x-rect.left)/Math.max(1,rect.width),y:(point.y-rect.top)/Math.max(1,rect.height),clientX:point.x,clientY:point.y};
}
function restoreZoomAnchor(anchor){
 const el=reader.value,host=anchor&&pageEls.get(anchor.page);if(!el||!host)return;
 const rect=host.getBoundingClientRect();el.scrollLeft+=rect.left+anchor.x*rect.width-anchor.clientX;el.scrollTop+=rect.top+anchor.y*rect.height-anchor.clientY;
}
function reducedMotion(){return reduceMotion.value||matchMedia('(prefers-reduced-motion: reduce)').matches;}
function startZoomAnimation(request){
 const layout=layoutElement.value;if(!layout||!request?.animate||request.from===zoom.value)return;
 const host=pageEls.get(request.anchor?.page||active.value),layoutRect=layout.getBoundingClientRect(),hostRect=host?.getBoundingClientRect();
 const origin=hostRect?`${hostRect.left-layoutRect.left+(request.anchor?.x||0)*hostRect.width}px ${hostRect.top-layoutRect.top+(request.anchor?.y||0)*hostRect.height}px`:'50% 50%';
 zoomAnimation=startZoomMotion(layout,{from:request.from,to:zoom.value,origin,reducedMotion:reducedMotion()});
}
function finishZoomAnimation(){if(zoomAnimation){zoomAnimation.finish?.();zoomAnimation.cancel?.();zoomAnimation=null;}}
function scheduleZoomRender(){
 clearTimeout(zoomRenderTimer);const generation=++zoomRenderGeneration;
 zoomRenderTimer=setTimeout(async()=>{zoomRenderTimer=0;if(generation!==zoomRenderGeneration||restoringView.value||pinching.value||fitResizing){if(generation===zoomRenderGeneration)zoomTargetPending=false;return;}try{await renderPages();}finally{if(generation===zoomRenderGeneration)zoomTargetPending=false;}},70);
}
async function applyRequestedZoom(request){
 const generation=++zoomMotionGeneration;finishZoomAnimation();await nextTick();if(generation!==zoomMotionGeneration)return;
 restoreZoomAnchor(request.anchor);startZoomAnimation(request);zoomTargetPending=true;scheduleZoomRender();
}
function requestZoom(value,{animate=true,anchor=animate?captureZoomAnchor():null}={}){
 const target=clampZoom(value);if(Math.abs(target-zoom.value)<.00001)return false;
 if(!zoomRequest)zoomRequest={from:zoom.value,anchor,animate};else {zoomRequest.to=target;zoomRequest.animate=zoomRequest.animate&&animate;}
 zoomTargetPending=true;zoom.value=target;return true;
}
function chooseFit(mode){++zoomMotionGeneration;zoomTargetPending=false;clearTimeout(zoomRenderTimer);zoomRenderTimer=0;++zoomRenderGeneration;finishZoomAnimation();fitMode.value=mode;localStorage.setItem('readerFit',mode);applyFit();saveView();}
function changeZoom(delta){fitMode.value='manual';localStorage.setItem('readerFit','manual');requestZoom(zoomStep(zoom.value,delta>=0?1:-1,Math.abs(delta)));saveView();}
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
function zoomEntryInput(event){zoomEntry.value=event.target.value;}
function submitZoom(event){
 const target=parsePercentValue(zoomEntry.value,{min:.1,max:4,fallback:zoom.value});
 fitMode.value='manual';localStorage.setItem('readerFit','manual');requestZoom(target);zoomEntry.value=formatPercentValue(target);saveView();
 if(event?.target&&event.target.value!==zoomEntry.value)event.target.value=zoomEntry.value;
}
const scrubbers=new Map();
function syncScrubInputs(){
 const specs=[
  ['page',pageInput.value,{getValue:()=>Number(pageEntry.value)||active.value,setValue:value=>{pageEntry.value=Math.round(value);},min:1,max:Math.max(1,pages.value.length),step:1,pixelsPerStep:18,deltaToValue:(value,delta)=>Math.round(value+delta),onCommit:submitPage}],
  ['zoom',zoomInput.value,{getValue:()=>zoom.value,setValue:value=>{zoomEntry.value=formatPercentValue(value);fitMode.value='manual';localStorage.setItem('readerFit','manual');requestZoom(value,{animate:false});},min:.1,max:4,step:.01,pixelsPerStep:18,deltaToValue:(value,delta)=>clampZoom(value*Math.exp(delta*.06)),onCommit:()=>saveView()}]
 ];
 const live=new Set();
 for(const [name,input,options] of specs){if(!input)continue;live.add(name);if(scrubbers.get(name)?.input===input)continue;scrubbers.get(name)?.controller.destroy();scrubbers.set(name,{input,controller:createScrubInput(input,options)});}
 for(const [name,entry] of scrubbers)if(!live.has(name)){entry.controller.destroy();scrubbers.delete(name);}
}
watch([pageInput,zoomInput,()=>pages.value.length,navigatorVisible],()=>nextTick(syncScrubInputs),{flush:'post'});
async function openSettings(target){selectedParagraph.value=null;settings.value=true;await nextTick();if(target==='language'){languageInput.value?.focus();languageMenuOpen.value=true;}else if(target==='kernel'){kernelFocusPending=engineBusy.value;kernelInput.value?.el?.querySelector('.macvue-segment[data-state="on"]')?.focus();}}
function chooseKernel(id){kernelFocusPending=!!kernelInput.value?.el?.contains(document.activeElement);engine.value=id;}
function kernelKeys(e){const current=kernelOptions.findIndex(k=>k.id===engine.value);const index=e.key==='ArrowRight'?Math.min(2,current+1):e.key==='ArrowLeft'?Math.max(0,current-1):e.key==='Home'?0:e.key==='End'?2:null;if(index===null)return;e.preventDefault();if(engineBusy.value)return;kernelFocusPending=true;engine.value=kernelOptions[index].id;nextTick(()=>kernelInput.value?.el?.querySelector('.macvue-segment[data-state="on"]')?.focus());}
function readerAction(action){if(action.startsWith('layout:'))direction.value=action.split(':')[1];else if(action.startsWith('columns:'))columns.value=Number(action.split(':')[1]);else if(action==='close-document')void closeDocument();else if(action==='recents'){if((pages.value.length||loading.value)&&window.previewWindow?.new)void window.previewWindow.new();else void closeDocument();}else if(action==='preferences')openSettings();else if(action==='copy-paragraph')void copyHoveredParagraph();else if(action==='search')void openSearch();else if(action==='open')fileInput.value?.click();else if(action==='translation'){if(!translationTaskProgress.value.busy)showTranslations.value=!showTranslations.value;}else if(action==='zoom-in')changeZoom(.1);else if(action==='zoom-out')changeZoom(-.1);else if(action==='page-previous'){if(pages.value.length)go(active.value-1);}else if(action==='page-next'){if(pages.value.length)go(active.value+1);}else if(action==='sidebar'){if(pages.value.length)toggleSidebar();}else if(action==='settings')settings.value?settings.value=false:openSettings();else if(action==='language'||action==='kernel')openSettings(action);else if(action==='fit-width')chooseFit('width');else if(action==='fit-height')chooseFit('height');else if(action.startsWith('percent:'))go(Math.max(1,Math.ceil(pages.value.length*Number(action.split(':')[1])/100)));}
function dismissPopovers(){windowsMenu.value?.close();settings.value=false;selectedParagraph.value=null;kernelFocusPending=false;error.value='';}
function outsidePopover(e){if(e.type==="focusin"&&kernelFocusPending&&engineBusy.value)return;if(e.target instanceof Element&&e.target.closest('.document-search,[data-popover-trigger],.settings,.error-banner,.macvue-pop-up-button-content'))return;dismissPopovers();}
function popoverFocusOut(e){if(kernelFocusPending&&engineBusy.value)return;if(e.relatedTarget&&!e.currentTarget.contains(e.relatedTarget)&&!e.relatedTarget.closest?.('.macvue-pop-up-button-content'))dismissPopovers();}
function editableTarget(target=document.activeElement){return !!target?.matches?.('input,textarea,select,[contenteditable="true"]')||target?.isContentEditable===true;}
function keyboard(e){
 if(e.defaultPrevented)return;
 if(platform==='win32'&&e.key==='F10'){e.preventDefault();revealHeader();void windowsMenu.value?.toggle();return;}
 const editable=editableTarget(e.target)||editableTarget(document.activeElement);
 if(['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','PageDown','PageUp','Home','End',' '].includes(e.key)&&!editable)immersiveIntent(e);
 if(interactionMode.value==='comparison'&&(platform==='darwin'?e.metaKey:e.ctrlKey)&&!e.altKey&&!e.shiftKey&&e.key.toLowerCase()==='c'){if(editable)return;e.preventDefault();void copyHoveredParagraph();return;}
 if(e.key==='Escape'){closeSearch();dismissPopovers();return;}
 const nativePageAction=pages.value.length>0&&!editable&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&(e.key==='PageUp'||e.key==='PageDown'||(e.shiftKey&&['ArrowUp','ArrowLeft','ArrowDown','ArrowRight'].includes(e.key)));
 if(nativePageAction){e.preventDefault();readerAction(e.key==='PageUp'||e.key==='ArrowUp'||e.key==='ArrowLeft'?'page-previous':'page-next');return;}
 const action=shortcutAction(platform,{type:'keyDown',key:e.key,code:e.code,meta:e.metaKey,control:e.ctrlKey,alt:e.altKey,shift:e.shiftKey});
 if(action&&action!=='close-window'&&!editable){e.preventDefault();readerAction(action);}
}


const keyEntry=ref(''),keyBusy=ref(false),keyMessage=ref(''),keySource=ref('none'),keyStorageAvailable=ref(false),keyInvalid=ref(false);
const desktopCredentials=window.previewCredentials;
const desktopWindow=window.previewWindow;
const platform=window.previewAppearance?.platform||(/Mac/i.test(navigator.platform)?'darwin':/Win/i.test(navigator.platform)?'win32':/Linux/i.test(navigator.platform)?'linux':'web');
// Windows drag regions handle native movement and double-click maximize.
// Keep a DOM fallback for header events outside native hit testing.
function headerDoubleClick(event){
 if(platform!=='win32'||!desktopWindow||immersiveHeaderHidden.value)return;
 if(event.target.closest('button,input,select,a,fluent-button,.windows-menu,.windows-window-controls,.toolbar-actions'))return;
 void desktopWindow.maximize();
}
function toolbarHint(description,key){return key?`${description} (${platform==='darwin'?'⌘'+key:'Ctrl+'+key})`:description;}
const contentGlass=window.previewAppearance?.contentGlass===true;
const engine=ref(localStorage.getItem('engine')||'pdf_inspector'),engineState=ref(null),uvState=ref(null),engineBusy=ref(false),pageConcurrency=ref(2),kernelAdvancedOptions=ref({pdf_math_fast:{},pdf_math_precise:{}});const parallelLevels=[1,2,4,12];
const parallelLabels=computed(()=>[t('parallel.off'),' ',t('parallel.medium'),t('parallel.more')]);
const parallelPagesStep=computed({get:()=>parallelLevels.indexOf(pageConcurrency.value),set:index=>{pageConcurrency.value=parallelLevels[index];}});
const parallelTranslationsStep=computed({get:()=>parallelLevels.indexOf(concurrency.value),set:index=>{concurrency.value=parallelLevels[index];}});
const pageQueue=[];let pageRunning=0;
const kernelStatus=computed(()=>engineBusy.value||pages.value.some(p=>p.status==='detecting'||p.blocks.some(b=>b.status==='translating'))?'busy':engineState.value?.available?'ready':engineState.value?.installed?'error':'missing');
const kernelStatusLabel=computed(()=>({busy:t('engine.busy'),ready:t('engine.ready'),error:t('engine.error'),missing:t('engine.missing')})[kernelStatus.value]);
const uvVersionLabel=computed(()=>{const version=uvState.value?.version;if(!version)return 'uv —';const match=version.match(/^(uv\s+\S+)\s+\(([0-9a-f]+)\b/i);return match?`${match[1]} (${match[2].slice(-4)})`:version.split(' (')[0];});
async function checkEngine(){const id=engine.value;engineState.value=null;engineBusy.value=true;try{const state=await api('/api/engines/'+id);if(engine.value===id)engineState.value=state;}catch(e){error.value=e.message;}finally{if(engine.value===id){engineBusy.value=false;if(kernelFocusPending){kernelFocusPending=false;await nextTick();kernelInput.value?.el?.querySelector('.macvue-segment[data-state="on"]')?.focus();}}}}
async function installEngine(){engineBusy.value=true;try{engineState.value=await api('/api/engines/'+engine.value+'/install',{method:'POST'});}catch(e){error.value=e.message;}finally{engineBusy.value=false;}}
function schedulePages(){pruneTranslationQueue();const candidates=translationPages(translationMode.value,active.value,pages.value.length).map(n=>pages.value[n-1]);for(const p of candidates)if(p.status==='idle'||(p.status==='ready'&&engine.value==='pdf_inspector'&&p.blocks.some(b=>b.status==='idle'&&!b.translation))){p.status='queued';pageQueue.push({p,token:epoch});}pumpPages();}
function pumpPages(){if(!foreground.value&&translationMode.value!=='full')return;while(pageRunning<pageConcurrency.value&&pageQueue.length){const job=pageQueue.shift();if(job.token!==epoch)continue;pageRunning++;processPage(job.p).finally(()=>{pageRunning--;pumpPages();});}}
async function mathPage(p,token){error.value='';p.status='detecting';p.message=t('pageStatus.translatingPage');try{const controller=new AbortController();controllers.add(controller);let response;try{response=await fetch('/api/math-page?'+new URLSearchParams({engine:engine.value,page:p.number,language:language.value,threads:concurrency.value,pageLimit:pageConcurrency.value}),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({documentId,sourceLanguage:sourceLanguage.value,advancedOptions:currentKernelAdvancedOptions()}),signal:controller.signal});if(!response.ok)throw Error((await response.json()).error);const data=await response.arrayBuffer();const layout=await api('/api/math-layout/'+response.headers.get('X-Layout-Key'));if(token!==epoch)return;p.blocks=layout.paragraphs.map(b=>reactive({...b,math:true,status:'ready',translated:true,cached:false,error:''}));p.mathDocument=markRaw(await getDocument({data}).promise);}finally{controllers.delete(controller);}if(token!==epoch){p.mathDocument?.loadingTask.destroy();return;}p.status='ready';p.message='';queuePreview(p);}catch(e){if(token===epoch){p.status='error';p.message=e.message;error.value=e.message;}}}
function resetTranslations(clearFrontendCache=false){selectedParagraph.value=null;cancel();if(clearFrontendCache)resetBitmaps();for(const p of pages.value){p.mathDocument?.loadingTask.destroy();p.mathDocument=null;p.blocks=[];p.status='idle';p.message='';}renderPages();}
watch(engine,async()=>{if(loadingPreferences)return;saveView(true);clearTimeout(timer);localStorage.setItem('engine',engine.value);resetTranslations();await checkEngine();if(engineState.value?.available)settle();});
watch(()=>[engine.value,JSON.stringify(currentKernelAdvancedOptions())],(next,previous)=>{
 if(!previous||next[0]!==previous[0]||next[1]===previous[1]||loadingPreferences||!['pdf_math_fast','pdf_math_precise'].includes(next[0]))return;
 resetTranslations(true);settle();
});
watch(pageConcurrency,pumpPages);
let stopAppearance,stopDocuments,receivingDocuments=false;
async function receiveDocuments(){if(receivingDocuments)return;receivingDocuments=true;try{let document;while(document=await window.previewDocuments.next()){if(document.error){error.value=document.error;continue;}await importFile(new File([document.bytes],document.name,{type:'application/pdf'}),document.ticket);}}catch{error.value=t('error.receivePDFFromDesktop');}finally{receivingDocuments=false;}}
const appearanceChoice=ref('system'),accentColor=ref('system'),reduceMotion=ref(false),reduceTransparency=ref(false),reducePadding=ref(false),systemDark=ref(matchMedia('(prefers-color-scheme: dark)').matches),systemAccentColor=ref('#007aff');
let appearanceTransition,appearanceTarget;
function renderAppearance(){
 const root=document.documentElement,theme=appearanceChoice.value==='system'?(systemDark.value?'dark':'light'):appearanceChoice.value;
 const reduced=reduceMotion.value||matchMedia('(prefers-reduced-motion: reduce)').matches;
 root.dataset.reduceMotion=String(reduceMotion.value);root.dataset.reduceTransparency=String(reduceTransparency.value);root.dataset.reducePadding=String(reducePadding.value);
 const color=accentColor.value==='system'?systemAccentColor.value:accentColor.value;root.style.setProperty('--accent',color);root.style.setProperty('--macvue-accent',color);
 const applyTheme=()=>{root.dataset.macvueAppearance=appearanceTarget;root.dataset.appearance=appearanceTarget;};
 if(reduced){appearanceTransition?.skipTransition();appearanceTarget=theme;applyTheme();return;}
 if(appearanceTarget===theme)return;
 appearanceTarget=theme;
 appearanceTransition?.skipTransition();
 if(!loadingPreferences&&root.dataset.appearance&&document.startViewTransition){appearanceTransition=document.startViewTransition(applyTheme);appearanceTransition.ready.catch(()=>{});appearanceTransition.finished.catch(()=>{});}else applyTheme();
}

watch([appearanceChoice,accentColor,reduceMotion,reduceTransparency,reducePadding],()=>{renderAppearance();saveView();});
function applyAppearance(state){const {accent,dark}=state;if(typeof dark==='boolean')systemDark.value=dark;if(accent)systemAccentColor.value=accent.slice(0,7);if(state.appearance){appearanceChoice.value=state.appearance;accentColor.value=state.accentColor||'system';reduceMotion.value=!!state.reduceMotion;reduceTransparency.value=!!state.reduceTransparency;reducePadding.value=!!state.reducePadding;}renderAppearance();}

const keyPlaceholder=computed(()=>keyMessage.value|| (keyInvalid.value?t('key.invalidPlaceholder'):configured.value?(keySource.value==='environment'?t('key.environmentPlaceholder'):t('key.savedPlaceholder')):t('key.missingPlaceholder')));
watch(error,message=>{if(/OpenAI rejected the configured API key|invalid.api.key|incorrect.api.key|authentication.*401/i.test(message))keyInvalid.value=true;});
function applyConfig(c){configured.value=c.configured;keySource.value=c.keySource||'none';keyStorageAvailable.value=!!c.keyStorageAvailable;if(c.keyStorageError)keyInvalid.value=true;}
async function updateKey(clear=false){if(keyBusy.value||(!clear&&!keyEntry.value.trim()))return;keyBusy.value=true;keyMessage.value='';try{const c=await (clear?desktopCredentials.clear():desktopCredentials.save(keyEntry.value));keyEntry.value='';keyInvalid.value=false;applyConfig(c);cancel();}catch{keyEntry.value='';keyMessage.value=t('key.saveFailed');}finally{keyBusy.value=false;}}
const revealControllers=new Set();
let pdf,pendingPDFTask,bytes,documentId,epoch=0,timer,renderEpoch=0;const controllers=new Set(),pageEls=new Map(),canvasEls=new Map(),thumbEls=new Map(),queue=[];let running=0;
const currentPage=computed(()=>pages.value[active.value-1]);
const currentPageStatus=computed(()=>{const p=currentPage.value;if(!p)return t('pageStatus.openPDFToTranslate');if(p.status==='queued')return t('pageStatus.queued');if(p.status==='detecting')return engine.value==='pdf_inspector'?t('pageStatus.detectingLayout'):t('pageStatus.translatingPage');if(p.status==='error')return p.message||t('pageStatus.translationFailed');if(p.mathDocument)return t('pageStatus.translatedPageReady');return p.message||t('pageStatus.readyToTranslate');});
const progress=computed(()=>{const all=pages.value.flatMap(p=>p.blocks);return {done:all.filter(b=>b.translation).length,total:all.length,pending:all.filter(b=>b.status==='translating'||b.status==='queued').length};});
const translationTaskProgress=computed(()=>{
 let done=0,pending=0;
 for(const p of pages.value){
  if(['queued','detecting'].includes(p.status))pending++;
  if(p.mathDocument||p.status==='error')done++;
  if(engine.value==='pdf_inspector')for(const block of p.blocks){if(['queued','translating'].includes(block.status))pending++;else if(block.translation||block.status==='error')done++;}
 }
 return {busy:pending>0,percent:Math.round(done/Math.max(1,done+pending)*100)};
});

async function api(url,options={}) {const controller=new AbortController();if(url==='/api/translate'||url.startsWith('/api/layout'))controllers.add(controller);try{const response=await fetch(url,{...options,signal:controller.signal});if(response.status===204)return null;const body=await response.json();if(!response.ok)throw Error(body.error||t('error.requestFailed'));return body;}finally{controllers.delete(controller);}}
function cancel(){hoveredParagraph.value=null;cancelResize();clearTimeout(previewTimer);clearTimeout(zoomRenderTimer);zoomRenderTimer=0;++zoomRenderGeneration;++zoomMotionGeneration;zoomTargetPending=false;zoomRequest=null;finishZoomAnimation();previewScrolling=false;pendingPreview.clear();cancelAnimationFrame(pinchFrame);clearTimeout(pinchTimer);pinchFrame=0;pinchDelta=0;pinching.value=false;revealControllers.forEach(c=>c.abort());revealControllers.clear();pageQueue.length=0;epoch++;renderEpoch++;pageTasks.forEach(t=>t.cancel());pageTasks.clear();controllers.forEach(c=>c.abort());controllers.clear();queue.length=0;for(const p of pages.value){if(['queued','detecting'].includes(p.status))p.status='idle';for(const b of p.blocks)if(['queued','translating'].includes(b.status))b.status='idle';}}
async function releaseDocument(){const id=documentId;documentId=undefined;if(id)try{await api('/api/documents/'+id,{method:'DELETE'});}catch{}}
let closingDocument=false;
async function closeDocument(){
 if(closingDocument)return;closingDocument=true;
 const host=workspace.value,token=epoch,reduced=reduceMotion.value||matchMedia('(prefers-reduced-motion: reduce)').matches;
 let exit;
 try{
  if(pages.value.length&&host&&!reduced){exit=host.animate([{opacity:1},{opacity:0}],{duration:120,easing:'ease-out',fill:'forwards'});await exit.finished.catch(()=>{});}
  if(token!==epoch)return;
  await closeDocumentNow();exit?.cancel();
  if(host&&!reduced&&pages.value.length===0)await host.animate([{opacity:0},{opacity:1}],{duration:180,easing:'ease-out'}).finished.catch(()=>{});
 }finally{exit?.cancel();closingDocument=false;}
}
async function closeDocumentNow(){
 const documentToken=epoch;await performanceRecorder.finish();await saveReadingView();if(documentToken!==epoch)return;currentRecentId=null;
 cancel();const closingToken=epoch;closeSearch();await releaseDocument();if(closingToken!==epoch)return;clearTimeout(timer);clearTimeout(navigatorTimer);cancelAnimationFrame(fitFrame);fitFrame=0;clearTimeout(fitResizeTimer);fitResizing=false;
 dismissPopovers();resetBitmaps();
 const tasks=new Set([pendingPDFTask,pdf?.loadingTask,...pages.value.map(page=>page.mathDocument?.loadingTask)].filter(Boolean));
 pdf=undefined;pendingPDFTask=undefined;bytes=undefined;pages.value=[];pageEls.clear();canvasEls.clear();thumbEls.clear();pageTasks.clear();
 title.value='PDFMathReader';active.value=1;pageEntry.value=1;loading.value=false;reading.value=t('reading.ready');navigatorVisible.value=false;
 if(reader.value)reader.value.scrollTop=reader.value.scrollLeft=0;if(fileInput.value)fileInput.value.value='';
 const token=epoch;
 await Promise.allSettled([...tasks].map(task=>task.destroy()));
 if(token!==epoch)return;
 if(window.previewRecents){try{const entries=await window.previewRecents.list();if(token===epoch){recentDocuments.value=entries;void loadRecentPreviews();}}catch{}}
}
async function importFile(file,ticket){
 if(file&&!ticket&&(pages.value.length||loading.value)&&window.previewDocuments?.open){try{await window.previewDocuments.open(file);}catch(e){error.value=e.message;}return;}
 if(!file)return;closeSearch();if(testMode&&!['A quieter way to read.pdf','Portrait and landscape.pdf'].includes(file.name)){error.value=t('error.testDocumentsDisabled');return;}if(file.size>50*1024*1024){error.value=t('error.PDFTooLarge');return;}
 await performanceRecorder.start(file.size);const runtimeReady=ensurePDF();await saveReadingView();currentRecentId=null;restoringView.value=true;selectedParagraph.value=null;cancel();const token=epoch;await releaseDocument();if(token!==epoch)return;resetBitmaps();renderMetrics.openedAt=performance.now();renderMetrics.firstPageMs=null;loading.value=true;error.value='';for(const p of pages.value)p.mathDocument?.loadingTask.destroy();pages.value=[];pageEls.clear();canvasEls.clear();thumbEls.clear();
 try{
  bytes=new Uint8Array(await file.arrayBuffer());performanceRecorder.mark('fileRead');if(token!==epoch)return;await pdf?.loadingTask.destroy();if(token!==epoch)return;
  const registered=await api('/api/documents',{method:'POST',headers:{'Content-Type':'application/pdf'},body:bytes});if(token!==epoch){await api('/api/documents/'+registered.id,{method:'DELETE'});return;}documentId=registered.id;performanceRecorder.mark('upload');
  await runtimeReady;const task=getDocument({data:bytes});pendingPDFTask=task;const loaded=await task.promise;if(token!==epoch){void task.destroy();return;}pdf=markRaw(loaded);performanceRecorder.mark('pdfReady');performanceRecorder.pages(pdf.numPages);bytes=undefined;if(pendingPDFTask===task)pendingPDFTask=undefined;
  title.value=(testMode?'TEST — ':'')+file.name;active.value=1;const list=[];
  for(let first=1;first<=pdf.numPages;first+=16){const numbers=Array.from({length:Math.min(16,pdf.numPages-first+1)},(_,i)=>first+i),batch=await Promise.all(numbers.map(n=>pdf.getPage(n)));if(token!==epoch)return;for(let i=0;i<batch.length;i++){const v=batch[i].getViewport({scale:1});list.push(reactive({number:numbers[i],width:v.width,height:v.height,status:'idle',blocks:[],dwell:0}));}}
  performanceRecorder.mark('pageGeometry');let saved;
  if(window.previewRecents)try{const result=await window.previewRecents.remember(file,ticket);if(token!==epoch)return;recentDocuments.value=result.entries;currentRecentId=result.recentId;saved=result.view;}catch{if(token===epoch)error.value=t('error.saveRecentHistory');}
  performanceRecorder.mark('recentHistory');pages.value=list;await restoreReadingView(saved);performanceRecorder.mark('restoreView');if(token!==epoch)return;observe();observeThumbnails();await renderPages();if(token!==epoch)return;restoringView.value=false;loading.value=false;saveView();await nextTick();settle();
  if(currentRecentId)try{const id=currentRecentId,thumbnail=await pagePreview(pdf);if(token!==epoch)return;if(thumbnail)await window.previewRecents.setThumbnail(id,thumbnail);}catch{if(token===epoch)error.value=t('error.saveDocumentPreview');}
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
const pageLayout=computed(()=>markRaw(buildReaderLayout(pages.value,zoom.value,direction.value,columns.value,reducePadding.value?0:24,reducePadding.value?0:2)));
const thumbnailLayout=computed(()=>markRaw(buildThumbnailLayout(pages.value)));
const thumbnailItems=computed(()=>(sidebar.value||sidebarLeaving.value)?visibleThumbnailWindow(thumbnailLayout.value,thumbnailTop.value,thumbnailHeight.value):[]);
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
 if(best&&!fitAdjusting&&!restoringView.value&&!pinching.value&&!fitResizing)active.value=best.number;
 setRenderWindow(window.numbers);
 return window.numbers.map(n=>pages.value[n-1]).sort((a,b)=>Number(!visiblePages.has(a.number))-Number(!visiblePages.has(b.number))||Math.abs(a.number-active.value)-Math.abs(b.number-active.value));
}
function scheduleViewport(){if(viewportFrame||!foreground.value||fitResizing)return;viewportFrame=requestAnimationFrame(()=>{viewportFrame=0;void renderPages();});}
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
async function renderThumbnails(){if(!foreground.value||fitResizing)return;const token=++thumbnailEpoch,documentToken=epoch;for(const n of [...visibleThumbnails]){if(token!==thumbnailEpoch||documentToken!==epoch||!pdf||!foreground.value)return;const p=pages.value[n-1],page=await pdf.getPage(n);if(token!==thumbnailEpoch||documentToken!==epoch)return;if(visibleThumbnails.has(n))await draw(page,thumbEls.get(n),Math.min(128/p.width,160/p.height));}}
function scrollThumbnailTo(number){const root=thumbnailList.value,item=thumbnailLayout.value.frames[number-1];if(!root||!item)return;const top=item.offset+14,bottom=top+item.height;if(top<root.scrollTop)root.scrollTop=top;else if(bottom>root.scrollTop+root.clientHeight)root.scrollTop=bottom-root.clientHeight;updateThumbnailViewport();}
if(testMode)window.previewRenderDiagnostics=()=>({active:active.value,zoom:zoom.value,direction:direction.value,previewScrolling,fitAdjusting,resizeActive:fitResizing,opening:loading.value,readingView:readingView(),recentId:currentRecentId,documentId,foreground:foreground.value,metrics:{...renderMetrics},totalPages:pages.value.length,mountedPages:pageEls.size,mountedThumbnails:thumbEls.size,translatedPages:pages.value.filter(p=>p.mathDocument||p.blocks.some(b=>b.translation)).length,cache:bitmapFrames.stats(),window:[...renderWindow.value],canvasMapping:[...canvasEls].map(([n,c])=>({number:n,actual:c.parentElement?.dataset.page,connected:c.isConnected,width:c.width})),pages:[...canvasEls].filter(([,c])=>c.width>0).map(([n])=>n),thumbnails:[...thumbEls].filter(([,c])=>c.width>0).map(([n])=>n),residentBytes:[...canvasEls.values(),...thumbEls.values()].reduce((n,c)=>n+c.width*c.height*4,0)});

function presentFrame(canvas,frame,page,scale,dpr){if(canvas.closest('.page')&&visiblePages.has(Number(canvas.parentElement.dataset.page)))performanceRecorder.painted();if(canvas.closest('.page')){renderMetrics.pageFrames++;if(renderMetrics.firstPageMs===null&&visiblePages.has(Number(canvas.parentElement.dataset.page)))renderMetrics.firstPageMs=performance.now()-renderMetrics.openedAt;}else renderMetrics.thumbnailFrames++;if(canvas.closest('.page')){let bytes=[...canvasEls.values()].reduce((n,c)=>n+c.width*c.height*4,0)-canvas.width*canvas.height*4+frame.width*frame.height*4;const candidates=[...canvasEls].filter(([n,c])=>c!==canvas&&!visiblePages.has(n)).sort(([a],[b])=>Math.abs(b-active.value)-Math.abs(a-active.value));for(const [,other] of candidates){if(bytes<=128*1024*1024)break;bytes-=other.width*other.height*4;releaseCanvas(other);}}if(canvas.width!==frame.width)canvas.width=frame.width;if(canvas.height!==frame.height)canvas.height=frame.height;const context=canvas.getContext('2d');context.clearRect(0,0,canvas.width,canvas.height);context.drawImage(frame,0,0);canvas.style.width=frame.width/dpr+'px';canvas.style.height=frame.height/dpr+'px';canvasCache.set(canvas,{page,scale,dpr});renderMetrics.peakResidentBytes=Math.max(renderMetrics.peakResidentBytes,[...canvasEls.values(),...thumbEls.values()].reduce((n,c)=>n+c.width*c.height*4,0));}
async function draw(page,canvas,scale){
 if(!foreground.value||!canvas||!canvas.isConnected)return false;
 const number=Number(canvas.closest('.page')?.dataset.page);if(number&&!renderWindow.value.has(number))return false;
 const base=page.getViewport({scale}),dpr=renderPixelRatio(base.width,base.height,devicePixelRatio,!!number&&visiblePages.has(number)),cached=canvasCache.get(canvas),current=pageTasks.get(canvas);
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
async function animatePDF(p,page,previous){if(interactionMode.value==='reading')return;const host=pageEls.get(p.number);if(!host||!p.blocks.length)return;const rect=host.getBoundingClientRect(),readerRect=reader.value.getBoundingClientRect();if(rect.bottom<readerRect.top||rect.top>readerRect.bottom||rect.right<readerRect.left||rect.left>readerRect.right)return;const scale=zoom.value;const boxes=p.blocks.filter(b=>b.math&&b.text!==b.translation).map(b=>showTranslations.value?b.translatedBox:b.sourceBox).map(b=>({x:b.x*scale,y:b.y*scale,width:b.width*scale,height:b.height*scale}));const controller=new AbortController();revealControllers.add(controller);try{await revealPDF({canvas:canvasEls.get(p.number),page,scale,host,boxes,previous,signal:controller.signal});}catch{}finally{revealControllers.delete(controller);}}
async function renderPages(animate=false,force=false){if(!foreground.value||(!force&&fitResizing))return;await nextTick();if(!foreground.value||(!force&&fitResizing))return;const viewport=viewportPages(),ordered=fitResizing?viewport.filter(p=>visiblePages.has(p.number)):viewport;await nextTick();if(previewScrolling&&!force){for(const p of ordered)pendingPreview.set(p.number,p);return;}const token=++renderEpoch;for(const p of ordered){if(token!==renderEpoch||!pdf)return;const page=await (p.mathDocument&&showTranslations.value?p.mathDocument.getPage(1):pdf.getPage(p.number));if(token!==renderEpoch)return;const previous=animate&&p.mathDocument&&p.visible?snapshot(canvasEls.get(p.number)):null;await draw(page,canvasEls.get(p.number),zoom.value);if(token!==renderEpoch)return;if(previous)animatePDF(p,page,previous);
 // Visible pages take priority; release the farthest prefetch bitmap if the resident budget fills.
 let bytes=[...canvasEls.values()].reduce((n,c)=>n+c.width*c.height*4,0);for(const candidate of [...ordered].reverse()){if(bytes<=128*1024*1024)break;if(visiblePages.has(candidate.number))continue;const canvas=canvasEls.get(candidate.number);if(!canvas)continue;bytes-=canvas.width*canvas.height*4;releaseCanvas(canvas);}
 }if(updateReaderInsets()&&fitMode.value!=='manual')applyFit();}

function observe(){viewportPages();}
watch(pageLayout,()=>nextTick(()=>{if(!zoomTargetPending)scheduleViewport();}));
const scrollbarTimers=new Map();
function showScrollbar(event){const el=event?.currentTarget;if(!el)return;el.dataset.scrolling='true';clearTimeout(scrollbarTimers.get(el));scrollbarTimers.set(el,setTimeout(()=>{delete el.dataset.scrolling;scrollbarTimers.delete(el);},800));}
function scrolling(event){immersiveScroll();if(restoringView.value||fitResizing)return;performanceRecorder.scroll();scheduleViewport();scheduleReadingSave();showScrollbar(event);interruptPreview();showNavigator();reading.value=t('reading.scrolling');clearTimeout(timer);timer=setTimeout(()=>{if(!pinching.value)settle();},650);}
function settle(){if(!foreground.value&&translationMode.value!=='full')return;if(!previewScrolling&&!pinching.value){for(const n of visiblePages){const p=pages.value[n-1];if(p)pendingPreview.set(n,p);}flushPreview();}if(document.hidden&&translationMode.value!=='full')return;const p=pages.value[active.value-1];if(!p)return;reading.value=t('reading.readingPage',{page:p.number});p.dwell++;if((automatic.value||translationMode.value==='full')&&engineState.value?.available)schedulePages();}
async function processPage(p,manual=false){if(!p||p.status==='detecting')return;if(!engineState.value?.available){error.value=engineState.value?.reason||t('pageStatus.checkKernelAvailability');return;}const token=epoch;if(engine.value!=='pdf_inspector')return mathPage(p,token);if(!p.blocks.length&&p.status!=='ready'){p.status='detecting';try{const result=await api('/api/layout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({documentId,page:p.number,height:p.height})});if(token!==epoch)return;p.blocks=result.paragraphs.map(b=>reactive({...b,status:'idle',translation:'',translated:showTranslations.value,cached:false,error:''}));p.status='ready';if(!p.blocks.length)p.message=t('pageStatus.noReadableText');}catch(e){if(token===epoch){p.status='error';p.message=e.message;}return;}}
 if(token!==epoch)return;p.status='ready';if(!manual&&!scopePages().has(p.number))return;
 for(const b of p.blocks)if(!b.translation&&!['queued','translating'].includes(b.status)){b.status='queued';queue.push({block:b,token,language:language.value,sourceLanguage:sourceLanguage.value,page:p.number,manual});}pump();}
function pump(){if(!foreground.value&&translationMode.value!=='full')return;while(running<Number(concurrency.value)&&queue.length){const job=queue.shift();if(job.token!==epoch)continue;running++;translate(job).finally(()=>{running--;pump();});}}
async function translate({block:b,token,language:target,sourceLanguage:source}){b.status='translating';b.error='';try{const data=await api('/api/translate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:b.text,language:target,sourceLanguage:source,concurrency:concurrency.value})});if(token!==epoch)return;b.translation=data.translation;b.cached=data.cached;b.status='ready';}catch(e){if(token===epoch){b.status='error';b.error=e.message;}}}
function go(n){if(!pages.value.length)return;n=Math.min(pages.value.length,Math.max(1,Math.round(Number(n)||1)));active.value=n;pageEntry.value=n;const frame=pageLayout.value.frames[n-1],el=reader.value,host=layoutElement.value;if(frame&&el&&host){const rect=host.getBoundingClientRect(),bounds=el.getBoundingClientRect(),style=getComputedStyle(el);el.scrollTop+=rect.top+frame.y-bounds.top-parseFloat(style.paddingTop);el.scrollLeft+=rect.left+frame.x-bounds.left-parseFloat(style.paddingLeft);}viewportPages();scheduleViewport();scrolling();}
function toggle(b){if(b.math||b.translation)b.translated=!b.translated;}

// Fit returned text inside the source box, retaining a scrollable minimum size.

watch(interactionMode,()=>{hoveredParagraph.value=null;selectedParagraph.value=null;window.getSelection()?.removeAllRanges();if(interactionMode.value==='reading'){for(const p of pages.value)for(const b of p.blocks)b.translated=showTranslations.value;}void renderPages();});
watch([interactionMode,language,concurrency,pageConcurrency,automatic,layoutVisible,autoHideHeader,uiLanguage],()=>saveView());
watch(kernelAdvancedOptions,()=>saveView(),{deep:true});
watch([language,sourceLanguage],()=>{if(loadingPreferences)return;localStorage.setItem('language',language.value);resetTranslations();settle();});
watch(active,n=>{pageEntry.value=n;if(restoringView.value||fitResizing)return;applyFit();nextTick(()=>scrollThumbnailTo(n));},{flush:'post'});
watch(reducePadding,async()=>{if(restoringView.value||!pages.value.length)return;const page=active.value;await nextTick();applyFit();await nextTick();go(page);renderPages();});
watch([direction,columns],async([nextDirection],[previousDirection])=>{if(restoringView.value)return;const directionChanged=nextDirection!==previousDirection&&!loadingPreferences;dismissPopovers();await nextTick();if(directionChanged)chooseFit(nextDirection==='horizontal'?'height':'width');else applyFit();await nextTick();go(active.value);renderPages();saveView();});
watch(sidebar,()=>{if(!restoringView.value)nextTick(()=>{observeThumbnails();resizeFit(true);});});
watch(title,value=>{document.title=value;});
watch(zoom,async()=>{if(restoringView.value)return;revealControllers.forEach(c=>c.abort());revealControllers.clear();localStorage.setItem('readerZoom',String(zoom.value));if(document.activeElement!==zoomInput.value)zoomEntry.value=formatPercentValue(zoom.value);const request=zoomRequest;zoomRequest=null;if(request&&!pinching.value&&!fitResizing){await applyRequestedZoom({...request,to:zoom.value});}else if(!pinching.value&&!fitResizing){await nextTick();await renderPages();}});watch(concurrency,pump);watch(automatic,()=>{if(automatic.value)settle();});watch(showTranslations,v=>{if(restoringView.value)return;for(const p of pages.value)for(const b of p.blocks)b.translated=v;if(engine.value!=='pdf_inspector'){revealControllers.forEach(c=>c.abort());revealControllers.clear();renderPages(true);}});
function visibility(){updateForeground();if(foreground.value){pumpPages();pump();}}
watch([active,zoom,direction,columns,fitMode,sidebar,showTranslations],scheduleReadingSave);
onMounted(async()=>{if(window.previewActivity){stopActivity=window.previewActivity.onChange(value=>{activityActive.value=value;visibility();});activityActive.value=await window.previewActivity.current();foreground.value=activityActive.value&&!pageHidden();window.previewActivityActive=foreground.value;}if(window.previewRecents){recentDocuments.value=await window.previewRecents.list();void loadRecentPreviews();}if(window.previewWindow){stopFullscreen=window.previewWindow.onFullscreen(value=>fullscreen.value=value);fullscreen.value=await window.previewWindow.fullscreen();}reader.value?.addEventListener('wheel',pinchWheel,{passive:false});document.addEventListener('keydown',keyboard);document.addEventListener('pointerdown',outsidePopover);document.addEventListener('focusin',outsidePopover);window.addEventListener('blur',dismissPopovers);stopActions=window.previewActions?.onAction(readerAction);if(window.previewPreferences){const saved=await window.previewPreferences.load();applySavedSettings(saved);stopPreferences=window.previewPreferences.onChange?.(applySavedSettings);applyAppearance(saved);engine.value=saved.engine||'pdf_inspector';direction.value=saved.direction||'vertical';columns.value=saved.columns||1;fitMode.value=saved.fit;translationMode.value=saved.translationMode||'reading';if(saved.fit==='manual'){zoom.value=saved.zoom;zoomEntry.value=formatPercentValue(zoom.value);}}await nextTick();syncScrubInputs();loadingPreferences=false;window.addEventListener('resize',resizeFit);resizeObserver=new ResizeObserver(resizeFit);if(reader.value)resizeObserver.observe(reader.value,{box:'content-box'});if(window.previewAppearance){applyAppearance(await window.previewAppearance.current());stopAppearance=window.previewAppearance.onChange(applyAppearance);}const startup=await api('/api/engines');uvState.value=startup.uv;engineState.value=startup.engines.find(e=>e.id===engine.value);const c=await api('/api/config');applyConfig(c);model.value=c.model;if(window.previewDocuments){stopDocuments=window.previewDocuments.onAvailable(receiveDocuments);await receiveDocuments();}document.addEventListener('visibilitychange',visibility);settle();});
onBeforeUnmount(()=>{clearTimeout(immersiveLightsTimer);clearTimeout(copyToastTimer);closeSearch();cancelResize();performanceRecorder.destroy();stopActivity?.();void releaseDocument();void saveReadingView();clearTimeout(readingSaveTimer);delete window.previewSaveReadingView;++recentPreviewGeneration;stopFullscreen?.();reader.value?.removeEventListener('wheel',pinchWheel);cancelAnimationFrame(pinchFrame);clearTimeout(pinchTimer);document.removeEventListener('keydown',keyboard);document.removeEventListener('pointerdown',outsidePopover);document.removeEventListener('focusin',outsidePopover);window.removeEventListener('blur',dismissPopovers);stopActions?.();resizeObserver?.disconnect();window.removeEventListener('resize',resizeFit);cancelAnimationFrame(fitFrame);clearTimeout(fitResizeTimer);clearTimeout(navigatorTimer);scrollbarTimers.forEach(clearTimeout);scrollbarTimers.clear();clearTimeout(previewTimer);clearTimeout(zoomRenderTimer);scrubbers.forEach(entry=>entry.controller.destroy());scrubbers.clear();finishZoomAnimation();cancelAnimationFrame(viewportFrame);resetBitmaps();stopAppearance?.();stopPreferences?.();stopDocuments?.();cancel();clearTimeout(timer);void Promise.allSettled([pdf?.loadingTask,pendingPDFTask,...pages.value.map(p=>p.mathDocument?.loadingTask)].filter(Boolean).map(task=>task.destroy())).then(()=>pdfWorker?.destroy());document.removeEventListener('visibilitychange',visibility);});
</script>

<template>
 <div class="app" :data-platform="platform" :class="{desktop:desktopCredentials,'content-glass':contentGlass,'startup-page':!pages.length,'is-fullscreen':fullscreen,'background-paused':!foreground,'immersive-header-hidden':immersiveHeaderHidden,'reading-interaction':interactionMode==='reading'}" @pointermove="immersivePointer" @dragover.prevent @drop.prevent="importFile($event.dataTransfer.files[0])">
  <div v-if="immersiveHeaderHidden" class="header-reveal-zone" @pointerenter="revealHeader" aria-hidden="true"></div>
  <nav class="toolbar" :class="{'has-document':pages.length}" :aria-label="t('app.readerNavigation')" :inert="immersiveHeaderHidden" @focusin="revealHeader" @dblclick="headerDoubleClick">
   <div v-if="platform==='darwin'" class="traffic-lights" aria-hidden="true"><i></i><i></i><i></i></div>
   <div v-if="platform==='win32'&&desktopCredentials" class="windows-window-controls">
    <button class="windows-close" :aria-label="menuLabel('Close Window',uiLanguage)" :title="menuLabel('Close Window',uiLanguage)" @click="desktopWindow.close()"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="m1 1 10 10M11 1 1 11"/></svg></button>
    <button :aria-label="menuLabel('Minimize',uiLanguage)" :title="menuLabel('Minimize',uiLanguage)" @click="desktopWindow.minimize()"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 6h10"/></svg></button>
   </div>
   <WindowsMenu v-if="platform==='win32'&&desktopCredentials" ref="windowsMenu" @open="dismissPopovers();revealHeader();windowsMenuOpen=true" @close="windowsMenuOpen=false"/>
   <MacButton v-if="pages.length" class="icon-button" :title="toolbarHint(sidebar?t('toolbar.hidePageThumbnails'):t('toolbar.showPageThumbnails'),'B')" :aria-label="t('toolbar.toggleThumbnails')" :aria-expanded="sidebar" @click="toggleSidebar"><span class="system-icon" aria-hidden="true" data-symbol="sidebar.left" style="--symbol:url('/symbols/sidebar.left.png')"></span></MacButton>
   <div class="title"><strong :title="title">{{title}}</strong><span v-if="pages.length">{{t('toolbar.pageOf',{current:active,total:pages.length})}}</span></div>
   <div class="toolbar-actions">
    <template v-if="pages.length">
    <MacButton class="icon-button" :title="toolbarHint(t('toolbar.zoomOut'),'−')" :aria-label="t('toolbar.zoomOut')" @click="changeZoom(-.1)"><span class="system-icon" aria-hidden="true" data-symbol="minus.magnifyingglass" style="--symbol:url('/symbols/minus.magnifyingglass.png')"></span></MacButton><input ref="zoomInput" class="zoom-popup scrub-input" data-scrub="zoom" :value="zoomEntry" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" aria-label="Zoom percentage" :aria-valuenow="Math.round(zoom*100)" aria-valuemin="10" aria-valuemax="400" :title="t('toolbar.chooseZoomPercentage')" style="-webkit-app-region:no-drag" @input="zoomEntryInput" @change="submitZoom" @blur="submitZoom" @keydown.enter.prevent="submitZoom"><MacButton class="icon-button" :title="toolbarHint(t('toolbar.zoomIn'),'=')" :aria-label="t('toolbar.zoomIn')" @click="changeZoom(.1)"><span class="system-icon" aria-hidden="true" data-symbol="plus.magnifyingglass" style="--symbol:url('/symbols/plus.magnifyingglass.png')"></span></MacButton>
    </template>
    <MacButton v-if="pages.length" class="icon-button translation-toggle" :aria-label="t('toolbar.translation')" :disabled="translationTaskProgress.busy" :aria-busy="translationTaskProgress.busy" :title="translationTaskProgress.busy?t('toolbar.translating',{percent:translationTaskProgress.percent}):toolbarHint(showTranslations?t('toolbar.showOriginalText'):t('toolbar.showTranslatedText'),'R')" :aria-pressed="showTranslations" @click="showTranslations=!showTranslations"><svg v-if="translationTaskProgress.busy" class="translation-progress" viewBox="0 0 24 24" role="progressbar" :aria-label="t('toolbar.translationProgress')" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="translationTaskProgress.percent"><circle class="translation-progress-track" cx="12" cy="12" r="9"/><circle class="translation-progress-fill" cx="12" cy="12" r="9" pathLength="100" :stroke-dasharray="`${translationTaskProgress.percent} 100`"/></svg><span v-else class="system-icon" aria-hidden="true" data-symbol="character.book.closed" style="--symbol:url('/symbols/character.book.closed.png')"></span></MacButton>
    <MacButton v-if="pages.length" class="icon-button" data-popover-trigger :aria-label="t('toolbar.searchDocument')" :title="toolbarHint(t('toolbar.searchOriginalOrTranslatedText'),'F')" :aria-expanded="searchOpen" @click="searchOpen?closeSearch():openSearch()"><span class="system-icon" aria-hidden="true" data-symbol="magnifyingglass" style="--symbol:url('/symbols/magnifyingglass.png')"></span></MacButton><MacButton class="icon-button" data-popover-trigger :aria-label="t('toolbar.translationSettings')" :title="toolbarHint(t('toolbar.openTranslationSettings'),',')" @click="selectedParagraph=null;settings=!settings"><span class="system-icon" aria-hidden="true" data-symbol="gearshape" style="--symbol:url('/symbols/gearshape.png')"></span></MacButton>
   </div>
  </nav>
  <Transition name="settings-motion"><form v-if="searchOpen&&pages.length" class="document-search" role="search" @submit.prevent="nextSearch()"><MacSearchField ref="searchInput" v-model="searchQuery" :placeholder="showTranslations?t('search.searchTranslation'):t('search.searchOriginal')" :aria-label="t('search.documentText')" @keydown.enter.prevent="nextSearch($event.shiftKey?-1:1)"/><span class="search-count" role="status">{{searchFailure|| (searchBusy?t('search.searching'):searchQuery.trim()?(searchResults.length?`${searchIndex+1} / ${searchResults.length}`:t('search.noMatches')):'')}}</span><MacButton :aria-label="t('search.previousMatch')" :disabled="!searchResults.length" @click="nextSearch(-1)">↑</MacButton><MacButton :aria-label="t('search.nextMatch')" :disabled="!searchResults.length" @click="nextSearch(1)">↓</MacButton><MacButton :aria-label="t('search.close')" @click="closeSearch()">×</MacButton></form></Transition>
  <input ref="fileInput" type="file" accept="application/pdf,.pdf" hidden @change="importFile($event.target.files[0]);$event.target.value=''">
  <div ref="workspace" class="workspace">
   <Transition name="sidebar-motion" @after-enter="observeThumbnails" @after-leave="sidebarLeaving=false;resizeFit()" @leave-cancelled="sidebarLeaving=false"><aside v-if="sidebar && pages.length" class="sidebar">
    <div v-if="pages.length" class="sidebar-heading">{{t('sidebar.thumbnails')}}</div>
    <div v-if="pages.length" ref="thumbnailList" class="thumbnail-list" @scroll.passive="thumbnailScrolling"><div class="thumbnail-inner" :style="{height:thumbnailLayout.height+'px'}"><div v-if="desktopCredentials && thumbnailHighlight" class="thumbnail-highlight" :class="{'without-motion':restoringView}" :style="thumbnailHighlight" aria-hidden="true"></div><button v-for="item in thumbnailItems" :key="item.number" class="thumb" :style="{top:item.offset+'px',height:item.height+'px','--thumbnail-width':item.width+'px'}" :class="{selected:item.number===active}" :aria-current="item.number===active?'page':undefined" :aria-label="t('sidebar.goToPage',{page:item.number})" @click="go(item.number)"><canvas :ref="el=>bindThumbnail(item.number,el)" :width="0" :height="0" :style="{width:item.width+'px',height:item.imageHeight+'px'}"></canvas><span>{{item.number}}</span><small :style="{visibility:pages[item.number-1].mathDocument||pages[item.number-1].blocks.some(b=>b.translation)?'visible':'hidden'}">{{t('sidebar.translated')}}</small></button></div></div>
   </aside></Transition>
   <main ref="reader" class="reader" :class="{pinching,'restoring-view':restoringView}" @scroll.passive="scrolling" @wheel.passive="immersiveIntent" @pointerdown="immersiveIntent">
    <div v-if="!pages.length" class="empty" :class="{'has-recents':recentDocuments.length}"><div class="document-symbol"><span class="system-icon" aria-hidden="true" data-symbol="doc.text" style="--symbol:url('/symbols/doc.text.png')"></span></div><MacButton variant="prominent" size="large" class="primary" @click="fileInput.click()"><span class="system-icon" aria-hidden="true" data-symbol="doc.badge.plus" style="--symbol:url('/symbols/doc.badge.plus.png')"></span><span>{{t('startup.openPDF')}}</span></MacButton><p class="startup-description">{{t('startup.description')}}</p><MacButton v-if="!recentDocuments.length" class="sample-button" @click="sample">{{t('startup.sample')}}</MacButton><section v-if="recentDocuments.length" class="recent-documents" :aria-label="t('startup.recentDocuments')"><div class="recent-heading"><h2>{{t('startup.recentDocuments')}}</h2><MacButton size="large" @click="clearRecent">{{t('startup.clear')}}</MacButton></div><div class="recent-gallery"><button v-for="document in recentDocuments" :key="document.id" class="recent-document" :data-recent-id="document.id" :title="document.name" :aria-label="t('startup.openDocument',{name:document.name})" @click="openRecent(document.id)"><img v-if="document.thumbnail" :src="document.thumbnail" alt="" draggable="false"><span v-else class="recent-placeholder" :class="{'is-loading':!document.previewUnavailable}" aria-hidden="true"><span class="system-icon" style="--symbol:url('/symbols/doc.text.png')"></span><span v-if="document.previewUnavailable">{{t('startup.previewUnavailable')}}</span></span></button></div></section></div>
    <div v-if="pages.length" ref="layoutElement" class="page-layout virtual-layout" :class="direction" :style="{'--page-columns':columns,width:pageLayout.width+'px',height:pageLayout.height+'px'}"><ReaderPage v-for="p in mountedPages" :key="p.number" :page="p" :frame="pageLayout.frames[p.number-1]" :zoom="zoom" :translations="showTranslations" :outlined="layoutVisible" :engine="engine" :foreground="foreground" :interaction-mode="interactionMode" :pdf-document="p.mathDocument&&showTranslations?p.mathDocument:pdf" :pdf-page-number="p.mathDocument&&showTranslations?1:p.number" :register-host="bindPage" :register-canvas="bindCanvas" :native-source="nativeSource" :math-source="mathSource" :search-boxes="searchHit?.page===p.number?searchHit.boxes:[]" @hover="hoveredParagraph=$event" @toggle="toggle" @retry="processPage($event,true)"/></div>
   </main>
  </div>
  <Transition name="navigator-motion"><nav v-if="navigatorVisible&&pages.length" ref="navigator" class="page-navigator" :aria-label="t('navigator.pageNavigator')" @focusin="holdNavigator" @focusout="hideNavigatorLater"><button :aria-label="t('navigator.previousPage')" :disabled="active<=1" @click="go(active-1)"><span class="system-icon" aria-hidden="true" style="--symbol:url('/symbols/chevron.up.png')"></span></button><form @submit.prevent="submitPage"><input ref="pageInput" v-model.number="pageEntry" class="scrub-input" data-scrub="page" :aria-label="t('navigator.pageNumber')" type="number" min="1" :max="pages.length" @change="submitPage"><span>/ {{pages.length}}</span></form><button :aria-label="t('navigator.nextPage')" :disabled="active>=pages.length" @click="go(active+1)"><span class="system-icon" aria-hidden="true" style="--symbol:url('/symbols/chevron.down.png')"></span></button></nav></Transition>
  <Transition name="copy-toast"><div v-if="copyToast" class="copy-toast" role="status">{{copyToast}}</div></Transition>
  <footer v-if="!desktopCredentials" class="statusbar"><span><i class="status-dot" :class="{busy:progress.pending||loading}"></i>{{loading?t('status.openingPDF'):reading}}</span><span v-if="progress.total">{{t('status.paragraphsTranslated',{done:progress.done,total:progress.total,cached:pages.flatMap(p=>p.blocks).filter(b=>b.cached).length})}}</span><span v-else>{{configured?t('status.translationReady'):t('status.openAIKeyNotConfigured')}}</span><span v-if="pages.length">{{t('status.pageOf',{current:active,total:pages.length})}}</span></footer>
  <div v-if="error" class="error-banner" role="alert">{{error}}<button @click="error=''" :aria-label="t('error.dismiss')"><span class="system-icon" aria-hidden="true" data-symbol="xmark" style="--symbol:url('/symbols/xmark.png')"></span></button></div>
  <section v-if="selectedParagraph" class="settings paragraph-detail" @focusout="popoverFocusOut" :aria-label="t('paragraph.comparison')"><div class="settings-heading"><h2>{{t('paragraph.title')}}</h2><button :aria-label="t('paragraph.closeComparison')" @click="selectedParagraph=null"><span class="system-icon" aria-hidden="true" style="--symbol:url('/symbols/xmark.png')"></span></button></div><h3>{{t('paragraph.original')}}</h3><p class="comparison-text">{{selectedParagraph.text}}</p><h3>{{t('paragraph.translation')}}</h3><p class="comparison-text">{{selectedParagraph.translation}}</p><p class="muted">{{t('paragraph.page',{page:selectedParagraph.page,layout:selectedParagraph.layoutLabel||selectedParagraph.layoutSource})}}</p></section>
  <Transition name="settings-motion"><section v-if="settings" class="settings" @focusout="popoverFocusOut" :aria-label="t('toolbar.translationSettings')"><div class="settings-heading"><h2>{{t('settings.title')}}</h2><MacButton :aria-label="t('settings.close')" @click="settings=false"><span class="system-icon" aria-hidden="true" data-symbol="xmark" style="--symbol:url('/symbols/xmark.png')"></span></MacButton></div><section class="settings-section" aria-labelledby="settings-engine"><h3 id="settings-engine">{{t('settings.mode')}}</h3><div class="kernel-setting"><MacSegmentedControl ref="kernelInput" class="mac-mode-control" :model-value="engine" :disabled="engineBusy" aria-labelledby="settings-engine" @update:model-value="chooseKernel"><MacSegment v-for="option in kernelOptions" :key="option.id" :value="option.id">{{t(option.labelKey)}}</MacSegment></MacSegmentedControl></div><div class="kernel-status-line" role="status" :title="engineState?.reason||kernelStatusLabel"><span class="kernel-traffic-light" :data-status="kernelStatus" :aria-label="kernelStatusLabel"></span><span class="kernel-module">{{({pdf_inspector:'Inspector',pdf_math_fast:'Legacy',pdf_math_precise:'Next'})[engine]}}</span><span>{{engineState?.version||'—'}}</span><span class="kernel-uv-version">{{uvVersionLabel}}</span></div><MacButton v-if="engine!=='pdf_inspector'&&!engineState?.available" @click="installEngine" :disabled="engineBusy||!uvState?.available">{{t('settings.installKernelWithUV')}}</MacButton></section><section class="settings-section" aria-labelledby="settings-translation"><h3 id="settings-translation">{{t('settings.translation')}}</h3><div class="setting-row"><span id="source-language-label">{{t('settings.sourceLanguage')}}</span><MacPopUpButton v-model="sourceLanguage" :teleport-to="false" :aria-label="t('settings.sourceLanguage')"><MacPopUpButtonItem v-for="name in languageOptions" :key="name" :value="name">{{languageLabel(name)}}</MacPopUpButtonItem></MacPopUpButton></div><div class="setting-row"><span id="language-label">{{t('settings.translateInto')}}</span><MacPopUpButton ref="languageInput" v-model="language" v-model:open="languageMenuOpen" :teleport-to="false" :aria-label="t('settings.translationLanguage')"><template #value><span class="language-values"><span v-for="name in languageOptions" :key="name" :class="{visible:name===language}" :aria-hidden="name!==language">{{languageLabel(name)}}</span></span></template><MacPopUpButtonItem v-for="name in languageOptions" :key="name" :value="name">{{languageLabel(name)}}</MacPopUpButtonItem></MacPopUpButton></div><div v-if="desktopCredentials" class="translation-service-account" aria-labelledby="settings-account"><h3 id="settings-account">{{t('settings.apiKey')}}</h3><form v-if="desktopCredentials" class="api-key-form" @submit.prevent="updateKey()"><div class="api-key-row"><MacSecureField v-model="keyEntry" autocomplete="off" autocapitalize="off" spellcheck="false" :placeholder="keyPlaceholder" :class="{'key-invalid':keyInvalid||keyMessage}" :aria-invalid="keyInvalid||!!keyMessage" :disabled="keyBusy" :aria-label="t('settings.openAIAPIKey')" @blur="updateKey()"/><MacButton v-if="configured||keyInvalid" type="button" class="key-clear" :aria-label="t('settings.clearAPIKey')" :title="t('settings.clearAPIKey')" :disabled="keyBusy" @pointerdown.prevent @click="updateKey(true)"><span class="system-icon" aria-hidden="true" data-symbol="trash" style="--symbol:url('/symbols/trash.png')"></span></MacButton></div><button type="submit" hidden tabindex="-1" aria-hidden="true"></button></form></div><TranslationServiceOptions :engine="engine" v-model="kernelAdvancedOptions"/><div class="kernel-setting"><MacSegmentedControl class="mac-translation-control" v-model="translationMode" :aria-label="t('settings.translationMode')"><MacSegment v-for="option in translationModes" :key="option.id" :value="option.id">{{t(option.labelKey)}}</MacSegment></MacSegmentedControl><p class="muted">{{translationMode==='full'?t('translation.fullDescription'):t('translation.readingDescription')}}</p></div><div class="parallel-settings"><div class="parallel-setting"><span id="parallel-pages-label">{{t('settings.parallelPages')}}</span><MacSlider  v-model="pageConcurrency" :min="1" :max="12" :step="1" aria-labelledby="parallel-pages-label"/><div class="parallel-ticks" aria-hidden="true"><i v-for="level in parallelLevels" :key="level" :style="{left:(level-1)/11*100+'%'}"></i></div><div class="parallel-levels"><span v-for="(label,index) in parallelLabels" :key="label" :style="{left:(parallelLevels[index]-1)/11*100+'%'}" :class="{selected:index===parallelPagesStep}">{{label}}</span></div></div><div class="parallel-setting"><span id="parallel-translations-label">{{t('settings.parallelTranslations')}}</span><MacSlider  v-model="concurrency" :min="1" :max="12" :step="1" aria-labelledby="parallel-translations-label"/><div class="parallel-ticks" aria-hidden="true"><i v-for="level in parallelLevels" :key="level" :style="{left:(level-1)/11*100+'%'}"></i></div><div class="parallel-levels"><span v-for="(label,index) in parallelLabels" :key="label" :style="{left:(parallelLevels[index]-1)/11*100+'%'}" :class="{selected:index===parallelTranslationsStep}">{{label}}</span></div></div></div></section><section v-if="false" class="settings-section" aria-labelledby="settings-reading"><h3 id="settings-reading">{{t('settings.reading')}}</h3><div v-if="translationMode==='reading'" class="setting-row"><span id="automatic-label">{{t('settings.translateWhenScrollingStops')}}</span><MacSwitch v-model="automatic" aria-labelledby="automatic-label"/></div><div class="setting-row"><span id="boundaries-label">{{t('settings.showParagraphBoundaries')}}</span><MacSwitch v-model="layoutVisible" aria-labelledby="boundaries-label"/></div></section><section class="settings-section" aria-labelledby="settings-interaction"><h3 id="settings-interaction">{{t("settings.interaction")}}</h3><MacSegmentedControl v-model="interactionMode" :aria-label="t('settings.interactionMode')"><MacSegment value="reading">{{t('settings.readingMode')}}</MacSegment><MacSegment value="comparison">{{t('settings.comparisonMode')}}</MacSegment></MacSegmentedControl><div class="setting-row" data-setting="auto-hide-header"><span id="auto-hide-header-label">{{t('settings.autoHideHeader')}}</span><MacSwitch v-model="autoHideHeader" aria-labelledby="auto-hide-header-label" :aria-label="t('settings.autoHideHeader')"/></div></section><AppearanceSettings v-model:appearance="appearanceChoice" v-model:accent-color="accentColor" v-model:reduce-motion="reduceMotion" v-model:reduce-transparency="reduceTransparency" v-model:reduce-padding="reducePadding" v-model:ui-language="uiLanguage"/><AdvancedSettings :engine="engine" :engine-state="engineState" v-model="kernelAdvancedOptions"/><section class="settings-section" aria-labelledby="settings-about"><h3 id="settings-about">{{t('settings.about')}}</h3><a class="github-link" href="https://github.com/PDFMathTranslate/PDFMathReader" target="_blank" rel="noopener noreferrer" :aria-label="t('settings.githubLabel')"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.73 1.16 1.73 1.16 1 1.72 2.63 1.22 3.27.94.1-.73.39-1.22.71-1.5-2.5-.29-5.13-1.25-5.13-5.56 0-1.23.44-2.23 1.16-3.02-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.09 1.15a10.78 10.78 0 0 1 5.62 0c2.14-1.45 3.09-1.15 3.09-1.15.61 1.55.23 2.7.11 2.98.72.79 1.16 1.79 1.16 3.02 0 4.32-2.64 5.27-5.15 5.55.4.35.76 1.03.76 2.08v3.1c0 .3.2.65.78.54A11.25 11.25 0 0 0 12 .75Z"/></svg><span>{{t('settings.github')}}</span></a><p class="muted">Rongxin (rongxin@u.nus.edu)</p></section></section></Transition>
 </div>
</template>
