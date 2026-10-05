<script setup>
import {nextTick,ref} from 'vue';
import {t} from './i18n.mjs';
const props=defineProps({modelValue:String,disabled:Boolean});
const emit=defineEmits(['update:modelValue']);
const el=ref();
const modes=[{id:'pdf_inspector',icon:'speed',label:'speed'},{id:'pdf_math_fast',icon:'balance',label:'balance'},{id:'pdf_math_precise',icon:'quality',label:'quality'}];
function choose(id){if(!props.disabled)emit('update:modelValue',id);}
function keyboard(event,index){
 const step=event.key==='ArrowRight'||event.key==='ArrowDown'?1:event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:0;
 const target=event.key==='Home'?0:event.key==='End'?modes.length-1:step?(index+step+modes.length)%modes.length:null;
 if(target===null||props.disabled)return;
 event.preventDefault();choose(modes[target].id);nextTick(()=>el.value?.querySelectorAll('button')[target]?.focus());
}
defineExpose({el});
</script>
<template>
 <div ref="el" class="kernel-mode-switcher mac-mode-control" role="radiogroup" :aria-label="t('settings.mode')">
  <button v-for="(mode,index) in modes" :key="mode.id" type="button" role="radio" :aria-checked="modelValue===mode.id" :tabindex="modelValue===mode.id?0:-1" :disabled="disabled" :data-kernel-mode="mode.id" @click="choose(mode.id)" @keydown="keyboard($event,index)">
   <span class="kernel-mode-preview"><img :src="'/kernel-modes/'+mode.icon+'.svg'" width="148" height="100" alt="" aria-hidden="true"/></span>
   <span>{{t('settings.kernelModes.'+mode.label)}}</span>
  </button>
 </div>
</template>
<style scoped>
.kernel-mode-switcher{display:flex;align-items:start;justify-content:flex-end;gap:12px;min-width:0;padding:0;}
.kernel-mode-switcher button{display:flex;flex-direction:column;align-items:center;gap:7px;min-width:0;padding:0;border:0;background:transparent;box-shadow:none;color:var(--text-secondary);font:inherit;font-size:12px;cursor:pointer;}
.kernel-mode-preview{display:block;width:74px;height:50px;border:0;border-radius:8px;corner-shape:round;background:transparent;box-shadow:none;}
.kernel-mode-preview img{display:block;width:100%;height:100%;}
.kernel-mode-switcher button[aria-checked=true]{color:var(--text);font-weight:600;}
.kernel-mode-switcher button[aria-checked=true] .kernel-mode-preview{outline:3px solid var(--accent);outline-offset:3px;}
.kernel-mode-switcher button:focus-visible{outline:none;}
.kernel-mode-switcher button:focus-visible .kernel-mode-preview{outline:3px solid var(--accent);outline-offset:3px;}
.kernel-mode-switcher button:disabled{opacity:.5;cursor:default;}
@media(max-width:520px){.kernel-mode-switcher{gap:12px;justify-content:flex-start;}.kernel-mode-switcher button{font-size:11px;}}
</style>
