<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import KernelInstallGuide from './KernelInstallGuide.vue';
import { MacButton, MacSwitch } from './platform-controls.mjs';
import { t, uiLanguage } from './i18n.mjs';
import { developerText } from './developer-locales.mjs';
defineProps({ embedded: Boolean });
const developerAvailable = !!globalThis.window?.previewDeveloper;
const developerEnabled = ref(false),
  developerBusy = ref(false),
  developerError = ref('');
const installDialog = ref(null),
  previewScenario = ref('pending'),
  previewRevision = ref(0),
  previewBusy = ref(false);
let previewUv = false,
  previewKernel = false;
const zh = () => /^zh/.test(uiLanguage.value);
function resetPreview(scenario) {
  previewScenario.value = scenario;
  previewUv = scenario === 'complete';
  previewKernel = scenario === 'complete';
  previewRevision.value++;
}
function openInstallGuide() {
  resetPreview('pending');
  installDialog.value.showModal();
}
async function previewRequest(path, options = {}) {
  if (options.method === 'POST') {
    await new Promise((resolve) => setTimeout(resolve, 700));
    if (previewScenario.value === 'failed')
      throw Error(
        zh() ? '模拟下载失败，请重试当前步骤。' : 'Simulated download failure. Retry this step.',
      );
    if (path === '/api/runtime/uv/install') previewUv = true;
    else previewKernel = true;
    return {};
  }
  return {
    uv: { available: previewUv },
    engines: [{ id: 'fast', available: previewKernel }],
  };
}
let unsubscribeDeveloper;
const dt = (key) => developerText(uiLanguage.value, 'app.' + key);
onMounted(async () => {
  if (!window.previewDeveloper) return;
  unsubscribeDeveloper = window.previewDeveloper.onChange((value) => {
    developerEnabled.value = value;
  });
  try {
    developerEnabled.value = await window.previewDeveloper.enabled();
  } catch (error) {
    developerError.value = error.message;
  }
});
onBeforeUnmount(() => unsubscribeDeveloper?.());
async function toggleDeveloper(enabled) {
  if (developerBusy.value) return;
  developerBusy.value = true;
  developerError.value = '';
  try {
    await window.previewDeveloper[enabled ? 'open' : 'close']();
    developerEnabled.value = enabled;
  } catch (error) {
    developerError.value = error.message;
  } finally {
    developerBusy.value = false;
  }
}
</script>
<template>
  <section
    v-if="developerAvailable"
    :class="embedded ? 'developer-options-embedded' : 'settings-section developer-options'"
    :aria-labelledby="embedded ? undefined : 'settings-developer-options'"
  >
    <h3 v-if="!embedded" id="settings-developer-options">{{ t('settings.developerOptions') }}</h3>
    <div :class="embedded ? 'advanced-developer-mode' : 'settings-section-body'">
      <div class="setting-row">
        <span id="developer-mode-label">{{ dt('developerMode') }}</span
        ><MacSwitch
          :model-value="developerEnabled"
          :disabled="developerBusy"
          aria-labelledby="developer-mode-label"
          @update:model-value="toggleDeveloper"
        />
      </div>
      <p class="muted">{{ dt('developerHint') }}</p>
      <MacButton v-if="developerEnabled" :disabled="developerBusy" @click="toggleDeveloper(true)">{{
        dt('openWindow')
      }}</MacButton>
      <MacButton class="install-guide-trigger" @click="openInstallGuide">{{
        zh() ? '调试安装引导…' : 'Debug installation guide…'
      }}</MacButton>
      <Teleport to="body">
        <dialog
          ref="installDialog"
          class="install-guide-dialog"
          :aria-label="zh() ? '调试安装引导' : 'Debug installation guide'"
          @cancel="previewBusy && $event.preventDefault()"
        >
          <header>
            <h2>{{ zh() ? '调试安装引导' : 'Debug installation guide' }}</h2>
            <p>
              {{
                zh()
                  ? '模拟安装流程，不会下载或安装软件。'
                  : 'Simulated setup. No software is downloaded or installed.'
              }}
            </p>
          </header>
          <div class="install-guide-scenarios">
            <MacButton :disabled="previewBusy" @click="resetPreview('pending')">{{
              zh() ? '待安装' : 'Not installed'
            }}</MacButton>
            <MacButton :disabled="previewBusy" @click="resetPreview('complete')">{{
              zh() ? '安装完成' : 'Installed'
            }}</MacButton>
            <MacButton :disabled="previewBusy" @click="resetPreview('failed')">{{
              zh() ? '安装失败' : 'Failure'
            }}</MacButton>
          </div>
          <KernelInstallGuide
            :key="previewRevision"
            engine="fast"
            :request="previewRequest"
            @busy="previewBusy = $event"
          />
          <footer>
            <MacButton :disabled="previewBusy" @click="installDialog.close()">{{
              zh() ? '关闭' : 'Close'
            }}</MacButton>
          </footer>
        </dialog>
      </Teleport>
      <slot />
      <p v-if="developerError" class="muted" role="alert">{{ developerError }}</p>
    </div>
  </section>
</template>
<style scoped>
.advanced-developer-mode {
  padding-bottom: 16px;
  margin-bottom: 8px;
  border-bottom: 1px solid color-mix(in srgb, currentColor 12%, transparent);
}
.install-guide-trigger {
  margin-top: 8px;
}
.install-guide-dialog {
  width: min(560px, calc(100vw - 40px));
  max-height: calc(100vh - 40px);
  overflow: auto;
  padding: 24px;
  border: 1px solid var(--chrome-border);
  border-radius: 28px;
  color: var(--text);
  background: var(--chrome-solid);
  box-shadow: var(--shadow-popover);
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}
.install-guide-dialog::backdrop {
  background: #00000030;
}
.install-guide-dialog h2 {
  font-size: 17px;
  font-weight: 600;
  margin: 0 0 8px;
}
.install-guide-dialog header p {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
}
.install-guide-scenarios {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 20px 0 16px;
}
.install-guide-dialog footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 20px;
}
</style>
