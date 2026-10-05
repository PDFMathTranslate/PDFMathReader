<script setup>
import {MacButton} from './platform-controls.mjs';
import {t} from './i18n.mjs';
defineProps({message:String,kernelLabel:String,bundled:Boolean,busy:Boolean,ignoreDocument:Boolean});
const emit=defineEmits(['ignore','retry','reinstall','rebuild']);
</script>

<template>
 <section class="kernel-error-popover" role="alert" aria-labelledby="kernel-error-title" aria-describedby="kernel-error-message" @keydown.esc.stop.prevent="emit('ignore')">
  <header class="kernel-error-heading">
   <svg class="kernel-error-symbol" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 4.5 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.5a2 2 0 0 0-3.4 0Z"/><path d="M12 9v5"/><circle cx="12" cy="17.5" r=".7" fill="currentColor" stroke="none"/></svg>
   <div><h2 id="kernel-error-title">{{t('engine.error')}}</h2><p class="kernel-error-name">{{kernelLabel}}</p></div>
  </header>
  <p id="kernel-error-message" class="kernel-error-message">{{message}}</p>
  <p v-if="bundled" class="kernel-error-hint">{{t('kernelRecovery.bundled')}}</p>
  <div v-else class="kernel-error-repairs">
   <MacButton :disabled="busy" @click="emit('reinstall')">{{t('kernelRecovery.reinstall')}}</MacButton>
   <MacButton :disabled="busy" @click="emit('rebuild')">{{t('kernelRecovery.rebuild')}}</MacButton>
  </div>
  <footer class="kernel-error-actions">
   <MacButton @click="emit('ignore')">{{t(ignoreDocument?'kernelRecovery.ignoreDocument':'kernelRecovery.ignore')}}</MacButton>
   <MacButton variant="prominent" :disabled="busy" @click="emit('retry')">{{t('kernelRecovery.retry')}}</MacButton>
  </footer>
 </section>
</template>

<style scoped>
.kernel-error-popover{
 position:absolute;top:calc(100% + 12px);right:0;z-index:60;
 width:min(340px,calc(100vw - 28px));max-height:calc(100dvh - var(--toolbar-height) - 32px);
 padding:20px;border:1px solid var(--chrome-border);border-radius:22px;corner-shape:squircle;
 background:var(--chrome-solid,#f7f7f9);color:var(--text);isolation:isolate;opacity:1;
 -webkit-backdrop-filter:none;backdrop-filter:none;
 box-shadow:inset 0 1px 0 #ffffff40,0 8px 28px #00000018,0 24px 64px #0000001f;
 font-size:13px;line-height:1.5;white-space:normal;overflow-wrap:anywhere;overflow-y:auto;
 transform-origin:calc(100% - 28px) top;-webkit-app-region:no-drag;
}
 .kernel-error-popover.settings-motion-enter-active,.kernel-error-popover.settings-motion-leave-active{transition:transform 180ms var(--motion-ease)}
.kernel-error-popover.settings-motion-enter-from,.kernel-error-popover.settings-motion-leave-to{opacity:1}
.kernel-error-heading{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.kernel-error-heading>div{min-width:0}
.kernel-error-symbol{width:28px;height:28px;flex:none;color:var(--warning)}
.kernel-error-heading h2{margin:0;font-size:14px;line-height:1.35;font-weight:600;letter-spacing:-.01em;color:var(--text)}
.kernel-error-name{margin:3px 0 0;font-size:12px;line-height:1.4;color:var(--text-secondary)}
.kernel-error-message{margin:0;color:var(--text);white-space:pre-wrap;max-height:180px;overflow:auto;user-select:text;-webkit-user-select:text}
.kernel-error-hint{margin:10px 0 0;color:var(--text-secondary);font-size:12px}
.kernel-error-repairs{display:grid;gap:8px;margin-top:18px}
.kernel-error-actions{display:grid;grid-template-columns:minmax(0,1fr) minmax(90px,.7fr);gap:8px;margin-top:18px;padding-top:14px;border-top:1px solid var(--chrome-divider)}
.kernel-error-popover :deep(button),.kernel-error-popover :deep(fluent-button){width:100%;min-width:0;min-height:32px;height:auto;padding:7px 12px;border-radius:999px;corner-shape:round;font:inherit;line-height:1.3;white-space:normal}
.kernel-error-repairs :deep(button){background:var(--chrome-hover);color:var(--text);box-shadow:inset 0 0 0 1px var(--chrome-divider)}
.kernel-error-repairs :deep(button:hover:not(:disabled)){background:var(--chrome-pressed)}
.kernel-error-popover :deep(button:focus-visible){outline:3px solid var(--accent);outline-offset:3px}
:global(.reduced-transparency .kernel-error-popover),:global([data-reduce-transparency="true"] .kernel-error-popover){background:var(--chrome-solid);-webkit-backdrop-filter:none;backdrop-filter:none}
@media(prefers-reduced-transparency:reduce){.kernel-error-popover{background:var(--chrome-solid);-webkit-backdrop-filter:none;backdrop-filter:none}}
:global([data-reduce-motion="true"] .kernel-error-popover){transition:none!important}
@media(prefers-contrast:more){.kernel-error-popover{background:var(--chrome-solid);border-color:var(--text-secondary);-webkit-backdrop-filter:none;backdrop-filter:none}.kernel-error-name,.kernel-error-hint{color:var(--text)}}
@media(max-width:700px){.kernel-error-popover{right:-4px}}
@media(max-width:420px){.kernel-error-popover{right:-8px;padding:16px}}
</style>
