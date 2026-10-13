<script setup>
import { computed, markRaw, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import {
  GALLERY_PADDING,
  buildGalleryLayout,
  galleryStep,
  visibleGalleryRows,
} from './page-gallery-layout.mjs';
import { GALLERY_EASE, fadeOut, flyPage, rippleTiles } from './page-gallery-motion.mjs';
import { pageGalleryLabel } from './page-gallery-labels.mjs';

// Contact-sheet view of every page. It opens from a double-clicked sidebar thumbnail and
// closes into the reader at the double-clicked tile; both directions move the page itself.
const props = defineProps({
  pages: { type: Array, default: () => [] },
  active: Number,
  pdf: Object,
  foreground: Boolean,
  reduceMotion: Boolean,
  drawPage: Function,
  releaseCanvas: Function,
  navigate: Function,
});

const open = ref(false),
  leaving = ref(false),
  selected = ref(1),
  // The tile whose page is in flight stays hidden until its copy lands.
  flying = ref(0),
  root = ref(),
  width = ref(0),
  viewTop = ref(0),
  viewHeight = ref(0);
const canvases = new Map(),
  pending = new Set();
let controller,
  pumping,
  inset = 0;

const layout = computed(() => markRaw(buildGalleryLayout(props.pages, width.value)));
const tiles = computed(() => {
  const { rows, frames } = layout.value;
  if (!rows.length || !viewHeight.value) return [];
  const { first, last } = visibleGalleryRows(layout.value, viewTop.value, viewHeight.value),
    items = [];
  for (let r = first; r <= last; r++)
    for (let i = rows[r].start; i < rows[r].end; i++)
      items.push({ frame: frames[i], row: rows[r] });
  return items;
});

function still() {
  return props.reduceMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function measure() {
  const el = root.value;
  if (!el) return;
  inset = parseFloat(getComputedStyle(el).paddingTop) || 0;
  width.value = el.clientWidth;
  viewHeight.value = el.clientHeight;
  viewTop.value = el.scrollTop - inset - GALLERY_PADDING;
}

function tileElement(number) {
  return root.value?.querySelector(`[data-gallery-page="${number}"]`);
}

function frameElement(number) {
  return tileElement(number)?.querySelector('.page-gallery-frame');
}

function rowOf(number) {
  return layout.value.rows[layout.value.frames[number - 1]?.row];
}

function centerOn(number) {
  const el = root.value,
    row = rowOf(number);
  if (!el || !row) return;
  el.scrollTop = inset + GALLERY_PADDING + row.top + row.height / 2 - el.clientHeight / 2;
  measure();
}

function revealRow(number) {
  const el = root.value,
    row = rowOf(number);
  if (!el || !row) return;
  const top = inset + GALLERY_PADDING + row.top,
    bottom = top + row.height;
  if (top - inset < el.scrollTop) el.scrollTop = top - inset - 12;
  else if (bottom > el.scrollTop + el.clientHeight) el.scrollTop = bottom - el.clientHeight + 12;
  measure();
}

// Painting -------------------------------------------------------------------------------

function bindCanvas(number, el) {
  const old = canvases.get(number);
  if (old === el) return;
  if (old) props.releaseCanvas?.(old);
  if (el) {
    canvases.set(number, el);
    pending.add(number);
    void pump();
  } else canvases.delete(number);
}

async function paint(number) {
  pending.delete(number);
  const canvas = canvases.get(number),
    frame = layout.value.frames[number - 1],
    pdf = props.pdf;
  if (!canvas || !frame || !pdf || !props.drawPage) return;
  try {
    const page = await pdf.getPage(number);
    if (canvases.get(number) === canvas && pdf === props.pdf)
      await props.drawPage(page, canvas, frame.scale);
  } catch (error) {
    // A tile that cannot be drawn stays blank, matching the sidebar thumbnails.
    if (error?.name !== 'RenderingCancelledException') console.warn('Page gallery', error);
  }
}

async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    await nextTick();
    while (open.value && pending.size && props.foreground) {
      // Nearest rows to the middle of the view are drawn first, two at a time.
      const middle = viewTop.value + viewHeight.value / 2,
        distance = (n) => Math.abs((rowOf(n)?.top ?? 0) - middle),
        batch = [...pending].sort((a, b) => distance(a) - distance(b)).slice(0, 2);
      await Promise.all(batch.map(paint));
    }
  } finally {
    pumping = false;
  }
}

// Copies the sidebar bitmap into an unpainted tile, so the landing tile is never blank.
function seed(number, source) {
  const canvas = canvases.get(number);
  if (!canvas || canvas.width || !(source instanceof HTMLCanvasElement) || !source.width) return;
  canvas.width = source.width;
  canvas.height = source.height;
  canvas.getContext('2d').drawImage(source, 0, 0);
}

watch(
  () => props.foreground,
  (foreground) => {
    if (!foreground || !open.value) return;
    for (const number of canvases.keys()) pending.add(number);
    void pump();
  },
);

// Opening and closing ---------------------------------------------------------------------

async function show(number, source) {
  if (open.value || !props.pages.length) return;
  controller?.abort();
  const signal = (controller = new AbortController()).signal;
  const from = source?.getBoundingClientRect();
  selected.value = Math.min(props.pages.length, Math.max(1, number));
  leaving.value = false;
  flying.value = still() ? 0 : selected.value;
  open.value = true;
  await nextTick();
  measure();
  centerOn(selected.value);
  await nextTick();
  tileElement(selected.value)?.focus({ preventScroll: true });
  if (!flying.value) return;
  seed(selected.value, source);
  root.value.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, easing: 'ease-out' });
  rippleTiles(
    root.value.querySelectorAll('.page-gallery-tile'),
    selected.value,
    layout.value.columns,
    {
      entering: true,
    },
  );
  const clone = await flyPage(source, from, frameElement(selected.value)?.getBoundingClientRect(), {
    duration: 460,
    signal,
  });
  if (!signal.aborted) flying.value = 0;
  void fadeOut(clone, 120);
}

function readerPage(number) {
  return root.value?.parentElement?.querySelector(`.reader .page[data-page="${number}"]`);
}

// Returns to reading at `number`; the reading position is kept when it is already the page.
async function choose(number, { navigate = number !== props.active } = {}) {
  if (!open.value || leaving.value) return;
  controller?.abort();
  const signal = (controller = new AbortController()).signal;
  selected.value = number;
  leaving.value = true;
  if (!frameElement(number)) {
    centerOn(number);
    await nextTick();
  }
  const tile = frameElement(number),
    from = tile?.getBoundingClientRect(),
    source = tile?.querySelector('canvas');
  if (navigate) await props.navigate?.(number);
  await nextTick();
  await new Promise(requestAnimationFrame);
  if (signal.aborted) return;
  const to = readerPage(number)?.getBoundingClientRect();
  if (still() || !from || !to) return finish();
  flying.value = number;
  rippleTiles(root.value.querySelectorAll('.page-gallery-tile'), number, layout.value.columns, {
    entering: false,
    duration: 260,
  });
  const backdrop = root.value.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: 300,
    delay: 120,
    easing: GALLERY_EASE,
    fill: 'forwards',
  });
  const clone = await flyPage(source, from, to, { duration: 480, signal });
  await backdrop.finished.catch(() => {});
  if (!signal.aborted) finish();
  void fadeOut(clone, 160);
}

function finish() {
  open.value = false;
  leaving.value = false;
  flying.value = 0;
  pending.clear();
  readerPage(selected.value)?.closest('.reader')?.focus({ preventScroll: true });
}

function dismiss() {
  controller?.abort();
  if (open.value) finish();
}

const MOVES = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
function keydown(event) {
  if (leaving.value || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === 'Escape') void choose(props.active, { navigate: false });
  else if (event.key === 'Enter' || event.key === ' ') void choose(selected.value);
  else if (MOVES.includes(event.key)) {
    const next = galleryStep(layout.value, selected.value, event.key);
    selected.value = next;
    revealRow(next);
    void nextTick(() => tileElement(next)?.focus({ preventScroll: true }));
  } else return;
  event.preventDefault();
  event.stopPropagation();
}

watch(
  () => props.pdf,
  () => dismiss(),
);
watch(
  () => props.pages.length,
  (length) => !length && dismiss(),
);

let resizeObserver;
watch(root, (el) => {
  resizeObserver?.disconnect();
  if (!el) return;
  resizeObserver = new ResizeObserver(() => {
    const keep = selected.value;
    measure();
    if (!leaving.value) revealRow(keep);
  });
  resizeObserver.observe(el);
});
onBeforeUnmount(() => {
  controller?.abort();
  resizeObserver?.disconnect();
});

defineExpose({ show, dismiss, isOpen: () => open.value });
</script>

<template>
  <div
    v-if="open"
    ref="root"
    class="page-gallery"
    :class="{ leaving }"
    role="listbox"
    :aria-label="pageGalleryLabel('gallery')"
    @scroll.passive="measure"
    @keydown="keydown"
  >
    <div class="page-gallery-sheet" :style="{ height: layout.height + GALLERY_PADDING * 2 + 'px' }">
      <button
        v-for="{ frame, row } in tiles"
        :key="frame.number"
        type="button"
        class="page-gallery-tile"
        role="option"
        :data-gallery-page="frame.number"
        :aria-selected="frame.number === selected"
        :aria-label="pageGalleryLabel('page', { page: frame.number })"
        :tabindex="frame.number === selected ? 0 : -1"
        :class="{ selected: frame.number === selected, flying: frame.number === flying }"
        :style="{
          left: frame.cellX + 'px',
          top: GALLERY_PADDING + row.top + 'px',
          width: frame.cellWidth + 'px',
          height: row.height + 'px',
        }"
        @click="selected = frame.number"
        @dblclick="choose(frame.number)"
      >
        <span
          class="page-gallery-frame"
          :style="{
            left: frame.x - frame.cellX + 'px',
            top: frame.y - row.top + 'px',
            width: frame.width + 'px',
            height: frame.height + 'px',
          }"
          ><canvas
            :ref="(el) => bindCanvas(frame.number, el)"
            :width="0"
            :height="0"
          ></canvas></span
        ><span class="page-gallery-number" :style="{ top: row.imageHeight + 14 + 'px' }"
          ><span>{{ frame.number }}</span></span
        >
      </button>
    </div>
  </div>
</template>

<style>
.workspace:has(> .page-gallery) {
  position: relative;
  isolation: isolate;
}
.app:has(.page-gallery) :is(.reader-floating-tools, .page-navigator) {
  visibility: hidden;
}
.page-gallery {
  position: absolute;
  inset: 0;
  z-index: 30;
  overflow: hidden auto;
  outline: none;
  background: var(--reader);
  scrollbar-width: thin;
  user-select: none;
  -webkit-user-select: none;
}
/* AppKit-style paper: hairline edge, tight contact shadow, soft ambient falloff. */
.page-gallery,
.page-gallery-flight {
  --page-gallery-shadow:
    0 0 0 0.5px rgba(0, 0, 0, 0.1), 0 0.5px 1px rgba(0, 0, 0, 0.12), 0 2px 5px rgba(0, 0, 0, 0.1),
    0 6px 16px rgba(0, 0, 0, 0.08);
  --page-gallery-shadow-lifted:
    0 0 0 0.5px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08), 0 4px 10px rgba(0, 0, 0, 0.1),
    0 14px 34px rgba(0, 0, 0, 0.16);
}
@media (prefers-color-scheme: dark) {
  .page-gallery,
  .page-gallery-flight {
    --page-gallery-shadow:
      0 0 0 0.5px rgba(255, 255, 255, 0.1), 0 0.5px 1px rgba(0, 0, 0, 0.4),
      0 1px 3px rgba(0, 0, 0, 0.35), 0 4px 12px rgba(0, 0, 0, 0.3);
    --page-gallery-shadow-lifted:
      0 0 0 0.5px rgba(255, 255, 255, 0.1), 0 1px 2px rgba(0, 0, 0, 0.4),
      0 4px 10px rgba(0, 0, 0, 0.4), 0 16px 38px rgba(0, 0, 0, 0.5);
  }
}
.content-glass:not(.is-fullscreen) .page-gallery {
  padding-top: var(--toolbar-height);
}
.page-gallery.leaving {
  pointer-events: none;
}
.page-gallery-sheet {
  position: relative;
}
.page-gallery-tile {
  position: absolute;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: default;
  outline: none;
}
.page-gallery-frame {
  position: absolute;
  background: #fff;
  box-shadow: var(--page-gallery-shadow);
}
.page-gallery-frame canvas {
  display: block;
  width: 100% !important;
  height: 100% !important;
}
.page-gallery-tile.flying .page-gallery-frame {
  visibility: hidden;
}
.page-gallery-frame::after {
  content: '';
  position: absolute;
  inset: -7px;
  border: 3px solid var(--accent);
  border-radius: 9px;
  corner-shape: round;
  opacity: 0;
  transform: scale(0.96);
  transition:
    opacity 160ms ease,
    transform 220ms cubic-bezier(0.2, 0.85, 0.25, 1);
  pointer-events: none;
}
.page-gallery-tile.selected .page-gallery-frame::after {
  opacity: 1;
  transform: none;
}
.page-gallery-tile:focus-visible .page-gallery-frame::after {
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.page-gallery-number {
  position: absolute;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  pointer-events: none;
}
.page-gallery-number > span {
  min-width: 22px;
  padding: 2px 8px;
  border-radius: 8px;
  corner-shape: round;
  color: color-mix(in srgb, var(--text) 82%, transparent);
  font-size: 16px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 22px;
  text-align: center;
  transition:
    background-color 160ms ease,
    color 160ms ease;
}
.page-gallery-tile.selected .page-gallery-number > span {
  background: var(--accent);
  color: #fff;
}
.page-gallery-flight {
  position: fixed;
  z-index: 1000;
  background: #fff;
  transform-origin: 0 0;
  pointer-events: none;
  will-change: transform;
}
[data-reduce-motion='true'] .page-gallery-frame::after,
[data-reduce-motion='true'] .page-gallery-number > span {
  transition: none;
}
@media (prefers-reduced-motion: reduce) {
  .page-gallery-frame::after,
  .page-gallery-number > span {
    transition: none;
  }
}
</style>
