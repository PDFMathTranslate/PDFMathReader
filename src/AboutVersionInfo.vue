<script setup>
import {ref,onMounted} from 'vue';
import {t} from './i18n.mjs';
import {loadBuildInfo} from './build-info.mjs';
const props=defineProps({engines:{type:Array,default:()=>[]},uv:{type:Object,default:null},discoveryFailed:Boolean});
const info=ref(null),failed=ref(false);
function uvVersion(version){return version?.match(/^uv\s+(\S+)/)?.[1]||version;}
const kernels=[{id:'pdf_inspector',name:'Inspector'},{id:'pdf_math_fast',name:'Legacy'},{id:'pdf_math_precise',name:'Next'}];
function kernelVersion(states,id){const state=states.find(item=>item.id===id);return !state?t(props.discoveryFailed?'aboutVersions.unavailable':'aboutVersions.loading'):state.version||t(state.installed?'engine.error':'engine.missing');}
onMounted(async()=>{try{info.value=await loadBuildInfo();}catch{failed.value=true;}});
</script>
<template>
<section class="settings-section about-versions" aria-labelledby="settings-about-versions">
 <h3 id="settings-about-versions">{{t('aboutVersions.title')}}</h3>
 <div class="settings-section-body">
  <div class="setting-row"><span>{{t('aboutVersions.app')}}</span><span class="version-value" data-version="app">{{info?.version||(failed?t('aboutVersions.unavailable'):t('aboutVersions.loading'))}}</span></div>
  <div v-for="kernel in kernels" :key="kernel.id" class="setting-row"><span>{{kernel.name}}</span><span class="version-value" :data-version="kernel.id">{{kernelVersion(engines,kernel.id)}}</span></div>
  <div class="setting-row"><span>UV</span><span class="version-value" data-version="uv" :title="uv?.version">{{uvVersion(uv?.version)||(uv||discoveryFailed?t('aboutVersions.unavailable'):t('aboutVersions.loading'))}}</span></div>
 </div>
</section>
<section class="settings-section about-updates" aria-labelledby="settings-about-updates">
 <h3 id="settings-about-updates">{{t('aboutVersions.recent')}}</h3>
 <div class="settings-section-body recent-features">
   <ol v-if="info?.recentFeatures?.length" class="feature-updates"><li v-for="feature in info.recentFeatures" :key="feature.hash"><span>{{feature.subject}}</span><time :datetime="feature.date">{{feature.date.slice(0,10)}}</time></li></ol>
   <p v-else class="muted">{{info?t('aboutVersions.empty'):failed?t('aboutVersions.unavailable'):t('aboutVersions.loading')}}</p>
 </div>
</section>
</template>
<style scoped>
.version-value{min-width:0;text-align:right;overflow-wrap:anywhere;color:var(--text-secondary);font-variant-numeric:tabular-nums;max-width:65%}
.feature-updates{list-style:none;margin:0;padding:0}
.feature-updates li{display:flex;align-items:baseline;justify-content:space-between;gap:18px;padding:10px 0;line-height:1.5}
.feature-updates li+li{border-top:1px solid var(--chrome-divider)}
.feature-updates span{min-width:0;overflow-wrap:anywhere}
.feature-updates time{flex-shrink:0;color:var(--text-secondary);font-size:12px;font-variant-numeric:tabular-nums}
@media(max-width:600px){.feature-updates li{flex-direction:column;gap:2px}}
</style>
