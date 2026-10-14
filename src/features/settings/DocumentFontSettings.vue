<script setup>
import { computed, inject, onMounted, ref } from 'vue';
import { AppPopUpButton, AppPopUpButtonItem } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';
import { documentFontLabel } from './document-font-labels.mjs';
import {
  DOCUMENT_FONT_DEFAULT,
  DOCUMENT_FONT_STYLES,
  chosenFont,
  documentFontMenu,
  loadInstalledFonts,
  rememberFont,
} from './document-font-menu.mjs';

const preferences = inject('documentLanguagePreferences', null);
const fonts = ref(null),
  status = ref('loading');
const label = (key, values) => documentFontLabel(key, uiLanguage.value, values);

onMounted(async () => {
  try {
    fonts.value = await loadInstalledFonts();
    status.value = 'ready';
  } catch {
    status.value = 'failed';
  }
});

const capitalized = (text) => text[0].toUpperCase() + text.slice(1);
const groups = computed(() =>
  ['original', 'translated'].map((document) => ({
    document,
    rows: DOCUMENT_FONT_STYLES.map((style) => {
      const preference = preferences[`${document}${capitalized(style)}Font`];
      return {
        id: `document-font-${document}-${style}`,
        style,
        preference,
        items: documentFontMenu({
          fonts: fonts.value,
          style,
          value: preference.value,
          recent: preferences.recentDocumentFonts.value,
          label,
        }),
      };
    }),
  })),
);

const fontStyle = (item) => (item.family ? { fontFamily: `"${item.family}"` } : undefined);

function choose(preference, value) {
  const name = chosenFont(value);
  if (name === null) return;
  preference.value = name;
  preferences.recentDocumentFonts.value = rememberFont(preferences.recentDocumentFonts.value, name);
}
</script>

<template>
  <section
    v-if="preferences"
    class="settings-section document-font-section"
    aria-labelledby="settings-document-fonts"
    data-setting="document-fonts"
  >
    <h3 id="settings-document-fonts">{{ label('title') }}</h3>
    <div class="settings-section-body">
      <p id="document-font-hint" class="muted">{{ label('hint') }}</p>
      <p v-if="status !== 'ready'" class="muted" role="status">
        {{ label(status === 'failed' ? 'failed' : 'loading') }}
      </p>
      <div
        v-for="group in groups"
        :key="group.document"
        class="document-font-group"
        role="group"
        :aria-labelledby="`document-font-${group.document}`"
      >
        <span :id="`document-font-${group.document}`" class="document-font-heading">
          {{ label(group.document) }}
        </span>
        <div v-for="row in group.rows" :key="row.id" class="appearance-row">
          <span :id="`${row.id}-label`">{{ label(row.style) }}</span
          ><AppPopUpButton
            teleport-to="body"
            :model-value="row.preference.value || DOCUMENT_FONT_DEFAULT"
            :disabled="status === 'loading' && !row.preference.value"
            :aria-labelledby="`document-font-${group.document} ${row.id}-label`"
            aria-describedby="document-font-hint"
            @update:model-value="choose(row.preference, $event)"
            ><AppPopUpButtonItem
              v-for="item in row.items"
              :key="item.value"
              :value="item.value"
              :text-value="item.label"
              :disabled="item.header"
              :class="{ 'document-font-section-label': item.header }"
              :style="fontStyle(item)"
              >{{ item.label }}</AppPopUpButtonItem
            ></AppPopUpButton
          >
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.settings-section-body {
  display: grid;
  gap: 10px;
}
.settings-section-body > .muted {
  margin: 0;
  line-height: 1.45;
}
.document-font-group {
  display: grid;
  gap: 6px;
}
.document-font-heading {
  font-weight: 600;
}
.document-font-section-label {
  font-size: 11px;
  font-weight: 600;
}
</style>
