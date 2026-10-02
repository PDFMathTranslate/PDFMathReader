<script setup>
import {ref,watch,onBeforeUnmount} from 'vue';
import {loadPDFRuntime} from './pdf-runtime.mjs';
const props=defineProps({document:Object,pageNumber:Number,zoom:Number,active:Boolean,obscuredBoxes:Array});
const host=ref();let layer,generation=0,currentDocument,currentPage,page,rendered=false,boxKey;
watch(()=>[props.document,props.pageNumber,props.zoom,props.active,props.obscuredBoxes],async()=>{
 const id=++generation;
 if(!props.active||!props.document){layer?.cancel();layer=null;rendered=false;host.value?.replaceChildren();return;}
 try{
  const runtime=await loadPDFRuntime();if(id!==generation)return;
  if(currentDocument!==props.document||currentPage!==props.pageNumber){page=await props.document.getPage(props.pageNumber);if(id!==generation)return;currentDocument=props.document;currentPage=props.pageNumber;layer?.cancel();layer=null;rendered=false;}
  const viewport=page.getViewport({scale:props.zoom});
  host.value.style.setProperty('--total-scale-factor',props.zoom);host.value.style.setProperty('--scale-round-x','1px');host.value.style.setProperty('--scale-round-y','1px');
  const nextBoxKey=JSON.stringify(props.obscuredBoxes||[]);if(layer&&rendered&&boxKey===nextBoxKey){layer.update({viewport});return;}boxKey=nextBoxKey;rendered=false;layer?.cancel();host.value.replaceChildren();
  layer=new runtime.TextLayer({textContentSource:page.streamTextContent(),container:host.value,viewport});const rendering=layer;
  await rendering.render();if(id!==generation)return;rendered=true;
  // Omit source runs covered by Ultra fast's visible translated paragraphs.
  if(props.obscuredBoxes?.length){const bounds=host.value.getBoundingClientRect(),scale=props.zoom;for(const span of rendering.textDivs){const r=span.getBoundingClientRect(),x=(r.left+r.width/2-bounds.left)/scale,y=(r.top+r.height/2-bounds.top)/scale;if(props.obscuredBoxes.some(b=>x>=b.x&&x<=b.x+b.width&&y>=b.y&&y<=b.y+b.height))span.remove();}}
 }catch(e){if(e.name!=='AbortException'&&e.name!=='RenderingCancelledException')console.error('Reading text layer failed',e);}
},{flush:'post',immediate:true});
onBeforeUnmount(()=>{generation++;layer?.cancel();});
</script>
<template><div ref="host" class="reading-text-layer textLayer" aria-label="Selectable document text"></div></template>
