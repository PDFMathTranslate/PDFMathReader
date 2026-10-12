<script setup>
import { computed, inject } from 'vue';
import { AppSwitch } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';

const preferences = inject('documentLanguagePreferences');
const labels = {
  en: [
    'Combine interrupted paragraphs with Jev',
    'Send adjoining paragraph fragments to Jev using the shared API Token, and translate confirmed continuations as one paragraph. Failed or uncertain checks keep fragments separate. Available with Ultra fast and Fast; Fast combines fragments within each column before typesetting. Changing this setting updates the current document.',
  ],
  'zh-CN': [
    '使用 Jev 合并被打断的段落',
    '使用共用的 API Token 将相邻段落片段发送给 Jev，确认是续接内容后按完整段落翻译。请求失败或结果不确定时保留独立片段。适用于 Ultra fast 和 Fast；Fast 会在排版前合并同一栏内的续接片段。更改设置后会更新当前文档。',
  ],
  'zh-TW': [
    '使用 Jev 合併被中斷的段落',
    '使用共用的 API Token 將相鄰段落片段傳送給 Jev，確認是續接內容後按完整段落翻譯。請求失敗或結果不確定時保留獨立片段。適用於 Ultra fast 和 Fast；Fast 會在排版前合併同一欄內的續接片段。更改設定後會更新目前文件。',
  ],
};
const text = computed(() => labels[uiLanguage.value] || labels.en);
</script>

<template>
  <div
    v-if="preferences"
    class="paragraph-continuation-settings"
    data-setting="paragraph-continuation-detection"
  >
    <div class="setting-row">
      <span id="paragraph-continuation-detection-label">{{ text[0] }}</span>
      <AppSwitch
        v-model="preferences.paragraphContinuationDetection.value"
        aria-labelledby="paragraph-continuation-detection-label"
        aria-describedby="paragraph-continuation-detection-help"
      />
    </div>
    <p id="paragraph-continuation-detection-help" class="muted">{{ text[1] }}</p>
  </div>
</template>

<style scoped>
.paragraph-continuation-settings {
  display: grid;
  gap: 8px;
}
.paragraph-continuation-settings > .muted {
  margin: 0;
  line-height: 1.45;
}
</style>
