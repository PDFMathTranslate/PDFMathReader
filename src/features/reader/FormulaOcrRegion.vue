<script setup>
import { inject, ref, computed, onBeforeUnmount, useId } from 'vue';
import { formulaOcrLabel } from './formula-ocr-labels.mjs';
const props = defineProps({ source: Function, box: Object, zoom: Number });
const ocr = inject('formulaOcr', null);
const busy = ref(false);
const hintId = useId();
const enabled = computed(() => ocr?.enabled.value === true);
const controller = new AbortController();
let rendering,
  alive = true;
async function recognize() {
  if (busy.value || !ocr) return;
  busy.value = true;
  let canvas;
  try {
    const page = await props.source();
    if (!alive) return;
    const box = props.box;
    // Fixed PDF resolution independent of the reading zoom; cap bitmap memory.
    const scale = Math.min(3, Math.sqrt((4 * 1024 * 1024) / (box.width * box.height)));
    canvas = document.createElement('canvas');
    const padding = 8;
    canvas.width = Math.ceil(box.width * scale) + padding * 2;
    canvas.height = Math.ceil(box.height * scale) + padding * 2;
    rendering = page.render({
      canvasContext: canvas.getContext('2d'),
      viewport: page.getViewport({ scale }),
      transform: [1, 0, 0, 1, padding - box.x * scale, padding - box.y * scale],
      background: '#ffffff',
    });
    await rendering.promise;
    rendering = null;
    if (!alive) return;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw Error(formulaOcrLabel('failed'));
    canvas.width = canvas.height = 0;
    await ocr.recognize(blob, { signal: controller.signal });
  } catch (e) {
    if (alive) ocr.notify(e.message || formulaOcrLabel('failed'), 4500);
  } finally {
    if (canvas) canvas.width = canvas.height = 0;
    rendering = null;
    busy.value = false;
  }
}
onBeforeUnmount(() => {
  alive = false;
  rendering?.cancel();
  controller.abort();
});
</script>
<template>
  <div
    v-if="enabled"
    class="formula-ocr-region"
    :class="{ 'is-busy': busy }"
    :style="{
      left: box.x * zoom + 'px',
      top: box.y * zoom + 'px',
      width: box.width * zoom + 'px',
      height: box.height * zoom + 'px',
    }"
  >
    <div class="formula-ocr-popover">
      <button
        class="formula-ocr-button"
        :disabled="busy"
        :aria-describedby="hintId"
        :aria-label="formulaOcrLabel(busy ? 'recognizing' : 'recognize')"
        :aria-busy="busy"
        @click.stop="recognize"
      >
        <progress v-if="busy" :aria-label="formulaOcrLabel('recognizing')"></progress>
        <span
          v-else
          class="system-icon"
          data-symbol="magnifyingglass"
          style="--symbol: url('/symbols/magnifyingglass.png')"
          aria-hidden="true"
        ></span>
      </button>
      <span :id="hintId" class="formula-ocr-hint" role="tooltip">
        {{ formulaOcrLabel(busy ? 'recognizing' : 'recognize') }}
      </span>
    </div>
  </div>
</template>
<style scoped>
.formula-ocr-region {
  position: absolute;
  z-index: 6;
  min-height: 16px;
}
.formula-ocr-popover {
  position: absolute;
  inset: -5px;
  border-radius: 8px;
  border: 1px solid transparent;
  opacity: 0;
  /* Keep the equation readable beneath the hover region, including when the
     application reduces transparency for other surfaces. */
  background: color-mix(in srgb, var(--surface, #f5f5f5) 20%, transparent);
  transition: opacity 140ms ease;
  pointer-events: none;
}
.formula-ocr-region:hover .formula-ocr-popover,
.formula-ocr-region:focus-within .formula-ocr-popover,
.formula-ocr-region.is-busy .formula-ocr-popover {
  opacity: 1;
  border-color: var(--separator, #8883);
}
.formula-ocr-button {
  position: absolute;
  right: 3px;
  top: 3px;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  padding: 4px;
  border: 1px solid var(--separator, #8883);
  border-radius: 7px;
  background: color-mix(in srgb, var(--surface, #f5f5f5) 85%, transparent);
  backdrop-filter: blur(12px);
  color: var(--text);
  cursor: pointer;
  pointer-events: auto;
}
.formula-ocr-hint {
  position: absolute;
  right: 3px;
  top: 39px;
  z-index: 1;
  padding: 5px 9px;
  border: 1px solid var(--separator, #8883);
  border-radius: 7px;
  background: var(--surface, #f5f5f5);
  color: var(--text);
  box-shadow: 0 3px 12px #0002;
  font-size: 12px;
  line-height: 1.4;
  white-space: nowrap;
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}
.formula-ocr-button:hover + .formula-ocr-hint,
.formula-ocr-button:focus-visible + .formula-ocr-hint {
  opacity: 1;
  visibility: visible;
}
.formula-ocr-button progress {
  width: 19px;
  height: 5px;
  accent-color: var(--accent);
}
.formula-ocr-button .system-icon {
  width: 16px;
  height: 16px;
}
:root[data-reduce-transparency='true'] .formula-ocr-button {
  background: var(--surface, #f5f5f5);
  backdrop-filter: none;
}
@media (prefers-reduced-motion: reduce) {
  .formula-ocr-popover {
    transition: none;
  }
}
:root[data-reduce-motion='true'] .formula-ocr-popover {
  transition: none;
}
</style>
