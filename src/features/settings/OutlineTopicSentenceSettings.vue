<script setup>
import { computed, inject } from 'vue';
import { AppSwitch } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';

const preferences = inject('documentLanguagePreferences');
const labels = {
  en: [
    'Show topic sentences in outline',
    'Lists the first sentence of each long paragraph under the outline section that contains it. Reads the document text when the outline is open. With Jev topic-sentence checks on, sentences Jev rejects are hidden.',
  ],
  'zh-CN': [
    '在目录中显示主题句',
    '在目录中把每个长段落的第一句列在其所属小节下。打开目录时读取文档文字。启用 Jev 主题句判断后，隐藏 Jev 判定为否的句子。',
  ],
  'zh-TW': [
    '在目錄中顯示主題句',
    '在目錄中把每個長段落的第一句列在其所屬小節下。開啟目錄時讀取文件文字。啟用 Jev 主題句判斷後，隱藏 Jev 判定為否的句子。',
  ],
  ja: [
    '目次に主題文を表示',
    '長い段落の最初の文を、それを含む目次のセクションの下に表示します。目次を開くと文書のテキストを読み取ります。Jev の主題文判定を有効にすると、Jev が否定した文は非表示になります。',
  ],
  ko: [
    '목차에 주제 문장 표시',
    '각 긴 단락의 첫 문장을 해당 단락이 속한 목차 섹션 아래에 표시합니다. 목차를 열 때 문서 텍스트를 읽습니다. Jev 주제 문장 검사를 켜면 Jev가 아니라고 판단한 문장은 숨겨집니다.',
  ],
  fr: [
    'Afficher les phrases principales dans le sommaire',
    'Répertorie la première phrase de chaque paragraphe long sous la section du sommaire qui le contient. Lit le texte du document lorsque le sommaire est ouvert. Lorsque les vérifications de phrases principales par Jev sont activées, les phrases rejetées par Jev sont masquées.',
  ],
  es: [
    'Mostrar las oraciones principales en el contenido',
    'Muestra la primera oración de cada párrafo largo bajo la sección del contenido que lo contiene. Lee el texto del documento al abrir el contenido. Con las comprobaciones de oraciones principales de Jev activadas, se ocultan las oraciones que Jev rechaza.',
  ],
  de: [
    'Themensätze im Inhaltsverzeichnis anzeigen',
    'Listet den ersten Satz jedes langen Absatzes unter dem Inhaltsverzeichnis-Abschnitt auf, der ihn enthält. Liest den Dokumenttext, wenn das Inhaltsverzeichnis geöffnet wird. Bei aktivierter Jev-Prüfung von Themensätzen werden von Jev abgelehnte Sätze ausgeblendet.',
  ],
  pt: [
    'Mostrar frases principais no índice',
    'Apresenta a primeira frase de cada parágrafo longo sob a secção do índice que o contém. Lê o texto do documento quando o índice é aberto. Com as verificações de frases principais do Jev ativadas, as frases rejeitadas pelo Jev são ocultadas.',
  ],
  ru: [
    'Показывать тематические предложения в содержании',
    'Выводит первое предложение каждого длинного абзаца под разделом содержания, в котором он находится. При открытии содержания читает текст документа. Если включена проверка тематических предложений Jev, предложения, отклонённые Jev, скрываются.',
  ],
  ar: [
    'إظهار الجمل المحورية في جدول المحتويات',
    'يسرد الجملة الأولى من كل فقرة طويلة تحت قسم جدول المحتويات الذي يحتوي عليها. يقرأ نص المستند عند فتح جدول المحتويات. عند تفعيل فحوص الجمل المحورية بواسطة Jev، تُخفى الجمل التي يرفضها Jev.',
  ],
  arz: [
    'إظهار الجمل الأساسية في جدول المحتويات',
    'بيحط أول جملة من كل فقرة طويلة تحت قسم جدول المحتويات اللي فيه الفقرة. بيقرأ نص المستند لما تفتح جدول المحتويات. مع تشغيل فحص الجمل الأساسية بتاع Jev، الجمل اللي Jev بيرفضها بتتخفى.',
  ],
  hi: [
    'विषय-सूची में मुख्य वाक्य दिखाएँ',
    'हर लंबे अनुच्छेद का पहला वाक्य विषय-सूची के उस अनुभाग के नीचे दिखाता है जिसमें वह अनुच्छेद है। विषय-सूची खुलने पर दस्तावेज़ का टेक्स्ट पढ़ता है। Jev की मुख्य-वाक्य जाँच चालू होने पर Jev द्वारा अस्वीकार किए गए वाक्य छिप जाते हैं।',
  ],
  bn: [
    'বিষয়সূচিতে মূল বাক্য দেখান',
    'প্রতিটি দীর্ঘ অনুচ্ছেদের প্রথম বাক্য যে বিষয়সূচি বিভাগে আছে তার নিচে দেখায়। বিষয়সূচি খোলার সময় নথির লেখা পড়ে। Jev-এর মূল বাক্য পরীক্ষা চালু থাকলে Jev যে বাক্য প্রত্যাখ্যান করে সেগুলি লুকিয়ে যায়।',
  ],
  ur: [
    'فہرست میں موضوعی جملے دکھائیں',
    'ہر طویل پیراگراف کا پہلا جملہ فہرست کے اس حصے کے نیچے دکھاتا ہے جس میں وہ شامل ہے۔ فہرست کھولنے پر دستاویز کا متن پڑھتا ہے۔ Jev کی موضوعی جملوں کی جانچ فعال ہو تو Jev کے مسترد کردہ جملے چھپا دیے جاتے ہیں۔',
  ],
  pcm: [
    'Show topic sentences for contents',
    'E list the first sentence for every long paragraph under the contents section wey get am. E read document text when contents open. When Jev topic-sentence checks dey on, e hide sentences wey Jev reject.',
  ],
};
const text = computed(() => labels[uiLanguage.value] || labels.en);
</script>

<template>
  <div v-if="preferences" class="outline-topic-settings" data-setting="outline-topic-sentences">
    <div class="setting-row">
      <span id="outline-topic-sentences-label">{{ text[0] }}</span>
      <AppSwitch
        v-model="preferences.outlineTopicSentencesEnabled.value"
        aria-labelledby="outline-topic-sentences-label"
        aria-describedby="outline-topic-sentences-help"
      />
    </div>
    <p id="outline-topic-sentences-help" class="muted">{{ text[1] }}</p>
  </div>
</template>

<style scoped>
.outline-topic-settings {
  display: grid;
  gap: 8px;
}
.outline-topic-settings > .muted {
  margin: 0;
  line-height: 1.45;
}
</style>
