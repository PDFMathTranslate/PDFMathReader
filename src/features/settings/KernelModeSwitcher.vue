<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { t } from '../../i18n/index.mjs';
import { platform, AppSegmentedControl, AppSegment } from '../../ui/controls.mjs';
const props = defineProps({ modelValue: String, disabled: Boolean });
const emit = defineEmits(['update:modelValue']);
const el = ref();
const ringStyle = ref({ opacity: 0 });
const ringAnimated = ref(false);
const RING_PAD = 6;
const modes = [
  { id: 'pdf_inspector', icon: '/symbols/bolt.fill.png', label: 'speed' },
  { id: 'pdf_math_fast', icon: '/kernel-modes/balance.svg', label: 'balance' },
  { id: 'pdf_math_precise', icon: '/symbols/sparkles.png', label: 'quality' },
];
function choose(id) {
  if (!props.disabled) emit('update:modelValue', id);
}
function keyboard(event, index) {
  const step =
    event.key === 'ArrowRight' || event.key === 'ArrowDown'
      ? 1
      : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
        ? -1
        : 0;
  const target =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? modes.length - 1
        : step
          ? (index + step + modes.length) % modes.length
          : null;
  if (target === null || props.disabled) return;
  event.preventDefault();
  choose(modes[target].id);
  nextTick(() => el.value?.querySelectorAll('button')[target]?.focus());
}
// The selection ring is one element that slides between tiles. Measuring the
// checked tile keeps it correct for any label width, locale or window size.
function placeRing() {
  const root = el.value;
  const tile = root?.querySelector('button[aria-checked="true"] .kernel-mode-preview');
  if (!tile) {
    ringStyle.value = { opacity: 0 };
    return;
  }
  const a = root.getBoundingClientRect();
  const b = tile.getBoundingClientRect();
  ringStyle.value = {
    width: b.width + RING_PAD * 2 + 'px',
    height: b.height + RING_PAD * 2 + 'px',
    transform: `translate(${b.left - a.left - RING_PAD}px, ${b.top - a.top - RING_PAD}px)`,
  };
}
let observer;
onMounted(() => {
  placeRing();
  if (typeof ResizeObserver === 'undefined') return;
  observer = new ResizeObserver(() => {
    ringAnimated.value = false;
    placeRing();
  });
  observer.observe(el.value);
  el.value.querySelectorAll('button').forEach((button) => observer.observe(button));
});
onBeforeUnmount(() => observer?.disconnect());
watch(
  () => props.modelValue,
  () => {
    ringAnimated.value = true;
    nextTick(placeRing);
  },
);
defineExpose({ el });
</script>
<template>
  <div
    ref="el"
    class="kernel-mode-switcher mac-mode-control"
    :role="platform === 'win32' ? undefined : 'radiogroup'"
    :aria-label="t('settings.mode')"
  >
    <AppSegmentedControl
      v-if="platform === 'win32'"
      class="fluent-kernel-modes"
      :model-value="modelValue"
      :disabled="disabled"
      :aria-label="t('settings.mode')"
      @update:model-value="choose"
    >
      <AppSegment
        v-for="mode in modes"
        :key="mode.id"
        :value="mode.id"
        :disabled="disabled"
        :data-kernel-mode="mode.id"
      >
        <span class="fluent-kernel-label">
          <span class="kernel-mode-preview"
            ><span
              class="system-icon"
              :style="{ '--symbol': 'url(' + mode.icon + ')' }"
              aria-hidden="true"
          /></span>
          <span>{{ t('settings.kernelModes.' + mode.label) }}</span>
        </span>
      </AppSegment>
    </AppSegmentedControl>
    <template v-else
      ><button
        v-for="(mode, index) in modes"
        :key="mode.id"
        type="button"
        role="radio"
        :aria-checked="modelValue === mode.id"
        :tabindex="modelValue === mode.id ? 0 : -1"
        :disabled="disabled"
        :data-kernel-mode="mode.id"
        @click="choose(mode.id)"
        @keydown="keyboard($event, index)"
      >
        <span class="kernel-mode-preview"
          ><span
            class="system-icon"
            :style="{ '--symbol': 'url(' + mode.icon + ')' }"
            aria-hidden="true"
        /></span>
        <span>{{ t('settings.kernelModes.' + mode.label) }}</span>
      </button>
      <span
        class="kernel-mode-ring"
        :class="{ animated: ringAnimated }"
        :style="ringStyle"
        aria-hidden="true"
    /></template>
  </div>
</template>
<style scoped>
.fluent-kernel-modes {
  width: 100%;
}
.fluent-kernel-label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
}
.kernel-mode-switcher {
  position: relative;
  display: flex;
  align-items: start;
  justify-content: flex-end;
  gap: 12px;
  min-width: 0;
  padding: 0;
}
.kernel-mode-switcher button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7px;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  color: var(--text-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.kernel-mode-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border: 0;
  border-radius: 14px;
  corner-shape: squircle;
  background: color-mix(in srgb, var(--text) 8%, transparent);
  box-shadow: none;
}
.kernel-mode-preview .system-icon {
  width: 28px;
  height: 28px;
}
.kernel-mode-switcher button[aria-checked='true'] {
  color: var(--text);
  font-weight: 600;
}
.kernel-mode-switcher button:focus-visible {
  outline: none;
}
.kernel-mode-ring {
  position: absolute;
  top: 0;
  left: 0;
  box-sizing: border-box;
  border: 3px solid var(--accent);
  border-radius: calc(14px + 6px);
  corner-shape: squircle;
  pointer-events: none;
  will-change: transform, width, height;
}
.kernel-mode-ring.animated {
  transition:
    transform 360ms cubic-bezier(0.2, 0.75, 0.25, 1.12),
    width 360ms cubic-bezier(0.2, 0.75, 0.25, 1.12),
    height 360ms cubic-bezier(0.2, 0.75, 0.25, 1.12);
}
@media (prefers-reduced-motion: reduce) {
  .kernel-mode-ring.animated {
    transition: none;
  }
}
.kernel-mode-switcher button:disabled {
  opacity: 0.5;
  cursor: default;
}
@media (max-width: 520px) {
  .kernel-mode-switcher {
    gap: 12px;
    justify-content: flex-start;
  }
  .kernel-mode-switcher button {
    font-size: 11px;
  }
}
</style>
