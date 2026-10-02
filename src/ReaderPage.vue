<script setup>
import {computed,nextTick,onMounted,onBeforeUnmount} from 'vue';
import TextReveal from './TextReveal.vue';
import MathRegion from './MathRegion.vue';
import {pageNote} from './page-note.mjs';
const props=defineProps({page:Object,frame:Object,zoom:Number,translations:Boolean,outlined:Boolean,engine:String,foreground:Boolean,registerHost:Function,registerCanvas:Function,nativeSource:Function,mathSource:Function});
const p=computed(()=>props.page),emit=defineEmits(['toggle','retry']);
let host;const hostRef=el=>{host=el;props.registerHost(props.page.number,el);};
onMounted(()=>props.registerCanvas(props.page.number,host.querySelector("canvas")));
onBeforeUnmount(()=>props.registerCanvas(props.page.number,null));
function blockStyle(b){const s=props.zoom;if(b.math){const box=mathBox(b);return {left:box.x*s+'px',top:box.y*s+'px',width:box.width*s+'px',height:box.height*s+'px',fontSize:b.fontSize*s+'px'};}return {'--cover-padding':Math.max(3,b.fontSize*.28)*s+'px',left:b.x*s+'px',top:b.y*s+'px',width:b.width*s+'px',height:Math.max(b.height,b.fontSize*1.1)*s+'px',fontSize:b.fontSize*s+'px',fontWeight:b.bold?600:400};}
function mathBox(b){const a=b.sourceBox,c=b.translatedBox;return {x:Math.min(a.x,c.x),y:Math.min(a.y,c.y),width:Math.max(a.x+a.width,c.x+c.width)-Math.min(a.x,c.x),height:Math.max(a.y+a.height,c.y+c.height)-Math.min(a.y,c.y)};}
function click(b,event){if(b.math){if(event.detail===0)emit('toggle',b);}else if(event.detail<=1)emit('toggle',b);}
function fit(el,b){if(b.math)return;if(!el||!b.translation)return;nextTick(()=>{let size=b.fontSize*props.zoom;const min=Math.min(size,8*props.zoom);el.style.fontSize=size+'px';while(el.scrollHeight>el.clientHeight+1&&size>min){size-=.5;el.style.fontSize=size+'px';}});}
</script>
<template>
<div class="page-wrap" :style="{left:frame.x+'px',top:frame.y+'px',width:frame.width+'px',height:frame.height+'px'}"><div class="page" :data-page="p.number" :ref="hostRef" :style="{width:p.width*zoom+'px',height:p.height*zoom+'px'}"><canvas width="0" height="0"></canvas><button v-for="b in p.blocks" :key="b.id" :ref="el=>fit(el,b)" class="paragraph" :data-translation-changed="b.math?b.text!==b.translation:undefined" :class="{math:b.math,translated:!b.math&&b.translation&&(b.translated||b.revealing),revealing:b.revealing,outlined:outlined,pending:b.status==='translating'}" :style="blockStyle(b)" :title="b.math?'Double-click to switch original / translation':b.error || (b.translation?'Click to switch original / translation':b.status==='translating'?'Translating…':'Original paragraph')" :aria-label="b.math?`Toggle paragraph: ${b.translated?b.translation:b.text}`:b.translation?`Toggle paragraph: ${b.translated?b.translation:b.text}`:b.text" @click="click(b,$event)" @dblclick.prevent="b.math&&emit('toggle',b)"><MathRegion v-if="b.math&&b.translated!==translations" :source="()=>mathSource(p.number,b.translated)" :box="mathBox(b)" :zoom="zoom" :active="foreground"/><TextReveal v-if="!b.math&&b.translation" :text="b.translated?b.translation:b.text" :original="!b.translated" :scale="zoom" :native-source="()=>nativeSource(p.number,b)" @active="b.revealing=$event"/><span v-else class="sr-only">{{b.text}}</span></button></div><div v-if="pageNote(p,engine)" class="page-caption" :class="pageNote(p,engine).kind" :title="pageNote(p,engine).detail" role="status"><span>{{pageNote(p,engine).label}}</span><button v-if="pageNote(p,engine).kind==='error'" @click="emit('retry',p)">Retry</button></div></div>
</template>
