<script setup>
import {ref,onMounted} from 'vue';
import {t,uiLanguage} from './i18n.mjs';
const props=defineProps({document:{type:Object,required:true}});
const emit=defineEmits(['close']);
const dialog=ref(null);
const platform=window.previewAppearance?.platform||'web';
const languageKeys={'Simplified Chinese':'simplifiedChinese','Traditional Chinese':'traditionalChinese',English:'english',Japanese:'japanese',Korean:'korean',French:'french',German:'german',Spanish:'spanish'};
onMounted(async()=>{
 if(platform==='darwin'&&window.previewRecents?.statusDialog){
  const status=props.document.translationStatus;
  const rows=status?[
   ['total',status.totalPages],['completed',status.completedPages],['partial',status.partialPages],
   ['pending',status.totalPages-status.completedPages-status.partialPages-status.failedPages],['failed',status.failedPages],
   ['engine',t({pdf_inspector:'engine.ultraFast',pdf_math_fast:'engine.fast',pdf_math_precise:'engine.precise'}[status.engine])],
   ['language',languageKeys[status.language]?t('languages.'+languageKeys[status.language]):status.language],
   ['updated',new Date(status.updatedAt).toLocaleString(uiLanguage.value)]
  ].map(([key,value])=>`${t('recentStatus.'+key)}：${value}`).join('\n'):'';
  try{
   await window.previewRecents.statusDialog({title:t('recentStatus.title'),detail:[props.document.name,t(status?'recentStatus.snapshot':'recentStatus.unknown'),rows].filter(Boolean).join('\n\n'),close:t('recentStatus.close')});
   emit('close');
  }catch{dialog.value.showModal();}
 }else dialog.value.showModal();
});
</script>
<template>
 <dialog ref="dialog" class="recent-status-dialog" :data-platform="platform" aria-labelledby="recent-status-title" @close="emit('close')" @click="event=>{if(event.target===dialog)dialog.close();}">
  <h2 id="recent-status-title">{{t('recentStatus.title')}}</h2>
  <p class="recent-status-name">{{document.name}}</p>
  <template v-if="document.translationStatus">
   <p>{{t('recentStatus.snapshot')}}</p>
   <dl><dt>{{t('recentStatus.total')}}</dt><dd>{{document.translationStatus.totalPages}}</dd><dt>{{t('recentStatus.completed')}}</dt><dd>{{document.translationStatus.completedPages}}</dd><dt>{{t('recentStatus.partial')}}</dt><dd>{{document.translationStatus.partialPages}}</dd><dt>{{t('recentStatus.pending')}}</dt><dd>{{document.translationStatus.totalPages-document.translationStatus.completedPages-document.translationStatus.partialPages-document.translationStatus.failedPages}}</dd><dt>{{t('recentStatus.failed')}}</dt><dd>{{document.translationStatus.failedPages}}</dd><dt>{{t('recentStatus.engine')}}</dt><dd>{{t({pdf_inspector:'engine.ultraFast',pdf_math_fast:'engine.fast',pdf_math_precise:'engine.precise'}[document.translationStatus.engine])}}</dd><dt>{{t('recentStatus.language')}}</dt><dd>{{languageKeys[document.translationStatus.language]?t('languages.'+languageKeys[document.translationStatus.language]):document.translationStatus.language}}</dd><dt>{{t('recentStatus.updated')}}</dt><dd>{{new Date(document.translationStatus.updatedAt).toLocaleString(uiLanguage)}}</dd></dl>
  </template>
  <p v-else>{{t('recentStatus.unknown')}}</p>
  <form method="dialog"><button autofocus>{{t('recentStatus.close')}}</button></form>
 </dialog>
</template>
<style scoped>
.recent-status-dialog{width:min(420px,calc(100vw - 48px));max-height:calc(100dvh - 48px);overflow:auto;box-sizing:border-box;padding:24px;border:1px solid var(--chrome-border);border-radius:16px;background:var(--chrome-solid);color:var(--text);box-shadow:0 12px 48px #0004;text-align:left}
.recent-status-dialog::backdrop{background:#0004}
h2{margin:0;font-size:18px}.recent-status-name{overflow-wrap:anywhere;font-weight:600}p{font-size:13px;color:var(--text-secondary)}dl{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,auto);gap:10px;font-size:13px}dd{margin:0;text-align:right;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}form{display:flex;justify-content:flex-end;margin-top:20px}button{border:0;border-radius:7px;padding:7px 18px;background:var(--accent);color:white;font:inherit;cursor:pointer}
.recent-status-dialog[data-platform="darwin"]{
 --status-surface:#f4f4f4;
 --status-text:#242424;
 --status-secondary:#6c6c6c;
 --status-edge:#00000026;
 --status-inner-edge:#ffffffb3;
 --status-divider:#00000012;
 --status-shadow:0 20px 60px #00000040,0 4px 12px #00000026;
 width:min(360px,calc(100vw - 40px));padding:20px;
 font-family:-apple-system,BlinkMacSystemFont,system-ui,sans-serif;font-size:13px;line-height:1.4;
 background:var(--status-surface);color:var(--status-text);
 border:1px solid var(--status-edge);border-radius:14px;
 box-shadow:inset 0 1px 0 var(--status-inner-edge),var(--status-shadow);
}
[data-appearance="dark"] .recent-status-dialog[data-platform="darwin"]{
 --status-surface:#2c2c2e;--status-text:#ffffffe8;--status-secondary:#ffffff8c;
 --status-edge:#00000080;--status-inner-edge:#ffffff24;--status-divider:#ffffff18;
 --status-shadow:0 20px 60px #00000066,0 4px 12px #00000040;
}
.recent-status-dialog[data-platform="darwin"]::backdrop{background:#00000026}
.recent-status-dialog[data-platform="darwin"] h2{font-size:15px;line-height:20px;font-weight:600;letter-spacing:0}
.recent-status-dialog[data-platform="darwin"] p{color:var(--status-secondary);font-size:12px;line-height:17px;margin:8px 0 16px}
.recent-status-dialog[data-platform="darwin"] .recent-status-name{font-size:13px;font-weight:400;line-height:18px;margin:6px 0 12px;color:var(--status-text)}
.recent-status-dialog[data-platform="darwin"] dl{margin:0;padding:12px 0;border-top:1px solid var(--status-divider);border-bottom:1px solid var(--status-divider);font-size:13px;line-height:18px;column-gap:16px;row-gap:8px}
.recent-status-dialog[data-platform="darwin"] dt{color:var(--status-secondary)}
.recent-status-dialog[data-platform="darwin"] dd{min-width:0;color:var(--status-text)}
.recent-status-dialog[data-platform="darwin"] form{margin:16px 0 0}
.recent-status-dialog[data-platform="darwin"] button{min-width:68px;min-height:24px;padding:3px 14px;font:inherit;line-height:18px;border-radius:6px;border:1px solid #00000012;background:linear-gradient(#1686ff,#0070ed);color:white;box-shadow:inset 0 1px 0 #ffffff26,0 1px 2px #00000014;cursor:default}
.recent-status-dialog[data-platform="darwin"] button:hover{background:linear-gradient(#087bf2,#0067df)}
.recent-status-dialog[data-platform="darwin"] button:active{background:#005dcc;box-shadow:inset 0 1px 2px #0002}
.recent-status-dialog[data-platform="darwin"] button:focus-visible{outline:3px solid #007aff66;outline-offset:2px}
</style>
