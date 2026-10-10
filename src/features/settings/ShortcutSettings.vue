<script setup>
import { computed, ref, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { AppButton, platform } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';
import { menuLabel } from '../../../shared/i18n/menu.mjs';
import { shortcutLabels } from './shortcut-labels.mjs';

const bridge = window.previewShortcuts;
const snapshot = ref({ catalog: [], bindings: {}, overrides: {} });
const recording = ref(null),
  busy = ref(false),
  error = ref('');
const labels = computed(() => shortcutLabels(uiLanguage.value));
const groups = computed(() => {
  const entries = snapshot.value.catalog || [];
  const order = [...new Set(entries.map((entry) => entry.group))];
  const translation = order.indexOf('Translation');
  if (translation >= 0) {
    order.splice(translation, 1);
    order.splice(1, 0, 'Translation');
  }
  return order.map((id) => ({
    id,
    label:
      id === 'navigation'
        ? labels.value.navigation
        : menuLabel(id || 'Menu actions', uiLanguage.value),
    entries: entries.filter((entry) => entry.group === id),
  }));
});
const name = (entry) => menuLabel(entry.label, uiLanguage.value);
function display(value) {
  if (!value) return labels.value.unassigned;
  return platform === 'darwin'
    ? value
        .replace(/CommandOrControl|Command/g, '⌘')
        .replace(/Control|Ctrl/g, '⌃')
        .replace(/Alt/g, '⌥')
        .replace(/Shift/g, '⇧')
        .replace(/\+/g, ' ')
    : value.replace(/CommandOrControl/g, 'Ctrl');
}
const binding = (entry) =>
  (snapshot.value.bindings?.[entry.id] || []).map(display).join(' / ') || labels.value.unassigned;
function showError(cause) {
  const conflict = cause?.message?.match(/Shortcut already in use: ([\w:.-]+)/);
  const entry = conflict && snapshot.value.catalog.find((entry) => entry.id === conflict[1]);
  error.value = /conflict|already|reserved|in use/i.test(cause?.message || '')
    ? labels.value.conflict + (entry ? ` ${name(entry)}` : '')
    : labels.value.error;
}
async function stopRecording() {
  recording.value = null;
  await bridge?.recording(false);
}
async function begin(entry) {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await bridge.recording(true);
    recording.value = entry.id;
    await nextTick();
    document.querySelector(`[data-shortcut-record="${entry.id}"]`)?.focus();
  } catch (cause) {
    showError(cause);
  } finally {
    busy.value = false;
  }
}
async function change(id, value, reset = false) {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    await stopRecording();
    snapshot.value = reset ? await bridge.reset(id) : await bridge.save(id, value);
  } catch (cause) {
    showError(cause);
  } finally {
    busy.value = false;
  }
}
async function capture(event) {
  if (!recording.value) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (event.repeat || event.isComposing) return;
  if (event.key === 'Escape') {
    await stopRecording();
    return;
  }
  if (['Meta', 'Control', 'Alt', 'Shift', 'Dead', 'Unidentified'].includes(event.key)) return;
  const aliases = {
    ' ': 'Space',
    '+': 'Plus',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
  };
  const key =
    aliases[event.key] ||
    (/^Digit\d$/.test(event.code)
      ? event.code.slice(-1)
      : event.key.length === 1
        ? event.key.toUpperCase()
        : event.key);
  const value = [
    ...(event.metaKey ? ['Command'] : []),
    ...(event.ctrlKey ? ['Control'] : []),
    ...(event.altKey ? ['Alt'] : []),
    ...(event.shiftKey ? ['Shift'] : []),
    key,
  ].join('+');
  await change(recording.value, value);
}
let unsubscribe;
function cancelOnBlur() {
  if (recording.value) void stopRecording().catch(showError);
}
onMounted(async () => {
  document.addEventListener('keydown', capture, true);
  window.addEventListener('blur', cancelOnBlur);
  if (!bridge) return;
  unsubscribe = bridge.onChange?.((value) => {
    snapshot.value = value;
  });
  try {
    snapshot.value = await bridge.load();
  } catch (cause) {
    showError(cause);
  }
});
onBeforeUnmount(() => {
  document.removeEventListener('keydown', capture, true);
  window.removeEventListener('blur', cancelOnBlur);
  unsubscribe?.();
  void bridge?.recording(false).catch(() => {});
});
</script>

<template>
  <div class="shortcut-settings">
    <p v-if="error" role="alert" class="shortcut-error">{{ error }}</p>
    <section v-for="group in groups" :key="group.id" class="settings-section">
      <h3>{{ group.label }}</h3>
      <div class="settings-section-body">
        <div
          v-for="entry in group.entries"
          :key="entry.id"
          class="setting-row shortcut-row"
          :data-shortcut="entry.id"
        >
          <span :id="`shortcut-label-${entry.id}`">{{ name(entry) }}</span>
          <div class="shortcut-controls">
            <AppButton
              :data-shortcut-record="entry.id"
              :aria-labelledby="`shortcut-label-${entry.id}`"
              :aria-pressed="recording === entry.id"
              :disabled="busy"
              class="shortcut-binding"
              @click="begin(entry)"
              >{{ recording === entry.id ? labels.record : binding(entry) }}</AppButton
            >
            <AppButton
              :disabled="busy || !snapshot.bindings?.[entry.id]?.length"
              :aria-label="`${labels.clear}: ${name(entry)}`"
              @click="change(entry.id, null)"
              >{{ labels.clear }}</AppButton
            >
            <AppButton
              :disabled="busy || !Object.hasOwn(snapshot.overrides || {}, entry.id)"
              :aria-label="`${labels.reset}: ${name(entry)}`"
              @click="change(entry.id, undefined, true)"
              >{{ labels.reset }}</AppButton
            >
          </div>
        </div>
      </div>
    </section>
    <div v-if="bridge" class="shortcut-global-actions">
      <AppButton :disabled="busy" @click="change(undefined, undefined, true)">{{
        labels.resetAll
      }}</AppButton>
      <AppButton v-if="recording" :disabled="busy" @click="stopRecording">{{
        labels.cancel
      }}</AppButton>
    </div>
  </div>
</template>

<style scoped>
.shortcut-global-actions,
.shortcut-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.shortcut-global-actions {
  justify-content: flex-end;
  margin: 24px 0 0;
}
.shortcut-row {
  display: flex;
  justify-content: space-between;
}
.shortcut-controls {
  justify-content: flex-end;
  margin-inline-start: auto;
}
.shortcut-binding {
  min-width: 150px;
  font-variant-numeric: tabular-nums;
}
.shortcut-binding[aria-pressed='true'] {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.shortcut-error {
  color: var(--text);
  border-inline-start: 3px solid var(--accent);
  padding-inline-start: 10px;
}
@media (max-width: 700px) {
  .shortcut-row {
    flex-wrap: wrap;
  }
  .shortcut-controls {
    width: 100%;
  }
}
</style>
