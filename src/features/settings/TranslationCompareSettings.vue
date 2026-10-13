<script setup>
import { computed, inject } from 'vue';
import { AppSwitch } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';
import { compareLabel } from '../translation/compare/compare-labels.mjs';

const preferences = inject('documentLanguagePreferences');
const text = computed(() => [
  compareLabel('setting', {}, uiLanguage.value),
  compareLabel('hint', {}, uiLanguage.value),
]);
</script>

<template>
  <div v-if="preferences" class="translation-compare-settings" data-setting="translation-compare">
    <div class="setting-row">
      <span id="translation-compare-label">{{ text[0] }}</span>
      <AppSwitch
        v-model="preferences.translationCompareEnabled.value"
        aria-labelledby="translation-compare-label"
        aria-describedby="translation-compare-hint"
      />
    </div>
    <p id="translation-compare-hint" class="muted">{{ text[1] }}</p>
  </div>
</template>

<style scoped>
.translation-compare-settings {
  display: grid;
  gap: 8px;
}
.translation-compare-settings > .muted {
  margin: 0;
  line-height: 1.45;
}
</style>
