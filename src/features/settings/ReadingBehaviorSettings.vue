<script setup>
import { computed } from 'vue';
import { AppSegment, AppSegmentedControl, AppSwitch } from '../../ui/controls.mjs';
import { t, uiLanguage } from '../../i18n/index.mjs';
import SmoothScrollingSettings from './SmoothScrollingSettings.vue';
const optimizeParagraphGaps = defineModel('optimizeParagraphGaps');
const reducePadding = defineModel('reducePadding');
const windowMode = defineModel('windowMode');
// Labels: [setting, Tabs, Windows, description].
const windowModeLabels = {
  en: ['Open documents in', 'Tabs', 'Windows', 'Tabs keep documents in one window, like Finder.'],
  'zh-CN': ['文档打开方式', '标签页', '窗口', '标签页模式像访达一样在同一窗口中排列文档。'],
  'zh-TW': ['文件打開方式', '標籤頁', '視窗', '標籤頁模式像 Finder 一樣在同一視窗中排列文件。'],
  ja: [
    '書類を開く方法',
    'タブ',
    'ウインドウ',
    'タブでは Finder と同様に書類を 1 つのウインドウにまとめます。',
  ],
  ko: ['문서 열기 방식', '탭', '윈도우', '탭은 Finder처럼 문서를 하나의 윈도우에 모읍니다.'],
  fr: [
    'Ouvrir les documents dans',
    'Onglets',
    'Fenêtres',
    'Les onglets regroupent les documents dans une fenêtre, comme le Finder.',
  ],
  es: [
    'Abrir documentos en',
    'Pestañas',
    'Ventanas',
    'Las pestañas reúnen los documentos en una ventana, como el Finder.',
  ],
  de: [
    'Dokumente öffnen in',
    'Tabs',
    'Fenstern',
    'Tabs bündeln Dokumente wie im Finder in einem Fenster.',
  ],
  pt: [
    'Abrir documentos em',
    'Abas',
    'Janelas',
    'As abas reúnem os documentos numa janela, como no Finder.',
  ],
  ru: [
    'Открывать документы',
    'Во вкладках',
    'В окнах',
    'Вкладки собирают документы в одном окне, как в Finder.',
  ],
  ar: [
    'فتح المستندات في',
    'علامات تبويب',
    'نوافذ',
    'تجمع علامات التبويب المستندات في نافذة واحدة، كما في Finder.',
  ],
  arz: ['افتح المستندات في', 'تابات', 'نوافذ', 'التابات بتجمع المستندات في نافذة واحدة زي Finder.'],
  hi: [
    'दस्तावेज़ खोलें',
    'टैब में',
    'विंडो में',
    'टैब Finder की तरह दस्तावेज़ों को एक विंडो में रखते हैं।',
  ],
  bn: ['নথি খুলুন', 'ট্যাবে', 'উইন্ডোতে', 'ট্যাব Finder-এর মতো নথিগুলো এক উইন্ডোতে রাখে।'],
  ur: [
    'دستاویزات کھولیں',
    'ٹیبز میں',
    'ونڈوز میں',
    'ٹیبز Finder کی طرح دستاویزات کو ایک ونڈو میں رکھتے ہیں۔',
  ],
  pcm: [
    'Open documents for',
    'Tabs',
    'Windows',
    'Tabs dey keep documents for one window, like Finder.',
  ],
};
const windowModeText = computed(() => windowModeLabels[uiLanguage.value] || windowModeLabels.en);
const title = computed(
  () =>
    ({
      en: 'Reading behavior',
      'zh-CN': '阅读行为',
      'zh-TW': '閱讀行為',
      ja: '読書動作',
      ko: '읽기 동작',
      fr: 'Comportement de lecture',
      es: 'Comportamiento de lectura',
      de: 'Leseverhalten',
      pt: 'Comportamento de leitura',
      ru: 'Поведение при чтении',
      ar: 'سلوك القراءة',
      arz: 'سلوك القراءة',
      hi: 'पठन व्यवहार',
      bn: 'পড়ার আচরণ',
      ur: 'پڑھنے کا رویہ',
      pcm: 'Reading behavior',
    })[uiLanguage.value] || 'Reading behavior',
);
</script>
<template>
  <section class="settings-section" aria-labelledby="settings-reading-behavior">
    <h3 id="settings-reading-behavior">{{ title }}</h3>
    <div class="settings-section-body">
      <div class="setting-row" data-setting="window-mode">
        <span id="window-mode-label">{{ windowModeText[0] }}</span>
        <AppSegmentedControl v-model="windowMode" aria-labelledby="window-mode-label"
          ><AppSegment value="tabs">{{ windowModeText[1] }}</AppSegment
          ><AppSegment value="window">{{ windowModeText[2] }}</AppSegment></AppSegmentedControl
        >
      </div>
      <p class="muted">{{ windowModeText[3] }}</p>
      <div class="setting-row" data-setting="optimize-paragraph-gaps">
        <span id="optimize-paragraph-gaps-label">{{ t('settings.optimizeParagraphGaps') }}</span>
        <AppSwitch
          v-model="optimizeParagraphGaps"
          aria-labelledby="optimize-paragraph-gaps-label"
        />
      </div>
      <p class="muted">{{ t('settings.optimizeParagraphGapsDescription') }}</p>
      <div class="setting-row" data-setting="reduce-padding">
        <span id="reduce-padding-label">{{ t('appearance.reducePadding') }}</span>
        <AppSwitch v-model="reducePadding" aria-labelledby="reduce-padding-label" />
      </div>
      <SmoothScrollingSettings />
    </div>
  </section>
</template>
<style scoped>
.settings-section-body {
  display: grid;
  gap: 10px;
}
</style>
