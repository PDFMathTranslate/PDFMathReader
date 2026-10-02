<script setup>
import {computed,ref,watch,nextTick,onBeforeUnmount} from 'vue';
import {characters,reducedMotion,revealDuration,revealPDF} from './text-reveal.mjs';
const props=defineProps({text:String,original:Boolean,nativeSource:Function,scale:Number});
const emit=defineEmits(['active']);const active=ref(false),generation=ref(0),nativeHost=ref(),textHost=ref();let timer,controller;
const wordSegmenter=new Intl.Segmenter(undefined,{granularity:'word'});
const words=computed(()=>{let index=0;return Array.from(wordSegmenter.segment(props.text||''),item=>item.segment).map(word=>({word,space:/^\s+$/.test(word),letters:characters(word).map(text=>({text,index:index++}))}));});
watch(()=>[props.text,props.original],async(_value,old)=>{clearTimeout(timer);controller?.abort();generation.value++;const id=generation.value;
 if(document.hidden||window.previewActivityActive===false||reducedMotion()||(!old&&props.original)){active.value=false;emit('active',false);return;}
 active.value=true;emit('active',true);await nextTick();if(id!==generation.value)return;
 const element=(nativeHost.value||textHost.value)?.parentElement,reader=element?.closest('.reader');if(element&&reader){const rect=element.getBoundingClientRect(),bounds=reader.getBoundingClientRect();if(rect.bottom<bounds.top||rect.top>bounds.bottom){active.value=false;emit('active',false);return;}}
 if(props.original&&props.nativeSource){controller=new AbortController();try{const source=props.nativeSource();const box=source.boxes[0];Object.assign(nativeHost.value.style,{left:'-3px',top:'-3px',width:(box.width+6)+'px',height:(box.height+6)+'px'});await revealPDF({...source,page:await source.page,host:nativeHost.value,signal:controller.signal});}catch{}if(id===generation.value){active.value=false;emit('active',false);}}
 else timer=setTimeout(()=>{if(id===generation.value){active.value=false;emit('active',false);}},revealDuration);
},{immediate:true});
watch(()=>props.scale,()=>{clearTimeout(timer);controller?.abort();generation.value++;active.value=false;emit('active',false);});
onBeforeUnmount(()=>{clearTimeout(timer);controller?.abort();emit('active',false);});
</script>
<template>
 <span v-if="original&&active" ref="nativeHost" class="native-paragraph-reveal" aria-hidden="true"></span>
 <span v-else-if="!original&&!active" class="paragraph-text" aria-hidden="true">{{text}}</span>
 <span v-else-if="!original" ref="textHost" :key="generation" class="paragraph-text" :class="{'text-revealing':active}" aria-hidden="true"><template v-for="(word,i) in words" :key="i"><template v-if="word.space">{{word.word}}</template><span v-else class="reveal-word"><span v-for="letter in word.letters" :key="letter.index" class="reveal-mask"><span class="reveal-letter" :style="{'--reveal-delay':Math.min(letter.index*6,180)+'ms'}">{{letter.text}}</span></span></span></template></span>
</template>
