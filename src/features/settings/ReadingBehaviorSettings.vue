<script setup>
import { computed } from 'vue';
import { AppSwitch } from '../../ui/controls.mjs';
import { t, uiLanguage } from '../../i18n/index.mjs';
const optimizeParagraphGaps = defineModel('optimizeParagraphGaps');
const reducePadding = defineModel('reducePadding');
const title = computed(
  () =>
    ({
      en: 'Reading behavior',
      'zh-CN': '阅读行为',
      'zh-TW': '閱讀行為',
      ja: '読書動作',
      ko: '읽기 동작',
      fr: 'Comportement de lecture',
      es: 'Comportamiento de lectura',
      de: 'Leseverhalten',
      pt: 'Comportamento de leitura',
      ru: 'Поведение при чтении',
      ar: 'سلوك القراءة',
      arz: 'سلوك القراءة',
      hi: 'पठन व्यवहार',
      bn: 'পড়ার আচরণ',
      ur: 'پڑھنے کا رویہ',
      pcm: 'Reading behavior',
    })[uiLanguage.value] || 'Reading behavior',
);
</script>
<template>
  <section class="settings-section" aria-labelledby="settings-reading-behavior">
    <h3 id="settings-reading-behavior">{{ title }}</h3>
    <div class="settings-section-body">
      <div class="setting-row" data-setting="optimize-paragraph-gaps">
        <span id="optimize-paragraph-gaps-label">{{ t('settings.optimizeParagraphGaps') }}</span>
        <AppSwitch
          v-model="optimizeParagraphGaps"
          aria-labelledby="optimize-paragraph-gaps-label"
        />
      </div>
      <p class="muted">{{ t('settings.optimizeParagraphGapsDescription') }}</p>
      <div class="setting-row" data-setting="reduce-padding">
        <span id="reduce-padding-label">{{ t('appearance.reducePadding') }}</span>
        <AppSwitch v-model="reducePadding" aria-labelledby="reduce-padding-label" />
      </div>
    </div>
  </section>
</template>
<style scoped>
.settings-section-body {
  display: grid;
  gap: 10px;
}
</style>
