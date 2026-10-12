<script setup>
import { computed, inject } from 'vue';
import { AppSwitch } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';

const preferences = inject('documentLanguagePreferences');
const labels = {
  en: [
    'Check topic sentences with Jev',
    'Use Jev to check whether the first sentence expresses the paragraph’s main idea when topic-sentence emphasis is on. Sends paragraph text concurrently using the shared Jev API Token; failed requests assume yes and keep the emphasis.',
  ],
  'zh-CN': [
    '使用 Jev 判断主题句',
    '启用主题句强调后，使用 Jev 判断段落第一句是否表达段落主旨。使用共用的 Jev API Token 并发发送段落文本；请求失败时按“是”处理，保留强调。',
  ],
  'zh-TW': [
    '使用 Jev 判斷主題句',
    '啟用主題句強調後，使用 Jev 判斷段落第一句是否表達段落主旨。使用共用的 Jev API Token 並行傳送段落文字；請求失敗時按「是」處理，保留強調。',
  ],
};
const text = computed(() => labels[uiLanguage.value] || labels.en);
</script>

<template>
  <div v-if="preferences" class="topic-sentence-settings" data-setting="topic-sentence-detection">
    <div class="setting-row">
      <span id="topic-sentence-detection-label">{{ text[0] }}</span>
      <AppSwitch
        v-model="preferences.topicSentenceDetection.value"
        aria-labelledby="topic-sentence-detection-label"
        aria-describedby="topic-sentence-detection-help"
      />
    </div>
    <p id="topic-sentence-detection-help" class="muted">{{ text[1] }}</p>
  </div>
</template>

<style scoped>
.topic-sentence-settings {
  display: grid;
  gap: 8px;
}
.topic-sentence-settings > .muted {
  margin: 0;
  line-height: 1.45;
}
</style>
