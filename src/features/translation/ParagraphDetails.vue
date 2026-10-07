<script setup>
import { t } from '../../i18n/index.mjs';
defineProps(['popoverFocusOut']);
const selectedParagraph = defineModel('selectedParagraph');
</script>

<template>
  <section
    v-if="selectedParagraph"
    class="settings paragraph-detail"
    @focusout="popoverFocusOut"
    :aria-label="t('paragraph.comparison')"
  >
    <div class="settings-heading">
      <h2>{{ t('paragraph.title') }}</h2>
      <button :aria-label="t('paragraph.closeComparison')" @click="selectedParagraph = null">
        <span
          class="system-icon"
          aria-hidden="true"
          style="--symbol: url('/symbols/xmark.png')"
        ></span>
      </button>
    </div>
    <h3>{{ t('paragraph.original') }}</h3>
    <p class="comparison-text">{{ selectedParagraph.text }}</p>
    <h3>{{ t('paragraph.translation') }}</h3>
    <p class="comparison-text">{{ selectedParagraph.translation }}</p>
    <p class="muted">
      {{
        t('paragraph.page', {
          page: selectedParagraph.page,
          layout: selectedParagraph.layoutLabel || selectedParagraph.layoutSource,
        })
      }}
    </p>
  </section>
</template>
