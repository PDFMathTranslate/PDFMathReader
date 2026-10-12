<script setup>
import { computed, inject } from 'vue';
import { t, uiLanguage as currentUILanguage } from '../../i18n/index.mjs';
import { chatGPTSubscriptionLabel } from '../../i18n/chatgpt-subscription-labels.mjs';
import { settingsCategoryLabels } from './settings-category-labels.mjs';
import DocumentLanguageSettings from './DocumentLanguageSettings.vue';
import TopicSentenceSettings from './TopicSentenceSettings.vue';
import ParagraphContinuationSettings from './ParagraphContinuationSettings.vue';
import RemoteKernelSettings from './RemoteKernelSettings.vue';
import FormulaOcrSettings from './FormulaOcrSettings.vue';
import EpubSettings from './EpubSettings.vue';
import ChatGPTSubscriptionSettings from './ChatGPTSubscriptionSettings.vue';
defineProps({ titled: { type: Boolean, default: false } });
const languagePreferences = inject('documentLanguagePreferences');
const categoryLabels = computed(() => settingsCategoryLabels(currentUILanguage.value));
</script>
<template>
  <!-- Groups follow the sidebar: General, Translation, Providers, Advanced. -->
  <h3 v-if="titled" id="settings-experimental">{{ t('settings.experimentalCategory') }}</h3>
  <div>
    <section class="settings-section" aria-labelledby="settings-experimental-general">
      <h3 id="settings-experimental-general">{{ categoryLabels[0] }}</h3>
      <div class="settings-section-body">
        <EpubSettings />
        <FormulaOcrSettings />
        <TopicSentenceSettings v-if="languagePreferences" />
      </div>
    </section>
    <section class="settings-section" aria-labelledby="settings-experimental-translation">
      <h3 id="settings-experimental-translation">{{ t('settings.translationBehavior') }}</h3>
      <div class="settings-section-body">
        <DocumentLanguageSettings v-if="languagePreferences" />
        <ParagraphContinuationSettings v-if="languagePreferences" />
      </div>
    </section>
    <section class="settings-section" aria-labelledby="settings-experimental-providers">
      <h3 id="settings-experimental-providers">{{ categoryLabels[1] }}</h3>
      <div class="settings-section-body">
        <section
          class="chatgpt-subscription-feature"
          :aria-label="chatGPTSubscriptionLabel('title', currentUILanguage)"
        >
          <ChatGPTSubscriptionSettings account-only />
        </section>
      </div>
    </section>
    <section class="settings-section" aria-labelledby="settings-experimental-advanced">
      <h3 id="settings-experimental-advanced">{{ t('settings.advancedCategory') }}</h3>
      <div class="settings-section-body">
        <RemoteKernelSettings v-if="languagePreferences" />
      </div>
    </section>
  </div>
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
