<script setup>
import { computed, inject } from 'vue';
import { AppSwitch } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';

const preferences = inject('documentLanguagePreferences');
const labels = {
  en: [
    'Check topic sentences with Jev',
    'Use Jev to check whether the first sentence expresses the paragraph’s main idea when topic-sentence emphasis or outline topic sentences are on. Sends paragraph text concurrently using the shared Jev API Token; failed requests assume yes and keep the emphasis.',
  ],
  'zh-CN': [
    '使用 Jev 判断主题句',
    '启用主题句强调或在目录中显示主题句后，使用 Jev 判断段落第一句是否表达段落主旨。使用共用的 Jev API Token 并发发送段落文本；请求失败时按“是”处理，保留强调。',
  ],
  'zh-TW': [
    '使用 Jev 判斷主題句',
    '啟用主題句強調或在目錄中顯示主題句後，使用 Jev 判斷段落第一句是否表達段落主旨。使用共用的 Jev API Token 並行傳送段落文字；請求失敗時按「是」處理，保留強調。',
  ],
  ja: [
    'Jev で主題文を確認',
    '主題文の強調または目次の主題文表示がオンのとき、段落の最初の文が段落の主旨を表しているか Jev で確認します。共通の Jev API Token を使って段落テキストを並行送信します。リクエストに失敗した場合は「はい」とみなし、強調を維持します。',
  ],
  ko: [
    'Jev로 주제 문장 확인',
    '주제 문장 강조 또는 목차의 주제 문장 표시가 켜져 있을 때 단락의 첫 문장이 단락의 요지를 나타내는지 Jev로 확인합니다. 공용 Jev API Token을 사용해 단락 텍스트를 동시에 전송하며, 요청에 실패하면 그렇다고 간주해 강조를 유지합니다.',
  ],
  fr: [
    'Vérifier les phrases principales avec Jev',
    'Utilise Jev pour vérifier si la première phrase exprime l’idée principale du paragraphe lorsque la mise en évidence des phrases principales ou leur affichage dans le sommaire est activé. Envoie les textes des paragraphes simultanément avec le Token API Jev partagé ; en cas d’échec, considère la réponse comme positive et conserve la mise en évidence.',
  ],
  es: [
    'Comprobar las oraciones principales con Jev',
    'Usa Jev para comprobar si la primera oración expresa la idea principal del párrafo cuando está activado el resaltado de oraciones principales o su vista en el contenido. Envía los textos de los párrafos simultáneamente mediante el Token API de Jev compartido; si falla una solicitud, se da por válida y se mantiene el resaltado.',
  ],
  de: [
    'Themensätze mit Jev prüfen',
    'Verwendet Jev, um zu prüfen, ob der erste Satz die Hauptaussage des Absatzes ausdrückt, wenn die Hervorhebung von Themensätzen oder ihre Anzeige im Inhaltsverzeichnis aktiviert ist. Sendet Absatztexte parallel mit dem gemeinsamen Jev-API-Token; bei fehlgeschlagenen Anfragen wird „Ja“ angenommen und die Hervorhebung beibehalten.',
  ],
  pt: [
    'Verificar frases principais com o Jev',
    'Utiliza o Jev para verificar se a primeira frase exprime a ideia principal do parágrafo quando o destaque de frases principais ou a sua apresentação no índice está ativo. Envia os textos dos parágrafos em simultâneo utilizando o Token de API Jev partilhado; em caso de falha, assume que sim e mantém o destaque.',
  ],
  ru: [
    'Проверять тематические предложения с помощью Jev',
    'Использует Jev, чтобы проверить, выражает ли первое предложение основную мысль абзаца, когда включено выделение тематических предложений или их показ в содержании. Тексты абзацев отправляются параллельно с общим токеном API Jev; при ошибке запроса считается, что ответ положительный, и выделение сохраняется.',
  ],
  ar: [
    'فحص الجمل المحورية باستخدام Jev',
    'استخدم Jev للتحقق مما إذا كانت الجملة الأولى تعبّر عن الفكرة الرئيسية للفقرة عند تفعيل إبراز الجمل المحورية أو عرضها في جدول المحتويات. يرسل نصوص الفقرات بالتوازي باستخدام رمز API المشترك لـ Jev؛ عند فشل الطلبات، تُفترض الإجابة بنعم ويظل الإبراز مفعّلًا.',
  ],
  arz: [
    'فحص الجمل الأساسية باستخدام Jev',
    'استخدم Jev عشان يتأكد إن أول جملة بتعبّر عن الفكرة الرئيسية للفقرة لما يكون إبراز الجمل الأساسية أو عرضها في جدول المحتويات شغّال. نصوص الفقرات بتتبعت مع بعض باستخدام رمز API المشترك بتاع Jev؛ لو الطلب فشل، بنفترض إن الإجابة آه وبيفضل الإبراز شغّال.',
  ],
  hi: [
    'Jev से मुख्य वाक्य जाँचें',
    'जब मुख्य वाक्य का ज़ोर या विषय-सूची में मुख्य वाक्य दिखाना चालू हो, तब Jev से जाँचता है कि अनुच्छेद का पहला वाक्य उसका मुख्य विचार व्यक्त करता है या नहीं। साझा Jev API Token का उपयोग करके अनुच्छेद का टेक्स्ट एक साथ भेजता है; अनुरोध विफल होने पर हाँ मानकर ज़ोर बनाए रखता है।',
  ],
  bn: [
    'Jev দিয়ে মূল বাক্য পরীক্ষা করুন',
    'মূল বাক্যে জোর বা বিষয়সূচিতে মূল বাক্য দেখানো চালু থাকলে অনুচ্ছেদের প্রথম বাক্যটি তার মূল ভাব প্রকাশ করে কি না Jev দিয়ে পরীক্ষা করে। শেয়ার করা Jev API Token ব্যবহার করে অনুচ্ছেদের লেখা একসঙ্গে পাঠায়; অনুরোধ ব্যর্থ হলে হ্যাঁ ধরে জোর বজায় রাখে।',
  ],
  ur: [
    'Jev سے موضوعی جملے چیک کریں',
    'جب موضوعی جملوں کو نمایاں کرنا یا انہیں فہرست میں دکھانا فعال ہو تو Jev سے چیک کرتا ہے کہ پیراگراف کا پہلا جملہ اس کا مرکزی خیال بیان کرتا ہے یا نہیں۔ مشترکہ Jev API Token کے ذریعے پیراگراف کا متن بیک وقت بھیجا جاتا ہے؛ درخواست ناکام ہونے پر ہاں فرض کر کے نمایاں کرنا برقرار رہتا ہے۔',
  ],
  pcm: [
    'Check topic sentences with Jev',
    'Use Jev check if the first sentence show the main idea of the paragraph when topic-sentence emphasis or topic sentences for contents dey on. Send paragraph text together with the shared Jev API Token; if request no work, assume yes and keep the emphasis.',
  ],
};
const text = computed(() => labels[uiLanguage.value] || labels.en);
</script>

<template>
  <div v-if="preferences" class="topic-sentence-settings" data-setting="topic-sentence-detection">
    <div class="setting-row">
      <span id="topic-sentence-detection-label">{{ text[0] }}</span>
      <AppSwitch
        v-model="preferences.topicSentenceDetection.value"
        aria-labelledby="topic-sentence-detection-label"
        aria-describedby="topic-sentence-detection-help"
      />
    </div>
    <p id="topic-sentence-detection-help" class="muted">{{ text[1] }}</p>
  </div>
</template>

<style scoped>
.topic-sentence-settings {
  display: grid;
  gap: 8px;
}
.topic-sentence-settings > .muted {
  margin: 0;
  line-height: 1.45;
}
</style>
