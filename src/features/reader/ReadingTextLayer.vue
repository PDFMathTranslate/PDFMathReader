<script setup>
import { ref, watch, onMounted, onBeforeUnmount, inject } from 'vue';
import { uiLanguage } from '../../i18n/index.mjs';
import {
  informationRunRanges,
  informationTextSegments,
  mergeInformationRects,
} from '../translation/information-emphasis.mjs';
import { topicSentenceParagraphs } from '../translation/topic-sentences.mjs';
import { loadPDFRuntime } from './pdf-runtime.mjs';
import { bindTextLayerSelection, preserveTextLayerSelection } from './text-layer-selection.mjs';
import { linkifyDoiText } from './text-layer-links.mjs';
const props = defineProps({
  document: Object,
  pageNumber: Number,
  zoom: Number,
  active: Boolean,
  obscuredBoxes: Array,
  paragraphBoxes: Array,
  emphasizeTopicSentences: Boolean,
  emphasizeInformation: Boolean,
  informationCategories: Object,
  selectable: Boolean,
});
const host = ref();
function followDoi(event) {
  if (event.target.closest('a.pdf-doi-link') && !window.getSelection()?.isCollapsed)
    event.preventDefault();
}
let layer,
  generation = 0,
  currentDocument,
  currentPage,
  page,
  rendered = false,
  boxKey,
  overlay,
  highlights,
  frameHost,
  layoutZoom = 1;
let unbindSelection, retentionTimer;
const originals = new WeakMap();
const emphasisKeys = new WeakMap();
const topicSentenceClassifier = inject('topicSentenceClassifier', null);
const watermarkRemoval = inject('watermarkRemoval', null);
function topicRangesForRuns(runs) {
  return topicSentenceParagraphs(runs, props.paragraphBoxes || [], uiLanguage.value)
    .filter((paragraph) => {
      if (!paragraph.ranges.length) return false;
      if (typeof topicSentenceClassifier?.isTopicSentence !== 'function') return true;
      try {
        return (
          topicSentenceClassifier.isTopicSentence(paragraph.text, paragraph.firstSentence) !== false
        );
      } catch {
        return true;
      }
    })
    .flatMap((paragraph) => paragraph.ranges)
    .sort((a, b) => a.index - b.index || a.start - b.start);
}
// Detached overlays would otherwise stay referenced after their page leaves
// the viewport.
function clearEmphasis() {
  overlay?.remove();
  overlay = null;
  highlights?.remove();
  highlights = null;
}
function drawEmphasis() {
  if (!host.value) return;
  clearEmphasis();
  if (!rendered || !props.active) return;
  const pageBounds = host.value.getBoundingClientRect(),
    overlayScale = host.value.pdfTextScale || 1;
  if (props.emphasizeInformation) {
    const boxes = [];
    for (const mark of host.value.querySelectorAll('.pdf-information-keyword')) {
      const range = window.document.createRange();
      range.selectNodeContents(mark);
      for (const r of range.getClientRects())
        boxes.push({
          x: (r.left - pageBounds.left) / overlayScale,
          y: (r.top - pageBounds.top) / overlayScale,
          width: r.width / overlayScale,
          height: r.height / overlayScale,
        });
    }
    highlights = window.document.createElement('div');
    highlights.className = 'information-highlights';
    highlights.setAttribute('aria-hidden', 'true');
    for (const r of mergeInformationRects(boxes)) {
      const rect = window.document.createElement('div');
      rect.className = 'information-highlight-rect';
      Object.assign(rect.style, {
        left: r.x + 'px',
        top: r.y + r.height - Math.max(1, r.height * 0.08) + 'px',
        width: r.width + 'px',
        height: Math.max(1, r.height * 0.08) + 'px',
      });
      highlights.append(rect);
    }
    host.value.append(highlights);
  }
  if (!props.emphasizeTopicSentences) return;
  const rects = [];
  for (const strong of host.value.querySelectorAll('.pdf-topic-sentence')) {
    const range = window.document.createRange();
    range.selectNodeContents(strong);
    rects.push(...range.getClientRects());
  }
  if (!rects.length) return;
  // A translucent wash marks the sentence without changing the PDF glyphs.
  // Boxes, not a page-sized bitmap, so emphasis costs no raster memory.
  overlay = window.document.createElement('div');
  overlay.className = 'topic-sentence-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  for (const r of mergeInformationRects(
    rects.map((r) => ({
      x: (r.left - pageBounds.left) / overlayScale,
      y: (r.top - pageBounds.top) / overlayScale,
      width: r.width / overlayScale,
      height: r.height / overlayScale,
    })),
  )) {
    const rect = window.document.createElement('div');
    rect.className = 'topic-sentence-rect';
    Object.assign(rect.style, {
      left: r.x + 'px',
      top: r.y + 'px',
      width: r.width + 'px',
      height: r.height + 'px',
    });
    overlay.append(rect);
  }
  host.value.append(overlay);
}
function refreshEmphasis() {
  if (!overlay && !highlights) drawEmphasis();
}
onMounted(() => {
  frameHost = host.value?.parentElement;
  frameHost?.addEventListener('pdf-frame-presented', refreshEmphasis);
});
function emphasize() {
  if (!rendered || !host.value || !layer || !props.active) return;
  const spans = layer.textDivs.filter((span) => host.value.contains(span));
  const restoreSelection = preserveTextLayerSelection(spans);
  for (const span of spans) {
    if (!originals.has(span)) originals.set(span, span.textContent);
  }
  if (!props.emphasizeTopicSentences && !props.emphasizeInformation) {
    for (const span of spans) {
      if (!emphasisKeys.has(span)) continue;
      span.textContent = originals.get(span);
      emphasisKeys.delete(span);
    }
    if (props.selectable) linkifyDoiText(spans);
    restoreSelection();
    drawEmphasis();
    return;
  }
  const bounds = host.value.getBoundingClientRect(),
    scale = props.zoom;
  const runs = spans.map((span) => {
    const r = span.getBoundingClientRect();
    return {
      text: originals.get(span),
      x: (r.left - bounds.left) / scale,
      y: (r.top - bounds.top) / scale,
      width: r.width / scale,
      height: r.height / scale,
    };
  });
  const topicRanges = props.emphasizeTopicSentences ? topicRangesForRuns(runs) : [];
  const informationRanges = props.emphasizeInformation
    ? informationRunRanges(runs, props.informationCategories)
    : [];
  for (let index = 0; index < spans.length; index++) {
    const span = spans[index],
      text = originals.get(span),
      topicEnd = topicRanges.find((r) => r.index === index)?.end || 0;
    const parts = informationTextSegments(text, {
      topicEnd,
      emphasizeInformation: props.emphasizeInformation,
      ranges: informationRanges.filter((r) => r.index === index),
    });
    const key = JSON.stringify(parts);
    // Page/layout refreshes must preserve the text nodes holding the native
    // selection when emphasis has not changed.
    if (emphasisKeys.get(span) === key) continue;
    emphasisKeys.set(span, key);
    span.replaceChildren(
      ...parts.map((part) => {
        let node = window.document.createTextNode(part.text);
        if (part.important) {
          const mark = window.document.createElement('mark');
          mark.className = 'pdf-information-keyword';
          mark.append(node);
          node = mark;
        }
        if (part.topic) {
          const strong = window.document.createElement('strong');
          strong.className = 'pdf-topic-sentence';
          strong.append(node);
          node = strong;
        }
        return node;
      }),
    );
  }
  if (props.selectable) linkifyDoiText(spans);
  restoreSelection();
  drawEmphasis();
}
watch(
  () => [
    props.emphasizeTopicSentences,
    props.emphasizeInformation,
    props.informationCategories,
    props.paragraphBoxes,
    uiLanguage.value,
    topicSentenceClassifier?.revision?.value,
  ],
  emphasize,
  { flush: 'post' },
);
// Zoom changes geometry, not the text stream. Keeping it outside the async
// construction watcher also avoids cancelling a layer while fonts are loading.
function updateTextViewport() {
  if (!page || !host.value || !layer || !rendered) return;
  // Text geometry is linear in zoom. Transform its original layout as a unit
  // instead of remeasuring every run and rebuilding all highlight rectangles.
  const scale = props.zoom / layoutZoom;
  host.value.pdfTextScale = scale;
  host.value.style.transform = scale === 1 ? '' : `scale(${scale})`;
}
watch(() => props.zoom, updateTextViewport, { flush: 'post' });
watch(
  () => [
    props.document,
    props.pageNumber,
    props.active,
    props.obscuredBoxes,
    watermarkRemoval?.version.value,
  ],
  async () => {
    clearTimeout(retentionTimer);
    // Retain completed and in-flight text in the bounded virtual page window.
    // A transient hide during zoom must not restart font measurement.
    if (
      !props.active &&
      layer &&
      currentDocument === props.document &&
      currentPage === props.pageNumber
    ) {
      clearEmphasis();
      // Keep only the brief hide/show transition, not a window full of hidden
      // DOM text. A page genuinely scrolled away releases its native layout.
      retentionTimer = setTimeout(() => {
        if (props.active) return;
        generation++;
        unbindSelection?.();
        unbindSelection = null;
        layer?.cancel();
        layer = null;
        rendered = false;
        host.value?.replaceChildren();
      }, 250);
      return;
    }
    const nextBoxKey = JSON.stringify([props.obscuredBoxes || [], watermarkRemoval?.version.value]);
    if (
      props.active &&
      layer &&
      !rendered &&
      currentDocument === props.document &&
      currentPage === props.pageNumber &&
      boxKey === nextBoxKey
    )
      return;
    const id = ++generation;
    if (!props.active || !props.document) {
      unbindSelection?.();
      unbindSelection = null;
      layer?.cancel();
      layer = null;
      rendered = false;
      clearEmphasis();
      host.value?.replaceChildren();
      return;
    }
    try {
      const runtime = await loadPDFRuntime();
      if (id !== generation) return;
      if (currentDocument !== props.document || currentPage !== props.pageNumber) {
        page = await props.document.getPage(props.pageNumber);
        if (id !== generation) return;
        currentDocument = props.document;
        currentPage = props.pageNumber;
        layer?.cancel();
        layer = null;
        rendered = false;
      }
      const viewport = page.getViewport({ scale: props.zoom });
      host.value.style.setProperty('--scale-round-x', '1px');
      host.value.style.setProperty('--scale-round-y', '1px');
      if (layer && rendered && boxKey === nextBoxKey) {
        updateTextViewport();
        // Zoom only repositions the existing text nodes. Keep their emphasis
        // markup and DOI anchors so native selection and link targets survive;
        // the overlay boxes still need their screen geometry refreshed.
        drawEmphasis();
        return;
      }
      boxKey = nextBoxKey;
      rendered = false;
      unbindSelection?.();
      unbindSelection = null;
      layer?.cancel();
      clearEmphasis();
      host.value.replaceChildren();
      layoutZoom = props.zoom;
      host.value.pdfTextScale = 1;
      host.value.style.transform = '';
      host.value.style.setProperty('--total-scale-factor', layoutZoom);
      layer = new runtime.TextLayer({
        textContentSource: page.streamTextContent(),
        container: host.value,
        viewport,
      });
      const rendering = layer;
      // Settled alongside the text so a removed watermark is never selectable.
      const hidden = watermarkRemoval?.hiddenText(page).catch(() => null);
      await rendering.render();
      const watermark = await hidden;
      if (id !== generation) return;
      rendered = true;
      // The zoom may have changed while the text stream was being rendered.
      updateTextViewport();
      if (watermark)
        for (const span of rendering.textDivs)
          if (watermark.matches(span.textContent)) span.remove();
      // Omit source runs covered by Ultra fast's visible translated paragraphs.
      if (props.obscuredBoxes?.length) {
        const bounds = host.value.getBoundingClientRect(),
          scale = props.zoom;
        for (const span of rendering.textDivs) {
          const r = span.getBoundingClientRect(),
            x = (r.left + r.width / 2 - bounds.left) / scale,
            y = (r.top + r.height / 2 - bounds.top) / scale;
          if (
            props.obscuredBoxes.some(
              (b) => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height,
            )
          )
            span.remove();
        }
      }
      unbindSelection = bindTextLayerSelection(host.value, () => rendering.textDivs);
      emphasize();
    } catch (e) {
      if (e.name !== 'AbortException' && e.name !== 'RenderingCancelledException')
        console.error('Reading text layer failed', e);
    }
  },
  { flush: 'post', immediate: true },
);
onBeforeUnmount(() => {
  clearTimeout(retentionTimer);
  generation++;
  unbindSelection?.();
  layer?.cancel();
  clearEmphasis();
  frameHost?.removeEventListener('pdf-frame-presented', refreshEmphasis);
});
</script>
<template>
  <div
    ref="host"
    class="reading-text-layer textLayer"
    :class="{ 'topic-layer-only': !selectable }"
    aria-label="Selectable document text"
    @click="followDoi"
  ></div>
</template>

<style>
.reading-text-layer .pdf-doi-link {
  position: static;
  font: inherit;
  color: transparent;
  text-decoration: none;
  cursor: pointer;
}
.reading-text-layer .pdf-doi-link:hover {
  background: color-mix(in srgb, var(--accent) 12%, transparent);
}
.reading-text-layer .pdf-doi-link:focus-visible {
  outline: 1px solid var(--accent);
}
.reading-text-layer.topic-layer-only {
  pointer-events: none;
  user-select: none;
}
.reading-text-layer :is(.pdf-topic-sentence, .pdf-information-keyword) {
  position: static;
  font: inherit;
  color: transparent;
  background: transparent;
  padding: 0;
  white-space: inherit;
  transform: none;
}
.reading-text-layer .topic-sentence-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  transform: none;
  z-index: 2;
  background: transparent;
  min-height: 0;
  border-radius: 0;
  mix-blend-mode: multiply;
  user-select: none;
}
.topic-sentence-rect {
  position: absolute;
  pointer-events: none;
  background: color-mix(in srgb, var(--accent, #007aff) 10%, transparent);
}
.reading-text-layer .information-highlights {
  position: absolute;
  inset: 0;
  pointer-events: none;
  user-select: none;
  transform: none;
  z-index: 1;
}
.information-highlight-rect {
  position: absolute;
  pointer-events: none;
  background: color-mix(in srgb, var(--accent) 65%, transparent);
  border-radius: 1px;
}
</style>
