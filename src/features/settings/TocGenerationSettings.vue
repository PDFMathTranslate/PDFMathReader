<script setup>
import { computed, inject } from 'vue';
import { AppSwitch } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';
import { tocGenerationLabel } from '../reader/toc-generation-labels.mjs';

const preferences = inject('documentLanguagePreferences');
const text = computed(() => [
  tocGenerationLabel('setting', {}, uiLanguage.value),
  tocGenerationLabel('hint', {}, uiLanguage.value),
]);
</script>

<template>
  <div v-if="preferences" class="toc-generation-settings" data-setting="toc-generation">
    <div class="setting-row">
      <span id="toc-generation-label">{{ text[0] }}</span>
      <AppSwitch
        v-model="preferences.tocGenerationEnabled.value"
        aria-labelledby="toc-generation-label"
        aria-describedby="toc-generation-hint"
      />
    </div>
    <p id="toc-generation-hint" class="muted">{{ text[1] }}</p>
  </div>
</template>

<style scoped>
.toc-generation-settings {
  display: grid;
  gap: 8px;
}
.toc-generation-settings > .muted {
  margin: 0;
  line-height: 1.45;
}
</style>
