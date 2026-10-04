<script setup>
import {ref,onMounted} from 'vue';
import {t,uiLanguage} from './i18n.mjs';
const props=defineProps({document:{type:Object,required:true}});
const emit=defineEmits(['close']);
const dialog=ref(null);
const languageKeys={'Simplified Chinese':'simplifiedChinese','Traditional Chinese':'traditionalChinese',English:'english',Japanese:'japanese',Korean:'korean',French:'french',German:'german',Spanish:'spanish'};
onMounted(()=>dialog.value.showModal());
</script>
<template>
 <dialog ref="dialog" class="recent-status-dialog" aria-labelledby="recent-status-title" @close="emit('close')" @click="event=>{if(event.target===dialog)dialog.close();}">
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
.recent-status-dialog{width:min(420px,calc(100vw - 48px));box-sizing:border-box;padding:24px;border:1px solid var(--chrome-border);border-radius:16px;background:var(--chrome-solid);color:var(--text);box-shadow:0 12px 48px #0004;text-align:left}
.recent-status-dialog::backdrop{background:#0004}
h2{margin:0;font-size:18px}.recent-status-name{overflow-wrap:anywhere;font-weight:600}p{font-size:13px;color:var(--text-secondary)}dl{display:grid;grid-template-columns:1fr auto;gap:10px;font-size:13px}dd{margin:0;text-align:right;overflow-wrap:anywhere}form{display:flex;justify-content:flex-end;margin-top:20px}button{border:0;border-radius:7px;padding:7px 18px;background:var(--accent);color:white;font:inherit;cursor:pointer}
</style>
