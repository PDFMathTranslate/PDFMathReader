<script setup>
import { computed, defineComponent, h, useId } from 'vue';
import * as platformControls from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';

const AppButton = platformControls.AppButton;
const AppSwitch = platformControls.AppSwitch;
const AppTextField = platformControls.AppTextField;

const labels = {
  en: {
    heading: 'Terminology glossary',
    description:
      'Exact phrase matching is case sensitive. The longest match applies to all three kernels for new translations.',
    addLibrary: 'Add library',
    removeLibrary: 'Remove library',
    libraryName: 'Library name',
    enabled: 'Enabled',
    entries: 'Terms',
    source: 'Source',
    target: 'Target',
    addEntry: 'Add term',
    removeEntry: 'Remove term',
    newLibrary: 'New library',
    unnamedLibrary: 'Unnamed library',
    empty: 'No terminology libraries yet.',
    noEntries: 'No terms yet.',
  },
  'zh-CN': {
    heading: '术语表',
    description: '精确短语匹配区分大小写。最长匹配应用于三个内核的新翻译。',
    addLibrary: '添加术语库',
    removeLibrary: '移除术语库',
    libraryName: '术语库名称',
    enabled: '启用',
    entries: '术语',
    source: '源短语',
    target: '目标短语',
    addEntry: '添加术语',
    removeEntry: '移除术语',
    newLibrary: '新术语库',
    unnamedLibrary: '未命名术语库',
    empty: '还没有术语库。',
    noEntries: '还没有术语。',
  },
  'zh-TW': {
    heading: '術語表',
    description: '精確詞組比對區分大小寫。最長比對套用到三個核心的新翻譯。',
    addLibrary: '加入術語庫',
    removeLibrary: '移除術語庫',
    libraryName: '術語庫名稱',
    enabled: '啟用',
    entries: '術語',
    source: '來源詞組',
    target: '目標詞組',
    addEntry: '加入術語',
    removeEntry: '移除術語',
    newLibrary: '新術語庫',
    unnamedLibrary: '未命名術語庫',
    empty: '尚未建立術語庫。',
    noEntries: '尚未建立術語。',
  },
  ja: {
    heading: '用語集',
    description:
      '完全一致する語句の照合では大文字と小文字を区別します。最長一致が 3 つすべてのカーネルの新しい翻訳に適用されます。',
    addLibrary: '用語集を追加',
    removeLibrary: '用語集を削除',
    libraryName: '用語集の名前',
    enabled: '有効',
    entries: '用語',
    source: '原文の語句',
    target: '訳語',
    addEntry: '用語を追加',
    removeEntry: '用語を削除',
    newLibrary: '新しい用語集',
    unnamedLibrary: '名前のない用語集',
    empty: '用語集はまだありません。',
    noEntries: '用語はまだありません。',
  },
  ko: {
    heading: '용어집',
    description:
      '정확한 구문 일치는 대소문자를 구분합니다. 가장 긴 일치는 세 커널의 새 번역에 적용됩니다.',
    addLibrary: '용어집 추가',
    removeLibrary: '용어집 삭제',
    libraryName: '용어집 이름',
    enabled: '활성화',
    entries: '용어',
    source: '원문 구문',
    target: '번역 구문',
    addEntry: '용어 추가',
    removeEntry: '용어 삭제',
    newLibrary: '새 용어집',
    unnamedLibrary: '이름 없는 용어집',
    empty: '용어집이 아직 없습니다.',
    noEntries: '용어가 아직 없습니다.',
  },
  fr: {
    heading: 'Glossaire terminologique',
    description:
      'La correspondance des expressions exactes respecte la casse. La correspondance la plus longue s’applique aux nouvelles traductions des trois noyaux.',
    addLibrary: 'Ajouter un glossaire',
    removeLibrary: 'Supprimer le glossaire',
    libraryName: 'Nom du glossaire',
    enabled: 'Activé',
    entries: 'Termes',
    source: 'Source',
    target: 'Cible',
    addEntry: 'Ajouter un terme',
    removeEntry: 'Supprimer le terme',
    newLibrary: 'Nouveau glossaire',
    unnamedLibrary: 'Glossaire sans nom',
    empty: 'Aucun glossaire terminologique pour le moment.',
    noEntries: 'Aucun terme pour le moment.',
  },
  es: {
    heading: 'Glosario de terminología',
    description:
      'La coincidencia de frases exactas distingue mayúsculas y minúsculas. La coincidencia más larga se aplica a las nuevas traducciones de los tres núcleos.',
    addLibrary: 'Añadir glosario',
    removeLibrary: 'Eliminar el glosario',
    libraryName: 'Nombre del glosario',
    enabled: 'Activado',
    entries: 'Términos',
    source: 'Origen',
    target: 'Destino',
    addEntry: 'Añadir término',
    removeEntry: 'Eliminar término',
    newLibrary: 'Nuevo glosario',
    unnamedLibrary: 'Glosario sin nombre',
    empty: 'Todavía no hay glosarios de terminología.',
    noEntries: 'Todavía no hay términos.',
  },
  ar: {
    heading: 'مسرد المصطلحات',
    description:
      'مطابقة العبارات الدقيقة حساسة لحالة الأحرف. ينطبق أطول تطابق على الترجمات الجديدة في النوى الثلاثة.',
    addLibrary: 'إضافة مسرد',
    removeLibrary: 'إزالة المسرد',
    libraryName: 'اسم المسرد',
    enabled: 'مفعّل',
    entries: 'المصطلحات',
    source: 'المصدر',
    target: 'الهدف',
    addEntry: 'إضافة مصطلح',
    removeEntry: 'إزالة المصطلح',
    newLibrary: 'مسرد جديد',
    unnamedLibrary: 'مسرد بلا اسم',
    empty: 'لا توجد مسارد مصطلحات بعد.',
    noEntries: 'لا توجد مصطلحات بعد.',
  },
  arz: {
    heading: 'قاموس المصطلحات',
    description:
      'مطابقة العبارات بالضبط بتفرق بين الحروف الكبيرة والصغيرة. أطول تطابق بيتطبق على الترجمات الجديدة في التلات نوى.',
    addLibrary: 'ضيف قاموس',
    removeLibrary: 'شيل القاموس',
    libraryName: 'اسم القاموس',
    enabled: 'مفعّل',
    entries: 'مصطلحات',
    source: 'المصدر',
    target: 'الهدف',
    addEntry: 'ضيف مصطلح',
    removeEntry: 'شيل المصطلح',
    newLibrary: 'قاموس جديد',
    unnamedLibrary: 'قاموس من غير اسم',
    empty: 'لسه مفيش قواميس مصطلحات.',
    noEntries: 'لسه مفيش مصطلحات.',
  },
  hi: {
    heading: 'शब्दावली',
    description:
      'सटीक वाक्यांश मिलान में बड़े और छोटे अक्षरों का अंतर रहता है। सबसे लंबा मिलान तीनों कर्नेल के नए अनुवादों पर लागू होता है।',
    addLibrary: 'लाइब्रेरी जोड़ें',
    removeLibrary: 'लाइब्रेरी हटाएँ',
    libraryName: 'लाइब्रेरी का नाम',
    enabled: 'सक्षम',
    entries: 'शब्द',
    source: 'स्रोत',
    target: 'लक्ष्य',
    addEntry: 'शब्द जोड़ें',
    removeEntry: 'शब्द हटाएँ',
    newLibrary: 'नई लाइब्रेरी',
    unnamedLibrary: 'बिना नाम की लाइब्रेरी',
    empty: 'अभी कोई शब्दावली लाइब्रेरी नहीं है।',
    noEntries: 'अभी कोई शब्द नहीं हैं।',
  },
  bn: {
    heading: 'পরিভাষা অভিধান',
    description:
      'নির্ভুল বাক্যাংশ মেলানো বড় ও ছোট হাতের অক্ষরের পার্থক্য করে। সবচেয়ে দীর্ঘ মিল তিনটি কার্নেলের নতুন অনুবাদে প্রয়োগ হয়।',
    addLibrary: 'লাইব্রেরি যোগ করুন',
    removeLibrary: 'লাইব্রেরি সরান',
    libraryName: 'লাইব্রেরির নাম',
    enabled: 'সক্রিয়',
    entries: 'পরিভাষা',
    source: 'উৎস',
    target: 'লক্ষ্য',
    addEntry: 'পরিভাষা যোগ করুন',
    removeEntry: 'পরিভাষা সরান',
    newLibrary: 'নতুন লাইব্রেরি',
    unnamedLibrary: 'নামহীন লাইব্রেরি',
    empty: 'এখনও কোনো পরিভাষা লাইব্রেরি নেই।',
    noEntries: 'এখনও কোনো পরিভাষা নেই।',
  },
  ru: {
    heading: 'Глоссарий терминов',
    description:
      'Точное совпадение фраз учитывает регистр. Самое длинное совпадение применяется к новым переводам во всех трёх ядрах.',
    addLibrary: 'Добавить библиотеку',
    removeLibrary: 'Удалить библиотеку',
    libraryName: 'Название библиотеки',
    enabled: 'Включено',
    entries: 'Термины',
    source: 'Источник',
    target: 'Цель',
    addEntry: 'Добавить термин',
    removeEntry: 'Удалить термин',
    newLibrary: 'Новая библиотека',
    unnamedLibrary: 'Библиотека без названия',
    empty: 'Глоссариев терминов пока нет.',
    noEntries: 'Терминов пока нет.',
  },
  pt: {
    heading: 'Glossário de terminologia',
    description:
      'A correspondência exata de expressões diferencia maiúsculas de minúsculas. A correspondência mais longa aplica-se às novas traduções dos três núcleos.',
    addLibrary: 'Adicionar biblioteca',
    removeLibrary: 'Remover biblioteca',
    libraryName: 'Nome da biblioteca',
    enabled: 'Ativada',
    entries: 'Termos',
    source: 'Origem',
    target: 'Destino',
    addEntry: 'Adicionar termo',
    removeEntry: 'Remover termo',
    newLibrary: 'Nova biblioteca',
    unnamedLibrary: 'Biblioteca sem nome',
    empty: 'Ainda não existem bibliotecas de terminologia.',
    noEntries: 'Ainda não existem termos.',
  },
  ur: {
    heading: 'اصطلاحات کی لغت',
    description:
      'عین فقرے کی مطابقت بڑے اور چھوٹے حروف میں فرق کرتی ہے۔ سب سے طویل مطابقت تینوں کرنلز کے نئے تراجم پر لاگو ہوتی ہے۔',
    addLibrary: 'لائبریری شامل کریں',
    removeLibrary: 'لائبریری ہٹائیں',
    libraryName: 'لائبریری کا نام',
    enabled: 'فعال',
    entries: 'اصطلاحات',
    source: 'ماخذ',
    target: 'ہدف',
    addEntry: 'اصطلاح شامل کریں',
    removeEntry: 'اصطلاح ہٹائیں',
    newLibrary: 'نئی لائبریری',
    unnamedLibrary: 'بے نام لائبریری',
    empty: 'ابھی اصطلاحات کی کوئی لائبریری نہیں ہے۔',
    noEntries: 'ابھی کوئی اصطلاح نہیں ہے۔',
  },
  de: {
    heading: 'Terminologieglossar',
    description:
      'Die genaue Übereinstimmung von Ausdrücken unterscheidet Groß- und Kleinschreibung. Die längste Übereinstimmung wird auf neue Übersetzungen in allen drei Kerneln angewendet.',
    addLibrary: 'Bibliothek hinzufügen',
    removeLibrary: 'Bibliothek entfernen',
    libraryName: 'Bibliotheksname',
    enabled: 'Aktiviert',
    entries: 'Begriffe',
    source: 'Quelle',
    target: 'Ziel',
    addEntry: 'Begriff hinzufügen',
    removeEntry: 'Begriff entfernen',
    newLibrary: 'Neue Bibliothek',
    unnamedLibrary: 'Unbenannte Bibliothek',
    empty: 'Noch keine Terminologiebibliotheken vorhanden.',
    noEntries: 'Noch keine Begriffe vorhanden.',
  },
  pcm: {
    heading: 'Word glossary',
    description:
      'Exact phrase matching dey check capital and small letters. The longest match dey apply to new translations for all three kernels.',
    addLibrary: 'Add library',
    removeLibrary: 'Remove library',
    libraryName: 'Library name',
    enabled: 'Enabled',
    entries: 'Terms',
    source: 'Source',
    target: 'Target',
    addEntry: 'Add term',
    removeEntry: 'Remove term',
    newLibrary: 'New library',
    unnamedLibrary: 'Library wey no get name',
    empty: 'No terminology library dey yet.',
    noEntries: 'No term dey yet.',
  },
};

let idSequence = 0;

const GlossaryButton = defineComponent({
  name: 'GlossaryButton',
  inheritAttrs: false,
  props: {
    disabled: Boolean,
    size: { type: String, default: undefined },
    variant: { type: String, default: undefined },
    type: { type: String, default: 'button' },
  },
  setup(props, { attrs, slots }) {
    return () => {
      const buttonAttrs = {
        ...attrs,
        type: props.type,
        disabled: props.disabled,
      };
      if (AppButton) {
        return h(
          AppButton,
          {
            ...buttonAttrs,
            ...(props.size ? { size: props.size } : {}),
            ...(props.variant ? { variant: props.variant } : {}),
          },
          slots.default?.(),
        );
      }
      return h('button', buttonAttrs, slots.default?.());
    };
  },
});

const GlossaryTextField = defineComponent({
  name: 'GlossaryTextField',
  inheritAttrs: false,
  props: {
    modelValue: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit }) {
    const update = (value) => emit('update:modelValue', String(value ?? ''));
    return () => {
      if (AppTextField) {
        return h(AppTextField, {
          ...attrs,
          modelValue: props.modelValue,
          'onUpdate:modelValue': update,
        });
      }
      return h('input', {
        ...attrs,
        type: attrs.type || 'text',
        value: props.modelValue,
        onInput: (event) => update(event.currentTarget?.value),
      });
    };
  },
});

const GlossarySwitch = defineComponent({
  name: 'GlossarySwitch',
  inheritAttrs: false,
  props: {
    modelValue: { type: Boolean, default: false },
  },
  emits: ['update:modelValue'],
  setup(props, { attrs, emit }) {
    const update = (value) => emit('update:modelValue', Boolean(value));
    return () => {
      if (AppSwitch) {
        return h(AppSwitch, {
          ...attrs,
          modelValue: props.modelValue,
          'onUpdate:modelValue': update,
        });
      }
      return h('input', {
        ...attrs,
        type: 'checkbox',
        checked: props.modelValue,
        onChange: (event) => update(event.currentTarget?.checked),
      });
    };
  },
});

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
});
const emit = defineEmits(['update:modelValue']);
const componentId = `glossary-settings-${useId()}`;
const copy = computed(() => labels[uiLanguage.value] || labels.en);
const libraries = computed(() => (Array.isArray(props.modelValue) ? props.modelValue : []));

function entriesFor(library) {
  return Array.isArray(library?.entries) ? library.entries : [];
}

function cloneLibrary(library) {
  const next = { ...(library || {}) };
  if (Array.isArray(library?.entries)) {
    next.entries = library.entries.map((entry) => ({ ...(entry || {}) }));
  }
  return next;
}

function updateLibraries(transform) {
  const current = libraries.value.map(cloneLibrary);
  emit('update:modelValue', transform(current));
}

function updateLibrary(libraryIndex, patch) {
  updateLibraries((current) =>
    current.map((library, index) => (index === libraryIndex ? { ...library, ...patch } : library)),
  );
}

function updateEntry(libraryIndex, entryIndex, patch) {
  updateLibraries((current) =>
    current.map((library, index) => {
      if (index !== libraryIndex) return library;
      return {
        ...library,
        entries: entriesFor(library).map((entry, rowIndex) =>
          rowIndex === entryIndex ? { ...(entry || {}), ...patch } : { ...(entry || {}) },
        ),
      };
    }),
  );
}

function addEntry(libraryIndex) {
  updateLibraries((current) =>
    current.map((library, index) =>
      index === libraryIndex
        ? {
            ...library,
            entries: [...entriesFor(library), { source: '', target: '' }],
          }
        : library,
    ),
  );
}

function removeEntry(libraryIndex, entryIndex) {
  updateLibraries((current) =>
    current.map((library, index) =>
      index === libraryIndex
        ? {
            ...library,
            entries: entriesFor(library).filter((_, rowIndex) => rowIndex !== entryIndex),
          }
        : library,
    ),
  );
}

function addLibrary() {
  const suffix = `${Date.now().toString(36)}-${++idSequence}`;
  const generatedId = globalThis.crypto?.randomUUID?.() || suffix;
  updateLibraries((current) => [
    ...current,
    {
      id: `glossary-${generatedId}`,
      name: copy.value.newLibrary,
      enabled: true,
      entries: [{ source: '', target: '' }],
    },
  ]);
}

function removeLibrary(libraryIndex) {
  updateLibraries((current) => current.filter((_, index) => index !== libraryIndex));
}

function libraryId(kind, libraryIndex) {
  return `${componentId}-${kind}-${libraryIndex}`;
}

function entryLabel(kind, entryIndex) {
  return `${copy.value[kind]} ${entryIndex + 1}`;
}

function libraryDisplayName(library) {
  const name = String(library?.name ?? '').trim();
  return name || copy.value.unnamedLibrary;
}
</script>

<template>
  <section
    class="settings-section glossary-settings"
    aria-labelledby="settings-terminology-glossary"
    aria-describedby="settings-terminology-glossary-description"
  >
    <h3 id="settings-terminology-glossary">{{ copy.heading }}</h3>
    <div class="settings-section-body">
      <p id="settings-terminology-glossary-description" class="muted glossary-description">
        {{ copy.description }}
      </p>
      <div class="glossary-toolbar">
        <GlossaryButton class="glossary-add-library" variant="prominent" @click="addLibrary">
          {{ copy.addLibrary }}
        </GlossaryButton>
      </div>
      <p v-if="!libraries.length" class="muted glossary-empty" role="status">
        {{ copy.empty }}
      </p>
      <div v-else class="glossary-libraries">
        <article
          v-for="(library, libraryIndex) in libraries"
          :key="String(library?.id ?? 'library') + '-' + libraryIndex"
          class="glossary-library"
          :data-library-id="library?.id"
          :aria-labelledby="libraryId('heading', libraryIndex)"
        >
          <div class="glossary-library-header">
            <div class="glossary-library-summary">
              <h4 :id="libraryId('heading', libraryIndex)">{{ libraryDisplayName(library) }}</h4>
              <div class="glossary-library-name">
                <label
                  :id="libraryId('name-label', libraryIndex)"
                  :for="libraryId('name', libraryIndex)"
                >
                  {{ copy.libraryName }}
                </label>
                <GlossaryTextField
                  :id="libraryId('name', libraryIndex)"
                  class="glossary-text-field"
                  :model-value="String(library?.name ?? '')"
                  :aria-labelledby="libraryId('name-label', libraryIndex)"
                  autocomplete="off"
                  :spellcheck="false"
                  @update:model-value="updateLibrary(libraryIndex, { name: $event })"
                />
              </div>
            </div>
            <div class="glossary-library-controls">
              <div class="setting-row glossary-enabled-row">
                <span :id="libraryId('enabled-label', libraryIndex)">{{ copy.enabled }}</span>
                <GlossarySwitch
                  :model-value="Boolean(library?.enabled)"
                  :aria-labelledby="libraryId('enabled-label', libraryIndex)"
                  @update:model-value="updateLibrary(libraryIndex, { enabled: $event })"
                />
              </div>
              <GlossaryButton
                class="glossary-remove-library"
                size="small"
                :aria-label="copy.removeLibrary + ': ' + libraryDisplayName(library)"
                @click="removeLibrary(libraryIndex)"
              >
                {{ copy.removeLibrary }}
              </GlossaryButton>
            </div>
          </div>

          <div class="glossary-entries" :aria-labelledby="libraryId('entries-label', libraryIndex)">
            <div class="glossary-entries-heading">
              <h5 :id="libraryId('entries-label', libraryIndex)">{{ copy.entries }}</h5>
              <GlossaryButton size="small" @click="addEntry(libraryIndex)">
                {{ copy.addEntry }}
              </GlossaryButton>
            </div>
            <div v-if="entriesFor(library).length" class="glossary-entry-labels" aria-hidden="true">
              <span>{{ copy.source }}</span>
              <span>{{ copy.target }}</span>
              <span></span>
            </div>
            <div
              v-for="(entry, entryIndex) in entriesFor(library)"
              :key="entryIndex"
              class="glossary-entry"
              :data-entry-index="entryIndex"
            >
              <GlossaryTextField
                class="glossary-text-field"
                :model-value="String(entry?.source ?? '')"
                :aria-label="entryLabel('source', entryIndex)"
                :placeholder="copy.source"
                autocomplete="off"
                :spellcheck="false"
                @update:model-value="updateEntry(libraryIndex, entryIndex, { source: $event })"
              />
              <GlossaryTextField
                class="glossary-text-field"
                :model-value="String(entry?.target ?? '')"
                :aria-label="entryLabel('target', entryIndex)"
                :placeholder="copy.target"
                autocomplete="off"
                :spellcheck="false"
                @update:model-value="updateEntry(libraryIndex, entryIndex, { target: $event })"
              />
              <GlossaryButton
                class="glossary-remove-entry"
                size="small"
                :aria-label="copy.removeEntry + ' ' + (entryIndex + 1)"
                @click="removeEntry(libraryIndex, entryIndex)"
              >
                {{ copy.removeEntry }}
              </GlossaryButton>
            </div>
            <p v-if="!entriesFor(library).length" class="muted glossary-no-entries">
              {{ copy.noEntries }}
            </p>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.settings-section-body {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.glossary-description,
.glossary-empty,
.glossary-no-entries {
  margin: 0;
  line-height: 1.55;
}

.glossary-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.glossary-libraries {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.glossary-library {
  display: grid;
  gap: 14px;
  min-width: 0;
  padding-top: 16px;
  border-top: 1px solid var(--chrome-divider);
}

.glossary-library:first-child {
  padding-top: 2px;
  border-top: 0;
}

.glossary-library-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: 16px;
  min-width: 0;
}

.glossary-library-summary,
.glossary-library-name,
.glossary-library-controls,
.glossary-entries {
  display: grid;
  min-width: 0;
}

.glossary-library-summary {
  gap: 10px;
}

.glossary-library-summary h4,
.glossary-entries-heading h5 {
  min-width: 0;
  margin: 0;
  color: var(--text);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.35;
}

.glossary-library-name {
  gap: 6px;
}

.glossary-library-name label,
.glossary-entry-labels {
  color: var(--text-secondary);
  font-size: 12px;
}

.glossary-library-name label {
  display: block;
}

.glossary-library-controls {
  justify-items: end;
  gap: 10px;
  min-width: 112px;
}

.glossary-enabled-row {
  width: 100%;
  min-height: 24px;
  gap: 10px;
}

.glossary-enabled-row > span {
  color: var(--text-secondary);
  font-size: 12px;
}

.glossary-remove-library,
.glossary-remove-entry {
  white-space: nowrap;
}

.glossary-entries {
  gap: 10px;
  min-width: 0;
  padding-top: 12px;
  border-top: 1px solid var(--chrome-divider);
}

.glossary-entries-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.glossary-entry-labels,
.glossary-entry {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.glossary-entry-labels {
  padding: 0 2px;
  line-height: 1.3;
}

.glossary-entry-labels span:last-child {
  width: 78px;
}

.glossary-entry {
  align-items: start;
}

.glossary-text-field {
  width: 100%;
  min-width: 0;
}

.glossary-remove-entry {
  min-width: 78px;
}

@media (max-width: 520px) {
  .glossary-library-header {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .glossary-library-controls {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    justify-items: stretch;
  }

  .glossary-enabled-row {
    width: auto;
  }

  .glossary-remove-library {
    justify-self: end;
  }
}

@media (max-width: 420px) {
  .glossary-entry-labels {
    display: none;
  }

  .glossary-entry {
    grid-template-columns: 1fr;
    gap: 7px;
  }

  .glossary-remove-entry {
    justify-self: end;
  }
}
</style>
