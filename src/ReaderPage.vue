<script setup>
import {computed,nextTick,onMounted,onBeforeUnmount,shallowRef} from 'vue';
import ReadingAnnotations from './ReadingAnnotations.vue';
import ReadingLinks from './ReadingLinks.vue';
import {quickLinkBox} from './quick-links.mjs';
import ReadingTextLayer from './ReadingTextLayer.vue';
import TopicSentenceText from './TopicSentenceText.vue';
import TextReveal from './TextReveal.vue';
import MathRegion from './MathRegion.vue';
import {annotationLineRects,highlightLineRect,annotationRailX} from './annotation-display.mjs';
import PageTranslationStatus from './PageTranslationStatus.vue';
import {paragraphDisplayText} from './translation-spacing.mjs';
import {topicParagraphBoxes} from './topic-sentences.mjs';
const props=defineProps({page:Object,crop:{type:Object,default:()=>({x:0,y:0})},frame:Object,zoom:Number,translations:Boolean,outlined:Boolean,engine:String,foreground:Boolean,registerHost:Function,registerCanvas:Function,nativeSource:Function,mathSource:Function,searchBoxes:Array,quickLinks:Array,interactionMode:String,emphasizeTopicSentences:Boolean,emphasizeInformation:Boolean,pdfDocument:Object,pdfPageNumber:Number,annotations:Array,selectedAnnotation:String,showAnnotations:{type:Boolean,default:true}});
const commentRail=shallowRef(null);
const linkRail=computed(()=>{
 if(props.interactionMode==='reading'&&props.showAnnotations&&commentRail.value!==null)return commentRail.value;
 const right=Math.max(0,...props.page.blocks.map(block=>{const box=quickLinkBox(block,props.translations);return box?box.x+box.width:0;}));
 return annotationRailX(props.page.width,right,props.zoom);
});
function quickLinkStyle(button,index){
 const box=quickLinkBox(props.page.blocks.find(b=>b.id===button.anchor.blockId),props.translations)||button.anchor.box;
 const stacked=props.quickLinks.slice(0,index).filter(b=>b.anchor.blockId===button.anchor.blockId&&b.anchor.box.y===button.anchor.box.y).length;
 return {left:linkRail.value*props.zoom+'px',top:(box.y*props.zoom+stacked*38)+'px'};
}
const p=computed(()=>props.page),emit=defineEmits(['toggle','retry','hover','annotations','notice','navigate','quick-link']);
// Unchanged math content needs no switch target; upstream can merge remote table/header runs.
const blocks=computed(()=>p.value.blocks.filter(b=>!b.math||b.text!==b.translation));
const searchHighlightBoxes=computed(()=>{const rects=annotationLineRects(props.searchBoxes||[]);return rects.map(rect=>highlightLineRect(rect,rects,p.value,props.zoom));});
const paragraphBoxes=computed(()=>topicParagraphBoxes(p.value.blocks,!!(props.translations&&p.value.mathDocument)));
function emphasizeTopic(block){return props.emphasizeTopicSentences&&paragraphBoxes.value.find(box=>box.id===block.id)?.eligible!==false;}
const readingBlocks=computed(()=>p.value.blocks.filter(b=>!b.math&&b.translation&&b.translated));
const obscuredBoxes=computed(()=>readingBlocks.value.map(b=>({x:b.x,y:b.y,width:b.width,height:Math.max(b.height,b.fontSize*1.1)})));
// The annotation layer needs a mounted page host on its first render, too.
const host=shallowRef(null);const hostRef=el=>{host.value=el;props.registerHost(props.page.number,el);};
onMounted(()=>props.registerCanvas(props.page.number,host.value.querySelector("canvas")));
onBeforeUnmount(()=>{emit('hover',null);props.registerCanvas(props.page.number,null);});
function blockStyle(b){const s=props.zoom;if(b.math){const box=mathBox(b);return {left:box.x*s+'px',top:box.y*s+'px',width:box.width*s+'px',height:box.height*s+'px',fontSize:b.fontSize*s+'px'};}return {'--paragraph-align':b.textAlign||'left','--cover-padding':Math.max(3,b.fontSize*.28)*s+'px',left:b.x*s+'px',top:b.y*s+'px',width:b.width*s+'px',height:Math.max(b.height,b.fontSize*1.1)*s+'px',fontSize:b.fontSize*s+'px',fontWeight:b.bold?600:400};}
function mathBox(b){const a=b.sourceBox,c=b.translatedBox;return {x:Math.min(a.x,c.x),y:Math.min(a.y,c.y),width:Math.max(a.x+a.width,c.x+c.width)-Math.min(a.x,c.x),height:Math.max(a.y+a.height,c.y+c.height)-Math.min(a.y,c.y)};}
function click(b,event){if(event.detail<=1)emit('toggle',b);}
function fit(el,b){if(b.math)return;if(!el||!b.translation)return;nextTick(()=>{let size=b.fontSize*props.zoom;const min=Math.min(size,8*props.zoom);el.style.fontSize=size+'px';const content=el.querySelector('.paragraph-text')||el;while(content.scrollHeight>el.clientHeight+1&&size>min){size-=.5;el.style.fontSize=size+'px';}});}
</script>
<template>
<div class="page-wrap" :class="{cropped:crop.x||crop.y}" :style="{left:frame.x+'px',top:frame.y+'px',width:frame.width+'px',height:frame.height+'px',overflow:crop.x||crop.y?'hidden':undefined,justifyItems:'start'}"><div class="page" :data-page="p.number" :ref="hostRef" :style="{width:p.width*zoom+'px',height:p.height*zoom+'px',left:-p.width*crop.x*zoom/2+'px',top:-p.height*crop.y*zoom/2+'px'}"><canvas width="0" height="0"></canvas><div v-for="(box,index) in searchHighlightBoxes" :key="index" class="search-highlight" :style="{left:box.x*zoom+'px',top:box.y*zoom+'px',width:box.width*zoom+'px',height:box.height*zoom+'px'}" aria-hidden="true"></div><ReadingTextLayer v-if="interactionMode==='reading'||emphasizeTopicSentences||emphasizeInformation" :selectable="interactionMode==='reading'" :emphasize-topic-sentences="emphasizeTopicSentences" :emphasize-information="emphasizeInformation" :paragraph-boxes="paragraphBoxes" :document="pdfDocument" :page-number="pdfPageNumber" :zoom="zoom" :active="foreground&&!!p.visible" :obscured-boxes="obscuredBoxes"/><ReadingLinks v-if="interactionMode==='reading'&&!translations" :document="pdfDocument" :page-number="pdfPageNumber" :zoom="zoom" :active="foreground&&!!p.visible" @navigate="emit('navigate',$event)"/><div v-if="interactionMode==='reading'" class="reading-paragraphs"><div v-for="b in readingBlocks" :key="b.id" :ref="el=>fit(el,b)" class="reading-paragraph" :data-block-id="b.id" :style="blockStyle(b)"><span class="paragraph-text"><TopicSentenceText :text="paragraphDisplayText(b.translation)" :enabled="emphasizeTopic(b)" :information="emphasizeInformation"/></span></div></div><template v-else><button v-for="b in blocks" :key="b.id" :ref="el=>fit(el,b)" class="paragraph" :data-translation-changed="b.math?b.text!==b.translation:undefined" :class="{math:b.math,translated:!b.math&&b.translation&&(b.translated||b.revealing),revealing:b.revealing,outlined:outlined,pending:b.status==='translating'}" :style="blockStyle(b)" :aria-label="b.math?`Toggle paragraph: ${b.translated?b.translation:b.text}`:b.translation?`Toggle paragraph: ${b.translated?b.translation:b.text}`:b.text" @pointerenter="emit('hover',b)" @pointerleave="emit('hover',null)" @click="click(b,$event)"><MathRegion v-if="b.math&&b.translated!==translations" :source="()=>mathSource(p.number,b.translated)" :box="mathBox(b)" :zoom="zoom" :active="foreground"/><TextReveal :emphasize-topic-sentences="emphasizeTopic(b)" :emphasize-information="emphasizeInformation" v-if="!b.math&&b.translation" :text="b.translated?b.translation:b.text" :original="!b.translated" :scale="zoom" :native-source="()=>nativeSource(p.number,b)" @active="b.revealing=$event"/><span v-else class="sr-only">{{b.text}}</span></button></template><Transition name="annotation-visibility" appear><div v-if="interactionMode==='reading'&&host&&showAnnotations" class="annotation-visibility"><ReadingAnnotations :host="()=>host" :page="p" :zoom="zoom" :annotations="annotations||[]" :selected-annotation="selectedAnnotation" :translated="translations" @rail="commentRail=$event" @change="emit('annotations',$event)" @notice="emit('notice',$event)"/></div></Transition><div class="quick-link-layer"><button v-for="(button,index) in quickLinks" :key="button.id" class="paragraph-quick-link" :data-link-side="button.side" :aria-label="button.side==='origin'?'返回搜索结果':'返回原文段落'" :title="button.side==='origin'?'返回搜索结果':'返回原文段落'" :style="quickLinkStyle(button,index)" @click.stop="emit('quick-link',button)"><span class="system-icon" aria-hidden="true" data-symbol="link" style="--symbol:url('/symbols/link.png')"></span></button></div><PageTranslationStatus :page="p" :engine="engine" @retry="emit('retry',p)"/></div></div>

</template>

<style>
/* Blend at the outer stacking context so highlights multiply the page ink. */
.annotation-visibility{position:absolute;inset:0;pointer-events:none;z-index:7;mix-blend-mode:multiply}
.annotation-visibility-enter-active,.annotation-visibility-leave-active{transition:opacity .2s ease}
.annotation-visibility-enter-from,.annotation-visibility-leave-to{opacity:0}
.annotation-visibility-leave-active .annotation-mark{pointer-events:none}
@media(prefers-reduced-motion:reduce){.annotation-visibility-enter-active,.annotation-visibility-leave-active{transition:none}}
</style>
