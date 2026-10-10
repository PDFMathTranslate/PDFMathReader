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
    'Cache',
    'Cache size limit',
    'Unlimited',
    'Clear cache',
    'Open cache folder',
    'Cache cleared',
    'Cache in use. Try again after translation finishes.',
    'Unable to open cache folder',
  ],
  'zh-CN': [
    '资源',
    '缓存',
    '缓存大小限制',
    '无限制',
    '清除缓存',
    '打开缓存文件夹',
    '缓存已清除',
    '缓存正在使用，请在翻译完成后重试。',
    '无法打开缓存文件夹',
  ],
  'zh-TW': [
    '資源',
    '快取',
    '快取大小限制',
    '無限制',
    '清除快取',
    '開啟快取資料夾',
    '快取已清除',
    '快取正在使用，請在翻譯完成後重試。',
    '無法開啟快取資料夾',
  ],
  ja: [
    'リソース',
    'キャッシュ',
    'キャッシュ容量の上限',
    '無制限',
    'キャッシュを消去',
    'キャッシュフォルダを開く',
    'キャッシュを消去しました',
    '翻訳完了後に再試行してください。',
    'キャッシュフォルダを開けません',
  ],
  ko: [
    '리소스',
    '캐시',
    '캐시 용량 제한',
    '무제한',
    '캐시 지우기',
    '캐시 폴더 열기',
    '캐시를 지웠습니다',
    '번역 완료 후 다시 시도하세요.',
    '캐시 폴더를 열 수 없습니다',
  ],
  fr: [
    'Ressources',
    'Cache',
    'Limite du cache',
    'Illimitée',
    'Vider le cache',
    'Ouvrir le dossier du cache',
    'Cache vidé',
    'Réessayez après la traduction.',
    'Impossible d’ouvrir le dossier du cache',
  ],
  es: [
    'Recursos',
    'Caché',
    'Límite de caché',
    'Sin límite',
    'Borrar caché',
    'Abrir carpeta de caché',
    'Caché borrada',
    'Inténtalo después de la traducción.',
    'No se puede abrir la carpeta de caché',
  ],
  ar: [
    'الموارد',
    'ذاكرة التخزين المؤقت',
    'حد حجم ذاكرة التخزين المؤقت',
    'غير محدود',
    'مسح ذاكرة التخزين المؤقت',
    'فتح مجلد ذاكرة التخزين المؤقت',
    'تم مسح ذاكرة التخزين المؤقت',
    'ذاكرة التخزين المؤقت قيد الاستخدام. حاول مرة أخرى بعد انتهاء الترجمة.',
    'تعذر فتح مجلد ذاكرة التخزين المؤقت',
  ],
  arz: [
    'الموارد',
    'الكاش',
    'حد حجم الكاش',
    'من غير حد',
    'امسح الكاش',
    'افتح مجلد الكاش',
    'الكاش اتمسح',
    'الكاش مستخدم. جرّب تاني بعد ما الترجمة تخلص.',
    'مش قادر أفتح مجلد الكاش',
  ],
  hi: [
    'संसाधन',
    'कैश',
    'कैश आकार सीमा',
    'असीमित',
    'कैश साफ़ करें',
    'कैश फ़ोल्डर खोलें',
    'कैश साफ़ कर दिया गया',
    'कैश उपयोग में है। अनुवाद पूरा होने के बाद फिर कोशिश करें।',
    'कैश फ़ोल्डर नहीं खोला जा सका',
  ],
  bn: [
    'রিসোর্স',
    'ক্যাশ',
    'ক্যাশের আকারের সীমা',
    'সীমাহীন',
    'ক্যাশ পরিষ্কার করুন',
    'ক্যাশ ফোল্ডার খুলুন',
    'ক্যাশ পরিষ্কার করা হয়েছে',
    'ক্যাশ ব্যবহার করা হচ্ছে। অনুবাদ শেষ হলে আবার চেষ্টা করুন।',
    'ক্যাশ ফোল্ডার খোলা যায়নি',
  ],
  ru: [
    'Ресурсы',
    'Кэш',
    'Ограничение размера кэша',
    'Без ограничений',
    'Очистить кэш',
    'Открыть папку кэша',
    'Кэш очищен',
    'Кэш используется. Повторите попытку после завершения перевода.',
    'Не удалось открыть папку кэша',
  ],
  pt: [
    'Recursos',
    'Cache',
    'Limite do cache',
    'Ilimitado',
    'Limpar cache',
    'Abrir pasta do cache',
    'Cache limpo',
    'O cache está a ser utilizado. Tente novamente depois de a tradução terminar.',
    'Não foi possível abrir a pasta do cache',
  ],
  ur: [
    'وسائل',
    'کیش',
    'کیش کے حجم کی حد',
    'لامحدود',
    'کیش صاف کریں',
    'کیش فولڈر کھولیں',
    'کیش صاف ہو گیا',
    'کیش زیر استعمال ہے۔ ترجمہ مکمل ہونے کے بعد دوبارہ کوشش کریں۔',
    'کیش فولڈر کھولا نہیں جا سکا',
  ],
  de: [
    'Ressourcen',
    'Cache',
    'Cachegrößenlimit',
    'Unbegrenzt',
    'Cache leeren',
    'Cacheordner öffnen',
    'Cache geleert',
    'Cache wird verwendet. Versuchen Sie es nach Abschluss der Übersetzung erneut.',
    'Cacheordner konnte nicht geöffnet werden',
  ],
  pcm: [
    'Resources',
    'Cache',
    'Cache size limit',
    'No limit',
    'Clear cache',
    'Open cache folder',
    'Cache clear',
    'Cache dey use now. Try again after translation don finish.',
    'Cache folder no fit open',
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
  ar: 'خفض معدل إطارات العرض في الخلفية',
  arz: 'قلّل معدل الإطارات في الخلفية',
  hi: 'बैकग्राउंड में रेंडरिंग फ़्रेम दर कम करें',
  bn: 'ব্যাকগ্রাউন্ডে রেন্ডারিং ফ্রেম রেট কমান',
  ru: 'Снизить частоту кадров отрисовки в фоне',
  pt: 'Reduzir a frequência de renderização em segundo plano',
  ur: 'پس منظر میں رینڈرنگ فریم ریٹ کم کریں',
  de: 'Bildwiederholrate der Darstellung im Hintergrund reduzieren',
  pcm: 'Reduce rendering frame rate for background',
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
  ar: [
    'أكبر ذاكرات تخزين مؤقت للمستندات',
    'مسح ذاكرة التخزين المؤقت للمستند',
    'مستند مخزّن مؤقتًا',
    'لا توجد ذاكرات تخزين مؤقت للمستندات',
  ],
  arz: ['أكبر كاشات المستندات', 'امسح كاش المستند', 'مستند متخزّن', 'مفيش كاش للمستندات'],
  hi: [
    'सबसे बड़े दस्तावेज़ कैश',
    'दस्तावेज़ कैश साफ़ करें',
    'कैश किया गया दस्तावेज़',
    'कोई दस्तावेज़ कैश नहीं',
  ],
  bn: [
    'সবচেয়ে বড় নথির ক্যাশ',
    'নথির ক্যাশ পরিষ্কার করুন',
    'ক্যাশ করা নথি',
    'কোনো নথির ক্যাশ নেই',
  ],
  ru: [
    'Самые большие кэши документов',
    'Очистить кэш документа',
    'Документ в кэше',
    'Кэшей документов нет',
  ],
  pt: [
    'Maiores caches de documentos',
    'Limpar cache do documento',
    'Documento em cache',
    'Não existem caches de documentos',
  ],
  ur: [
    'بڑے ترین دستاویزی کیش',
    'دستاویز کا کیش صاف کریں',
    'کیش شدہ دستاویز',
    'دستاویز کا کوئی کیش نہیں',
  ],
  de: [
    'Größte Dokument-Caches',
    'Dokument-Cache leeren',
    'Dokument im Cache',
    'Keine Dokument-Caches',
  ],
  pcm: [
    'Biggest document caches',
    'Clear document cache',
    'Document wey dey cache',
    'No document cache',
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
    notice.value = text(6);
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
  notice = ref(''),
  folderBusy = ref(false);
const cacheFolderAvailable =
  typeof window !== 'undefined' && typeof window.previewCache?.openFolder === 'function';
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
    const error = Error(response.status === 409 ? text(7) : 'Unable to manage cache');
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
    notice.value = text(6);
  } catch (error) {
    notice.value = error.message.includes('409') ? text(7) : error.message;
  } finally {
    busy.value = false;
  }
}
async function openCacheFolder() {
  if (folderBusy.value) return;
  folderBusy.value = true;
  notice.value = '';
  try {
    const result = await window.previewCache.openFolder();
    if (!result?.opened) notice.value = text(8);
  } catch (error) {
    notice.value = error?.message || text(8);
  } finally {
    folderBusy.value = false;
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
    </div>
  </section>
  <section class="settings-section performance-cache" aria-labelledby="settings-cache">
    <h3 id="settings-cache">{{ text(1) }}</h3>
    <div class="settings-section-body">
      <div class="setting-row" data-setting="cache-size-limit">
        <span id="cache-size-limit-label">{{ text(2) }}</span
        ><AppPopUpButton
          :model-value="limit"
          :disabled="busy"
          teleport-to="body"
          aria-labelledby="cache-size-limit-label"
          @update:model-value="change"
          ><AppPopUpButtonItem v-for="[value, label] in choices" :key="value" :value="value">{{
            label || text(3)
          }}</AppPopUpButtonItem></AppPopUpButton
        >
      </div>
      <div class="setting-row cache-actions">
        <span class="muted">{{ usage }}</span
        ><AppButton :disabled="busy" @click="clear">{{ text(4) }}</AppButton
        ><AppButton
          v-if="cacheFolderAvailable"
          data-setting="open-cache-folder"
          :disabled="busy || folderBusy"
          @click="openCacheFolder"
          >{{ text(5) }}</AppButton
        >
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
