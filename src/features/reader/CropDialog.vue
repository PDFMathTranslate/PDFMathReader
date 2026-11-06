<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { AppButton, platform } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';
import { menuLabel } from '../../../shared/i18n/menu.mjs';

const props = defineProps({
  pages: Array,
  active: Number,
  pdf: Object,
  crop: Object,
  drawPage: Function,
  releaseCanvas: Function,
  readerAction: Function,
});
const dialog = ref(null),
  canvas = ref(null),
  frame = ref(null),
  pageNumber = ref(1);
const draft = ref({ left: 0, right: 0, top: 0, bottom: 0 });
const loading = ref(false),
  failed = ref(false);
let generation = 0;
const chinese = computed(() => uiLanguage.value === 'zh-CN' || uiLanguage.value === 'zh-TW');
const words = computed(() =>
  chinese.value
    ? {
        hint: '拖动边缘调整裁剪范围。裁剪将应用于所有页面。',
        cancel: '取消',
        apply: '应用',
        reset: '重置',
        left: '左',
        right: '右',
        top: '上',
        bottom: '下',
        loading: '正在加载页面…',
        error: '无法加载页面预览。',
      }
    : {
        hint: 'Drag the edges to adjust the crop. It applies to all pages.',
        cancel: 'Cancel',
        apply: 'Apply',
        reset: 'Reset',
        left: 'Left',
        right: 'Right',
        top: 'Top',
        bottom: 'Bottom',
        loading: 'Loading page…',
        error: 'Could not load the page preview.',
      },
);
const page = computed(() => props.pages?.[pageNumber.value - 1]);
const title = computed(() => menuLabel('Adjust Crop…', uiLanguage.value).replace(/…$/, ''));
const cropStyle = computed(() => ({
  left: `${draft.value.left * 100}%`,
  right: `${draft.value.right * 100}%`,
  top: `${draft.value.top * 100}%`,
  bottom: `${draft.value.bottom * 100}%`,
}));
function initialCrop(crop = {}) {
  return {
    left: crop.left ?? (crop.x || 0) / 2,
    right: crop.right ?? (crop.x || 0) / 2,
    top: crop.top ?? (crop.y || 0) / 2,
    bottom: crop.bottom ?? (crop.y || 0) / 2,
  };
}
async function open() {
  if (!props.pdf || !props.pages?.length) return;
  pageNumber.value = props.active;
  draft.value = initialCrop(props.crop);
  loading.value = true;
  failed.value = false;
  const token = ++generation,
    pdf = props.pdf;
  await nextTick();
  if (!dialog.value?.open) dialog.value?.showModal();
  try {
    const pdfPage = await pdf.getPage(pageNumber.value);
    if (token !== generation || !dialog.value?.open) return;
    const viewport = pdfPage.getViewport({ scale: 1 });
    const scale = Math.min(600 / viewport.width, 780 / viewport.height);
    if (!(await props.drawPage(pdfPage, canvas.value, scale, true)))
      throw Error('Preview unavailable');
  } catch (error) {
    if (token === generation) failed.value = true;
  } finally {
    if (token === generation) loading.value = false;
  }
}
function close() {
  generation++;
  dialog.value?.close();
}
function apply() {
  props.readerAction('crop:apply', { ...draft.value });
  close();
}
function setEdge(edge, value) {
  const opposite = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' }[edge];
  draft.value = {
    ...draft.value,
    [edge]: Math.max(0, Math.min(0.8 - draft.value[opposite], value)),
  };
}
function pointer(edge, event) {
  if (event.button !== 0) return;
  event.preventDefault();
  const target = event.currentTarget;
  target.setPointerCapture(event.pointerId);
  function move(e) {
    const rect = frame.value.getBoundingClientRect();
    const value =
      edge === 'left'
        ? (e.clientX - rect.left) / rect.width
        : edge === 'right'
          ? (rect.right - e.clientX) / rect.width
          : edge === 'top'
            ? (e.clientY - rect.top) / rect.height
            : (rect.bottom - e.clientY) / rect.height;
    setEdge(edge, value);
  }
  function end() {
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', end);
    target.removeEventListener('pointercancel', end);
  }
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', end);
  target.addEventListener('pointercancel', end);
  move(event);
}
function key(edge, event) {
  const direction = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
  if (!direction) return;
  event.preventDefault();
  const sign = edge === 'right' || edge === 'bottom' ? -1 : 1;
  setEdge(edge, draft.value[edge] + direction * sign * (event.shiftKey ? 0.05 : 0.01));
}
function cleanup() {
  generation++;
  if (canvas.value) props.releaseCanvas?.(canvas.value);
}
watch(
  () => props.pdf,
  () => {
    if (dialog.value?.open) close();
  },
);
watch(
  () => props.pages?.length,
  (count) => {
    if (!count && dialog.value?.open) close();
  },
);
onMounted(() => window.addEventListener('reader:adjust-crop', open));
onBeforeUnmount(() => {
  window.removeEventListener('reader:adjust-crop', open);
  cleanup();
});
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="crop-dialog"
      :data-platform="platform"
      :aria-label="title"
      @close="cleanup"
      @keydown.stop
    >
      <header>
        <h2>{{ title }}</h2>
        <p>{{ words.hint }}</p>
      </header>
      <div class="crop-stage">
        <div
          v-if="page"
          ref="frame"
          class="crop-preview"
          :style="{
            aspectRatio: page.width + ' / ' + page.height,
            width: `min(100%, calc((min(58vh, 580px) - 28px) * ${page.width / page.height}))`,
          }"
        >
          <canvas ref="canvas"></canvas>
          <div v-if="loading || failed" class="crop-status" role="status">
            {{ failed ? words.error : words.loading }}
          </div>
          <div v-if="!failed" class="crop-selection" :style="cropStyle">
            <button
              v-for="edge in ['left', 'right', 'top', 'bottom']"
              :key="edge"
              type="button"
              class="crop-handle"
              :class="edge"
              role="slider"
              :aria-label="words[edge]"
              :aria-valuemin="0"
              :aria-valuemax="
                Math.round(
                  (0.8 -
                    draft[{ left: 'right', right: 'left', top: 'bottom', bottom: 'top' }[edge]]) *
                    100,
                )
              "
              :aria-valuenow="Math.round(draft[edge] * 100)"
              :aria-valuetext="Math.round(draft[edge] * 100) + '%'"
              @pointerdown="pointer(edge, $event)"
              @keydown="key(edge, $event)"
            >
              <span></span>
            </button>
          </div>
        </div>
      </div>
      <footer>
        <AppButton type="button" @click="draft = initialCrop()">{{ words.reset }}</AppButton>
        <div class="crop-actions">
          <AppButton type="button" @click="close">{{ words.cancel }}</AppButton
          ><AppButton
            type="button"
            variant="prominent"
            :disabled="loading || failed"
            @click="apply"
            >{{ words.apply }}</AppButton
          >
        </div>
      </footer>
    </dialog>
  </Teleport>
</template>

<style scoped>
.crop-dialog {
  box-sizing: border-box;
  width: min(620px, calc(100vw - 40px));
  max-height: calc(100vh - 40px);
  padding: 22px 24px;
  border: 1px solid #00000014;
  border-radius: 20px;
  background: #f5f5f7;
  color: #1d1d1f;
  box-shadow:
    0 24px 72px #0004,
    0 4px 16px #0002;
  font:
    13px/1.4 -apple-system,
    BlinkMacSystemFont,
    system-ui,
    sans-serif;
}
:global([data-appearance='dark'] .crop-dialog) {
  background: #2c2c2e;
  color: #f5f5f7;
  border-color: #ffffff14;
  color-scheme: dark;
}
.crop-dialog::backdrop {
  background: #0006;
}
h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
header p {
  margin: 5px 0 0;
  opacity: 0.72;
}
.crop-stage {
  display: flex;
  justify-content: center;
  align-items: center;
  box-sizing: border-box;
  padding: 14px;
  margin: 18px 0;
  min-height: 180px;
  height: min(58vh, 580px);
  overflow: hidden;
  background: #7772;
  border-radius: 10px;
}
.crop-preview {
  position: relative;
  max-height: 100%;
  background: white;
  box-shadow: 0 2px 10px #0003;
}
canvas {
  display: block;
  width: 100%;
  height: 100%;
}
.crop-status {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #333;
  background: #fffffff0;
}
.crop-selection {
  position: absolute;
  outline: 2px solid #1683ff;
  box-shadow: 0 0 0 999px #0008;
}
.crop-handle {
  position: absolute;
  display: grid;
  place-items: center;
  border: 0;
  padding: 0;
  background: transparent;
  touch-action: none;
}
.crop-handle.left,
.crop-handle.right {
  width: 24px;
  height: 100%;
  top: 0;
  cursor: ew-resize;
}
.crop-handle.left {
  left: -12px;
}
.crop-handle.right {
  right: -12px;
}
.crop-handle.top,
.crop-handle.bottom {
  height: 24px;
  width: calc(100% - 24px);
  left: 12px;
  cursor: ns-resize;
}
.crop-handle.top {
  top: -12px;
}
.crop-handle.bottom {
  bottom: -12px;
}
.crop-handle span {
  display: block;
  background: #fff;
  border: 2px solid #1683ff;
  border-radius: 5px;
  box-shadow: 0 1px 4px #0004;
}
.crop-handle.left span,
.crop-handle.right span {
  width: 7px;
  height: 30px;
}
.crop-handle.top span,
.crop-handle.bottom span {
  width: 30px;
  height: 7px;
}
.crop-handle:focus-visible span {
  outline: 2px solid #1683ff;
  outline-offset: 2px;
}
footer,
.crop-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
footer {
  justify-content: space-between;
}
</style>
