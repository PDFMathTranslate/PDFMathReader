<script setup>
import { computed, inject, onMounted, ref } from 'vue';
import { AppButton, AppSwitch } from '../../ui/controls.mjs';
import { formulaOcrLabel } from '../reader/formula-ocr-labels.mjs';

const fallbackStatus = {
  ready: false,
  downloading: false,
  downloadedBytes: 0,
  totalBytes: 0,
};
const fallback = {
  enabled: ref(false),
  status: ref(fallbackStatus),
  busy: ref(false),
  error: ref(''),
  enable: async () => {},
  refresh: async () => {},
};
const formulaOcr = inject('formulaOcr', fallback);
const enabled = formulaOcr?.enabled || fallback.enabled;
const status = formulaOcr?.status || fallback.status;
const busy = formulaOcr?.busy || fallback.busy;
const error = formulaOcr?.error || fallback.error;
const labels = computed(() =>
  Object.fromEntries(
    [
      'enabled',
      'hint',
      'download',
      'ready',
      'retry',
      'recognize',
      'recognizing',
      'copied',
      'failed',
      'copyFailed',
      'notReady',
    ].map((key) => [key, formulaOcrLabel(key)]),
  ),
);
const currentStatus = computed(() => status.value || fallbackStatus);
const ready = computed(() => currentStatus.value.ready === true);
const downloading = computed(() => currentStatus.value.downloading === true);
const retryAvailable = computed(
  () => enabled.value && !ready.value && !downloading.value && !busy.value,
);
const downloadedBytes = computed(() =>
  Math.max(0, Number(currentStatus.value.downloadedBytes) || 0),
);
const totalBytes = computed(() => Math.max(0, Number(currentStatus.value.totalBytes) || 0));
const progress = computed(() =>
  totalBytes.value > 0
    ? Math.min(100, Math.max(0, Math.round((downloadedBytes.value / totalBytes.value) * 100)))
    : 0,
);
const bytesLabel = computed(() => {
  const downloaded = formatBytes(downloadedBytes.value);
  return totalBytes.value ? `${downloaded} / ${formatBytes(totalBytes.value)}` : downloaded;
});

function formatBytes(bytes) {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let amount = bytes;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${unit === 0 || amount >= 10 ? Math.round(amount) : amount.toFixed(1)} ${units[unit]}`;
}

async function setEnabled(value) {
  try {
    await formulaOcr?.enable?.(Boolean(value));
  } catch {
    // The provider exposes the failure through its reactive error value.
  }
}

async function retry() {
  try {
    await formulaOcr?.enable?.(true);
  } catch {
    // The provider exposes the failure through its reactive error value.
  }
}

onMounted(() => {
  void formulaOcr?.refresh?.().catch?.(() => {});
});
</script>

<template>
  <div class="formula-ocr-settings" data-setting="formula-ocr">
    <div class="setting-row">
      <span id="formula-ocr-enabled-label">{{ labels.enabled }}</span>
      <AppSwitch
        :model-value="enabled"
        :disabled="busy"
        aria-labelledby="formula-ocr-enabled-label"
        aria-describedby="formula-ocr-hint"
        @update:model-value="setEnabled"
      />
    </div>
    <p id="formula-ocr-hint" class="muted">{{ labels.hint }}</p>
    <div v-if="downloading" class="formula-ocr-download" role="status">
      <div class="formula-ocr-download-label">
        <span>{{ labels.download }}</span>
        <span>{{ bytesLabel }} · {{ progress }}%</span>
      </div>
      <div
        class="formula-ocr-progress"
        role="progressbar"
        :aria-label="labels.download"
        :aria-valuenow="progress"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <span :style="{ width: `${progress}%` }"></span>
      </div>
    </div>
    <p v-else-if="ready" class="muted formula-ocr-ready" role="status">{{ labels.ready }}</p>
    <p v-if="error" class="formula-ocr-error" role="alert">{{ error }}</p>
    <div v-if="error || retryAvailable" class="formula-ocr-actions">
      <AppButton size="small" :disabled="busy" @click="retry">{{ labels.retry }}</AppButton>
    </div>
  </div>
</template>

<style scoped>
.formula-ocr-settings {
  display: grid;
  gap: 8px;
}
.formula-ocr-settings > .muted {
  margin: 0;
  line-height: 1.45;
}
.formula-ocr-download {
  display: grid;
  gap: 6px;
  padding-top: 2px;
}
.formula-ocr-download-label {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-tertiary);
  font-size: 11px;
  line-height: 1.4;
}
.formula-ocr-progress {
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 16%, transparent);
}
.formula-ocr-progress > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--accent);
  transition: width 160ms ease;
}
.formula-ocr-ready {
  color: var(--text-secondary);
}
.formula-ocr-error {
  margin: 0;
  color: var(--text);
  font-size: 11px;
  line-height: 1.45;
}
.formula-ocr-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
