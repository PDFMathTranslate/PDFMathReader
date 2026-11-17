<script setup>
import { computed, inject, ref } from 'vue';
import { AppButton, AppSwitch } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';

const preferences = inject('documentLanguagePreferences');
const labels = {
  en: [
    'Use a remote Precise kernel',
    'Translates pages with a zotero-pdf2zh compatible server over HTTP when its health check passes, and with the local kernel otherwise. The server uses its own translation service and credentials; no API key is sent. Pages are uploaded as one-page PDFs and, because the server returns only the PDF, have no reading text layer. The selected translation service and glossaries are not used for remotely translated pages.',
    'Server URL',
    'Translation service on the server (optional)',
    'Check connection',
    'Connected',
    'Unavailable',
    'Enter a valid http:// or https:// URL.',
  ],
  'zh-CN': [
    '使用远程精确内核',
    '健康检查通过时，通过 HTTP 使用兼容 zotero-pdf2zh 的服务器翻译页面，否则使用本地内核。服务器使用自己的翻译服务和凭据，不会发送任何 API 密钥。页面以单页 PDF 上传；服务器只返回 PDF，因此没有阅读文本层。所选翻译服务和术语表不会用于远程翻译的页面。',
    '服务器地址',
    '服务器上的翻译服务（可选）',
    '检查连接',
    '已连接',
    '不可用',
    '请输入有效的 http:// 或 https:// 地址。',
  ],
  'zh-TW': [
    '使用遠端精確核心',
    '健康檢查通過時，透過 HTTP 使用相容 zotero-pdf2zh 的伺服器翻譯頁面，否則使用本機核心。伺服器使用自己的翻譯服務與憑證，不會傳送任何 API 金鑰。頁面以單頁 PDF 上傳；伺服器只回傳 PDF，因此沒有閱讀文字層。所選翻譯服務與詞彙表不會用於遠端翻譯的頁面。',
    '伺服器位址',
    '伺服器上的翻譯服務（選填）',
    '檢查連線',
    '已連線',
    '無法使用',
    '請輸入有效的 http:// 或 https:// 位址。',
  ],
  ja: [
    'リモートの高精度カーネルを使用',
    'ヘルスチェックに合格した場合は HTTP 経由で zotero-pdf2zh 互換サーバーを使ってページを翻訳し、それ以外の場合はローカルカーネルを使います。サーバーは独自の翻訳サービスと認証情報を使用し、API キーは送信されません。ページは 1 ページの PDF としてアップロードされ、サーバーは PDF のみを返すため、読書用テキストレイヤーはありません。選択した翻訳サービスと用語集はリモート翻訳ページでは使用されません。',
    'サーバー URL',
    'サーバー上の翻訳サービス（任意）',
    '接続を確認',
    '接続済み',
    '利用できません',
    '有効な http:// または https:// URL を入力してください。',
  ],
  ko: [
    '원격 정밀 커널 사용',
    '상태 확인에 통과하면 HTTP를 통해 zotero-pdf2zh 호환 서버로 페이지를 번역하고, 그렇지 않으면 로컬 커널을 사용합니다. 서버는 자체 번역 서비스와 자격 증명을 사용하며 API 키는 전송하지 않습니다. 페이지는 한 페이지 PDF로 업로드되고 서버는 PDF만 반환하므로 읽기 텍스트 레이어가 없습니다. 선택한 번역 서비스와 용어집은 원격으로 번역된 페이지에 사용되지 않습니다.',
    '서버 URL',
    '서버의 번역 서비스(선택 사항)',
    '연결 확인',
    '연결됨',
    '사용할 수 없음',
    '유효한 http:// 또는 https:// URL을 입력하세요.',
  ],
  fr: [
    'Utiliser un noyau Précis distant',
    'Traduit les pages avec un serveur compatible avec zotero-pdf2zh via HTTP lorsque son contrôle d’état réussit, et avec le noyau local dans le cas contraire. Le serveur utilise son propre service de traduction et ses identifiants ; aucune clé API n’est envoyée. Les pages sont téléversées sous forme de PDF d’une page et, comme le serveur ne renvoie que le PDF, elles ne possèdent pas de couche de texte pour la lecture. Le service de traduction et les glossaires sélectionnés ne sont pas utilisés pour les pages traduites à distance.',
    'URL du serveur',
    'Service de traduction du serveur (facultatif)',
    'Vérifier la connexion',
    'Connecté',
    'Indisponible',
    'Saisissez une URL http:// ou https:// valide.',
  ],
  es: [
    'Usar un núcleo Preciso remoto',
    'Traduce las páginas con un servidor compatible con zotero-pdf2zh mediante HTTP cuando supera la comprobación de estado y, en caso contrario, con el núcleo local. El servidor usa su propio servicio de traducción y sus credenciales; no se envía ninguna clave API. Las páginas se suben como PDF de una sola página y, como el servidor solo devuelve el PDF, no tienen capa de texto para la lectura. El servicio de traducción y los glosarios seleccionados no se usan en las páginas traducidas remotamente.',
    'URL del servidor',
    'Servicio de traducción del servidor (opcional)',
    'Comprobar conexión',
    'Conectado',
    'No disponible',
    'Introduce una URL http:// o https:// válida.',
  ],
  de: [
    'Entfernten Präzise-Kernel verwenden',
    'Übersetzt Seiten per HTTP mit einem mit zotero-pdf2zh kompatiblen Server, wenn dessen Gesundheitsprüfung erfolgreich ist, und andernfalls mit dem lokalen Kernel. Der Server verwendet seinen eigenen Übersetzungsdienst und seine Zugangsdaten; es wird kein API-Schlüssel gesendet. Seiten werden als einseitige PDFs hochgeladen. Da der Server nur das PDF zurückgibt, besitzen sie keine Textebene zum Lesen. Der ausgewählte Übersetzungsdienst und die Glossare werden für entfernt übersetzte Seiten nicht verwendet.',
    'Server-URL',
    'Übersetzungsdienst auf dem Server (optional)',
    'Verbindung prüfen',
    'Verbunden',
    'Nicht verfügbar',
    'Geben Sie eine gültige http://- oder https://-URL ein.',
  ],
  pt: [
    'Utilizar um kernel Preciso remoto',
    'Traduz as páginas com um servidor compatível com zotero-pdf2zh através de HTTP quando a verificação de estado é bem-sucedida e, caso contrário, com o kernel local. O servidor utiliza o seu próprio serviço de tradução e credenciais; nenhuma chave de API é enviada. As páginas são carregadas como PDFs de uma página e, como o servidor devolve apenas o PDF, não têm camada de texto para leitura. O serviço de tradução e os glossários selecionados não são utilizados nas páginas traduzidas remotamente.',
    'URL do servidor',
    'Serviço de tradução no servidor (opcional)',
    'Verificar ligação',
    'Ligado',
    'Indisponível',
    'Introduza um URL http:// ou https:// válido.',
  ],
  ru: [
    'Использовать удалённое точное ядро',
    'Переводит страницы по HTTP с помощью сервера, совместимого с zotero-pdf2zh, если проверка его состояния проходит успешно, и с помощью локального ядра в противном случае. Сервер использует собственный сервис перевода и учётные данные; ключ API не отправляется. Страницы загружаются как одностраничные PDF, а поскольку сервер возвращает только PDF, текстового слоя для чтения нет. Выбранный сервис перевода и глоссарии не используются для страниц, переведённых удалённо.',
    'URL сервера',
    'Сервис перевода на сервере (необязательно)',
    'Проверить соединение',
    'Подключено',
    'Недоступно',
    'Введите действительный URL http:// или https://.',
  ],
  ar: [
    'استخدام نواة دقيقة بعيدة',
    'يترجم الصفحات باستخدام خادم متوافق مع zotero-pdf2zh عبر HTTP عند نجاح فحص حالته، ويستخدم النواة المحلية خلاف ذلك. يستخدم الخادم خدمة الترجمة وبيانات الاعتماد الخاصة به؛ ولا يُرسل أي مفتاح API. تُرفع الصفحات كملفات PDF من صفحة واحدة، وبما أن الخادم يعيد ملف PDF فقط، فلا تحتوي على طبقة نص للقراءة. لا تُستخدم خدمة الترجمة وقواميس المصطلحات المحددة للصفحات المترجمة عن بُعد.',
    'عنوان URL للخادم',
    'خدمة الترجمة على الخادم (اختياري)',
    'فحص الاتصال',
    'متصل',
    'غير متاح',
    'أدخل عنوان URL صالحًا يبدأ بـ http:// أو https://.',
  ],
  arz: [
    'استخدام نواة دقيقة بعيدة',
    'بيترجم الصفحات بسيرفر متوافق مع zotero-pdf2zh عن طريق HTTP لما فحص الحالة ينجح، وبالنواة المحلية في غير كده. السيرفر بيستخدم خدمة الترجمة وبيانات الدخول بتوعه؛ ومفيش أي مفتاح API بيتبعت. الصفحات بتترفع كملفات PDF من صفحة واحدة، وبما إن السيرفر بيرجع الـ PDF بس، مافيهاش طبقة نص للقراءة. خدمة الترجمة وقواميس المصطلحات اللي اخترتها مش بتتستخدم للصفحات اللي اتترجمت عن بُعد.',
    'عنوان URL للسيرفر',
    'خدمة الترجمة على السيرفر (اختياري)',
    'فحص الاتصال',
    'متصل',
    'مش متاح',
    'اكتب عنوان URL صحيح يبدأ بـ http:// أو https://.',
  ],
  hi: [
    'दूरस्थ सटीक कर्नेल का उपयोग करें',
    'स्वास्थ्य जाँच सफल होने पर HTTP के ज़रिए zotero-pdf2zh संगत सर्वर से पेजों का अनुवाद करता है और अन्यथा स्थानीय कर्नेल का उपयोग करता है। सर्वर अपनी अनुवाद सेवा और क्रेडेंशियल का उपयोग करता है; कोई API कुंजी नहीं भेजी जाती। पेज एक-पेज PDF के रूप में अपलोड किए जाते हैं और सर्वर केवल PDF लौटाता है, इसलिए उनमें पढ़ने के लिए टेक्स्ट लेयर नहीं होती। चुनी गई अनुवाद सेवा और शब्दावलियाँ दूरस्थ रूप से अनूदित पेजों पर उपयोग नहीं होतीं।',
    'सर्वर URL',
    'सर्वर पर अनुवाद सेवा (वैकल्पिक)',
    'कनेक्शन जाँचें',
    'कनेक्टेड',
    'उपलब्ध नहीं',
    'मान्य http:// या https:// URL दर्ज करें।',
  ],
  bn: [
    'দূরবর্তী নির্ভুল কার্নেল ব্যবহার করুন',
    'স্বাস্থ্য পরীক্ষা সফল হলে HTTP-এর মাধ্যমে zotero-pdf2zh-সঙ্গত সার্ভার দিয়ে পেজ অনুবাদ করে, নইলে স্থানীয় কার্নেল ব্যবহার করে। সার্ভার নিজের অনুবাদ পরিষেবা ও পরিচয়পত্র ব্যবহার করে; কোনো API কী পাঠানো হয় না। পেজ এক-পেজ PDF হিসেবে আপলোড হয় এবং সার্ভার শুধু PDF ফেরত দেয় বলে পড়ার টেক্সট স্তর থাকে না। নির্বাচিত অনুবাদ পরিষেবা ও শব্দতালিকা দূরবর্তী অনুবাদ করা পেজে ব্যবহার হয় না।',
    'সার্ভার URL',
    'সার্ভারের অনুবাদ পরিষেবা (ঐচ্ছিক)',
    'সংযোগ পরীক্ষা করুন',
    'সংযুক্ত',
    'পাওয়া যাচ্ছে না',
    'একটি বৈধ http:// বা https:// URL লিখুন।',
  ],
  ur: [
    'دور دراز درست کرنل استعمال کریں',
    'صحت کی جانچ کامیاب ہونے پر HTTP کے ذریعے zotero-pdf2zh سے مطابقت رکھنے والے سرور سے صفحات کا ترجمہ کرتا ہے، ورنہ مقامی کرنل استعمال کرتا ہے۔ سرور اپنی ترجمہ سروس اور اسناد استعمال کرتا ہے؛ کوئی API کلید نہیں بھیجی جاتی۔ صفحات ایک صفحے کی PDF کے طور پر اپ لوڈ ہوتے ہیں اور چونکہ سرور صرف PDF واپس کرتا ہے، ان میں مطالعے کے لیے متن کی تہہ نہیں ہوتی۔ منتخب ترجمہ سروس اور لغتیں دور دراز ترجمہ شدہ صفحات کے لیے استعمال نہیں ہوتیں۔',
    'سرور URL',
    'سرور کی ترجمہ سروس (اختیاری)',
    'کنکشن چیک کریں',
    'منسلک',
    'دستیاب نہیں',
    'درست http:// یا https:// URL درج کریں۔',
  ],
  pcm: [
    'Use remote Precise kernel',
    'E translate pages with zotero-pdf2zh server through HTTP when health check pass, and use local kernel when e no pass. The server get im own translation service and login; no API key dey go there. Pages dey upload as one-page PDFs and, because server return PDF only, dem no get reading text layer. The translation service and glossaries wey you choose no dey work for pages translated remotely.',
    'Server URL',
    'Translation service for server (optional)',
    'Check connection',
    'E connect',
    'E no dey available',
    'Enter correct http:// or https:// URL.',
  ],
};
const text = computed(() => labels[uiLanguage.value] || labels.en);
const checking = ref(false);
const result = ref('');

async function check() {
  checking.value = true;
  result.value = '';
  try {
    const response = await fetch('/api/remote-kernel/health', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: preferences.remoteKernelUrl.value.trim() }),
    });
    if (response.status === 400) result.value = text.value[7];
    else {
      const body = await response.json();
      result.value = body.ok
        ? `${text.value[5]}${body.version ? ` (${body.version})` : ''}`
        : `${text.value[6]}${body.reason ? `: ${body.reason}` : ''}`;
    }
  } catch {
    result.value = text.value[6];
  } finally {
    checking.value = false;
  }
}
</script>

<template>
  <div v-if="preferences" class="remote-kernel-settings" data-setting="remote-kernel">
    <div class="setting-row">
      <span id="remote-kernel-label">{{ text[0] }}</span>
      <AppSwitch
        v-model="preferences.remoteKernelEnabled.value"
        aria-labelledby="remote-kernel-label"
        aria-describedby="remote-kernel-help"
      />
    </div>
    <p id="remote-kernel-help" class="muted">{{ text[1] }}</p>
    <template v-if="preferences.remoteKernelEnabled.value">
      <label for="remote-kernel-url">{{ text[2] }}</label>
      <input
        id="remote-kernel-url"
        v-model="preferences.remoteKernelUrl.value"
        type="url"
        placeholder="http://127.0.0.1:8890"
        autocomplete="off"
        spellcheck="false"
        maxlength="2048"
      />
      <label for="remote-kernel-service">{{ text[3] }}</label>
      <input
        id="remote-kernel-service"
        v-model="preferences.remoteKernelService.value"
        type="text"
        placeholder="siliconflowfree"
        autocomplete="off"
        spellcheck="false"
        maxlength="100"
      />
      <div class="remote-kernel-check">
        <AppButton
          :disabled="checking || !preferences.remoteKernelUrl.value.trim()"
          @click="check"
          >{{ text[4] }}</AppButton
        >
        <span v-if="result" class="muted" role="status">{{ result }}</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.remote-kernel-settings {
  display: grid;
  gap: 8px;
}
.remote-kernel-settings > .muted {
  margin: 0;
  line-height: 1.45;
}
input {
  display: block;
  width: 100%;
  box-sizing: border-box;
}
.remote-kernel-check {
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
