<script setup>
import { computed, markRaw, nextTick, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import {
  GALLERY_PADDING,
  buildGalleryLayout,
  galleryStep,
  visibleGalleryRows,
} from './page-gallery-layout.mjs';
import { GALLERY_EASE, fadeOut, flyPage, rippleTiles, snapshot } from './page-gallery-motion.mjs';
import {
  arrangedPositions,
  dropGap,
  menuGap,
  movePages,
  pastePages,
} from './page-gallery-order.mjs';
import { pageGalleryLabel } from './page-gallery-labels.mjs';

// Contact-sheet view of every page. It opens from a double-clicked sidebar thumbnail and
// closes into the reader at the double-clicked tile; both directions move the page itself.
// Pages can be selected together, dragged into a new place, copied and pasted; every
// arrangement is saved to the document through `editPages`.
const props = defineProps({
  pages: { type: Array, default: () => [] },
  active: Number,
  pdf: Object,
  foreground: Boolean,
  reduceMotion: Boolean,
  drawPage: Function,
  releaseCanvas: Function,
  navigate: Function,
  editPages: Function,
  editing: Boolean,
});

const open = ref(false),
  leaving = ref(false),
  selected = ref(1),
  // Selected pages; `selected` is the focused one among them.
  marked = shallowRef(new Set([1])),
  // Copied page numbers, in order.
  clipboard = shallowRef([]),
  // While an arrangement is saved, the gallery shows it from these page sizes.
  held = shallowRef(null),
  busy = ref(false),
  lifted = shallowRef(new Set()),
  caret = shallowRef(null),
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
  pumpDone = Promise.resolve(),
  anchor = 1,
  press = null,
  drag = null,
  swallowClick = false,
  clipboardKeyAt = -Infinity,
  inset = 0;

const shown = computed(() => held.value ?? props.pages);
const layout = computed(() => markRaw(buildGalleryLayout(shown.value, width.value)));
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
    if (canvases.get(number) === canvas && pdf === props.pdf && !busy.value)
      await props.drawPage(page, canvas, frame.scale);
  } catch (error) {
    // A tile that cannot be drawn stays blank, matching the sidebar thumbnails.
    if (error?.name !== 'RenderingCancelledException') console.warn('Page gallery', error);
  }
}

function pump() {
  if (!pumping) pumpDone = drain();
  return pumpDone;
}

async function drain() {
  pumping = true;
  try {
    await nextTick();
    while (open.value && pending.size && props.foreground && !busy.value) {
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
  mark([selected.value]);
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
  if (!open.value || leaving.value || busy.value) return;
  cancelDrag();
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
  cancelDrag();
  if (open.value) finish();
}

// Selection -------------------------------------------------------------------------------

function span(a, b) {
  const low = Math.min(a, b);
  return Array.from({ length: Math.abs(a - b) + 1 }, (_, index) => low + index);
}

function mark(pages, focus = pages[0]) {
  marked.value = new Set(pages);
  selected.value = focus;
  anchor = focus;
}

function markedPages() {
  const count = shown.value.length;
  return [...marked.value].filter((page) => page >= 1 && page <= count).sort((a, b) => a - b);
}

function click(event, number) {
  if (busy.value) return;
  if (event.metaKey || event.ctrlKey) {
    const next = new Set(marked.value);
    if (next.has(number) && next.size > 1) next.delete(number);
    else next.add(number);
    marked.value = next;
    selected.value = anchor = number;
  } else if (event.shiftKey) {
    marked.value = new Set(span(anchor, number));
    selected.value = number;
  } else mark([number]);
}

function focusSelected() {
  void nextTick(() => tileElement(selected.value)?.focus({ preventScroll: true }));
}

// Copying, pasting and moving ---------------------------------------------------------------

function copyPages() {
  const pages = markedPages();
  if (busy.value || !pages.length) return;
  clipboard.value = pages;
  if (still()) return;
  for (const page of pages)
    frameElement(page)?.animate(
      [{ transform: 'none' }, { transform: 'scale(0.95)' }, { transform: 'none' }],
      { duration: 240, easing: GALLERY_EASE },
    );
}

// Pastes after the last selected page; `duplicate` pastes the selection itself when nothing
// has been copied.
function paste({ duplicate = false } = {}) {
  const pages = markedPages(),
    source = clipboard.value.length ? clipboard.value : duplicate ? pages : [];
  if (busy.value || !source.length) return;
  const after = pages.at(-1) ?? selected.value;
  void arrange(
    pastePages(shown.value.length, source, after),
    span(after + 1, after + source.length),
  );
}

function move(action) {
  const pages = markedPages(),
    gap = pages.length ? menuGap(shown.value.length, pages, action) : null,
    order = gap === null ? null : movePages(shown.value.length, pages, gap);
  if (!busy.value && order) void arrange(order, positions(order, pages));
}

function positions(order, pages) {
  const at = arrangedPositions(order);
  return pages.map((page) => at.get(page));
}

async function contextMenu(number) {
  if (busy.value || leaving.value || drag || !window.previewDocuments?.pageMenu) return;
  if (marked.value.has(number)) selected.value = number;
  else mark([number]);
  const pages = markedPages(),
    count = shown.value.length,
    pdf = props.pdf;
  let action;
  try {
    action = await window.previewDocuments.pageMenu({
      count: pages.length,
      paste: clipboard.value.length,
      first: !movePages(count, pages, 0),
      last: !movePages(count, pages, count),
    });
  } catch (error) {
    console.warn('Page gallery menu', error);
    return;
  }
  if (!action || !open.value || leaving.value || busy.value || pdf !== props.pdf) return;
  if (action === 'copy') copyPages();
  else if (action === 'paste') paste();
  else move(action);
}

// Menu commands from the Edit menu arrive as clipboard events; keys handled in `keydown`
// are not repeated when the menu also fires.
function clipboardEvent(event, action) {
  event.preventDefault();
  event.stopPropagation();
  if (performance.now() - clipboardKeyAt < 500) return;
  if (action === 'copy') copyPages();
  else paste();
}

// Saves `order` and shows it at once: tiles keep their bitmaps and slide into place while
// the document is rewritten underneath.
async function arrange(order, next, { from } = {}) {
  if (!order || busy.value || props.editing || !props.editPages || !open.value) return false;
  const before = shown.value,
    previous = { marked: marked.value, selected: selected.value, anchor };
  busy.value = true;
  const rects = new Map();
  for (const number of canvases.keys()) {
    const rect = frameElement(number)?.getBoundingClientRect();
    if (rect) rects.set(number, rect);
  }
  await pumpDone;
  const shots = new Map();
  for (const [number, canvas] of canvases) if (canvas.width) shots.set(number, snapshot(canvas));
  held.value = order.map((page, index) => ({
    number: index + 1,
    width: before[page - 1].width,
    height: before[page - 1].height,
  }));
  mark(next);
  await nextTick();
  const scrollTop = root.value?.scrollTop;
  revealRow(selected.value);
  const scrolled = root.value?.scrollTop !== scrollTop;
  await nextTick();
  for (const [number, canvas] of canvases) {
    const shot = shots.get(order[number - 1]);
    props.releaseCanvas?.(canvas);
    if (shot) {
      canvas.width = shot.width;
      canvas.height = shot.height;
      canvas.getContext('2d').drawImage(shot, 0, 0);
    }
  }
  settle(order, scrolled ? new Map() : rects, from);
  focusSelected();
  let saved = false;
  try {
    saved = (await props.editPages('arrange', { order })) === true;
  } catch (error) {
    console.warn('Page gallery', error);
  }
  held.value = null;
  busy.value = false;
  if (saved && props.pages.length === order.length) {
    const at = arrangedPositions(order);
    clipboard.value = clipboard.value.map((page) => at.get(page)).filter(Boolean);
  } else {
    if (!props.pages.length) {
      dismiss();
      return false;
    }
    if (props.pages.length !== before.length) clipboard.value = [];
    marked.value = previous.marked;
    selected.value = Math.min(previous.selected, props.pages.length);
    anchor = Math.min(previous.anchor, props.pages.length);
    await nextTick();
    for (const canvas of canvases.values()) props.releaseCanvas?.(canvas);
  }
  for (const number of canvases.keys()) pending.add(number);
  void pump();
  focusSelected();
  return saved;
}

// Moved pages slide from where they were (or from the dragged stack), copies appear in place.
function settle(order, rects, from) {
  if (still()) return;
  const seen = new Set();
  order.forEach((page, index) => {
    const first = !seen.has(page),
      frame = frameElement(index + 1);
    seen.add(page);
    if (!frame) return;
    const to = frame.getBoundingClientRect(),
      start = first ? (from?.get(page) ?? rects.get(page)) : null;
    if (start) {
      const dx = start.left - to.left,
        dy = start.top - to.top,
        sx = start.width / to.width,
        sy = start.height / to.height;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(sx - 1) < 0.01) return;
      frame.animate(
        [
          { transformOrigin: '0 0', transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` },
          { transformOrigin: '0 0', transform: 'none' },
        ],
        { duration: 380, easing: GALLERY_EASE },
      );
    } else
      frame.animate(
        [
          { opacity: 0, transform: 'scale(0.86)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 320, delay: first ? 0 : 90, easing: GALLERY_EASE, fill: 'backwards' },
      );
  });
}

// Dragging ------------------------------------------------------------------------------------

function pointerdown(event, number) {
  swallowClick = false;
  if (event.button !== 0 || event.ctrlKey || busy.value || leaving.value) return;
  press = { x: event.clientX, y: event.clientY, number, pointerId: event.pointerId };
}

function pointermove(event) {
  if (drag) {
    if (event.pointerId !== drag.pointerId) return;
    drag.x = event.clientX;
    drag.y = event.clientY;
    placeGhost();
    locate();
    return;
  }
  if (!press || event.pointerId !== press.pointerId) return;
  if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < 6) return;
  startDrag(event);
}

function startDrag(event) {
  const { number, pointerId, x, y } = press;
  press = null;
  if (busy.value) return;
  if (!marked.value.has(number)) mark([number]);
  const pages = markedPages(),
    frame = frameElement(number),
    rect = frame?.getBoundingClientRect();
  if (!rect || !root.value) return;
  root.value.setPointerCapture(pointerId);
  const ghost = document.createElement('div');
  ghost.className = 'page-gallery-ghost';
  Object.assign(ghost.style, { width: rect.width + 'px', height: rect.height + 'px' });
  for (let layer = Math.min(pages.length, 3) - 1; layer > 0; layer--) {
    const card = document.createElement('div');
    card.className = 'page-gallery-ghost-card';
    card.style.transform = `translate(${layer * 5}px, ${layer * 4}px) rotate(${layer * 2.5}deg)`;
    ghost.append(card);
  }
  const copy = snapshot(frame.querySelector('canvas'));
  copy.className = 'page-gallery-ghost-page';
  ghost.append(copy);
  if (pages.length > 1) {
    const badge = document.createElement('span');
    badge.className = 'page-gallery-ghost-count';
    badge.textContent = pages.length;
    ghost.append(badge);
  }
  drag = {
    pages,
    pointerId,
    ghost,
    rect,
    offsetX: x - rect.left,
    offsetY: y - rect.top,
    x: event.clientX,
    y: event.clientY,
    gap: null,
    frame: 0,
  };
  document.body.append(ghost);
  placeGhost();
  if (!still())
    ghost.animate([{ transform: 'none' }, { transform: 'scale(1.04) rotate(-1.5deg)' }], {
      duration: 160,
      easing: GALLERY_EASE,
      fill: 'forwards',
    });
  lifted.value = new Set(pages);
  locate();
  drag.frame = requestAnimationFrame(autoScroll);
}

function placeGhost() {
  drag.ghost.style.left = drag.x - drag.offsetX + 'px';
  drag.ghost.style.top = drag.y - drag.offsetY + 'px';
}

// Marks the gap under the pointer; gaps that would leave the order unchanged get no caret.
function locate() {
  const el = root.value;
  if (!el || !drag) return;
  const box = el.getBoundingClientRect(),
    hit = dropGap(
      layout.value,
      drag.x - box.left,
      drag.y - box.top + el.scrollTop - inset - GALLERY_PADDING,
    ),
    order = hit && movePages(shown.value.length, drag.pages, hit.gap);
  drag.gap = order ? hit.gap : null;
  caret.value = order ? { x: hit.x, top: GALLERY_PADDING + hit.top, height: hit.height } : null;
}

function autoScroll() {
  const el = root.value;
  if (!drag || !el) return;
  const box = el.getBoundingClientRect(),
    edge = 56,
    top = box.top + inset;
  let speed = 0;
  if (drag.y < top + edge) speed = -(top + edge - drag.y) / edge;
  else if (drag.y > box.bottom - edge) speed = (drag.y - box.bottom + edge) / edge;
  if (speed) {
    const before = el.scrollTop;
    el.scrollTop += Math.max(-1.5, Math.min(1.5, speed)) * 16;
    if (el.scrollTop !== before) {
      measure();
      locate();
    }
  }
  drag.frame = requestAnimationFrame(autoScroll);
}

function releaseDrag() {
  if (!drag) return null;
  const value = drag;
  drag = null;
  cancelAnimationFrame(value.frame);
  caret.value = null;
  if (root.value?.hasPointerCapture?.(value.pointerId))
    root.value.releasePointerCapture(value.pointerId);
  return value;
}

// The stack returns to the page it was lifted from.
async function cancelDrag() {
  press = null;
  const value = releaseDrag();
  if (!value) return;
  const { ghost, rect } = value,
    from = ghost.getBoundingClientRect();
  if (!still())
    await ghost
      .animate(
        [
          { transform: 'scale(1.04) rotate(-1.5deg)' },
          { transform: `translate(${rect.left - from.left}px, ${rect.top - from.top}px)` },
        ],
        { duration: 260, easing: GALLERY_EASE, fill: 'forwards' },
      )
      .finished.catch(() => {});
  ghost.remove();
  if (!drag) lifted.value = new Set();
}

function pointerup(event) {
  press = null;
  if (!drag || event.pointerId !== drag.pointerId) return;
  swallowClick = true;
  const order = drag.gap === null ? null : movePages(shown.value.length, drag.pages, drag.gap);
  if (!order || props.editing) return void cancelDrag();
  const { ghost, pages } = releaseDrag(),
    rect = ghost.querySelector('.page-gallery-ghost-page').getBoundingClientRect();
  lifted.value = new Set();
  void fadeOut(ghost, 90);
  void arrange(order, positions(order, pages), {
    from: new Map(pages.map((page) => [page, rect])),
  });
}

function swallow(event) {
  if (!swallowClick) return;
  swallowClick = false;
  event.preventDefault();
  event.stopPropagation();
}

// Keyboard ------------------------------------------------------------------------------------

const MOVES = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];

function stop(event) {
  event.preventDefault();
  event.stopPropagation();
}

function keydown(event) {
  if (drag) {
    if (event.key === 'Escape') void cancelDrag();
    return stop(event);
  }
  if (leaving.value) return;
  if ((event.metaKey || event.ctrlKey) && !event.altKey) {
    const key = event.key.toLowerCase();
    if (key === 'a') marked.value = new Set(span(1, shown.value.length));
    else if (key === 'c') copyPages();
    else if (key === 'v') paste();
    else if (key === 'd') paste({ duplicate: true });
    else return;
    if (key === 'c' || key === 'v') clipboardKeyAt = performance.now();
    return stop(event);
  }
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (busy.value) {
    if (['Escape', 'Enter', ' ', ...MOVES].includes(event.key)) stop(event);
    return;
  }
  if (event.key === 'Escape') void choose(props.active, { navigate: false });
  else if (event.key === 'Enter' || event.key === ' ') void choose(selected.value);
  else if (MOVES.includes(event.key)) {
    const next = galleryStep(layout.value, selected.value, event.key);
    if (event.shiftKey) {
      marked.value = new Set(span(anchor, next));
      selected.value = next;
    } else mark([next]);
    revealRow(next);
    void nextTick(() => tileElement(next)?.focus({ preventScroll: true }));
  } else return;
  stop(event);
}

// The gallery's own arrangement replaces the document too; only other changes close it.
watch(
  () => props.pdf,
  () => {
    if (busy.value) return;
    clipboard.value = [];
    dismiss();
  },
);
watch(
  () => props.pages.length,
  (length) => !length && !busy.value && dismiss(),
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
  releaseDrag()?.ghost.remove();
  resizeObserver?.disconnect();
});

defineExpose({ show, dismiss, isOpen: () => open.value });
</script>

<template>
  <div
    v-if="open"
    ref="root"
    class="page-gallery"
    :class="{ leaving, busy, dragging: lifted.size > 0 }"
    role="listbox"
    aria-multiselectable="true"
    :aria-label="pageGalleryLabel('gallery')"
    @scroll.passive="measure"
    @keydown="keydown"
    @copy="clipboardEvent($event, 'copy')"
    @paste="clipboardEvent($event, 'paste')"
    @pointermove="pointermove"
    @pointerup="pointerup"
    @pointercancel="cancelDrag"
    @lostpointercapture="cancelDrag"
    @click.capture="swallow"
  >
    <div class="page-gallery-sheet" :style="{ height: layout.height + GALLERY_PADDING * 2 + 'px' }">
      <button
        v-for="{ frame, row } in tiles"
        :key="frame.number"
        type="button"
        class="page-gallery-tile"
        role="option"
        :data-gallery-page="frame.number"
        :aria-selected="marked.has(frame.number)"
        :aria-label="pageGalleryLabel('page', { page: frame.number })"
        :tabindex="frame.number === selected ? 0 : -1"
        :class="{
          selected: marked.has(frame.number),
          flying: frame.number === flying,
          lifted: lifted.has(frame.number),
        }"
        :style="{
          left: frame.cellX + 'px',
          top: GALLERY_PADDING + row.top + 'px',
          width: frame.cellWidth + 'px',
          height: row.height + 'px',
        }"
        @pointerdown="pointerdown($event, frame.number)"
        @click="click($event, frame.number)"
        @dblclick="choose(frame.number)"
        @contextmenu.prevent="contextMenu(frame.number)"
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
      <span
        v-if="caret"
        class="page-gallery-caret"
        :style="{ left: caret.x + 'px', top: caret.top + 'px', height: caret.height + 'px' }"
      ></span>
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
.page-gallery-flight,
.page-gallery-ghost {
  --page-gallery-shadow:
    0 0 0 0.5px rgba(0, 0, 0, 0.1), 0 0.5px 1px rgba(0, 0, 0, 0.12), 0 2px 5px rgba(0, 0, 0, 0.1),
    0 6px 16px rgba(0, 0, 0, 0.08);
  --page-gallery-shadow-lifted:
    0 0 0 0.5px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08), 0 4px 10px rgba(0, 0, 0, 0.1),
    0 14px 34px rgba(0, 0, 0, 0.16);
}
@media (prefers-color-scheme: dark) {
  .page-gallery,
  .page-gallery-flight,
  .page-gallery-ghost {
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
.page-gallery.busy {
  cursor: progress;
}
.page-gallery.dragging,
.page-gallery.dragging .page-gallery-tile {
  cursor: grabbing;
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
.page-gallery-tile.lifted .page-gallery-frame {
  opacity: 0.35;
  transition: opacity 160ms ease;
}
.page-gallery-caret {
  position: absolute;
  z-index: 1;
  width: 4px;
  margin-left: -2px;
  border-radius: 2px;
  background: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-soft);
  pointer-events: none;
  transition:
    left 120ms cubic-bezier(0.2, 0.85, 0.25, 1),
    top 120ms cubic-bezier(0.2, 0.85, 0.25, 1),
    height 120ms cubic-bezier(0.2, 0.85, 0.25, 1);
}
.page-gallery-ghost {
  position: fixed;
  z-index: 1000;
  pointer-events: none;
  will-change: left, top, transform;
}
.page-gallery-ghost-card,
.page-gallery-ghost-page {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: #fff;
  box-shadow: var(--page-gallery-shadow-lifted);
}
.page-gallery-ghost-count {
  position: absolute;
  top: -10px;
  right: -10px;
  min-width: 24px;
  height: 24px;
  padding: 0 7px;
  box-sizing: border-box;
  border-radius: 12px;
  background: var(--accent);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 24px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
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
