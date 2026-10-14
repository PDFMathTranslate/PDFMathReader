<script setup>
import { computed, inject } from 'vue';
import { AppTextField } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';
import {
  MAX_TRANSLATION_FONT_LENGTH,
  stripTranslationFont,
} from '../../../shared/reader/translation-font.mjs';
import { pdfFontLabel } from './pdf-font-labels.mjs';

const preferences = inject('documentLanguagePreferences');
const label = (key) => pdfFontLabel(key, uiLanguage.value);
const fields = computed(() =>
  [
    ['serif', preferences.pdfSerifFont, 'serif'],
    ['sans', preferences.pdfSansFont, 'sans-serif'],
  ].map(([id, preference, generic]) => {
    const name = preference.value.trim();
    return {
      id,
      preference,
      label: label(id),
      placeholder: label(id + 'Placeholder'),
      preview: name ? `"${name}", ${generic}` : '',
    };
  }),
);
</script>

<template>
  <div v-if="preferences" class="pdf-font-settings" data-setting="pdf-fonts">
    <div class="setting-row">
      <span id="pdf-font-label">{{ label('setting') }}</span>
    </div>
    <p id="pdf-font-hint" class="muted">{{ label('hint') }}</p>
    <div v-for="field in fields" :key="field.id" class="pdf-font-field">
      <label :id="`pdf-font-${field.id}-label`" :for="`pdf-font-${field.id}-input`">
        {{ field.label }}
      </label>
      <AppTextField
        :id="`pdf-font-${field.id}-input`"
        :model-value="field.preference.value"
        :placeholder="field.placeholder"
        :maxlength="MAX_TRANSLATION_FONT_LENGTH"
        spellcheck="false"
        :aria-labelledby="`pdf-font-label pdf-font-${field.id}-label`"
        aria-describedby="pdf-font-hint"
        @update:model-value="field.preference.value = stripTranslationFont($event)"
      />
      <p
        v-if="field.preview"
        class="pdf-font-preview"
        aria-hidden="true"
        :style="{ fontFamily: field.preview }"
      >
        The quick brown fox · fi 1984
      </p>
    </div>
  </div>
</template>

<style scoped>
.pdf-font-settings {
  display: grid;
  gap: 8px;
}
.pdf-font-settings > .muted {
  margin: 0;
  line-height: 1.45;
}
.pdf-font-field {
  display: grid;
  gap: 6px;
}
.pdf-font-preview {
  margin: 0;
  font-size: 17px;
  color: var(--text-secondary);
}
</style>
