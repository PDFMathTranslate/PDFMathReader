<script setup>
import { computed, ref, watch, nextTick, onBeforeUnmount } from 'vue';
import {
  characters,
  reducedMotion,
  revealDuration,
  revealPDF,
  revealCharactersPDF,
} from './text-reveal.mjs';
import TopicSentenceText from '../../features/translation/TopicSentenceText.vue';
import { firstSentenceLength } from '../../features/translation/topic-sentences.mjs';
import { importantInformationRanges } from '../../features/translation/information-emphasis.mjs';
import { uiLanguage } from '../../i18n/index.mjs';
import { paragraphDisplayText } from '../../../shared/translation/spacing.mjs';
const props = defineProps({
  text: String,
  effect: { type: String, default: 'refocus' },
  original: Boolean,
  nativeSource: Function,
  scale: Number,
  emphasizeTopicSentences: Boolean,
  emphasizeInformation: Boolean,
  informationCategories: Object,
});
const emit = defineEmits(['active']);
const active = ref(false),
  generation = ref(0),
  nativeHost = ref(),
  textHost = ref();
let timer, controller;
const displayText = computed(() =>
  props.original ? props.text : paragraphDisplayText(props.text),
);
const sentenceEnd = computed(() =>
  props.emphasizeTopicSentences
    ? firstSentenceLength(displayText.value || '', uiLanguage.value)
    : 0,
);
const informationRanges = computed(() =>
  props.emphasizeInformation
    ? importantInformationRanges(displayText.value || '', props.informationCategories)
    : [],
);
const wordSegmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
const words = computed(() => {
  let index = 0,
    offset = 0;
  return Array.from(wordSegmenter.segment(displayText.value || ''), (item) => item.segment).map(
    (word) => ({
      word,
      space: /^\s+$/.test(word),
      letters: characters(word).map((text) => {
        const emphasized = offset < sentenceEnd.value;
        const important = informationRanges.value.some((r) => offset >= r.start && offset < r.end);
        offset += text.length;
        return { text, index: index++, emphasized, important };
      }),
    }),
  );
});
watch(
  () => [props.text, props.original],
  async (_value, old) => {
    clearTimeout(timer);
    controller?.abort();
    generation.value++;
    const id = generation.value;
    if (
      document.hidden ||
      window.previewActivityActive === false ||
      reducedMotion() ||
      (!old && props.original)
    ) {
      active.value = false;
      emit('active', false);
      return;
    }
    active.value = true;
    emit('active', true);
    await nextTick();
    if (id !== generation.value) return;
    const element = (nativeHost.value || textHost.value)?.parentElement,
      reader = element?.closest('.reader');
    if (element && reader) {
      const rect = element.getBoundingClientRect(),
        bounds = reader.getBoundingClientRect();
      if (rect.bottom < bounds.top || rect.top > bounds.bottom) {
        active.value = false;
        emit('active', false);
        return;
      }
    }
    if (props.original && props.nativeSource) {
      controller = new AbortController();
      try {
        const source = props.nativeSource();
        const box = source.boxes[0];
        Object.assign(nativeHost.value.style, {
          left: '-3px',
          top: '-3px',
          width: box.width + 6 + 'px',
          height: box.height + 6 + 'px',
        });
        await (props.effect === 'characters' ? revealCharactersPDF : revealPDF)({
          ...source,
          page: await source.page,
          host: nativeHost.value,
          signal: controller.signal,
        });
      } catch {}
      if (id === generation.value) {
        active.value = false;
        emit('active', false);
      }
    } else
      timer = setTimeout(() => {
        if (id === generation.value) {
          active.value = false;
          emit('active', false);
        }
      }, revealDuration);
  },
  { immediate: true },
);
watch(
  () => props.scale,
  () => {
    clearTimeout(timer);
    controller?.abort();
    generation.value++;
    active.value = false;
    emit('active', false);
  },
);
onBeforeUnmount(() => {
  clearTimeout(timer);
  controller?.abort();
  emit('active', false);
});
</script>
<template>
  <span
    v-if="original && active"
    ref="nativeHost"
    class="native-paragraph-reveal"
    aria-hidden="true"
  ></span>
  <span
    v-else-if="!original && (!active || effect === 'refocus')"
    :key="generation"
    class="paragraph-text"
    :class="{ 'digital-refocusing': active }"
    aria-hidden="true"
    ><TopicSentenceText
      :text="displayText"
      :enabled="emphasizeTopicSentences"
      :information="emphasizeInformation"
      :information-categories="informationCategories"
  /></span>
  <span
    v-else-if="!original"
    ref="textHost"
    :key="generation"
    class="paragraph-text"
    :class="{ 'text-revealing': active }"
    aria-hidden="true"
    ><template v-for="(word, i) in words" :key="i"
      ><template v-if="word.space">{{ word.word }}</template
      ><span v-else class="reveal-word"
        ><span v-for="letter in word.letters" :key="letter.index" class="reveal-mask"
          ><span
            class="reveal-letter"
            :class="{
              'topic-sentence-text': letter.emphasized,
              'information-keyword': letter.important,
            }"
            :style="{ '--reveal-delay': Math.min(letter.index * 6, 180) + 'ms' }"
            >{{ letter.text }}</span
          ></span
        ></span
      ></template
    ></span
  >
</template>
