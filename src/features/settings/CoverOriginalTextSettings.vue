<script setup>
import { computed, inject } from 'vue';
import { AppSwitch } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';

const preferences = inject('documentLanguagePreferences');
// Labels: [setting, hint]. English is the fallback.
const labels = {
  en: [
    'Show translations over the original',
    'Where a translation overlaps the original text, the paper colour is laid under the translation so only the translation shows. Useful for scanned and OCR documents, whose original text is part of the page image. Applied when pages are drawn; the file is never changed.',
  ],
  'zh-CN': [
    '译文优先显示',
    '译文与原文重叠时，在译文下方铺一层与纸张同色的底色，只显示译文。适合扫描件、OCR 等图片文档，这类文档的原文是页面图像的一部分。仅在绘制页面时生效，不会修改文件。',
  ],
  'zh-TW': [
    '譯文優先顯示',
    '譯文與原文重疊時，在譯文下方鋪一層與紙張同色的底色，只顯示譯文。適合掃描檔、OCR 等圖片文件，這類文件的原文是頁面影像的一部分。僅在繪製頁面時生效，不會修改檔案。',
  ],
  ja: [
    '訳文を優先して表示',
    '訳文が原文と重なる箇所では、訳文の下に紙と同じ色を敷き、訳文だけを表示します。原文がページ画像の一部であるスキャンや OCR の書類に適しています。ページの描画時にのみ適用され、ファイルは変更されません。',
  ],
  ko: [
    '번역문 우선 표시',
    '번역문이 원문과 겹치는 곳에서는 번역문 아래에 종이와 같은 색을 깔아 번역문만 보이게 합니다. 원문이 페이지 이미지의 일부인 스캔·OCR 문서에 유용합니다. 페이지를 그릴 때만 적용되며 파일은 변경되지 않습니다.',
  ],
  fr: [
    'Afficher la traduction par-dessus l’original',
    'Là où la traduction chevauche le texte original, la couleur du papier est posée sous la traduction pour ne montrer qu’elle. Utile pour les documents numérisés ou OCR, dont le texte original fait partie de l’image de la page. Appliqué à l’affichage ; le fichier n’est jamais modifié.',
  ],
  es: [
    'Mostrar la traducción sobre el original',
    'Donde la traducción se superpone al texto original, se coloca el color del papel bajo la traducción para que solo se vea ella. Útil en documentos escaneados u OCR, cuyo texto original forma parte de la imagen de la página. Se aplica al dibujar las páginas; el archivo no se modifica.',
  ],
  de: [
    'Übersetzung über dem Original anzeigen',
    'Wo die Übersetzung den Originaltext überlagert, wird die Papierfarbe unter die Übersetzung gelegt, sodass nur sie sichtbar ist. Nützlich für gescannte und OCR-Dokumente, deren Originaltext Teil des Seitenbilds ist. Wirkt nur beim Zeichnen der Seiten; die Datei bleibt unverändert.',
  ],
  pt: [
    'Mostrar a tradução sobre o original',
    'Onde a tradução se sobrepõe ao texto original, a cor do papel é colocada sob a tradução para que só ela apareça. Útil para documentos digitalizados ou OCR, cujo texto original faz parte da imagem da página. Aplicado ao desenhar as páginas; o ficheiro nunca é alterado.',
  ],
  ru: [
    'Показывать перевод поверх оригинала',
    'Там, где перевод накладывается на исходный текст, под перевод подкладывается цвет бумаги, и виден только перевод. Полезно для сканов и OCR-документов, где исходный текст — часть изображения страницы. Применяется при отрисовке страниц; файл не изменяется.',
  ],
  ar: [
    'إظهار الترجمة فوق النص الأصلي',
    'حيث تتداخل الترجمة مع النص الأصلي، يوضع لون الورق تحت الترجمة فلا يظهر إلا هي. مفيد للمستندات الممسوحة ضوئيًا ومستندات OCR التي يكون نصها الأصلي جزءًا من صورة الصفحة. يُطبَّق عند رسم الصفحات ولا يُعدَّل الملف.',
  ],
  arz: [
    'اعرض الترجمة فوق الأصل',
    'لما الترجمة تيجي فوق النص الأصلي، بيتحط لون الورق تحت الترجمة فتبان الترجمة بس. مفيد للمستندات المتصورة سكانر وملفات OCR اللي نصها الأصلي جزء من صورة الصفحة. بيشتغل وقت رسم الصفحات والملف مش بيتغير.',
  ],
  hi: [
    'मूल पाठ के ऊपर अनुवाद दिखाएँ',
    'जहाँ अनुवाद मूल पाठ पर चढ़ता है, वहाँ अनुवाद के नीचे काग़ज़ का रंग बिछा दिया जाता है ताकि केवल अनुवाद दिखे। स्कैन और OCR दस्तावेज़ों के लिए उपयोगी, जिनका मूल पाठ पृष्ठ की छवि का हिस्सा होता है। केवल पृष्ठ बनाते समय लागू होता है; फ़ाइल नहीं बदलती।',
  ],
  bn: [
    'মূল লেখার ওপরে অনুবাদ দেখান',
    'যেখানে অনুবাদ মূল লেখার ওপর পড়ে, সেখানে অনুবাদের নিচে কাগজের রঙ বিছিয়ে দেওয়া হয়, যাতে শুধু অনুবাদ দেখা যায়। স্ক্যান ও OCR নথির জন্য উপযোগী, যেগুলোর মূল লেখা পৃষ্ঠার ছবির অংশ। শুধু পৃষ্ঠা আঁকার সময় প্রযোজ্য; ফাইল বদলায় না।',
  ],
  ur: [
    'اصل متن کے اوپر ترجمہ دکھائیں',
    'جہاں ترجمہ اصل متن پر آ جائے، وہاں ترجمے کے نیچے کاغذ کا رنگ بچھا دیا جاتا ہے تاکہ صرف ترجمہ نظر آئے۔ اسکین اور OCR دستاویزات کے لیے مفید، جن کا اصل متن صفحے کی تصویر کا حصہ ہوتا ہے۔ صرف صفحہ بناتے وقت لاگو ہوتا ہے؛ فائل تبدیل نہیں ہوتی۔',
  ],
  pcm: [
    'Show translation on top of the original',
    'Where translation dey cover the original text, e go put paper colour under the translation so na only the translation go show. E good for scanned and OCR documents wey their original text be part of the page picture. E dey work when page dey draw; e no dey change the file.',
  ],
};
const text = computed(() => labels[uiLanguage.value] || labels.en);
</script>

<template>
  <div v-if="preferences" class="cover-original-text-settings" data-setting="cover-original-text">
    <div class="setting-row">
      <span id="cover-original-text-label">{{ text[0] }}</span>
      <AppSwitch
        v-model="preferences.coverOriginalText.value"
        aria-labelledby="cover-original-text-label"
        aria-describedby="cover-original-text-hint"
      />
    </div>
    <p id="cover-original-text-hint" class="muted">{{ text[1] }}</p>
  </div>
</template>

<style scoped>
.cover-original-text-settings {
  display: grid;
  gap: 8px;
}
.cover-original-text-settings > .muted {
  margin: 0;
  line-height: 1.45;
}
</style>
