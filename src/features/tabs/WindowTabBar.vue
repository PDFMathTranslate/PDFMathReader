<script setup>
import { computed, ref } from 'vue';
import { menuLabel } from '../../../shared/i18n/menu.mjs';
import { uiLanguage } from '../../i18n/index.mjs';

const props = defineProps({ controller: { type: Object, required: true } });
const label = (text) => menuLabel(text, uiLanguage.value);
const tabs = computed(() => props.controller.tabs.value);
const track = ref(null);
// Pointer-driven reordering, as in Finder: the dragged tab follows the pointer
// while its neighbours slide aside to show where it will land.
const drag = ref(null);
const DRAG_THRESHOLD = 4;

const begin = (event, tab, index) => {
  if (event.button !== 0 || event.target.closest('.window-tab-close')) return;
  const items = [...track.value.querySelectorAll('.window-tab')];
  drag.value = {
    id: tab.id,
    from: index,
    to: index,
    startX: event.clientX,
    offset: 0,
    moved: false,
    width: items[index]?.getBoundingClientRect().width || 0,
    centers: items.map((item) => {
      const rect = item.getBoundingClientRect();
      return rect.left + rect.width / 2;
    }),
  };
  event.currentTarget.setPointerCapture?.(event.pointerId);
};
const update = (event) => {
  const state = drag.value;
  if (!state) return;
  const offset = event.clientX - state.startX;
  if (!state.moved && Math.abs(offset) < DRAG_THRESHOLD) return;
  state.moved = true;
  state.offset = offset;
  const center = state.centers[state.from] + offset;
  let to = state.from;
  while (to < state.centers.length - 1 && center > state.centers[to + 1]) to += 1;
  while (to > 0 && center < state.centers[to - 1]) to -= 1;
  state.to = to;
};
const finish = (event, tab) => {
  const state = drag.value;
  drag.value = null;
  if (!state || state.id !== tab.id) return;
  if (state.moved) {
    if (state.to !== state.from) void props.controller.move(tab.id, state.to);
    return;
  }
  if (event.type === 'pointerup' && !tab.active) void props.controller.select(tab.id);
};
const shift = (index) => {
  const state = drag.value;
  if (!state?.moved) return 0;
  if (index === state.from) return state.offset;
  if (state.from < index && index <= state.to) return -state.width;
  if (state.to <= index && index < state.from) return state.width;
  return 0;
};
const keySelect = (event, tab, index) => {
  const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
  if (!step) return;
  event.preventDefault();
  const items = track.value.querySelectorAll('.window-tab');
  items[(index + step + items.length) % items.length]?.focus();
};
</script>

<template>
  <div class="window-tab-bar" data-window-tab-bar>
    <div ref="track" class="window-tab-track" role="tablist" :aria-label="label('Window')">
      <div
        v-for="(tab, index) in tabs"
        :key="tab.id"
        class="window-tab"
        :class="{
          active: tab.active,
          dragging: drag?.moved && drag.id === tab.id,
          'drag-settling': drag?.moved && drag.id !== tab.id,
        }"
        role="tab"
        tabindex="0"
        :aria-selected="tab.active"
        :title="tab.title"
        :style="{ transform: shift(index) ? `translateX(${shift(index)}px)` : undefined }"
        @pointerdown="begin($event, tab, index)"
        @pointermove="update"
        @pointerup="finish($event, tab)"
        @pointercancel="finish($event, tab)"
        @auxclick.prevent="$event.button === 1 && controller.close(tab.id)"
        @contextmenu.prevent="controller.contextMenu(tab.id)"
        @keydown.enter.prevent="!tab.active && controller.select(tab.id)"
        @keydown.space.prevent="!tab.active && controller.select(tab.id)"
        @keydown="keySelect($event, tab, index)"
      >
        <button
          type="button"
          class="window-tab-close"
          tabindex="-1"
          :aria-label="label('Close Tab')"
          :title="label('Close Tab')"
          @click.stop="controller.close(tab.id)"
        >
          <svg viewBox="0 0 10 10" aria-hidden="true">
            <path d="M2 2l6 6M8 2l-6 6" />
          </svg>
        </button>
        <span class="window-tab-title">{{ tab.title }}</span>
      </div>
    </div>
    <button
      type="button"
      class="window-tab-new"
      :aria-label="label('New Tab')"
      :title="label('New Tab')"
      @click="controller.create()"
    >
      <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1.5v9M1.5 6h9" /></svg>
    </button>
  </div>
</template>

<style scoped>
.window-tab-bar {
  position: fixed;
  top: calc(var(--toolbar-height) - var(--tabbar-height));
  left: 0;
  right: 0;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 8px;
  height: var(--tabbar-height);
  padding: 0 12px 6px;
  box-sizing: border-box;
  transition: transform 180ms ease;
  animation: window-tab-bar-in 200ms ease-out;
}

.window-tab-track {
  position: relative;
  display: flex;
  flex: 1;
  min-width: 0;
  height: 28px;
  padding: 2px;
  box-sizing: border-box;
  border-radius: 14px;
  background: var(--tab-track, rgba(0, 0, 0, 0.055));
  -webkit-app-region: no-drag;
}

.window-tab {
  position: relative;
  display: flex;
  flex: 1 1 0;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 24px;
  padding: 0 26px;
  border-radius: 12px;
  color: var(--tab-text, rgba(0, 0, 0, 0.55));
  font-size: 12px;
  font-weight: 500;
  cursor: default;
  user-select: none;
  outline: none;
  transition:
    background-color 140ms ease,
    color 140ms ease,
    transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.window-tab:not(.active):hover {
  background: var(--tab-hover, rgba(0, 0, 0, 0.045));
}

.window-tab.active {
  color: var(--tab-active-text, rgba(0, 0, 0, 0.85));
  background: var(--tab-active, #fff);
  box-shadow:
    0 0 0 0.5px rgba(0, 0, 0, 0.06),
    0 1px 2px rgba(0, 0, 0, 0.1);
}

.window-tab:focus-visible {
  box-shadow: 0 0 0 2px var(--accent);
}

.window-tab.dragging {
  z-index: 1;
  transition:
    background-color 140ms ease,
    color 140ms ease;
}

.window-tab-title {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.window-tab-close {
  position: absolute;
  left: 5px;
  top: 50%;
  display: grid;
  place-items: center;
  width: 16px;
  height: 16px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  color: inherit;
  background: transparent;
  opacity: 0;
  transform: translateY(-50%);
  transition: opacity 120ms ease;
}

.window-tab:hover .window-tab-close,
.window-tab:focus-visible .window-tab-close {
  opacity: 1;
}

.window-tab-close:hover {
  background: var(--tab-hover, rgba(0, 0, 0, 0.08));
}

.window-tab-close svg,
.window-tab-new svg {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
}

.window-tab-close svg {
  width: 8px;
  height: 8px;
  stroke-width: 1.5;
}

.window-tab-new {
  display: grid;
  flex: none;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  color: var(--tab-text, rgba(0, 0, 0, 0.6));
  background: var(--tab-track, rgba(0, 0, 0, 0.055));
  -webkit-app-region: no-drag;
  transition: background-color 140ms ease;
}

.window-tab-new:hover {
  background: var(--tab-hover-strong, rgba(0, 0, 0, 0.1));
}

.window-tab-new svg {
  width: 12px;
  height: 12px;
  stroke-width: 1.6;
}

@keyframes window-tab-bar-in {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .window-tab-bar,
  .window-tab,
  .window-tab-close {
    animation: none;
    transition: none;
  }
}
</style>
