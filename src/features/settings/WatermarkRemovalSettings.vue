<script setup>
import { computed, inject } from 'vue';
import { AppSwitch } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';
import { watermarkRemovalLabel } from '../reader/watermark-removal-labels.mjs';

const preferences = inject('documentLanguagePreferences');
const text = computed(() => [
  watermarkRemovalLabel('setting', uiLanguage.value),
  watermarkRemovalLabel('hint', uiLanguage.value),
]);
</script>

<template>
  <div v-if="preferences" class="watermark-removal-settings" data-setting="watermark-removal">
    <div class="setting-row">
      <span id="watermark-removal-label">{{ text[0] }}</span>
      <AppSwitch
        v-model="preferences.watermarkRemovalEnabled.value"
        aria-labelledby="watermark-removal-label"
        aria-describedby="watermark-removal-hint"
      />
    </div>
    <p id="watermark-removal-hint" class="muted">{{ text[1] }}</p>
  </div>
</template>

<style scoped>
.watermark-removal-settings {
  display: grid;
  gap: 8px;
}
.watermark-removal-settings > .muted {
  margin: 0;
  line-height: 1.45;
}
</style>
