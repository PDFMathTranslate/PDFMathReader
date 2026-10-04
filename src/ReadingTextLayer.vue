<script setup>
import {ref,watch,onMounted,onBeforeUnmount} from 'vue';
import {uiLanguage} from './i18n.mjs';
import {informationRunRanges,informationTextSegments,mergeInformationRects} from './information-emphasis.mjs';
import {topicSentenceRanges} from './topic-sentences.mjs';
import {loadPDFRuntime} from './pdf-runtime.mjs';
const props=defineProps({document:Object,pageNumber:Number,zoom:Number,active:Boolean,obscuredBoxes:Array,paragraphBoxes:Array,emphasizeTopicSentences:Boolean,emphasizeInformation:Boolean,selectable:Boolean});
const host=ref();let layer,generation=0,currentDocument,currentPage,page,rendered=false,boxKey,overlay,highlights,frameHost;
const originals=new WeakMap();
function drawEmphasis(){
 if(!host.value)return;overlay?.remove();overlay=null;highlights?.remove();highlights=null;
 if(!rendered||!props.active)return;
 const pageBounds=host.value.getBoundingClientRect();
 if(props.emphasizeInformation){
  const boxes=[];for(const mark of host.value.querySelectorAll('.pdf-information-keyword')){const range=window.document.createRange();range.selectNodeContents(mark);for(const r of range.getClientRects())boxes.push({x:r.left-pageBounds.left,y:r.top-pageBounds.top,width:r.width,height:r.height});}
  highlights=window.document.createElement('div');highlights.className='information-highlights';highlights.setAttribute('aria-hidden','true');
  for(const r of mergeInformationRects(boxes)){const rect=window.document.createElement('div');rect.className='information-highlight-rect';Object.assign(rect.style,{left:r.x+'px',top:r.y+'px',width:r.width+'px',height:r.height+'px'});highlights.append(rect);}
  host.value.append(highlights);
 }
 if(!props.emphasizeTopicSentences)return;
 const source=host.value.parentElement?.querySelector(':scope > canvas');if(!source?.width||!source.height)return;
 const bounds=host.value.getBoundingClientRect();if(!bounds.width||!bounds.height)return;
 const rects=[];for(const strong of host.value.querySelectorAll('.pdf-topic-sentence')){const range=window.document.createRange();range.selectNodeContents(strong);rects.push(...range.getClientRects());}
 if(!rects.length)return;
 overlay=window.document.createElement('canvas');overlay.className='topic-sentence-overlay';overlay.width=source.width;overlay.height=source.height;
 const context=overlay.getContext('2d'),sx=source.width/bounds.width,sy=source.height/bounds.height;
 context.globalCompositeOperation='darken';
 for(const r of rects){context.save();context.beginPath();context.rect((r.left-bounds.left)*sx-.5*sx,(r.top-bounds.top)*sy, r.width*sx+sx,r.height*sy);context.clip();for(const offset of [-.3,0,.3])context.drawImage(source,offset*sx,0);context.restore();}
 // Keep only the glyph ink so the overlay never obscures the rest of the PDF.
 const pixels=context.getImageData(0,0,source.width,source.height),data=pixels.data;
 for(let i=0;i<data.length;i+=4){if(!data[i+3])continue;const white=Math.min(data[i],data[i+1],data[i+2]),alpha=255-white;if(!alpha){data[i+3]=0;continue;}for(let c=0;c<3;c++)data[i+c]=(data[i+c]-white)*255/alpha;data[i+3]=alpha;}
 context.putImageData(pixels,0,0);host.value.append(overlay);
}
onMounted(()=>{frameHost=host.value?.parentElement;frameHost?.addEventListener('pdf-frame-presented',drawEmphasis);});
function emphasize(){
 if(!rendered||!host.value||!layer)return;
 const spans=layer.textDivs.filter(span=>host.value.contains(span));
 for(const span of spans){if(!originals.has(span))originals.set(span,span.textContent);span.textContent=originals.get(span);}
 if(!props.emphasizeTopicSentences&&!props.emphasizeInformation){drawEmphasis();return;}
 const bounds=host.value.getBoundingClientRect(),scale=props.zoom;
 const runs=spans.map(span=>{const r=span.getBoundingClientRect();return {text:originals.get(span),x:(r.left-bounds.left)/scale,y:(r.top-bounds.top)/scale,width:r.width/scale,height:r.height/scale};});
 const topicRanges=props.emphasizeTopicSentences?topicSentenceRanges(runs,props.paragraphBoxes||[],uiLanguage.value):[];
 const informationRanges=props.emphasizeInformation?informationRunRanges(runs):[];
 for(let index=0;index<spans.length;index++){
  const span=spans[index],text=originals.get(span),topicEnd=topicRanges.find(r=>r.index===index)?.end||0;
  const parts=informationTextSegments(text,{topicEnd,emphasizeInformation:props.emphasizeInformation,ranges:informationRanges.filter(r=>r.index===index)});
  span.replaceChildren(...parts.map(part=>{let node=window.document.createTextNode(part.text);if(part.important){const mark=window.document.createElement('mark');mark.className='pdf-information-keyword';mark.append(node);node=mark;}if(part.topic){const strong=window.document.createElement('strong');strong.className='pdf-topic-sentence';strong.append(node);node=strong;}return node;}));
 }
 drawEmphasis();
}
watch(()=>[props.emphasizeTopicSentences,props.emphasizeInformation,props.paragraphBoxes,uiLanguage.value],emphasize,{flush:'post'});
watch(()=>[props.document,props.pageNumber,props.zoom,props.active,props.obscuredBoxes],async()=>{
 const id=++generation;
 if(!props.active||!props.document){layer?.cancel();layer=null;rendered=false;host.value?.replaceChildren();return;}
 try{
  const runtime=await loadPDFRuntime();if(id!==generation)return;
  if(currentDocument!==props.document||currentPage!==props.pageNumber){page=await props.document.getPage(props.pageNumber);if(id!==generation)return;currentDocument=props.document;currentPage=props.pageNumber;layer?.cancel();layer=null;rendered=false;}
  const viewport=page.getViewport({scale:props.zoom});
  host.value.style.setProperty('--total-scale-factor',props.zoom);host.value.style.setProperty('--scale-round-x','1px');host.value.style.setProperty('--scale-round-y','1px');
  const nextBoxKey=JSON.stringify(props.obscuredBoxes||[]);if(layer&&rendered&&boxKey===nextBoxKey){layer.update({viewport});emphasize();return;}boxKey=nextBoxKey;rendered=false;layer?.cancel();host.value.replaceChildren();
  layer=new runtime.TextLayer({textContentSource:page.streamTextContent(),container:host.value,viewport});const rendering=layer;
  await rendering.render();if(id!==generation)return;rendered=true;
  // Omit source runs covered by Ultra fast's visible translated paragraphs.
  if(props.obscuredBoxes?.length){const bounds=host.value.getBoundingClientRect(),scale=props.zoom;for(const span of rendering.textDivs){const r=span.getBoundingClientRect(),x=(r.left+r.width/2-bounds.left)/scale,y=(r.top+r.height/2-bounds.top)/scale;if(props.obscuredBoxes.some(b=>x>=b.x&&x<=b.x+b.width&&y>=b.y&&y<=b.y+b.height))span.remove();}}
  emphasize();
 }catch(e){if(e.name!=='AbortException'&&e.name!=='RenderingCancelledException')console.error('Reading text layer failed',e);}
},{flush:'post',immediate:true});
onBeforeUnmount(()=>{generation++;layer?.cancel();frameHost?.removeEventListener('pdf-frame-presented',drawEmphasis);});
</script>
<template><div ref="host" class="reading-text-layer textLayer" :class="{'topic-layer-only':!selectable}" aria-label="Selectable document text"></div></template>

<style>
.reading-text-layer.topic-layer-only{pointer-events:none;user-select:none}
.reading-text-layer :is(.pdf-topic-sentence,.pdf-information-keyword){position:static;font:inherit;color:transparent;background:transparent;padding:0;white-space:inherit;transform:none}
.reading-text-layer .topic-sentence-overlay{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;transform:none;z-index:2;background:transparent;min-height:0;border-radius:0}
.reading-text-layer .information-highlights{position:absolute;inset:0;pointer-events:none;user-select:none;transform:none;z-index:1}
.information-highlight-rect{position:absolute;pointer-events:none;background:color-mix(in srgb,var(--system-accent,var(--accent)) 24%,transparent);border-radius:2px}
</style>
