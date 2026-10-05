<script setup>
import { ref, computed, nextTick, onBeforeUnmount } from 'vue';
import { menuLabel } from '../electron/menu-i18n.mjs';
import { uiLanguage } from './i18n.mjs';
import { towardSubmenu } from './menu-intent.mjs';
const emit = defineEmits(['open', 'close']);
const open = ref(false),
  items = ref([]),
  trail = ref([]),
  positions = ref([]),
  trigger = ref(),
  failure = ref('');
const panels = [];
let generation = 0,
  pending,
  previous;
const levels = computed(() => [items.value, ...trail.value.map((item) => item.submenu)]);
const label = computed(() => menuLabel('Menu', uiLanguage.value));
function cancelPending() {
  clearTimeout(pending);
  pending = undefined;
}
function close(restore = false) {
  cancelPending();
  ++generation;
  open.value = false;
  trail.value = [];
  positions.value = [];
  previous = undefined;
  emit('close');
  if (restore) trigger.value?.focus();
}
async function position() {
  await nextTick();
  if (!open.value) return;
  for (let level = 0; level < levels.value.length; level++) {
    const panel = panels[level];
    if (!panel) continue;
    const anchor = level
      ? panels[level - 1]?.querySelector(
          `[data-index="${levels.value[level - 1].indexOf(trail.value[level - 1])}"]`,
        )
      : trigger.value;
    if (!anchor) continue;
    const box = anchor.getBoundingClientRect(),
      bounds = panel.getBoundingClientRect();
    let left = level ? box.right - 2 : box.left,
      top = level ? box.top - 5 : box.bottom + 6;
    if (level && left + bounds.width > innerWidth - 8) left = box.left - bounds.width + 2;
    positions.value[level] = {
      left: Math.max(8, Math.min(left, innerWidth - bounds.width - 8)) + 'px',
      top: Math.max(8, Math.min(top, innerHeight - bounds.height - 8)) + 'px',
    };
    await nextTick();
  }
}
async function toggle() {
  if (open.value) {
    close();
    return;
  }
  emit('open');
  const token = ++generation;
  failure.value = '';
  try {
    const result = await window.previewWindow.menu();
    if (token !== generation) return;
    items.value = result;
    open.value = true;
    await position();
    focusFirst(0);
  } catch {
    if (token === generation) {
      failure.value = menuLabel('Menu unavailable', uiLanguage.value);
      open.value = true;
      await position();
    }
  }
}
function focusFirst(level) {
  panels[level]?.querySelector('button:not(:disabled)')?.focus();
}
async function expand(item, level, focus = false) {
  cancelPending();
  trail.value = trail.value.slice(0, level);
  if (item.enabled !== false && item.submenu?.length) trail.value.push(item);
  await position();
  if (focus && item.submenu?.length) focusFirst(level + 1);
}
function hover(item, level, event) {
  cancelPending();
  if (trail.value[level] === item) return;
  const point = { x: event.clientX, y: event.clientY },
    child = panels[level + 1];
  if (child && previous && towardSubmenu(previous, point, child.getBoundingClientRect()))
    pending = setTimeout(() => void expand(item, level), 300);
  else void expand(item, level);
}
function move(event) {
  previous = { x: event.clientX, y: event.clientY };
}
async function choose(item, level) {
  if (item.submenu?.length) {
    await expand(item, level, true);
    return;
  }
  // Vue wraps menu paths in reactive proxies; Electron IPC requires a plain array.
  const path = [...item.path];
  close(true);
  await nextTick();
  await window.previewWindow.menuAction(path);
}
async function keydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    close(true);
    return;
  }
  if (event.key === 'Tab') {
    close();
    return;
  }
  const level = Number(event.target.closest('[data-level]')?.dataset.level || 0),
    index = Number(event.target.dataset.index),
    item = levels.value[level]?.[index];
  if (event.key === 'ArrowLeft' && level) {
    event.preventDefault();
    cancelPending();
    const parent = trail.value[level - 1];
    trail.value = trail.value.slice(0, level - 1);
    await nextTick();
    panels[level - 1]
      ?.querySelector(`[data-index="${levels.value[level - 1].indexOf(parent)}"]`)
      ?.focus();
    return;
  }
  if (event.key === 'ArrowRight' && item?.submenu?.length) {
    event.preventDefault();
    await expand(item, level, true);
    return;
  }
  const buttons = [...(panels[level]?.querySelectorAll('button:not(:disabled)') || [])],
    selected = buttons.indexOf(document.activeElement);
  const next =
    event.key === 'ArrowDown'
      ? (selected + 1) % buttons.length
      : event.key === 'ArrowUp'
        ? (selected - 1 + buttons.length) % buttons.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? buttons.length - 1
            : null;
  if (next !== null) {
    event.preventDefault();
    cancelPending();
    buttons[next]?.focus();
    const target = levels.value[level]?.[Number(buttons[next]?.dataset.index)];
    if (target) await expand(target, level);
  }
}
onBeforeUnmount(cancelPending);
defineExpose({ close, toggle });
</script>

<template>
  <div
    class="windows-menu"
    data-popover-trigger
    @keydown="keydown"
    @pointermove="move"
    @pointerleave="cancelPending"
    @focusout="
      (event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) close();
      }
    "
  >
    <button
      ref="trigger"
      class="windows-menu-trigger"
      :aria-label="label"
      :title="label"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="toggle"
    >
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        aria-hidden="true"
      >
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
    <template v-if="open">
      <div
        v-for="(entries, level) in levels"
        :key="level"
        :ref="(el) => (panels[level] = el)"
        class="windows-menu-panel windows-menu-cascade"
        :data-level="level"
        :style="positions[level]"
        role="menu"
        :aria-label="level ? trail[level - 1].label.replaceAll('&', '') : label"
        @pointerenter="cancelPending"
        @scroll="
          cancelPending();
          position();
        "
      >
        <p v-if="failure && level === 0" role="status">{{ failure }}</p>
        <template v-for="(item, index) in entries" :key="item.path.join('.')">
          <div
            v-if="item.type === 'separator'"
            role="separator"
            class="windows-menu-separator"
          ></div>
          <button
            v-else
            class="windows-menu-item"
            :class="{ 'submenu-open': trail[level] === item }"
            :data-index="index"
            :role="
              item.type === 'checkbox'
                ? 'menuitemcheckbox'
                : item.type === 'radio'
                  ? 'menuitemradio'
                  : 'menuitem'
            "
            :aria-checked="['checkbox', 'radio'].includes(item.type) ? !!item.checked : undefined"
            :aria-haspopup="item.submenu?.length ? 'menu' : undefined"
            :aria-expanded="item.submenu?.length ? trail[level] === item : undefined"
            :disabled="item.enabled === false"
            @pointerenter="hover(item, level, $event)"
            @click="choose(item, level)"
          >
            <span class="windows-menu-check">{{ item.checked ? '✓' : '' }}</span
            ><span>{{ item.label.replaceAll('&', '') }}</span
            ><small>{{ item.accelerator?.replace('CommandOrControl', 'Ctrl') }}</small
            ><span v-if="item.submenu?.length">›</span>
          </button>
        </template>
      </div>
    </template>
  </div>
</template>
