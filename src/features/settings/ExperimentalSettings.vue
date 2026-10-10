<script setup>
import { computed, inject } from 'vue';
import { platform } from '../../platform/runtime.mjs';
import { AppSwitch } from '../../ui/controls.mjs';
import { t, uiLanguage as currentUILanguage } from '../../i18n/index.mjs';
import { chatGPTSubscriptionLabel } from '../../i18n/chatgpt-subscription-labels.mjs';
import DocumentLanguageSettings from './DocumentLanguageSettings.vue';
import FormulaOcrSettings from './FormulaOcrSettings.vue';
import ChatGPTSubscriptionSettings from './ChatGPTSubscriptionSettings.vue';
const languagePreferences = inject('documentLanguagePreferences');
const interfaceStyle = defineModel('interfaceStyle', { default: 'default' });
const optimizeParagraphGaps = defineModel('optimizeParagraphGaps');
const glassLabels = computed(
  () =>
    ({
      ar: ['Liquid Glass', 'افتراضي', 'قد يستهلك المزيد من الموارد'],
      arz: ['Liquid Glass', 'الافتراضي', 'ممكن يستخدم موارد أكتر'],
      hi: ['Liquid Glass', 'डिफ़ॉल्ट', 'अधिक संसाधन इस्तेमाल हो सकते हैं'],
      bn: ['Liquid Glass', 'ডিফল্ট', 'বেশি সংস্থান ব্যবহার করতে পারে'],
      ru: ['Liquid Glass', 'По умолчанию', 'Может потреблять больше ресурсов'],
      pt: ['Liquid Glass', 'Predefinido', 'Pode consumir mais recursos'],
      ur: ['Liquid Glass', 'طے شدہ', 'زیادہ وسائل استعمال ہو سکتے ہیں'],
      de: ['Liquid Glass', 'Standard', 'Kann mehr Ressourcen verbrauchen'],
      pcm: ['Liquid Glass', 'Default', 'E fit use more resources'],
      'zh-CN': ['液态玻璃界面', '默认', '可能消耗更多性能'],
      'zh-TW': ['液態玻璃介面', '預設', '可能消耗更多效能'],
      ja: ['Liquid Glass', 'デフォルト', 'パフォーマンスへの負荷が増える場合があります'],
      ko: ['Liquid Glass', '기본', '더 많은 성능 자원을 사용할 수 있습니다'],
      fr: ['Liquid Glass', 'Par défaut', 'Peut consommer davantage de ressources'],
      es: ['Liquid Glass', 'Predeterminado', 'Puede consumir más recursos'],
    })[currentUILanguage.value] || ['Liquid Glass', 'Default', 'May use more resources'],
);
</script>
<template>
  <section class="settings-section" aria-labelledby="settings-experimental">
    <h3 id="settings-experimental">{{ t('settings.experimentalCategory') }}</h3>
    <div class="settings-section-body">
      <div v-if="platform === 'darwin'" class="setting-row" data-setting="interface-style">
        <div>
          <span id="interface-style-label">{{ glassLabels[0] }}</span>
          <p id="interface-style-warning" class="muted">{{ glassLabels[2] }}</p>
        </div>
        <AppSwitch
          :model-value="interfaceStyle === 'liquid-glass'"
          aria-labelledby="interface-style-label"
          aria-describedby="interface-style-warning"
          @update:model-value="interfaceStyle = $event ? 'liquid-glass' : 'default'"
        />
      </div>
      <DocumentLanguageSettings v-if="languagePreferences" />
      <FormulaOcrSettings />
      <section
        class="chatgpt-subscription-feature"
        :aria-label="chatGPTSubscriptionLabel('title', currentUILanguage)"
      >
        <ChatGPTSubscriptionSettings account-only />
      </section>
      <div class="setting-row" data-setting="optimize-paragraph-gaps">
        <span id="optimize-paragraph-gaps-label">{{ t('settings.optimizeParagraphGaps') }}</span>
        <AppSwitch
          v-model="optimizeParagraphGaps"
          aria-labelledby="optimize-paragraph-gaps-label"
          :aria-label="t('settings.optimizeParagraphGaps')"
        />
      </div>
      <p class="muted">{{ t('settings.optimizeParagraphGapsDescription') }}</p>
    </div>
  </section>
</template>
<style scoped>
.settings-section-body {
  display: grid;
  gap: 10px;
}
.chatgpt-subscription-feature {
  min-width: 0;
}
</style>
