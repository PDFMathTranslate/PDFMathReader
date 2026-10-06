<script setup>
import { computed } from 'vue';
import { uiLanguage } from './i18n.mjs';
import { topicSentenceLength } from './topic-sentences.mjs';
import { informationTextSegments } from './information-emphasis.mjs';
import { chineseWordBoundaries } from './chinese-word-boundaries.mjs';
const props = defineProps({
  text: String,
  enabled: Boolean,
  information: Boolean,
  informationCategories: Object,
});
const parts = computed(() =>
  informationTextSegments(props.text || '', {
    topicEnd: props.enabled ? topicSentenceLength(props.text || '', uiLanguage.value) : 0,
    emphasizeInformation: props.information,
    categories: props.informationCategories,
  }),
);
const experimental = document.documentElement.dataset.experimentalTypography === 'true';
const words = computed(() => {
  if (!experimental) return [];
  return chineseWordBoundaries(props.text || '').map((word) => ({
    ...word,
    parts: parts.value.flatMap((part) => {
      const start = Math.max(word.start, part.start);
      const end = Math.min(word.end, part.start + part.text.length);
      return end > start ? [{ ...part, start, text: (props.text || '').slice(start, end) }] : [];
    }),
  }));
});
</script>
<template>
  <template v-if="experimental">
    <span v-for="word in words" :key="word.start" :class="{ 'typography-word': word.protected }"
      ><component
        :is="part.topic ? 'strong' : 'span'"
        v-for="part in word.parts"
        :key="part.start"
        :class="{ 'topic-sentence-text': part.topic }"
        ><mark v-if="part.important" class="information-keyword">{{ part.text }}</mark
        ><template v-else>{{ part.text }}</template></component
      ></span
    >
  </template>
  <template v-for="part in experimental ? [] : parts" :key="part.start"
    ><component :is="part.topic ? 'strong' : 'span'" :class="{ 'topic-sentence-text': part.topic }"
      ><mark v-if="part.important" class="information-keyword">{{ part.text }}</mark
      ><template v-else>{{ part.text }}</template></component
    ></template
  >
</template>
<style>
.topic-sentence-text {
  font-weight: inherit;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  border-radius: 2px;
  box-decoration-break: clone;
  -webkit-box-decoration-break: clone;
}
.information-keyword {
  font: inherit;
  color: inherit;
  background: transparent;
  padding: 0;
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--accent) 65%, transparent);
  text-decoration-thickness: 0.08em;
  text-underline-offset: 0.16em;
  text-decoration-skip-ink: auto;
}
</style>
