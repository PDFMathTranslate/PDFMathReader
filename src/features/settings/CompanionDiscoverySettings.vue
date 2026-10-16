<script setup>
import { computed, inject } from 'vue';
import { AppSwitch } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';

const preferences = inject('documentLanguagePreferences');
const labels = {
  en: [
    'Auto-discovery',
    'When kernel sharing is turned on from the Share Kernels with iPhone and iPad menu, advertise this computer on your local network so PDFMathReader can find it. The pairing code is never included in the advertisement.',
  ],
  'zh-CN': [
    '自动发现',
    '从“与 iPhone 和 iPad 共享内核”菜单开启内核共享后，在本地网络广播此电脑，让 PDFMathReader 可以找到它。配对码不会包含在广播中。',
  ],
  'zh-TW': [
    '自動探索',
    '從「與 iPhone 和 iPad 分享核心」選單開啟核心分享後，在區域網路廣播此電腦，讓 PDFMathReader 可以找到它。配對碼不會包含在廣播中。',
  ],
};
const text = computed(() => labels[uiLanguage.value] || labels.en);
</script>

<template>
  <div v-if="preferences" class="companion-discovery-settings" data-setting="companion-discovery">
    <div class="setting-row">
      <span id="companion-discovery-label">{{ text[0] }}</span>
      <AppSwitch
        v-model="preferences.companionDiscoveryEnabled.value"
        aria-labelledby="companion-discovery-label"
      />
    </div>
    <p class="muted">{{ text[1] }}</p>
  </div>
</template>

<style scoped>
.companion-discovery-settings {
  display: grid;
  gap: 8px;
}
.companion-discovery-settings > .muted {
  margin: 0;
  line-height: 1.45;
}
</style>
