<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { MacButton, MacSwitch } from './platform-controls.mjs';
import { t, uiLanguage } from './i18n.mjs';
import { developerText } from './developer-locales.mjs';
defineProps({ embedded: Boolean });
const developerAvailable = !!globalThis.window?.previewDeveloper;
const developerEnabled = ref(false),
  developerBusy = ref(false),
  developerError = ref('');
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
</style>
