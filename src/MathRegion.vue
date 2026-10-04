<script setup>
import {ref,watch,onBeforeUnmount} from 'vue';
const props=defineProps({source:Function,box:Object,zoom:Number,active:{type:Boolean,default:true}});
const canvas=ref();let task,generation=0;
watch(()=>[props.source,props.box,props.zoom,props.active],async()=>{
 const id=++generation;task?.cancel();task=null;
 if(!props.active)return;
 let frame,rendering;
 try{
  const page=await props.source();if(id!==generation)return;
  const el=canvas.value;if(!el)return;
  const scale=props.zoom,box=props.box,dpr=Math.min(devicePixelRatio,2,Math.sqrt(16*1024*1024/(box.width*box.height*scale*scale*4)));
  frame=document.createElement('canvas');
  frame.width=Math.ceil(box.width*scale*dpr);frame.height=Math.ceil(box.height*scale*dpr);
  const context=frame.getContext('2d');
  rendering=page.render({canvasContext:context,viewport:page.getViewport({scale}),transform:[dpr,0,0,dpr,-box.x*scale*dpr,-box.y*scale*dpr]});
  task=rendering;await rendering.promise;
  if(id!==generation)return;
  el.width=frame.width;el.height=frame.height;el.getContext('2d').drawImage(frame,0,0);
 }catch(e){if(e.name!=='RenderingCancelledException')console.error('Paragraph render failed',e);}
 finally{if(task===rendering)task=null;if(frame)frame.width=frame.height=0;}
},{flush:'post',immediate:true});
onBeforeUnmount(()=>{generation++;task?.cancel();});
</script>
<template><canvas ref="canvas" class="math-region" aria-hidden="true"></canvas></template>
