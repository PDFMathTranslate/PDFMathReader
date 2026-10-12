<script setup>
import { computed, inject } from 'vue';
import { AppSwitch, AppTextField } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';
import {
  MAX_TRANSLATION_FONT_LENGTH,
  stripTranslationFont,
  translationFontFamily,
} from '../../../shared/reader/translation-font.mjs';
const preferences = inject('documentLanguagePreferences');
// [serif label, serif hint, font label, font hint, placeholder]
const labels = {
  en: [
    'Use serif fonts',
    'Shows translated text in a serif typeface that matches the target language.',
    'Specify a font',
    'Enter an installed font family name. Leave empty to use the default font.',
    'e.g. Songti SC',
  ],
  'zh-CN': [
    '使用衬线字体',
    '以与目标语言匹配的衬线字体显示译文。',
    '指定字体',
    '输入已安装字体的名称。留空则使用默认字体。',
    '例如 Songti SC',
  ],
  'zh-TW': [
    '使用襯線字型',
    '以與目標語言相符的襯線字型顯示譯文。',
    '指定字型',
    '輸入已安裝字型的名稱。留空則使用預設字型。',
    '例如 Songti TC',
  ],
  ja: [
    'セリフ体を使用',
    '翻訳文を翻訳先の言語に合ったセリフ体で表示します。',
    'フォントを指定',
    'インストール済みのフォント名を入力します。空欄の場合は既定のフォントを使用します。',
    '例: Hiragino Mincho ProN',
  ],
  ko: [
    '세리프 글꼴 사용',
    '번역문을 대상 언어에 맞는 세리프 글꼴로 표시합니다.',
    '글꼴 지정',
    '설치된 글꼴 이름을 입력하세요. 비워 두면 기본 글꼴을 사용합니다.',
    '예: AppleMyungjo',
  ],
  fr: [
    'Utiliser des polices à empattement',
    'Affiche le texte traduit dans une police à empattement adaptée à la langue cible.',
    'Choisir une police',
    'Saisissez le nom d’une police installée. Laissez vide pour utiliser la police par défaut.',
    'ex. Georgia',
  ],
  es: [
    'Usar fuentes con serifa',
    'Muestra el texto traducido con una fuente con serifa adecuada al idioma de destino.',
    'Especificar una fuente',
    'Escribe el nombre de una fuente instalada. Déjalo vacío para usar la fuente predeterminada.',
    'p. ej., Georgia',
  ],
  de: [
    'Serifenschrift verwenden',
    'Zeigt übersetzten Text in einer zur Zielsprache passenden Serifenschrift an.',
    'Schrift festlegen',
    'Geben Sie den Namen einer installierten Schrift ein. Leer lassen, um die Standardschrift zu verwenden.',
    'z. B. Georgia',
  ],
  pt: [
    'Usar fontes serifadas',
    'Mostra o texto traduzido em uma fonte serifada adequada ao idioma de destino.',
    'Especificar uma fonte',
    'Digite o nome de uma fonte instalada. Deixe em branco para usar a fonte padrão.',
    'ex.: Georgia',
  ],
  ru: [
    'Использовать шрифты с засечками',
    'Показывает перевод шрифтом с засечками, подходящим для целевого языка.',
    'Указать шрифт',
    'Введите название установленного шрифта. Оставьте пустым, чтобы использовать шрифт по умолчанию.',
    'например, Georgia',
  ],
  ar: [
    'استخدام خطوط مذيّلة',
    'يعرض النص المترجم بخط مذيّل يناسب اللغة الهدف.',
    'تحديد خط',
    'أدخل اسم خط مثبّت. اتركه فارغًا لاستخدام الخط الافتراضي.',
    'مثال: Georgia',
  ],
  arz: [
    'استخدم خطوط مذيّلة',
    'بيعرض النص المترجم بخط مذيّل مناسب للغة الهدف.',
    'حدّد خط',
    'اكتب اسم خط متثبّت. سيبه فاضي عشان تستخدم الخط الافتراضي.',
    'مثلًا Georgia',
  ],
  hi: [
    'सेरिफ़ फ़ॉन्ट उपयोग करें',
    'अनुवादित पाठ को लक्ष्य भाषा के अनुरूप सेरिफ़ फ़ॉन्ट में दिखाता है।',
    'फ़ॉन्ट निर्दिष्ट करें',
    'इंस्टॉल किए गए फ़ॉन्ट का नाम लिखें। डिफ़ॉल्ट फ़ॉन्ट के लिए खाली छोड़ें।',
    'जैसे Georgia',
  ],
  bn: [
    'সেরিফ ফন্ট ব্যবহার করুন',
    'অনূদিত লেখা লক্ষ্য ভাষার উপযোগী সেরিফ ফন্টে দেখায়।',
    'ফন্ট নির্দিষ্ট করুন',
    'ইনস্টল করা ফন্টের নাম লিখুন। ডিফল্ট ফন্টের জন্য ফাঁকা রাখুন।',
    'যেমন Georgia',
  ],
  ur: [
    'سیرف فونٹس استعمال کریں',
    'ترجمہ شدہ متن کو ہدف زبان کے مطابق سیرف فونٹ میں دکھاتا ہے۔',
    'فونٹ متعین کریں',
    'انسٹال شدہ فونٹ کا نام لکھیں۔ ڈیفالٹ فونٹ کے لیے خالی چھوڑیں۔',
    'مثلاً Georgia',
  ],
  pcm: [
    'Use serif fonts',
    'E go show the translation with serif font wey match the language wey you dey translate to.',
    'Choose one font',
    'Type the name of one font wey dey your computer. Leave am empty to use the normal font.',
    'like Georgia',
  ],
};
const text = computed(() => labels[uiLanguage.value] || labels.en);
const preview = computed(() =>
  translationFontFamily({
    serif: preferences.ultraFastSerif.value,
    font: preferences.ultraFastFont.value,
    language: preferences.language.value,
  }),
);
function updateFont(value) {
  preferences.ultraFastFont.value = stripTranslationFont(value);
}
</script>
<template>
  <div v-if="preferences" class="ultra-fast-font-settings" data-setting="ultra-fast-font">
    <div class="setting-row">
      <span id="ultra-fast-serif-label">{{ text[0] }}</span>
      <AppSwitch
        v-model="preferences.ultraFastSerif.value"
        aria-labelledby="ultra-fast-serif-label"
        aria-describedby="ultra-fast-serif-hint"
      />
    </div>
    <p id="ultra-fast-serif-hint" class="muted">{{ text[1] }}</p>
    <div class="setting-row">
      <label id="ultra-fast-font-label" for="ultra-fast-font-input">{{ text[2] }}</label>
    </div>
    <AppTextField
      id="ultra-fast-font-input"
      :model-value="preferences.ultraFastFont.value"
      :placeholder="text[4]"
      :maxlength="MAX_TRANSLATION_FONT_LENGTH"
      spellcheck="false"
      aria-labelledby="ultra-fast-font-label"
      aria-describedby="ultra-fast-font-hint"
      @update:model-value="updateFont"
    />
    <p id="ultra-fast-font-hint" class="muted">{{ text[3] }}</p>
    <p
      v-if="preview"
      class="ultra-fast-font-preview"
      aria-hidden="true"
      :style="{ fontFamily: preview }"
    >
      Aa · 永 · あ · 한
    </p>
  </div>
</template>
<style scoped>
.ultra-fast-font-settings {
  display: grid;
  gap: 8px;
}
.ultra-fast-font-settings > .muted {
  margin: 0;
  line-height: 1.45;
}
.ultra-fast-font-preview {
  margin: 0;
  font-size: 17px;
  color: var(--text-secondary);
}
</style>
