<script setup>
import { computed, inject } from 'vue';
import { AppSwitch } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';
import { smoothScrollingLabel } from './smooth-scrolling-labels.mjs';

const preferences = inject('documentLanguagePreferences');
const text = computed(() => [
  smoothScrollingLabel('setting', uiLanguage.value),
  smoothScrollingLabel('hint', uiLanguage.value),
  smoothScrollingLabel('mouseOnly', uiLanguage.value),
]);
</script>

<template>
  <div v-if="preferences" class="smooth-scrolling-settings" data-setting="force-smooth-scrolling">
    <div class="setting-row">
      <span id="force-smooth-scrolling-label">{{ text[0] }}</span>
      <AppSwitch
        v-model="preferences.forceSmoothScrolling.value"
        aria-labelledby="force-smooth-scrolling-label"
        aria-describedby="force-smooth-scrolling-hint"
      />
    </div>
    <p id="force-smooth-scrolling-hint" class="muted">{{ text[1] }}</p>
    <div v-if="preferences.forceSmoothScrolling.value" class="setting-row sub-option">
      <span id="smooth-scrolling-mouse-only-label">{{ text[2] }}</span>
      <AppSwitch
        v-model="preferences.smoothScrollingMouseOnly.value"
        aria-labelledby="smooth-scrolling-mouse-only-label"
      />
    </div>
  </div>
</template>

<style scoped>
.smooth-scrolling-settings {
  display: grid;
  gap: 8px;
}
.smooth-scrolling-settings > .muted {
  margin: 0;
  line-height: 1.45;
}
.sub-option {
  padding-left: 16px;
}
</style>
