<script setup>
import { computed, inject } from 'vue';
import { AppSwitch } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';

const preferences = inject('documentLanguagePreferences');
// Labels: [setting, hint]. English is the fallback.
const labels = {
  en: [
    'Don’t translate references',
    'Stops translating after a References or Bibliography heading in the second half of the document.',
  ],
  'zh-CN': [
    '不翻译参考文献',
    '在文档后半部分遇到“参考文献”“References”等标题后，停止翻译之后的内容。',
  ],
  'zh-TW': [
    '不翻譯參考文獻',
    '在文件後半部分遇到「參考文獻」「References」等標題後，停止翻譯之後的內容。',
  ],
  ja: [
    '参考文献を翻訳しない',
    '書類の後半で「参考文献」や「References」などの見出しが見つかると、それ以降は翻訳しません。',
  ],
  ko: [
    '참고문헌 번역 안 함',
    '문서 후반부에서 ‘참고문헌’이나 ‘References’ 같은 제목이 나오면 그 뒤로는 번역하지 않습니다.',
  ],
  fr: [
    'Ne pas traduire les références',
    'Arrête la traduction après un titre « Références » ou « Bibliographie » dans la seconde moitié du document.',
  ],
  es: [
    'No traducir las referencias',
    'Deja de traducir tras un título «Referencias» o «Bibliografía» en la segunda mitad del documento.',
  ],
  de: [
    'Literaturverzeichnis nicht übersetzen',
    'Beendet die Übersetzung nach einer Überschrift wie „Literatur“ oder „References“ in der zweiten Hälfte des Dokuments.',
  ],
  pt: [
    'Não traduzir as referências',
    'Para de traduzir após um título «Referências» ou «Bibliografia» na segunda metade do documento.',
  ],
  ru: [
    'Не переводить список литературы',
    'Перевод останавливается после заголовка «Литература» или «References» во второй половине документа.',
  ],
  ar: [
    'عدم ترجمة المراجع',
    'يتوقف عن الترجمة بعد عنوان «المراجع» أو «References» في النصف الثاني من المستند.',
  ],
  arz: [
    'متترجمش المراجع',
    'بيوقف الترجمة بعد عنوان «المراجع» أو «References» في النص التاني من المستند.',
  ],
  hi: [
    'संदर्भों का अनुवाद न करें',
    'दस्तावेज़ के दूसरे आधे भाग में “संदर्भ” या “References” शीर्षक के बाद अनुवाद रोक देता है।',
  ],
  bn: [
    'তথ্যসূত্র অনুবাদ করবেন না',
    'নথির দ্বিতীয়ার্ধে “তথ্যসূত্র” বা “References” শিরোনামের পরে অনুবাদ থামিয়ে দেয়।',
  ],
  ur: [
    'حوالہ جات کا ترجمہ نہ کریں',
    'دستاویز کے دوسرے نصف میں “حوالہ جات” یا “References” کی سرخی کے بعد ترجمہ روک دیتا ہے۔',
  ],
  pcm: [
    'No translate references',
    'E go stop to translate after References or Bibliography heading for second half of the document.',
  ],
};
const text = computed(() => labels[uiLanguage.value] || labels.en);
</script>

<template>
  <div v-if="preferences" class="skip-references-settings" data-setting="skip-references">
    <div class="setting-row">
      <span id="skip-references-label">{{ text[0] }}</span>
      <AppSwitch
        v-model="preferences.skipReferences.value"
        aria-labelledby="skip-references-label"
        aria-describedby="skip-references-hint"
      />
    </div>
    <p id="skip-references-hint" class="muted">{{ text[1] }}</p>
  </div>
</template>

<style scoped>
.skip-references-settings {
  display: grid;
  gap: 8px;
}
.skip-references-settings > .muted {
  margin: 0;
  line-height: 1.45;
}
</style>
