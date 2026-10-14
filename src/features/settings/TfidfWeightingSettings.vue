<script setup>
import { computed, inject } from 'vue';
import { AppSwitch } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';
import { tfidfWeightingLabel } from './tfidf-weighting-labels.mjs';

const preferences = inject('documentLanguagePreferences');
const text = computed(() => [
  tfidfWeightingLabel('setting', uiLanguage.value),
  tfidfWeightingLabel('hint', uiLanguage.value),
]);
</script>

<template>
  <div v-if="preferences" class="tfidf-weighting-settings" data-setting="tfidf-weighting">
    <div class="setting-row">
      <span id="tfidf-weighting-label">{{ text[0] }}</span>
      <AppSwitch
        v-model="preferences.tfidfWeightingEnabled.value"
        aria-labelledby="tfidf-weighting-label"
        aria-describedby="tfidf-weighting-hint"
      />
    </div>
    <p id="tfidf-weighting-hint" class="muted">{{ text[1] }}</p>
  </div>
</template>

<style scoped>
.tfidf-weighting-settings {
  display: grid;
  gap: 8px;
}
.tfidf-weighting-settings > .muted {
  margin: 0;
  line-height: 1.45;
}
</style>
