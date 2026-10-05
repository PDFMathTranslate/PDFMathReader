<script setup>
import {computed} from 'vue';
import {MacSwitch,MacSlider} from './platform-controls.mjs';
import {t} from './i18n.mjs';
const cropEnabled=defineModel('cropEnabled',{type:Boolean,default:false});
const cropX=defineModel('cropX',{type:Number,default:0});
const cropY=defineModel('cropY',{type:Number,default:0});
const alignWidth=defineModel('alignWidth',{type:Boolean,default:false});
const percentage=model=>computed({get:()=>Math.round(model.value*100),set:value=>{const number=Number(value);model.value=Number.isFinite(number)?Math.max(0,Math.min(50,number))/100:0;}});
const horizontal=percentage(cropX),vertical=percentage(cropY);
</script>

<template>
 <section class="settings-section" aria-labelledby="document-defaults-heading">
  <h3 id="document-defaults-heading">{{t('settings.documentDefaults')}}</h3>
  <div class="settings-section-body">
   <div class="setting-row" data-setting="auto-align-document-width">
    <span id="auto-align-document-width-label">{{t('settings.autoAlignDocumentWidth')}}</span>
    <MacSwitch v-model="alignWidth" aria-labelledby="auto-align-document-width-label" aria-describedby="auto-align-document-width-hint"/>
   </div>
   <p id="auto-align-document-width-hint" class="muted document-default-hint">{{t('settings.autoAlignDocumentWidthHint')}}</p>
   <div class="setting-row" data-setting="default-page-crop">
    <span id="default-page-crop-label">{{t('settings.defaultPageCrop')}}</span>
    <MacSwitch v-model="cropEnabled" aria-labelledby="default-page-crop-label" aria-describedby="default-page-crop-hint"/>
   </div>
   <p id="default-page-crop-hint" class="muted document-default-hint">{{t('settings.defaultPageCropHint')}}</p>
   <div class="crop-sliders">
    <div v-for="axis in ['horizontal','vertical']" :key="axis" class="crop-slider" :data-setting="'default-crop-'+axis">
     <div class="crop-slider-label"><span :id="'default-crop-'+axis+'-label'">{{t('settings.crop'+(axis==='horizontal'?'Horizontal':'Vertical'))}}</span><output>{{axis==='horizontal'?horizontal:vertical}}%</output></div>
     <MacSlider v-if="axis==='horizontal'" v-model="horizontal" :min="0" :max="50" :step="1" :disabled="!cropEnabled" :aria-labelledby="'default-crop-'+axis+'-label'"/>
     <MacSlider v-else v-model="vertical" :min="0" :max="50" :step="1" :disabled="!cropEnabled" :aria-labelledby="'default-crop-'+axis+'-label'"/>
    </div>
   </div>

  </div>
 </section>
</template>

<style scoped>
.document-default-hint{margin:0;padding:0 0 12px;font-size:12px;line-height:1.5}
.crop-sliders{display:grid;gap:14px;padding:2px 0 4px}
[data-setting="default-page-crop"]{border-top:1px solid var(--separator,#8883)}
.crop-slider{display:grid;gap:8px}.crop-slider-label{display:flex;align-items:center;justify-content:space-between;gap:16px;font-size:13px}.crop-slider-label output{color:var(--text-secondary);font-variant-numeric:tabular-nums}
</style>
