<script setup>
import { computed, inject } from 'vue';
import { AppSwitch } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';
const preferences = inject('documentLanguagePreferences');
const labels = computed(
  () =>
    ({
      bn: [
        'নথির ভাষা যাচাই (পরীক্ষামূলক)',
        'Jev ব্যবহার করে নথির ভাষা নির্ণয় করুন; লক্ষ্য ভাষার সঙ্গে মিললে স্বয়ংক্রিয় অনুবাদ বাদ যাবে, তবে হাতে অনুবাদ করা যাবে। প্রথম ৩টি পৃষ্ঠার প্রতিটি থেকে শুধু প্রথম ১০০টি অক্ষর পাঠানো হয়; ব্যর্থতা বা অনিশ্চয়তার ক্ষেত্রে স্বয়ংক্রিয় অনুবাদ চলবে।',
        'কাস্টম Jev API Token',
        'কাস্টম Token আগে ব্যবহার করা হবে; ফাঁকা রাখলে স্থানীয় TYPESAFE_API_KEY পরিবেশ ভেরিয়েবল ব্যবহার হবে।',
      ],
      arz: [
        'فحص لغة المستند (تجريبي)',
        'استخدم Jev لتخطي الترجمة التلقائية عندما تطابق لغة المستند اللغة الهدف. تظل الترجمة اليدوية متاحة. يُرسل أول 100 حرف فقط من كل صفحة من أول 3 صفحات. عند الفشل أو عدم اليقين، تستمر الترجمة التلقائية.',
        'رمز API مخصص لـ Jev',
        'تُعطى الأولوية للرمز المخصص. اتركه فارغًا لاستخدام متغير البيئة المحلي TYPESAFE_API_KEY.',
      ],
      de: [
        'Dokumentsprache prüfen (experimentell)',
        'Verwende Jev, um die automatische Übersetzung zu überspringen, wenn das Dokument der Zielsprache entspricht. Eine manuelle Übersetzung bleibt möglich. Nur die ersten 100 Zeichen der ersten 3 Seiten werden gesendet. Bei Fehlern oder Unsicherheit wird die automatische Übersetzung fortgesetzt.',
        'Benutzerdefiniertes Jev-API-Token',
        'Das benutzerdefinierte Token hat Vorrang. Leer lassen, um die lokale Umgebungsvariable TYPESAFE_API_KEY zu verwenden.',
      ],
      hi: [
        'दस्तावेज़ की भाषा जाँचें (प्रायोगिक)',
        'जब दस्तावेज़ लक्ष्य भाषा से मेल खाए, तो स्वचालित अनुवाद छोड़ने के लिए Jev का उपयोग करें। मैन्युअल अनुवाद उपलब्ध रहेगा। पहली 3 पृष्ठों में से प्रत्येक के केवल पहले 100 वर्ण भेजे जाते हैं। विफलता या अनिश्चितता पर स्वचालित अनुवाद जारी रहता है।',
        'कस्टम Jev API Token',
        'कस्टम Token को प्राथमिकता दी जाती है। खाली छोड़ने पर स्थानीय TYPESAFE_API_KEY पर्यावरण चर इस्तेमाल होता है।',
      ],
      pcm: [
        'Check document language (we still dey test am)',
        'Use Jev make e skip automatic translation when document language match target language. You fit still translate am by hand. Na first 100 characters from each of first 3 pages dem dey send. If e fail or e no sure, automatic translation go continue.',
        'Custom Jev API Token',
        'Custom Token get priority. Leave am empty make e use local TYPESAFE_API_KEY environment variable.',
      ],
      ur: [
        'دستاویز کی زبان کی جانچ (تجرباتی)',
        'جب دستاویز ہدف زبان سے مطابقت رکھے تو خودکار ترجمہ چھوڑنے کے لیے Jev استعمال کریں۔ دستی ترجمہ دستیاب رہے گا۔ پہلے 3 صفحات میں سے ہر صفحے کے صرف پہلے 100 حروف بھیجے جاتے ہیں۔ ناکامی یا غیر یقینی کی صورت میں خودکار ترجمہ جاری رہتا ہے۔',
        'حسب ضرورت Jev API Token',
        'حسب ضرورت Token کو ترجیح حاصل ہے۔ خالی چھوڑنے پر مقامی TYPESAFE_API_KEY ماحول کا متغیر استعمال ہوگا۔',
      ],
      pt: [
        'Verificação do idioma do documento (experimental)',
        'Use o Jev para ignorar a tradução automática quando o idioma do documento corresponder ao idioma de destino. A tradução manual continua disponível. Apenas os primeiros 100 caracteres de cada uma das 3 primeiras páginas são enviados. Em caso de falha ou incerteza, a tradução automática continua.',
        'Token de API Jev personalizado',
        'O Token personalizado tem prioridade. Deixe em branco para usar a variável de ambiente local TYPESAFE_API_KEY.',
      ],
      ru: [
        'Проверка языка документа (экспериментально)',
        'Используйте Jev, чтобы пропустить автоматический перевод, если язык документа совпадает с целевым языком. Ручной перевод остаётся доступным. Отправляются только первые 100 символов каждой из первых 3 страниц. При ошибке или неопределённости автоматический перевод продолжается.',
        'Пользовательский токен API Jev',
        'Пользовательский токен имеет приоритет. Оставьте поле пустым, чтобы использовать локальную переменную окружения TYPESAFE_API_KEY.',
      ],
      ar: [
        'فحص لغة المستند (تجريبي)',
        'استخدم Jev لتخطي الترجمة التلقائية عندما تطابق لغة المستند اللغة الهدف. تظل الترجمة اليدوية متاحة. يُرسل أول 100 حرف فقط من كل صفحة من أول 3 صفحات. عند الفشل أو عدم اليقين، تستمر الترجمة التلقائية.',
        'رمز API مخصص لـ Jev',
        'تُعطى الأولوية للرمز المخصص. اتركه فارغًا لاستخدام متغير البيئة المحلي TYPESAFE_API_KEY.',
      ],
      'zh-CN': [
        '文档语言判断（实验性）',
        '通过 Jev 判断文档语言；与目标语言一致时跳过自动翻译，仍可手动翻译。仅发送前三页每页前 100 个字符；失败或不确定时继续自动翻译。',
        '自定义 Jev API Token',
        '优先使用自定义 Token；留空则使用本机 TYPESAFE_API_KEY 环境变量。',
      ],
      'zh-TW': [
        '文件語言判斷（實驗性）',
        '透過 Jev 判斷文件語言；與目標語言一致時略過自動翻譯，仍可手動翻譯。僅傳送前三頁每頁前 100 個字元；失敗或不確定時繼續自動翻譯。',
        '自訂 Jev API Token',
        '優先使用自訂 Token；留空則使用本機 TYPESAFE_API_KEY 環境變數。',
      ],
      ja: [
        '文書言語の判定（実験的）',
        'Jev で翻訳先言語と一致する文書の自動翻訳をスキップします。手動翻訳は可能です。先頭 3 ページから各 100 文字のみ送信し、失敗や不確実な結果では自動翻訳を続けます。',
        'カスタム Jev API Token',
        'カスタム Token を優先します。空欄の場合は TYPESAFE_API_KEY 環境変数を使用します。',
      ],
      ko: [
        '문서 언어 감지 (실험적)',
        'Jev가 대상 언어와 일치하면 자동 번역을 건너뜁니다. 수동 번역은 가능합니다. 처음 3페이지에서 각 100자만 전송하며 실패하거나 불확실하면 자동 번역을 계속합니다.',
        '사용자 지정 Jev API Token',
        '사용자 지정 Token이 우선입니다. 비워 두면 TYPESAFE_API_KEY 환경 변수를 사용합니다.',
      ],
      fr: [
        'Détection de langue (expérimentale)',
        'Jev désactive la traduction automatique si la langue correspond à la langue cible. La traduction manuelle reste disponible. Seuls les 100 premiers caractères des 3 premières pages sont envoyés. En cas d’échec ou d’incertitude, la traduction continue.',
        'Token API Jev personnalisé',
        'Priorité au Token personnalisé. Sinon, utilise la variable locale TYPESAFE_API_KEY.',
      ],
      es: [
        'Detección de idioma (experimental)',
        'Jev omite la traducción automática si el idioma coincide con el idioma de destino. La traducción manual sigue disponible. Solo se envían los primeros 100 caracteres de las 3 primeras páginas. Si falla o hay dudas, la traducción continúa.',
        'Token API Jev personalizado',
        'El Token personalizado tiene prioridad. Si está vacío, se usa la variable local TYPESAFE_API_KEY.',
      ],
    })[uiLanguage.value] || [
      'Document language check (experimental)',
      'Use Jev to skip automatic translation when the document matches the target language. Manual translation remains available. Sends only the first 100 characters from each of the first 3 pages. On failure or uncertainty, automatic translation continues.',
      'Custom Jev API Token',
      'Custom Token takes priority. Leave blank to use the local TYPESAFE_API_KEY environment variable.',
    ],
);
</script>
<template>
  <div data-setting="document-language-detection">
    <div class="setting-row">
      <span id="document-language-label">{{ labels[0] }}</span>
      <AppSwitch
        v-model="preferences.documentLanguageDetection.value"
        aria-labelledby="document-language-label"
        aria-describedby="document-language-help"
      />
    </div>
    <p id="document-language-help" class="muted">{{ labels[1] }}</p>
    <label for="jev-api-token">{{ labels[2] }}</label>
    <input
      id="jev-api-token"
      v-model="preferences.jevApiToken.value"
      type="password"
      autocomplete="off"
      spellcheck="false"
      maxlength="4096"
      aria-describedby="jev-api-help"
    />
    <p id="jev-api-help" class="muted">{{ labels[3] }}</p>
  </div>
</template>
<style scoped>
input {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin-top: 6px;
}
</style>
