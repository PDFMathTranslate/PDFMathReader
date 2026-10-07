<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { AppButton, AppSwitch, AppPopUpButton, AppPopUpButtonItem } from '../../ui/controls.mjs';
import { t, uiLanguage } from '../../i18n/index.mjs';
const props = defineProps({
  reduceResourceUsage: Boolean,
  reduceBackgroundFrameRate: { type: Boolean, default: true },
});
const emit = defineEmits(['update:reduceResourceUsage', 'update:reduceBackgroundFrameRate']);
const words = {
  en: [
    'Resources',
    'Cache size limit',
    'Unlimited',
    'Clear cache',
    'Cache cleared',
    'Cache in use. Try again after translation finishes.',
  ],
  'zh-CN': [
    '资源',
    '缓存大小限制',
    '无限制',
    '清除缓存',
    '缓存已清除',
    '缓存正在使用，请在翻译完成后重试。',
  ],
  'zh-TW': [
    '資源',
    '快取大小限制',
    '無限制',
    '清除快取',
    '快取已清除',
    '快取正在使用，請在翻譯完成後重試。',
  ],
  ja: [
    'リソース',
    'キャッシュ容量の上限',
    '無制限',
    'キャッシュを消去',
    'キャッシュを消去しました',
    '翻訳完了後に再試行してください。',
  ],
  ko: [
    '리소스',
    '캐시 용량 제한',
    '무제한',
    '캐시 지우기',
    '캐시를 지웠습니다',
    '번역 완료 후 다시 시도하세요.',
  ],
  fr: [
    'Ressources',
    'Limite du cache',
    'Illimitée',
    'Vider le cache',
    'Cache vidé',
    'Réessayez après la traduction.',
  ],
  es: [
    'Recursos',
    'Límite de caché',
    'Sin límite',
    'Borrar caché',
    'Caché borrada',
    'Inténtalo después de la traducción.',
  ],
};
const text = (i) => (words[uiLanguage.value] || words.en)[i];
const backgroundLabels = {
  en: 'Reduce rendering frame rate in background',
  'zh-CN': '后台时降低渲染帧率',
  'zh-TW': '背景時降低繪製影格率',
  ja: 'バックグラウンドで描画フレームレートを下げる',
  ko: '백그라운드에서 렌더링 프레임 속도 낮추기',
  fr: 'Réduire la fréquence de rendu en arrière-plan',
  es: 'Reducir los FPS de renderizado en segundo plano',
};
const backgroundLabel = computed(() => backgroundLabels[uiLanguage.value] || backgroundLabels.en);
const documentWords = {
  en: ['Largest document caches', 'Clear document cache', 'Cached document', 'No document caches'],
  'zh-CN': ['占用最大的文档缓存', '清除该文档缓存', '缓存文档', '暂无文档缓存'],
  'zh-TW': ['最大的文件快取', '清除此文件快取', '快取文件', '暫無文件快取'],
  ja: [
    '容量の大きい文書キャッシュ',
    '文書キャッシュを消去',
    'キャッシュ文書',
    '文書キャッシュなし',
  ],
  ko: ['가장 큰 문서 캐시', '문서 캐시 지우기', '캐시 문서', '문서 캐시 없음'],
  fr: [
    'Caches de documents les plus volumineux',
    'Vider ce cache',
    'Document en cache',
    'Aucun cache de document',
  ],
  es: [
    'Cachés de documentos más grandes',
    'Borrar caché del documento',
    'Documento en caché',
    'Sin cachés de documentos',
  ],
};
const documentText = (i) => (documentWords[uiLanguage.value] || documentWords.en)[i];
const documentSize = (value) =>
  new Intl.NumberFormat(uiLanguage.value, { maximumFractionDigits: 1 }).format(
    value / (1024 * 1024),
  ) + ' MB';
function applyCache(result) {
  bytes.value = result.bytes;
  documents.value = Array.isArray(result.documents) ? result.documents.slice(0, 5) : [];
}
async function clearDocument(id) {
  if (busy.value) return;
  busy.value = true;
  notice.value = '';
  try {
    await request('/document/clear', { id });
    await refresh();
    notice.value = text(4);
  } catch (error) {
    notice.value = error.message;
  } finally {
    busy.value = false;
  }
}
const choices = [
  ['512', '512 MB'],
  ['1024', '1 GB'],
  ['2048', '2 GB'],
  ['5120', '5 GB'],
  ['10240', '10 GB'],
  ['unlimited', null],
];
const documents = ref([]);
const limit = ref('unlimited'),
  bytes = ref(0),
  busy = ref(false),
  notice = ref('');
const usage = computed(
  () =>
    new Intl.NumberFormat(uiLanguage.value, { maximumFractionDigits: 1 }).format(
      bytes.value / (1024 * 1024),
    ) + ' MB',
);
let unsubscribe,
  disposed = false;
async function request(path, body) {
  const response = await fetch('/api/cache' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const error = Error(response.status === 409 ? text(5) : 'Unable to manage cache');
    throw error;
  }
  return response.json();
}
async function refresh() {
  try {
    const result = await request('');
    if (!disposed) {
      applyCache(result);
      limit.value = result.limitMB === null ? 'unlimited' : String(result.limitMB);
    }
  } catch {}
}
async function change(value) {
  if (busy.value) return;
  busy.value = true;
  notice.value = '';
  const previous = limit.value;
  try {
    const limitMB = value === 'unlimited' ? null : Number(value);
    const result = await request('/limit', { limitMB });
    await window.previewPreferences?.save({ cacheLimitMB: limitMB });
    limit.value = value;
    applyCache(result);
    await refresh();
  } catch (error) {
    limit.value = previous;
    notice.value = error.message;
  } finally {
    busy.value = false;
  }
}
async function clear() {
  if (busy.value) return;
  busy.value = true;
  notice.value = '';
  try {
    const result = window.previewCache
      ? await window.previewCache.clear()
      : await request('/clear', {});
    applyCache(result);
    await refresh();
    notice.value = text(4);
  } catch (error) {
    notice.value = error.message.includes('409') ? text(5) : error.message;
  } finally {
    busy.value = false;
  }
}
onMounted(() => {
  void refresh();
  unsubscribe = window.previewPreferences?.onChange((value) => {
    if (Object.hasOwn(value, 'cacheLimitMB'))
      limit.value = value.cacheLimitMB === null ? 'unlimited' : String(value.cacheLimitMB);
  });
});
onBeforeUnmount(() => {
  disposed = true;
  unsubscribe?.();
});
</script>
<template>
  <section class="settings-section performance-resources" aria-labelledby="settings-resources">
    <h3 id="settings-resources">{{ text(0) }}</h3>
    <div class="settings-section-body">
      <div class="setting-row" data-setting="reduce-resource-usage">
        <span id="reduce-resource-usage-label">{{ t('settings.reduceResourceUsage') }}</span
        ><AppSwitch
          :model-value="props.reduceResourceUsage"
          aria-labelledby="reduce-resource-usage-label"
          @update:model-value="emit('update:reduceResourceUsage', $event)"
        />
      </div>
      <p class="muted">{{ t('settings.reduceResourceUsageHint') }}</p>
      <div class="setting-row" data-setting="reduce-background-frame-rate">
        <span id="reduce-background-frame-rate-label">{{ backgroundLabel }}</span
        ><AppSwitch
          :model-value="props.reduceBackgroundFrameRate"
          aria-labelledby="reduce-background-frame-rate-label"
          @update:model-value="emit('update:reduceBackgroundFrameRate', $event)"
        />
      </div>
      <div class="setting-row" data-setting="cache-size-limit">
        <span id="cache-size-limit-label">{{ text(1) }}</span
        ><AppPopUpButton
          :model-value="limit"
          :disabled="busy"
          teleport-to="body"
          aria-labelledby="cache-size-limit-label"
          @update:model-value="change"
          ><AppPopUpButtonItem v-for="[value, label] in choices" :key="value" :value="value">{{
            label || text(2)
          }}</AppPopUpButtonItem></AppPopUpButton
        >
      </div>
      <div class="setting-row cache-actions">
        <span class="muted">{{ usage }}</span
        ><AppButton :disabled="busy" @click="clear">{{ text(3) }}</AppButton>
      </div>
      <div class="document-cache-list" aria-labelledby="document-cache-heading">
        <h4 id="document-cache-heading">{{ documentText(0) }}</h4>
        <div v-for="entry in documents" :key="entry.id" class="document-cache-row">
          <span class="document-cache-name" :title="entry.name || documentText(2)">{{
            entry.name || documentText(2) + ' ' + entry.id.slice(0, 8)
          }}</span>
          <span class="muted document-cache-size">{{ documentSize(entry.bytes) }}</span>
          <AppButton
            :disabled="busy"
            :aria-label="documentText(1) + '：' + (entry.name || documentText(2))"
            @click="clearDocument(entry.id)"
            >{{ documentText(1) }}</AppButton
          >
        </div>
        <p v-if="!documents.length" class="muted">{{ documentText(3) }}</p>
      </div>
      <p v-if="notice" class="muted" role="status">{{ notice }}</p>
    </div>
  </section>
</template>
<style scoped>
.document-cache-list {
  display: grid;
  gap: 8px;
  padding: 12px 0 8px;
  border-top: 1px solid var(--chrome-divider);
}
.document-cache-list h4 {
  margin: 0;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}
.document-cache-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 12px;
  padding-block: 6px;
}
.document-cache-name {
  min-width: 0;
  overflow-wrap: anywhere;
  user-select: text;
}
.document-cache-size {
  white-space: nowrap;
}
@media (max-width: 600px) {
  .document-cache-row {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .document-cache-row > .macvue-button {
    grid-column: 1 / -1;
    justify-self: end;
  }
}
.cache-actions {
  border-top: 1px solid var(--chrome-divider);
}
</style>
