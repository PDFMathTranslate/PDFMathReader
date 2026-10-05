<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { uiLanguage } from './i18n.mjs';
import { formatDebugLog } from './debug-log-filter.mjs';
const props = defineProps({
  engine: String,
  debugEnabled: Boolean,
  active: { type: Boolean, default: true },
});
const labels = {
  en: [
    'Recent debug logs',
    'Regex filter',
    'error|timeout or /pattern/i',
    'Invalid regular expression. Showing all logs.',
    'Expression took too long. Use a simpler pattern.',
    'No recent logs.',
    'No matching logs.',
    'Could not load debug logs.',
    'Filtered logs',
  ],
  'zh-CN': [
    '最近调试日志',
    '正则过滤',
    'error|timeout 或 /pattern/i',
    '正则表达式无效，显示全部日志。',
    '匹配耗时过长，请简化表达式。',
    '暂无最近调试日志。',
    '没有匹配的日志。',
    '无法加载调试日志。',
    '过滤后的日志',
  ],
  'zh-TW': [
    '最近除錯記錄',
    '正則篩選',
    'error|timeout 或 /pattern/i',
    '正則運算式無效，顯示所有記錄。',
    '比對時間過長，請簡化運算式。',
    '暫無最近除錯記錄。',
    '沒有符合的記錄。',
    '無法載入除錯記錄。',
    '篩選後的記錄',
  ],
  ja: [
    '最近のデバッグログ',
    '正規表現フィルター',
    'error|timeout または /pattern/i',
    '正規表現が無効です。すべてのログを表示します。',
    '照合が遅すぎます。式を簡単にしてください。',
    '最近のログはありません。',
    '一致するログはありません。',
    'ログを読み込めませんでした。',
    '絞り込んだログ',
  ],
  ko: [
    '최근 디버그 로그',
    '정규식 필터',
    'error|timeout 또는 /pattern/i',
    '잘못된 정규식입니다. 모든 로그를 표시합니다.',
    '검색이 너무 오래 걸립니다. 표현식을 단순화하세요.',
    '최근 로그가 없습니다.',
    '일치하는 로그가 없습니다.',
    '로그를 불러올 수 없습니다.',
    '필터링된 로그',
  ],
  fr: [
    'Journaux de débogage récents',
    'Filtre regex',
    'error|timeout ou /pattern/i',
    'Expression invalide. Tous les journaux sont affichés.',
    'Expression trop lente. Simplifiez-la.',
    'Aucun journal récent.',
    'Aucun journal correspondant.',
    'Impossible de charger les journaux.',
    'Journaux filtrés',
  ],
  es: [
    'Registros de depuración recientes',
    'Filtro regex',
    'error|timeout o /pattern/i',
    'Expresión no válida. Se muestran todos los registros.',
    'La expresión tarda demasiado. Simplifícala.',
    'Sin registros recientes.',
    'Sin registros coincidentes.',
    'No se pudieron cargar los registros.',
    'Registros filtrados',
  ],
};
const text = (index) => (labels[uiLanguage.value] || labels.en)[index];
const developerEnabled = ref(false),
  pageVisible = ref(document.visibilityState !== 'hidden');
const events = ref([]),
  pattern = ref(''),
  indices = ref([]),
  filterError = ref(''),
  loadError = ref(false);
const enabled = computed(() => props.debugEnabled || developerEnabled.value);
const polling = computed(() => enabled.value && props.active && pageVisible.value);
const lines = computed(() => events.value.map(formatDebugLog));
const output = computed(() =>
  indices.value
    .map((index) => lines.value[index])
    .filter((line) => line !== undefined)
    .join('\n'),
);
let timer,
  filterTimer,
  worker,
  workerTimer,
  controller,
  unsubscribe,
  disposed = false,
  requestId = 0,
  filterId = 0;
function stopFilter() {
  clearTimeout(filterTimer);
  clearTimeout(workerTimer);
  worker?.terminate();
  worker = null;
  filterId++;
}
function applyFilter() {
  stopFilter();
  filterError.value = '';
  if (!polling.value) {
    indices.value = [];
    return;
  }
  if (!pattern.value.trim()) {
    indices.value = lines.value.map((_, index) => index);
    return;
  }
  const current = filterId;
  filterTimer = setTimeout(() => {
    try {
      worker = new Worker(new URL('./debug-log-filter.worker.mjs', import.meta.url), {
        type: 'module',
      });
      const failed = (reason) => {
        if (current !== filterId || disposed) return;
        worker?.terminate();
        worker = null;
        clearTimeout(workerTimer);
        filterError.value = reason;
        indices.value = lines.value.map((_, index) => index);
      };
      worker.onmessage = ({ data }) => {
        if (current !== filterId || disposed) return;
        clearTimeout(workerTimer);
        worker?.terminate();
        worker = null;
        if (data.error) failed('invalid');
        else indices.value = data.indices;
      };
      worker.onerror = () => failed('invalid');
      workerTimer = setTimeout(() => failed('timeout'), 1000);
      worker.postMessage({ lines: lines.value, pattern: pattern.value });
    } catch {
      filterError.value = 'invalid';
      indices.value = lines.value.map((_, index) => index);
    }
  }, 150);
}
watch([lines, pattern, polling], applyFilter, { immediate: true });
function stopPolling() {
  requestId++;
  clearTimeout(timer);
  controller?.abort();
  controller = null;
}
async function refresh() {
  if (!polling.value || disposed) return;
  const id = ++requestId;
  controller = new AbortController();
  try {
    const response = await fetch(
      '/api/developer/recent-logs?' + new URLSearchParams({ engine: props.engine }),
      { signal: controller.signal },
    );
    if (!response.ok) throw Error('Unavailable');
    const data = await response.json();
    if (id !== requestId || disposed) return;
    const next = Array.isArray(data.events) ? data.events.slice(-200) : [];
    if (JSON.stringify(next) !== JSON.stringify(events.value)) events.value = next;
    loadError.value = false;
  } catch (error) {
    if (id === requestId && !disposed && error.name !== 'AbortError') loadError.value = true;
  } finally {
    if (id === requestId && !disposed && polling.value) timer = setTimeout(refresh, 1000);
  }
}
watch(
  [polling, () => props.engine],
  () => {
    stopPolling();
    events.value = [];
    loadError.value = false;
    if (polling.value) void refresh();
  },
  { immediate: true },
);
function visibility() {
  pageVisible.value = document.visibilityState !== 'hidden';
}
onMounted(async () => {
  document.addEventListener('visibilitychange', visibility);
  const bridge = window.previewDeveloper;
  if (!bridge) return;
  unsubscribe = bridge.onChange?.((value) => {
    developerEnabled.value = value === true;
  });
  try {
    const value = await bridge.enabled();
    if (!disposed) developerEnabled.value = value === true;
  } catch {}
});
onBeforeUnmount(() => {
  disposed = true;
  stopPolling();
  stopFilter();
  unsubscribe?.();
  document.removeEventListener('visibilitychange', visibility);
});
</script>
<template>
  <section v-if="enabled" class="recent-debug-logs" aria-labelledby="recent-debug-logs-title">
    <div class="debug-log-heading">
      <h3 id="recent-debug-logs-title">{{ text(0) }}</h3>
      <span class="debug-log-count">{{ indices.length }} / {{ events.length }}</span>
    </div>
    <label class="debug-log-filter"
      ><span>{{ text(1) }}</span
      ><input
        v-model="pattern"
        type="search"
        :placeholder="text(2)"
        :aria-invalid="!!filterError"
        :aria-describedby="filterError ? 'debug-log-filter-error' : undefined"
        autocomplete="off"
        spellcheck="false"
    /></label>
    <p v-if="filterError" id="debug-log-filter-error" class="debug-log-notice" role="status">
      {{ text(filterError === 'timeout' ? 4 : 3) }}
    </p>
    <p v-if="loadError" class="debug-log-notice" role="status">{{ text(7) }}</p>
    <pre
      v-if="output"
      class="debug-log-output"
      tabindex="0"
      :aria-label="text(8)"
    ><span v-for="index in indices" :key="`${events[index]?.id}:${events[index]?.time}:${events[index]?.kind}`">{{lines[index]+'\n'}}</span></pre>
    <p v-else class="debug-log-empty">{{ text(events.length ? 6 : 5) }}</p>
  </section>
</template>
<style scoped>
.recent-debug-logs {
  margin-top: 18px;
  padding-top: 16px;
  border-top: 1px solid color-mix(in srgb, currentColor 12%, transparent);
  color: var(--text-secondary, #6e6e73);
}
.debug-log-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}
.debug-log-heading h3 {
  margin: 0;
  color: inherit;
  font-size: 12px;
  font-weight: 600;
}
.debug-log-count {
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.debug-log-filter {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
}
.debug-log-filter input {
  flex: 1;
  min-width: 0;
  padding: 6px 9px;
  border: 1px solid color-mix(in srgb, currentColor 22%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, currentColor 4%, transparent);
  color: inherit;
  font: inherit;
}
.recent-debug-logs .debug-log-output {
  margin: 12px 0 0;
  max-height: 240px;
  overflow: auto;
  padding: 10px 12px;
  border-radius: 9px;
  background: color-mix(in srgb, currentColor 4%, transparent);
  color: inherit;
  font:
    11px/1.65 ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  cursor: text;
  -webkit-user-select: text;
  user-select: text;
  overscroll-behavior: contain;
}
.recent-debug-logs .debug-log-output span {
  -webkit-user-select: text;
  user-select: text;
}
.debug-log-notice,
.debug-log-empty {
  margin: 10px 0 0;
  color: inherit;
  font-size: 11px;
  line-height: 1.5;
}
.debug-log-filter input:focus-visible,
.debug-log-output:focus-visible {
  outline: 2px solid var(--accent, #007aff);
  outline-offset: 3px;
}
@media (prefers-color-scheme: dark) {
  .recent-debug-logs {
    color: var(--text-secondary, #a1a1a6);
  }
}
@media (prefers-contrast: more) {
  .debug-log-filter input {
    border-color: currentColor;
  }
  .debug-log-output {
    outline: 1px solid currentColor;
  }
}
</style>
