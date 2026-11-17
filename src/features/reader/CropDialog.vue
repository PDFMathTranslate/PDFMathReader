<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { AppButton, platform } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';
import { menuLabel } from '../../../shared/i18n/menu.mjs';

const props = defineProps({
  pages: Array,
  active: Number,
  pdf: Object,
  crop: Object,
  drawPage: Function,
  releaseCanvas: Function,
  readerAction: Function,
});
const dialog = ref(null),
  canvas = ref(null),
  frame = ref(null),
  pageNumber = ref(1);
const draft = ref({ left: 0, right: 0, top: 0, bottom: 0 });
const loading = ref(false),
  failed = ref(false);
let generation = 0;
const cropLabels = {
  en: {
    hint: 'Drag the edges to adjust the crop. It applies to all pages.',
    cancel: 'Cancel',
    apply: 'Apply',
    reset: 'Reset',
    left: 'Left',
    right: 'Right',
    top: 'Top',
    bottom: 'Bottom',
    loading: 'Loading page…',
    error: 'Could not load the page preview.',
  },
  'zh-CN': {
    hint: '拖动边缘调整裁剪范围。裁剪将应用于所有页面。',
    cancel: '取消',
    apply: '应用',
    reset: '重置',
    left: '左',
    right: '右',
    top: '上',
    bottom: '下',
    loading: '正在加载页面…',
    error: '无法加载页面预览。',
  },
  'zh-TW': {
    hint: '拖曳邊緣調整裁剪範圍。裁剪會套用到所有頁面。',
    cancel: '取消',
    apply: '套用',
    reset: '重設',
    left: '左',
    right: '右',
    top: '上',
    bottom: '下',
    loading: '正在載入頁面…',
    error: '無法載入頁面預覽。',
  },
  ja: {
    hint: '端をドラッグして切り抜き範囲を調整します。すべてのページに適用されます。',
    cancel: 'キャンセル',
    apply: '適用',
    reset: 'リセット',
    left: '左',
    right: '右',
    top: '上',
    bottom: '下',
    loading: 'ページを読み込み中…',
    error: 'ページのプレビューを読み込めませんでした。',
  },
  ko: {
    hint: '가장자리를 끌어 자르기 범위를 조정하세요. 모든 페이지에 적용됩니다.',
    cancel: '취소',
    apply: '적용',
    reset: '재설정',
    left: '왼쪽',
    right: '오른쪽',
    top: '위쪽',
    bottom: '아래쪽',
    loading: '페이지 로드 중…',
    error: '페이지 미리보기를 불러오지 못했습니다.',
  },
  fr: {
    hint: 'Faites glisser les bords pour ajuster le recadrage. Il s’applique à toutes les pages.',
    cancel: 'Annuler',
    apply: 'Appliquer',
    reset: 'Réinitialiser',
    left: 'Gauche',
    right: 'Droite',
    top: 'Haut',
    bottom: 'Bas',
    loading: 'Chargement de la page…',
    error: 'Impossible de charger l’aperçu de la page.',
  },
  es: {
    hint: 'Arrastra los bordes para ajustar el recorte. Se aplica a todas las páginas.',
    cancel: 'Cancelar',
    apply: 'Aplicar',
    reset: 'Restablecer',
    left: 'Izquierda',
    right: 'Derecha',
    top: 'Arriba',
    bottom: 'Abajo',
    loading: 'Cargando página…',
    error: 'No se pudo cargar la vista previa de la página.',
  },
  de: {
    hint: 'Ziehe die Ränder, um den Ausschnitt anzupassen. Er wird auf alle Seiten angewendet.',
    cancel: 'Abbrechen',
    apply: 'Anwenden',
    reset: 'Zurücksetzen',
    left: 'Links',
    right: 'Rechts',
    top: 'Oben',
    bottom: 'Unten',
    loading: 'Seite wird geladen …',
    error: 'Die Seitenvorschau konnte nicht geladen werden.',
  },
  pt: {
    hint: 'Arraste as margens para ajustar o corte. O corte é aplicado a todas as páginas.',
    cancel: 'Cancelar',
    apply: 'Aplicar',
    reset: 'Repor',
    left: 'Esquerda',
    right: 'Direita',
    top: 'Cima',
    bottom: 'Baixo',
    loading: 'A carregar a página…',
    error: 'Não foi possível carregar a pré-visualização da página.',
  },
  ru: {
    hint: 'Перетаскивайте края, чтобы настроить обрезку. Она применяется ко всем страницам.',
    cancel: 'Отмена',
    apply: 'Применить',
    reset: 'Сбросить',
    left: 'Слева',
    right: 'Справа',
    top: 'Сверху',
    bottom: 'Снизу',
    loading: 'Загрузка страницы…',
    error: 'Не удалось загрузить предварительный просмотр страницы.',
  },
  ar: {
    hint: 'اسحب الحواف لضبط الاقتصاص. سيُطبَّق على جميع الصفحات.',
    cancel: 'إلغاء',
    apply: 'تطبيق',
    reset: 'إعادة تعيين',
    left: 'اليسار',
    right: 'اليمين',
    top: 'الأعلى',
    bottom: 'الأسفل',
    loading: 'جارٍ تحميل الصفحة…',
    error: 'تعذّر تحميل معاينة الصفحة.',
  },
  arz: {
    hint: 'اسحب الحواف عشان تظبط القص. القص هيتطبق على كل الصفحات.',
    cancel: 'إلغاء',
    apply: 'طبّق',
    reset: 'رجّع الإعدادات',
    left: 'شمال',
    right: 'يمين',
    top: 'فوق',
    bottom: 'تحت',
    loading: 'جاري تحميل الصفحة…',
    error: 'مش قادرين نحمّل معاينة الصفحة.',
  },
  hi: {
    hint: 'क्रॉप समायोजित करने के लिए किनारों को खींचें। यह सभी पृष्ठों पर लागू होगा।',
    cancel: 'रद्द करें',
    apply: 'लागू करें',
    reset: 'रीसेट करें',
    left: 'बायाँ',
    right: 'दायाँ',
    top: 'ऊपर',
    bottom: 'नीचे',
    loading: 'पृष्ठ लोड हो रहा है…',
    error: 'पृष्ठ का पूर्वावलोकन लोड नहीं किया जा सका।',
  },
  bn: {
    hint: 'ক্রপ সামঞ্জস্য করতে প্রান্ত টানুন। এটি সব পৃষ্ঠায় প্রয়োগ হবে।',
    cancel: 'বাতিল',
    apply: 'প্রয়োগ করুন',
    reset: 'রিসেট করুন',
    left: 'বাম',
    right: 'ডান',
    top: 'উপর',
    bottom: 'নিচে',
    loading: 'পৃষ্ঠা লোড হচ্ছে…',
    error: 'পৃষ্ঠার প্রিভিউ লোড করা যায়নি।',
  },
  ur: {
    hint: 'تراش کو ایڈجسٹ کرنے کے لیے کناروں کو کھینچیں۔ یہ تمام صفحات پر لاگو ہوگی۔',
    cancel: 'منسوخ کریں',
    apply: 'لاگو کریں',
    reset: 'ری سیٹ کریں',
    left: 'بایاں',
    right: 'دایاں',
    top: 'اوپر',
    bottom: 'نیچے',
    loading: 'صفحہ لوڈ ہو رہا ہے…',
    error: 'صفحے کا پیش منظر لوڈ نہیں ہو سکا۔',
  },
  pcm: {
    hint: 'Drag the edges to adjust the crop. E go apply to all pages.',
    cancel: 'Cancel',
    apply: 'Apply',
    reset: 'Reset',
    left: 'Left',
    right: 'Right',
    top: 'Top',
    bottom: 'Bottom',
    loading: 'Page dey load…',
    error: 'We no fit load the page preview.',
  },
};
const words = computed(() => cropLabels[uiLanguage.value] || cropLabels.en);
const page = computed(() => props.pages?.[pageNumber.value - 1]);
const title = computed(() => menuLabel('Adjust Crop…', uiLanguage.value).replace(/…$/, ''));
const cropStyle = computed(() => ({
  left: `${draft.value.left * 100}%`,
  right: `${draft.value.right * 100}%`,
  top: `${draft.value.top * 100}%`,
  bottom: `${draft.value.bottom * 100}%`,
}));
function initialCrop(crop = {}) {
  return {
    left: crop.left ?? (crop.x || 0) / 2,
    right: crop.right ?? (crop.x || 0) / 2,
    top: crop.top ?? (crop.y || 0) / 2,
    bottom: crop.bottom ?? (crop.y || 0) / 2,
  };
}
async function open() {
  if (!props.pdf || !props.pages?.length) return;
  pageNumber.value = props.active;
  draft.value = initialCrop(props.crop);
  loading.value = true;
  failed.value = false;
  const token = ++generation,
    pdf = props.pdf;
  await nextTick();
  if (!dialog.value?.open) dialog.value?.showModal();
  try {
    const pdfPage = await pdf.getPage(pageNumber.value);
    if (token !== generation || !dialog.value?.open) return;
    const viewport = pdfPage.getViewport({ scale: 1 });
    const scale = Math.min(600 / viewport.width, 780 / viewport.height);
    if (!(await props.drawPage(pdfPage, canvas.value, scale, true)))
      throw Error('Preview unavailable');
    if (token !== generation || !dialog.value?.open) return;
    // drawPage sets fixed CSS dimensions for non-reader canvases. The dialog
    // owns the preview size so the bitmap and crop handles share one frame.
    canvas.value.style.removeProperty('width');
    canvas.value.style.removeProperty('height');
  } catch (error) {
    if (token === generation) failed.value = true;
  } finally {
    if (token === generation) loading.value = false;
  }
}
function close() {
  generation++;
  dialog.value?.close();
}
function apply() {
  props.readerAction('crop:apply', { ...draft.value });
  close();
}
function setEdge(edge, value) {
  const opposite = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' }[edge];
  draft.value = {
    ...draft.value,
    [edge]: Math.max(0, Math.min(0.8 - draft.value[opposite], value)),
  };
}
function pointer(edge, event) {
  if (event.button !== 0) return;
  event.preventDefault();
  const target = event.currentTarget;
  target.setPointerCapture(event.pointerId);
  function move(e) {
    const rect = frame.value.getBoundingClientRect();
    const value =
      edge === 'left'
        ? (e.clientX - rect.left) / rect.width
        : edge === 'right'
          ? (rect.right - e.clientX) / rect.width
          : edge === 'top'
            ? (e.clientY - rect.top) / rect.height
            : (rect.bottom - e.clientY) / rect.height;
    setEdge(edge, value);
  }
  function end() {
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', end);
    target.removeEventListener('pointercancel', end);
  }
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', end);
  target.addEventListener('pointercancel', end);
  move(event);
}
function key(edge, event) {
  const direction = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
  if (!direction) return;
  event.preventDefault();
  const sign = edge === 'right' || edge === 'bottom' ? -1 : 1;
  setEdge(edge, draft.value[edge] + direction * sign * (event.shiftKey ? 0.05 : 0.01));
}
function cleanup() {
  generation++;
  if (canvas.value) props.releaseCanvas?.(canvas.value);
}
watch(
  () => props.pdf,
  () => {
    if (dialog.value?.open) close();
  },
);
watch(
  () => props.pages?.length,
  (count) => {
    if (!count && dialog.value?.open) close();
  },
);
onMounted(() => window.addEventListener('reader:adjust-crop', open));
onBeforeUnmount(() => {
  window.removeEventListener('reader:adjust-crop', open);
  cleanup();
});
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="crop-dialog"
      :data-platform="platform"
      :aria-label="title"
      @close="cleanup"
      @keydown.stop
    >
      <header>
        <h2>{{ title }}</h2>
        <p>{{ words.hint }}</p>
      </header>
      <div class="crop-stage">
        <div
          v-if="page"
          ref="frame"
          class="crop-preview"
          :style="{
            aspectRatio: page.width + ' / ' + page.height,
            width: `min(100%, calc((min(58vh, 580px) - 28px) * ${page.width / page.height}))`,
          }"
        >
          <canvas ref="canvas"></canvas>
          <div v-if="loading || failed" class="crop-status" role="status">
            {{ failed ? words.error : words.loading }}
          </div>
          <div v-if="!failed" class="crop-selection" :style="cropStyle">
            <button
              v-for="edge in ['left', 'right', 'top', 'bottom']"
              :key="edge"
              type="button"
              class="crop-handle"
              :class="edge"
              role="slider"
              :aria-label="words[edge]"
              :aria-valuemin="0"
              :aria-valuemax="
                Math.round(
                  (0.8 -
                    draft[{ left: 'right', right: 'left', top: 'bottom', bottom: 'top' }[edge]]) *
                    100,
                )
              "
              :aria-valuenow="Math.round(draft[edge] * 100)"
              :aria-valuetext="Math.round(draft[edge] * 100) + '%'"
              @pointerdown="pointer(edge, $event)"
              @keydown="key(edge, $event)"
            >
              <span></span>
            </button>
          </div>
        </div>
      </div>
      <footer>
        <AppButton type="button" @click="draft = initialCrop()">{{ words.reset }}</AppButton>
        <div class="crop-actions">
          <AppButton type="button" @click="close">{{ words.cancel }}</AppButton
          ><AppButton
            type="button"
            variant="prominent"
            :disabled="loading || failed"
            @click="apply"
            >{{ words.apply }}</AppButton
          >
        </div>
      </footer>
    </dialog>
  </Teleport>
</template>

<style scoped>
.crop-dialog {
  box-sizing: border-box;
  width: min(620px, calc(100vw - 40px));
  max-height: calc(100vh - 40px);
  padding: 22px 24px;
  border: 1px solid #00000014;
  border-radius: 20px;
  background: #f5f5f7;
  color: #1d1d1f;
  box-shadow:
    0 24px 72px #0004,
    0 4px 16px #0002;
  font:
    13px/1.4 -apple-system,
    BlinkMacSystemFont,
    system-ui,
    sans-serif;
}
:global([data-appearance='dark'] .crop-dialog) {
  background: #2c2c2e;
  color: #f5f5f7;
  border-color: #ffffff14;
  color-scheme: dark;
}
.crop-dialog::backdrop {
  background: #0006;
}
h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
header p {
  margin: 5px 0 0;
  opacity: 0.72;
}
.crop-stage {
  display: flex;
  justify-content: center;
  align-items: center;
  box-sizing: border-box;
  padding: 14px;
  margin: 18px 0;
  min-height: 180px;
  height: min(58vh, 580px);
  overflow: hidden;
  background: #7772;
  border-radius: 10px;
}
.crop-preview {
  position: relative;
  max-height: 100%;
  background: white;
  box-shadow: 0 2px 10px #0003;
}
canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}
.crop-status {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: #333;
  background: #fffffff0;
}
.crop-selection {
  position: absolute;
  outline: 2px solid #1683ff;
  box-shadow: 0 0 0 999px #0008;
}
.crop-handle {
  position: absolute;
  display: grid;
  place-items: center;
  border: 0;
  padding: 0;
  background: transparent;
  touch-action: none;
}
.crop-handle:focus,
.crop-handle:focus-visible {
  outline: none;
}
.crop-handle.left,
.crop-handle.right {
  width: 24px;
  height: 100%;
  top: 0;
  cursor: ew-resize;
}
.crop-handle.left {
  left: -12px;
}
.crop-handle.right {
  right: -12px;
}
.crop-handle.top,
.crop-handle.bottom {
  height: 24px;
  width: calc(100% - 24px);
  left: 12px;
  cursor: ns-resize;
}
.crop-handle.top {
  top: -12px;
}
.crop-handle.bottom {
  bottom: -12px;
}
.crop-handle span {
  display: block;
  background: #fff;
  border: 2px solid #1683ff;
  border-radius: 5px;
  box-shadow: 0 1px 4px #0004;
}
.crop-handle.left span,
.crop-handle.right span {
  width: 7px;
  height: 30px;
}
.crop-handle.top span,
.crop-handle.bottom span {
  width: 30px;
  height: 7px;
}
.crop-handle:focus-visible span {
  background: #1683ff;
}
footer,
.crop-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
footer {
  justify-content: space-between;
}
</style>
