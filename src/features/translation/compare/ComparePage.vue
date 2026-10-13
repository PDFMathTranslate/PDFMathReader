<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { compareLabel } from './compare-labels.mjs';
import { uiLanguage } from '../../../i18n/index.mjs';

const props = defineProps({
  number: { type: Number, required: true },
  // Page size in PDF points at scale 1, and the cell width in CSS pixels.
  pageWidth: { type: Number, required: true },
  pageHeight: { type: Number, required: true },
  width: { type: Number, required: true },
  lane: { type: Object, default: null },
  blank: { type: Boolean, default: false },
  visible: { type: Boolean, default: false },
  originalPage: { type: Function, required: true },
});

const canvas = ref(null);
const scale = computed(() => props.width / props.pageWidth);
const height = computed(() => Math.round(props.pageHeight * scale.value));
const entry = computed(() => props.lane?.pages[props.number] || null);
const status = computed(() => entry.value?.status || (props.lane ? 'queued' : 'idle'));
const translatedPage = computed(() => entry.value?.document || null);
const blocks = computed(() =>
  props.lane?.paragraphMode ? (entry.value?.blocks || []).filter((b) => b.translation) : [],
);
const progress = computed(() => {
  const page = entry.value;
  if (!page) return null;
  if (props.lane?.paragraphMode && page.blocks.length) {
    const done = page.blocks.filter((b) => b.status === 'ready').length;
    return { done, total: page.blocks.length };
  }
  return Number.isFinite(page.progress?.percent) ? { percent: page.progress.percent } : null;
});
const chip = computed(() => {
  const language = uiLanguage.value;
  const value = status.value;
  if (!props.lane || value === 'ready' || value === 'idle' || value === 'partial') return '';
  if (value === 'error') return compareLabel('failed', {}, language);
  if (value === 'queued') return compareLabel('queued', {}, language);
  const activity = entry.value?.activity;
  const label =
    activity === 'layout'
      ? compareLabel('layout', {}, language)
      : activity === 'cache'
        ? compareLabel('cache', {}, language)
        : compareLabel('translating', {}, language);
  const count = progress.value;
  if (count?.total) return `${label} ${count.done}/${count.total}`;
  if (count && Number.isFinite(count.percent)) return `${label} ${Math.round(count.percent)}%`;
  return label;
});
// Math kernels return a whole translated page; until then the original stays dimmed.
const dimmed = computed(
  () => !!props.lane && !props.lane.paragraphMode && !translatedPage.value && !props.blank,
);

let renderTask = null;
let generation = 0;

function release() {
  generation++;
  renderTask?.cancel?.();
  renderTask = null;
  if (canvas.value) {
    canvas.value.width = 0;
    canvas.value.height = 0;
  }
}

async function paint() {
  const target = canvas.value;
  if (!target || !props.visible || props.blank || props.width <= 0) return release();
  const current = ++generation;
  renderTask?.cancel?.();
  renderTask = null;
  const dpr = window.devicePixelRatio || 1;
  const pixelWidth = Math.max(1, Math.round(props.width * dpr));
  try {
    const translated = translatedPage.value;
    if (translated) {
      const page = await translated.getPage(1);
      if (current !== generation) return;
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: pixelWidth / base.width });
      target.width = Math.round(viewport.width);
      target.height = Math.round(viewport.height);
      renderTask = page.render({
        canvasContext: target.getContext('2d'),
        viewport,
        background: '#ffffff',
      });
      await renderTask.promise;
      return;
    }
    const source = await props.originalPage(props.number, pixelWidth);
    if (current !== generation) return;
    target.width = source.width;
    target.height = source.height;
    target.getContext('2d').drawImage(source, 0, 0);
  } catch (error) {
    if (error?.name !== 'RenderingCancelledException' && current === generation)
      console.warn('Compare page render failed', error);
  }
}

watch(
  () => [props.visible, props.width, props.blank, translatedPage.value, canvas.value],
  () => (props.visible ? void paint() : release()),
  { immediate: true, flush: 'post' },
);
onBeforeUnmount(release);

function blockStyle(b) {
  const s = scale.value;
  return {
    '--paragraph-align': b.textAlign || 'left',
    '--cover-padding': Math.max(3, b.fontSize * 0.28) * s + 'px',
    left: b.x * s + 'px',
    top: b.y * s + 'px',
    width: b.width * s + 'px',
    height: Math.max(b.height, b.fontSize * 1.1) * s + 'px',
    fontSize: b.fontSize * s + 'px',
    fontWeight: b.bold ? 600 : 400,
  };
}

// Shrinks a translation until it fits the source paragraph's box.
function fit(el, b) {
  if (!el) return;
  nextTick(() => {
    let size = b.fontSize * scale.value;
    const min = Math.min(size, 6 * scale.value);
    el.style.fontSize = size + 'px';
    while (el.scrollHeight > el.clientHeight + 1 && size > min) {
      size -= 0.5;
      el.style.fontSize = size + 'px';
    }
  });
}
</script>

<template>
  <div
    class="compare-page"
    :class="{ blank, dimmed, failed: status === 'error' }"
    :style="{ width: width + 'px', height: height + 'px' }"
    :aria-label="compareLabel('page', { number }, uiLanguage)"
  >
    <canvas v-show="visible && !blank" ref="canvas" class="compare-canvas"></canvas>
    <div v-if="visible && blocks.length" class="compare-paragraphs">
      <div
        v-for="b in blocks"
        :key="b.id"
        :ref="(el) => fit(el, b)"
        class="compare-paragraph"
        :style="blockStyle(b)"
      >
        {{ b.translation }}
      </div>
    </div>
    <div v-if="chip" class="compare-status">
      <span v-if="chip" class="compare-chip" :class="{ error: status === 'error' }" role="status">
        <i v-if="status !== 'error'" class="status-dot busy" aria-hidden="true"></i>{{ chip }}
      </span>
      <button
        v-if="status === 'error'"
        class="compare-retry"
        type="button"
        :title="entry?.message || ''"
        @click="lane.retry(number)"
      >
        {{ compareLabel('retry', {}, uiLanguage) }}
      </button>
    </div>
  </div>
</template>
