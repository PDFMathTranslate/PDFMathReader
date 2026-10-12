<script setup>
import { computed, inject } from 'vue';
import { AppSwitch } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';
import { recentMagicZoomLabel } from '../library/recent-magic-zoom-labels.mjs';

const preferences = inject('documentLanguagePreferences');
const text = computed(() => [
  recentMagicZoomLabel('setting', uiLanguage.value),
  recentMagicZoomLabel('hint', uiLanguage.value),
]);
</script>

<template>
  <div v-if="preferences" class="recent-magic-zoom-settings" data-setting="recent-magic-zoom">
    <div class="setting-row">
      <span id="recent-magic-zoom-label">{{ text[0] }}</span>
      <AppSwitch
        v-model="preferences.recentMagicZoomEnabled.value"
        aria-labelledby="recent-magic-zoom-label"
        aria-describedby="recent-magic-zoom-hint"
      />
    </div>
    <p id="recent-magic-zoom-hint" class="muted">{{ text[1] }}</p>
  </div>
</template>

<style scoped>
.recent-magic-zoom-settings {
  display: grid;
  gap: 8px;
}
.recent-magic-zoom-settings > .muted {
  margin: 0;
  line-height: 1.45;
}
</style>
