<script setup>
import {computed} from 'vue';
import {MacTextField} from './platform-controls.mjs';
import {t} from './i18n.mjs';
const props=defineProps({engine:String,modelValue:Object});
const emit=defineEmits(['update:modelValue']);
const option=computed(()=>props.engine==='pdf_math_fast'?{id:'prompt',label:t('settings.promptFile')}:props.engine==='pdf_math_precise'?{id:'custom_system_prompt',label:t('settings.systemPrompt')}:null);
const value=computed(()=>props.modelValue?.[props.engine]?.[option.value?.id]||'');
function update(value){
 const options={...props.modelValue?.[props.engine]};
 if(value)options[option.value.id]=value;else delete options[option.value.id];
 emit('update:modelValue',{...props.modelValue,[props.engine]:options});
}
</script>
<template>
 <div v-if="option" class="translation-service-option">
  <label :id="'service-'+option.id">{{option.label}}</label>
  <MacTextField :model-value="value" :aria-labelledby="'service-'+option.id" @update:model-value="update"/>
 </div>
</template>
<style scoped>
.translation-service-option{display:grid;gap:8px;margin-top:16px;}
</style>
