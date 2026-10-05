<script setup>
import {computed} from 'vue';
import {t} from './i18n.mjs';
const props=defineProps({page:{type:Object,required:true},engine:String});
const emit=defineEmits(['retry']);
const pending=computed(()=>['queued','detecting'].includes(props.page.status)||props.page.blocks.some(b=>['queued','translating'].includes(b.status)));
const cacheReading=computed(()=>!(props.page.translationActivity==='translating'&&props.page.status==='detecting')&&!props.page.blocks.some(b=>b.status==='translating'&&b.translationActivity==='translating'));
const failed=computed(()=>props.page.status==='error'||props.page.blocks.some(b=>b.status==='error'));
const detail=computed(()=>props.page.blocks.find(b=>b.error)?.error||props.page.message||'');
const percent=computed(()=>props.page.blocks.length?Math.round(props.page.blocks.filter(b=>b.translation).length/props.page.blocks.length*100):null);
const indeterminate=computed(()=>props.page.status==='detecting'||percent.value===null);
const label=computed(()=>props.page.status==='queued'?t('pageStatus.queued'):props.page.status==='detecting'?t(props.engine==='pdf_inspector'?'pageStatus.detectingLayout':'pageStatus.loadingTranslationPage'):t('pageStatus.translatingPage'));
</script>

<template>
 <div v-if="pending" class="page-translation-progress" role="progressbar" :aria-label="t('toolbar.translationProgress')" :aria-valuetext="label" :aria-valuemin="0" :aria-valuemax="100" :aria-valuenow="indeterminate?undefined:percent" :title="label" :class="{indeterminate,queued:page.status==='queued','cache-reading':cacheReading}">
  <span class="page-translation-progress-fill" :style="indeterminate?undefined:{transform:`scaleX(${percent/100})`}"></span>
 </div>
 <Transition name="page-translation-toast">
  <div v-if="failed||(!pending&&detail)" class="page-translation-toast" :class="{error:failed}" role="status" aria-live="polite" @pointerdown.stop @click.stop>
   <div class="page-translation-toast-content">
    <strong>{{failed?t('pageStatus.translationFailed'):t('pageStatus.checkPage')}}</strong>
    <p v-if="detail">{{detail}}</p>
   </div>
   <button v-if="failed" type="button" @click="emit('retry')">{{t('pageStatus.retry')}}</button>
  </div>
 </Transition>
</template>

<style>
.page-translation-progress{position:absolute;left:0;right:0;top:0;height:4px;overflow:hidden;background:#e5e5ea;z-index:9;pointer-events:none}
.page-translation-progress-fill{display:block;width:100%;height:100%;background:var(--accent);transform-origin:left;transition:transform .2s ease}
.page-translation-progress.cache-reading .page-translation-progress-fill{background:var(--text-secondary,#8e8e93)}
.page-translation-progress.indeterminate .page-translation-progress-fill{width:35%;animation:page-translation-progress 1.6s ease-in-out infinite}
.page-translation-progress.queued .page-translation-progress-fill{width:12%;animation:none;opacity:.55}
@keyframes page-translation-progress{from{transform:translateX(-100%)}to{transform:translateX(386%)}}
.page-translation-toast{position:absolute;right:12px;bottom:16px;box-sizing:border-box;max-width:min(380px,calc(100% - 24px));max-height:calc(100% - 32px);overflow:auto;display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid var(--chrome-border);border-radius:12px;background:var(--chrome-solid);color:var(--text);box-shadow:0 4px 18px #00000020;z-index:10;font-size:12px;line-height:1.4;text-align:left}
.page-translation-toast.error::before{content:none}
.page-translation-toast-content{min-width:0;flex:1}
.page-translation-toast-content strong{font-size:12px;font-weight:600}
.page-translation-toast-content p{margin:3px 0 0;color:var(--text-secondary);overflow-wrap:anywhere;max-height:100px;overflow:auto;white-space:pre-wrap}
.page-translation-toast button{flex-shrink:0;min-height:28px;padding:4px 9px;border:0;border-radius:6px;background:var(--accent-soft);color:var(--accent);font-size:12px;font-weight:600;cursor:pointer}
.page-translation-toast button:hover{background:color-mix(in srgb,var(--accent) 20%,transparent)}
.page-translation-toast-enter-active,.page-translation-toast-leave-active{transition:opacity .18s ease,transform .18s ease}
.page-translation-toast-enter-from,.page-translation-toast-leave-to{opacity:0;transform:translateY(5px)}
:root[data-reduce-motion=true] .page-translation-progress.indeterminate .page-translation-progress-fill{transform:translateX(90%)}
@media(prefers-reduced-motion:reduce){.page-translation-progress-fill{transition:none}.page-translation-progress.indeterminate .page-translation-progress-fill{animation:none;transform:translateX(90%)}.page-translation-toast-enter-active,.page-translation-toast-leave-active{transition:none}}
</style>
