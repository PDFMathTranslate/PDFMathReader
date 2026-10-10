<script setup>
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import {
  AppButton,
  AppPopUpButton,
  AppPopUpButtonItem,
  AppSwitch,
  AppTextField,
  platform,
} from '../../ui/controls.mjs';
import { t, advancedOptionText, advancedChoiceText } from '../../i18n/index.mjs';
import DeveloperOptions from '../developer/DeveloperOptions.vue';
import RecentDebugLogs from '../developer/RecentDebugLogs.vue';
import { GPU_INFERENCE_OPTION } from '../../../shared/gpu-inference.mjs';

const SUPPORTED_ENGINES = ['pdf_math_fast', 'pdf_math_precise'];
const INVALID = Symbol('invalid-advanced-value');
const SERVICE_OPTIONS = ['prompt', 'custom_system_prompt'];
const props = defineProps({
  engine: { type: String, default: '' },
  engineState: { type: Object, default: null },
  inline: Boolean,
  showDeveloper: { type: Boolean, default: true },
  installing: Boolean,
  uvAvailable: Boolean,
  modelValue: { type: Object, default: () => ({}) },
});
const emit = defineEmits(['update:modelValue', 'reinstall']);
const options = ref([]),
  busy = ref(false),
  message = ref(''),
  expanded = ref(props.inline);
let generation = 0,
  requestController;
const eligible = computed(() => SUPPORTED_ENGINES.includes(props.engine));
const values = computed(() => {
  const value = props.modelValue?.[props.engine];
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
});
const schemaKey = computed(() =>
  JSON.stringify({
    engine: props.engine,
    installing: props.installing,
    expanded: expanded.value,
    available: props.engineState?.available === true,
    installed: props.engineState?.installed === true,
    version: props.engineState?.version || '',
    reason: props.engineState?.reason || '',
  }),
);

function sameValue(left, right, type) {
  if (type === 'number') return Number(left) === Number(right);
  if (type === 'boolean') return Boolean(left) === Boolean(right);
  return String(left ?? '') === String(right ?? '');
}

function normalize(option, value, { emptyToDefault = true } = {}) {
  if (!option || !['boolean', 'number', 'string'].includes(option.type)) return INVALID;
  if (option.type === 'boolean') return typeof value === 'boolean' ? value : INVALID;
  if (option.type === 'number') {
    if (value === '' || value === null || value === undefined) {
      if (!emptyToDefault) return INVALID;
      value = option.default;
    }
    const number = Number(value);
    if (
      !Number.isFinite(number) ||
      (option.integer && !Number.isInteger(number)) ||
      (option.min !== undefined && number < option.min) ||
      (option.max !== undefined && number > option.max)
    )
      return INVALID;
    if (option.choices?.length && !option.choices.some((choice) => Number(choice) === number))
      return INVALID;
    return number;
  }
  const string = String(value ?? '');
  if (!string && !emptyToDefault) return INVALID;
  if (option.choices?.length && !option.choices.some((choice) => String(choice) === string))
    return INVALID;
  return string;
}

function sanitize(raw) {
  const next = Object.fromEntries(
    Object.entries(raw || {}).filter(([id]) => SERVICE_OPTIONS.includes(id)),
  );
  for (const option of options.value) {
    if (!Object.prototype.hasOwnProperty.call(raw || {}, option.id)) continue;
    const value = normalize(option, raw[option.id], { emptyToDefault: false });
    if (value === INVALID || value === '' || sameValue(value, option.default, option.type))
      continue;
    next[option.id] = value;
  }
  return next;
}

function sameMap(left, right) {
  const leftKeys = Object.keys(left || {}).sort(),
    rightKeys = Object.keys(right || {}).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) => key === rightKeys[index] && left[key] === right[key])
  );
}

function effectiveValue(option) {
  const value = values.value[option.id];
  return value === undefined || value === '' ? option.default : value;
}

const hasOverrides = computed(() =>
  Object.keys(sanitize(values.value)).some((id) => !SERVICE_OPTIONS.includes(id)),
);

function emitValues(nextValues) {
  const nextMap = {
    ...(props.modelValue && typeof props.modelValue === 'object' ? props.modelValue : {}),
  };
  nextMap[props.engine] = nextValues;
  emit('update:modelValue', nextMap);
}

function update(option, value) {
  const nextValue = normalize(option, value);
  if (nextValue === INVALID) return;
  const next = option.id === 'prefer_gpu' ? { ...values.value } : sanitize(values.value);
  if (nextValue === '' || sameValue(nextValue, option.default, option.type)) delete next[option.id];
  else next[option.id] = nextValue;
  emitValues(next);
}

function reset() {
  emitValues(
    Object.fromEntries(Object.entries(values.value).filter(([id]) => SERVICE_OPTIONS.includes(id))),
  );
}

function normalizeSchema(raw) {
  const seen = new Set(),
    next = [];
  for (const option of Array.isArray(raw) ? raw : []) {
    if (
      !option ||
      typeof option.id !== 'string' ||
      !option.id ||
      ['lang_in', 'lang_out', ...SERVICE_OPTIONS].includes(option.id) ||
      seen.has(option.id) ||
      !['boolean', 'number', 'string'].includes(option.type)
    )
      continue;
    seen.add(option.id);
    next.push({
      id: option.id,
      label: typeof option.label === 'string' && option.label ? option.label : option.id,
      type: option.type,
      default: option.default,
      help: typeof option.help === 'string' ? option.help : '',
      choices: Array.isArray(option.choices) ? option.choices : undefined,
      integer: option.integer === true,
      min: option.min,
      max: option.max,
    });
  }
  return next;
}

watch(
  schemaKey,
  async () => {
    const token = ++generation;
    requestController?.abort();
    options.value = eligible.value && expanded.value ? [{ ...GPU_INFERENCE_OPTION }] : [];
    message.value = '';
    busy.value = false;
    if (!eligible.value || !expanded.value || props.installing) return;
    if (!props.engineState?.available) {
      message.value = props.engineState?.reason || '';
      return;
    }
    busy.value = true;
    const controller = new AbortController();
    requestController = controller;
    try {
      let result;
      do {
        const response = await fetch('/api/engines/' + props.engine + '/advanced', {
          signal: controller.signal,
        });
        result = await response.json();
        if (!response.ok) throw Error(result.error || 'Advanced options unavailable.');
        if (result.pending)
          await new Promise((resolve) => {
            const done = () => {
              clearTimeout(timer);
              controller.signal.removeEventListener('abort', done);
              resolve();
            };
            const timer = setTimeout(done, 500);
            controller.signal.addEventListener('abort', done, { once: true });
          });
      } while (result.pending && token === generation && !controller.signal.aborted);
      if (token === generation) {
        options.value = normalizeSchema([GPU_INFERENCE_OPTION, ...result.options]);
        if (!result.reason) {
          const normalized = sanitize(values.value);
          if (!sameMap(values.value, normalized)) emitValues(normalized);
        }
        message.value = result.reason || '';
      }
    } catch (error) {
      if (token === generation && error.name !== 'AbortError') message.value = error.message;
    } finally {
      if (token === generation) busy.value = false;
    }
  },
  { immediate: true },
);
watch(
  () => props.engine,
  () => {
    expanded.value = props.inline;
  },
);
onBeforeUnmount(() => {
  generation++;
  requestController?.abort();
  requestController = undefined;
});
</script>

<template>
  <component
    :is="inline ? 'section' : 'details'"
    :key="engine"
    :open="inline ? undefined : expanded"
    class="settings-section advanced-settings"
    :aria-labelledby="inline ? 'settings-mode-options' : undefined"
    @toggle="expanded = $event.target.open"
  >
    <summary v-if="!inline">{{ t('advanced.section') }}</summary>
    <h3 v-else id="settings-mode-options">{{ t('settings.modeSettings') }}</h3>
    <div class="advanced-options">
      <DeveloperOptions v-if="showDeveloper" embedded />
      <p v-if="engine === 'pdf_inspector'" class="muted">
        {{ t('settings.kernelNoManualConfiguration') }}
      </p>
      <p v-if="busy" class="muted" role="status">{{ t('advanced.loading') }}</p>
      <p v-else-if="message" class="muted" role="status">{{ message }}</p>
      <div
        v-for="option in options"
        :key="option.id"
        class="advanced-option"
        :data-advanced-option="option.id"
      >
        <div class="setting-row">
          <label :id="'advanced-' + option.id" :for="'advanced-input-' + option.id">{{
            advancedOptionText(option, 'label')
          }}</label>
          <AppSwitch
            v-if="option.type === 'boolean'"
            :model-value="effectiveValue(option)"
            :aria-labelledby="'advanced-' + option.id"
            @update:model-value="update(option, $event)"
          />
          <AppPopUpButton
            v-else-if="option.choices?.length"
            :model-value="String(effectiveValue(option))"
            :aria-labelledby="'advanced-' + option.id"
            teleport-to="body"
            @update:model-value="update(option, $event)"
          >
            <AppPopUpButtonItem
              v-for="choice in option.choices"
              :key="String(choice)"
              :value="String(choice)"
              >{{ advancedChoiceText(option, choice) }}</AppPopUpButtonItem
            >
          </AppPopUpButton>
          <AppTextField
            v-else-if="option.type === 'number' && platform === 'win32'"
            :id="'advanced-input-' + option.id"
            type="number"
            :model-value="String(effectiveValue(option))"
            :min="option.min"
            :max="option.max"
            :step="option.integer ? 1 : 'any'"
            inputmode="decimal"
            :aria-labelledby="'advanced-' + option.id"
            @update:model-value="update(option, $event)"
          />
          <input
            v-else-if="option.type === 'number'"
            :id="'advanced-input-' + option.id"
            type="number"
            :value="effectiveValue(option)"
            :min="option.min"
            :max="option.max"
            :step="option.integer ? 1 : 'any'"
            inputmode="decimal"
            :aria-labelledby="'advanced-' + option.id"
            @change="update(option, $event.target.value)"
          />
        </div>
        <AppTextField
          v-if="option.type === 'string' && !option.choices?.length"
          :id="'advanced-input-' + option.id"
          :model-value="String(effectiveValue(option) ?? '')"
          :aria-labelledby="'advanced-' + option.id"
          @update:model-value="update(option, $event)"
        />
        <p v-if="advancedOptionText(option, 'help')" class="muted">
          {{ advancedOptionText(option, 'help') }}
        </p>
      </div>
      <AppButton
        v-if="options.length && !$slots.maintenance"
        :disabled="!hasOverrides"
        :aria-label="t('advanced.restoreDefaults')"
        @click="reset"
        >{{ t('advanced.restoreDefaults') }}</AppButton
      >
      <RecentDebugLogs
        :engine="engine"
        :debug-enabled="values.debug === true"
        :active="inline || expanded"
      />
      <div
        v-if="!$slots.maintenance"
        class="advanced-kernel-update"
        :class="{ bundled: !eligible }"
      >
        <p v-if="!eligible" class="muted">{{ t('advanced.bundledKernel') }}</p>
        <AppButton
          v-if="eligible || !inline"
          :disabled="installing || !uvAvailable || !eligible"
          :aria-busy="installing"
          @click="emit('reinstall', 'release')"
          >{{ t(installing ? 'advanced.updatingKernel' : 'advanced.reinstallKernel') }}</AppButton
        >
        <AppButton
          v-if="eligible || !inline"
          :disabled="installing || !uvAvailable || !eligible"
          :aria-busy="installing"
          @click="emit('reinstall', 'git')"
          >{{
            t(installing ? 'advanced.updatingKernel' : 'advanced.reinstallKernelGit')
          }}</AppButton
        >
      </div>
    </div>
  </component>
  <slot
    name="maintenance"
    :reset="reset"
    :has-overrides="hasOverrides"
    :has-options="options.length > 0"
    :eligible="eligible"
  />
</template>

<style scoped>
.advanced-kernel-update.bundled {
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
}
</style>
