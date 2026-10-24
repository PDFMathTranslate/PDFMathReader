<script setup>
import { computed, inject } from 'vue';
import { AppSwitch } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';

const preferences = inject('documentLanguagePreferences');
const labels = {
  en: [
    'Show topic sentences in outline',
    'Lists the first sentence of each long paragraph under the outline section that contains it. Reads the document text when the outline is open. With Jev topic-sentence checks on, sentences Jev rejects are hidden.',
  ],
  'zh-CN': [
    '在目录中显示主题句',
    '在目录中把每个长段落的第一句列在其所属小节下。打开目录时读取文档文字。启用 Jev 主题句判断后，隐藏 Jev 判定为否的句子。',
  ],
  'zh-TW': [
    '在目錄中顯示主題句',
    '在目錄中把每個長段落的第一句列在其所屬小節下。開啟目錄時讀取文件文字。啟用 Jev 主題句判斷後，隱藏 Jev 判定為否的句子。',
  ],
};
const text = computed(() => labels[uiLanguage.value] || labels.en);
</script>

<template>
  <div v-if="preferences" class="outline-topic-settings" data-setting="outline-topic-sentences">
    <div class="setting-row">
      <span id="outline-topic-sentences-label">{{ text[0] }}</span>
      <AppSwitch
        v-model="preferences.outlineTopicSentencesEnabled.value"
        aria-labelledby="outline-topic-sentences-label"
        aria-describedby="outline-topic-sentences-help"
      />
    </div>
    <p id="outline-topic-sentences-help" class="muted">{{ text[1] }}</p>
  </div>
</template>

<style scoped>
.outline-topic-settings {
  display: grid;
  gap: 8px;
}
.outline-topic-settings > .muted {
  margin: 0;
  line-height: 1.45;
}
</style>
