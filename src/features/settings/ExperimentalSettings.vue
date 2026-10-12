<script setup>
import { inject } from 'vue';
import { t, uiLanguage as currentUILanguage } from '../../i18n/index.mjs';
import { chatGPTSubscriptionLabel } from '../../i18n/chatgpt-subscription-labels.mjs';
import DocumentLanguageSettings from './DocumentLanguageSettings.vue';
import TopicSentenceSettings from './TopicSentenceSettings.vue';
import ParagraphContinuationSettings from './ParagraphContinuationSettings.vue';
import RemoteKernelSettings from './RemoteKernelSettings.vue';
import FormulaOcrSettings from './FormulaOcrSettings.vue';
import EpubSettings from './EpubSettings.vue';
import ChatGPTSubscriptionSettings from './ChatGPTSubscriptionSettings.vue';
const languagePreferences = inject('documentLanguagePreferences');
</script>
<template>
  <section class="settings-section" aria-labelledby="settings-experimental">
    <h3 id="settings-experimental">{{ t('settings.experimentalCategory') }}</h3>
    <div class="settings-section-body">
      <DocumentLanguageSettings v-if="languagePreferences" />
      <TopicSentenceSettings v-if="languagePreferences" />
      <ParagraphContinuationSettings v-if="languagePreferences" />
      <RemoteKernelSettings v-if="languagePreferences" />
      <EpubSettings />
      <FormulaOcrSettings />
      <section
        class="chatgpt-subscription-feature"
        :aria-label="chatGPTSubscriptionLabel('title', currentUILanguage)"
      >
        <ChatGPTSubscriptionSettings account-only />
      </section>
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
