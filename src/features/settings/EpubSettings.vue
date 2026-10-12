<script setup>
import { computed, inject } from 'vue';
import { AppSwitch } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';
const preferences = inject('documentLanguagePreferences');
const labels = {
  en: [
    'Open EPUB books',
    'Converts EPUB files into paged documents so they can be read, translated and annotated like PDFs. The original file is never modified. The first opening may take a few seconds.',
  ],
  'zh-CN': [
    '打开 EPUB 电子书',
    '将 EPUB 文件转换为分页文档，可像 PDF 一样阅读、翻译和批注。不会修改原文件。首次打开可能需要几秒。',
  ],
  'zh-TW': [
    '開啟 EPUB 電子書',
    '將 EPUB 檔案轉換為分頁文件，可像 PDF 一樣閱讀、翻譯和註解。不會修改原始檔案。首次開啟可能需要幾秒。',
  ],
  ja: [
    'EPUB ブックを開く',
    'EPUB ファイルをページ形式の文書に変換し、PDF と同様に閲覧・翻訳・注釈できるようにします。元のファイルは変更されません。初回は数秒かかる場合があります。',
  ],
  ko: [
    'EPUB 책 열기',
    'EPUB 파일을 페이지 문서로 변환해 PDF처럼 읽고, 번역하고, 주석을 달 수 있습니다. 원본 파일은 수정되지 않습니다. 처음 열 때 몇 초가 걸릴 수 있습니다.',
  ],
  fr: [
    'Ouvrir les livres EPUB',
    'Convertit les fichiers EPUB en documents paginés pour les lire, traduire et annoter comme des PDF. Le fichier original n’est jamais modifié. La première ouverture peut prendre quelques secondes.',
  ],
  es: [
    'Abrir libros EPUB',
    'Convierte los archivos EPUB en documentos paginados para leerlos, traducirlos y anotarlos como PDF. El archivo original nunca se modifica. La primera apertura puede tardar unos segundos.',
  ],
  de: [
    'EPUB-Bücher öffnen',
    'Wandelt EPUB-Dateien in seitenbasierte Dokumente um, die wie PDFs gelesen, übersetzt und kommentiert werden können. Die Originaldatei wird nie verändert. Das erste Öffnen kann einige Sekunden dauern.',
  ],
  pt: [
    'Abrir livros EPUB',
    'Converte arquivos EPUB em documentos paginados para ler, traduzir e anotar como PDFs. O arquivo original nunca é modificado. A primeira abertura pode levar alguns segundos.',
  ],
  ru: [
    'Открывать книги EPUB',
    'Преобразует файлы EPUB в постраничные документы, которые можно читать, переводить и аннотировать как PDF. Исходный файл не изменяется. Первое открытие может занять несколько секунд.',
  ],
  ar: [
    'فتح كتب EPUB',
    'يحوّل ملفات EPUB إلى مستندات مقسّمة إلى صفحات لقراءتها وترجمتها والتعليق عليها مثل ملفات PDF. لا يُعدَّل الملف الأصلي أبدًا. قد يستغرق الفتح الأول بضع ثوانٍ.',
  ],
  arz: [
    'فتح كتب EPUB',
    'بيحوّل ملفات EPUB لمستندات بصفحات عشان تقراها وتترجمها وتعلّق عليها زي ملفات PDF. الملف الأصلي مش بيتغيّر خالص. أول فتح ممكن ياخد كام ثانية.',
  ],
  hi: [
    'EPUB पुस्तकें खोलें',
    'EPUB फ़ाइलों को पृष्ठों वाले दस्तावेज़ों में बदलता है, ताकि उन्हें PDF की तरह पढ़ा, अनुवादित और एनोटेट किया जा सके। मूल फ़ाइल कभी नहीं बदली जाती। पहली बार खोलने में कुछ सेकंड लग सकते हैं।',
  ],
  bn: [
    'EPUB বই খুলুন',
    'EPUB ফাইলকে পৃষ্ঠাভিত্তিক নথিতে রূপান্তর করে, যাতে PDF-এর মতো পড়া, অনুবাদ ও টীকা যোগ করা যায়। মূল ফাইল কখনো পরিবর্তন করা হয় না। প্রথমবার খুলতে কয়েক সেকেন্ড লাগতে পারে।',
  ],
  ur: [
    'EPUB کتابیں کھولیں',
    'EPUB فائلوں کو صفحات والی دستاویزات میں تبدیل کرتا ہے تاکہ انہیں PDF کی طرح پڑھا، ترجمہ اور حاشیہ لگایا جا سکے۔ اصل فائل کبھی تبدیل نہیں ہوتی۔ پہلی بار کھولنے میں چند سیکنڈ لگ سکتے ہیں۔',
  ],
  pcm: [
    'Open EPUB books',
    'E go change EPUB files to documents wey get pages, so you fit read, translate and annotate dem like PDF. E no dey touch the original file. The first time wey you open am fit take small seconds.',
  ],
};
const text = computed(() => labels[uiLanguage.value] || labels.en);
</script>
<template>
  <div v-if="preferences" class="epub-settings" data-setting="epub">
    <div class="setting-row">
      <span id="epub-enabled-label">{{ text[0] }}</span>
      <AppSwitch
        v-model="preferences.epubEnabled.value"
        aria-labelledby="epub-enabled-label"
        aria-describedby="epub-enabled-hint"
      />
    </div>
    <p id="epub-enabled-hint" class="muted">{{ text[1] }}</p>
  </div>
</template>
<style scoped>
.epub-settings {
  display: grid;
  gap: 8px;
}
.epub-settings > .muted {
  margin: 0;
  line-height: 1.45;
}
</style>
