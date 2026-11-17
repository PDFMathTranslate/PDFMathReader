<script setup>
import { computed, inject } from 'vue';
import { AppSwitch } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';

const preferences = inject('documentLanguagePreferences');
const labels = {
  en: [
    'Auto-discovery',
    'When kernel sharing is turned on from the Share Kernels with iPhone and iPad menu, advertise this computer on your local network so PDFMathReader can find it. The pairing code is never included in the advertisement.',
  ],
  'zh-CN': [
    '自动发现',
    '从“与 iPhone 和 iPad 共享内核”菜单开启内核共享后，在本地网络广播此电脑，让 PDFMathReader 可以找到它。配对码不会包含在广播中。',
  ],
  'zh-TW': [
    '自動探索',
    '從「與 iPhone 和 iPad 分享核心」選單開啟核心分享後，在區域網路廣播此電腦，讓 PDFMathReader 可以找到它。配對碼不會包含在廣播中。',
  ],
  ja: [
    '自動検出',
    '「iPhone と iPad でカーネルを共有」メニューからカーネル共有をオンにすると、このコンピュータをローカルネットワーク上で通知し、PDFMathReader が見つけられるようにします。ペアリングコードは通知に含まれません。',
  ],
  ko: [
    '자동 검색',
    'iPhone 및 iPad와 커널 공유 메뉴에서 커널 공유를 켜면 이 컴퓨터를 로컬 네트워크에 알리고 PDFMathReader가 찾을 수 있게 합니다. 페어링 코드는 알림에 포함되지 않습니다.',
  ],
  fr: [
    'Détection automatique',
    'Lorsque le partage de noyau est activé dans le menu Partager les noyaux avec l’iPhone et l’iPad, annonce cet ordinateur sur votre réseau local afin que PDFMathReader puisse le trouver. Le code d’association n’est jamais inclus dans l’annonce.',
  ],
  es: [
    'Detección automática',
    'Al activar el uso compartido del núcleo desde el menú Compartir núcleos con iPhone y iPad, anuncia este ordenador en tu red local para que PDFMathReader pueda encontrarlo. El código de emparejamiento nunca se incluye en el anuncio.',
  ],
  de: [
    'Automatische Erkennung',
    'Wenn die Kernel-Freigabe im Menü Kernel mit iPhone und iPad teilen aktiviert wird, wird dieser Computer in Ihrem lokalen Netzwerk bekannt gemacht, damit PDFMathReader ihn finden kann. Der Kopplungscode wird nie in der Ankündigung übertragen.',
  ],
  pt: [
    'Deteção automática',
    'Quando a partilha do kernel é ativada no menu Partilhar kernels com o iPhone e o iPad, anuncia este computador na rede local para que o PDFMathReader o possa encontrar. O código de emparelhamento nunca é incluído no anúncio.',
  ],
  ru: [
    'Автоматическое обнаружение',
    'При включении общего доступа к ядру в меню «Поделиться ядрами с iPhone и iPad» этот компьютер объявляется в локальной сети, чтобы PDFMathReader мог его найти. Код сопряжения никогда не передаётся в объявлении.',
  ],
  ar: [
    'الاكتشاف التلقائي',
    'عند تفعيل مشاركة النواة من قائمة «مشاركة النوى مع iPhone وiPad»، يعلن هذا الكمبيوتر عن نفسه على شبكتك المحلية حتى يتمكن PDFMathReader من العثور عليه. لا يتم تضمين رمز الاقتران في الإعلان مطلقًا.',
  ],
  arz: [
    'الاكتشاف التلقائي',
    'لما تشغّل مشاركة النواة من قائمة «مشاركة النوى مع iPhone وiPad»، الكمبيوتر ده بيعلن عن نفسه على الشبكة المحلية عشان PDFMathReader يقدر يلاقيه. كود الاقتران عمره ما بيتحط في الإعلان.',
  ],
  hi: [
    'अपने आप खोजें',
    'iPhone और iPad के साथ कर्नेल साझा करें मेनू से कर्नेल साझाकरण चालू करने पर, इस कंप्यूटर को आपके स्थानीय नेटवर्क पर घोषित करता है ताकि PDFMathReader इसे ढूँढ सके। पेयरिंग कोड कभी भी घोषणा में शामिल नहीं होता।',
  ],
  bn: [
    'স্বয়ংক্রিয় আবিষ্কার',
    'iPhone ও iPad-এর সঙ্গে কার্নেল শেয়ার করুন মেনু থেকে কার্নেল শেয়ারিং চালু করলে এই কম্পিউটারকে স্থানীয় নেটওয়ার্কে জানানো হয়, যাতে PDFMathReader এটি খুঁজে পায়। পেয়ারিং কোড কখনও ঘোষণায় থাকে না।',
  ],
  ur: [
    'خودکار دریافت',
    'iPhone اور iPad کے ساتھ کرنل شیئر کریں مینو سے کرنل شیئرنگ آن کرنے پر اس کمپیوٹر کا آپ کے مقامی نیٹ ورک پر اعلان کیا جاتا ہے تاکہ PDFMathReader اسے تلاش کر سکے۔ جوڑا بنانے کا کوڈ کبھی اعلان میں شامل نہیں ہوتا۔',
  ],
  pcm: [
    'Find by itself',
    'When you turn on kernel sharing from the Share Kernels with iPhone and iPad menu, app go announce this computer for your local network so PDFMathReader fit find am. Pairing code no dey inside the announcement.',
  ],
};
const text = computed(() => labels[uiLanguage.value] || labels.en);
</script>

<template>
  <div v-if="preferences" class="companion-discovery-settings" data-setting="companion-discovery">
    <div class="setting-row">
      <span id="companion-discovery-label">{{ text[0] }}</span>
      <AppSwitch
        v-model="preferences.companionDiscoveryEnabled.value"
        aria-labelledby="companion-discovery-label"
      />
    </div>
    <p class="muted">{{ text[1] }}</p>
  </div>
</template>

<style scoped>
.companion-discovery-settings {
  display: grid;
  gap: 8px;
}
.companion-discovery-settings > .muted {
  margin: 0;
  line-height: 1.45;
}
</style>
