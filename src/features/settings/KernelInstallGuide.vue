<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { uiLanguage } from '../../i18n/index.mjs';
import { AppButton } from '../../ui/controls.mjs';
const props = defineProps({ engine: String, request: Function, disabled: Boolean });
const emit = defineEmits(['ready', 'busy']);
const busy = ref(false),
  failure = ref(''),
  failedStep = ref(-1),
  ready = ref(false);
const states = ref(['pending', 'pending', 'pending', 'pending']);
const copyByLanguage = {
  en: {
    title: 'Installation guide',
    intro: 'No commands needed. Check your environment and install missing components.',
    steps: ['Check environment', 'Prepare uv', 'Install selected kernel', 'Verify the kernel'],
    descriptions: [
      'Detect existing installations.',
      'uv downloads Python and dependencies. Existing installations are reused.',
      'Downloads may take several minutes. Keep the app open.',
      'Configure a translation service, then open a PDF.',
    ],
    start: 'Start installation',
    retry: 'Retry this step',
    running: 'Working…',
    done: 'Ready to use',
    pending: 'Pending',
    working: 'In progress',
    complete: 'Complete',
    failed: 'Failed',
    help: 'uv installation help',
    network:
      'Check your connection, disk space and write permissions, then retry. Completed installations are reused.',
  },
  'zh-CN': {
    title: '安装引导',
    intro: '无需输入命令。按下开始，我们会检测环境并安装缺少的组件。',
    steps: ['检测运行环境', '准备 uv 安装工具', '安装所选翻译内核', '验证内核可以启动'],
    descriptions: [
      '检查本机已有的安装。',
      'uv 用来下载 Python 和内核依赖；已有安装会自动跳过。',
      '首次安装需要联网下载，可能需要几分钟，请保持应用打开。',
      '完成后可在翻译服务中配置服务，再打开 PDF 阅读。',
    ],
    start: '开始安装',
    retry: '重试当前步骤',
    running: '正在处理，请稍候…',
    done: '安装完成，可以使用了',
    pending: '待处理',
    working: '进行中',
    complete: '已完成',
    failed: '失败',
    help: '查看 uv 安装帮助',
    network: '请检查网络连接、磁盘空间和目录写入权限后重试。已完成的步骤不会重复安装。',
  },
  'zh-TW': {
    title: '安裝指南',
    intro: '無需輸入指令。按下開始後，我們會檢查環境並安裝缺少的元件。',
    steps: ['檢查執行環境', '準備 uv 安裝工具', '安裝所選翻譯核心', '確認核心可以啟動'],
    descriptions: [
      '檢查本機已有的安裝。',
      'uv 用來下載 Python 和核心相依套件；已有的安裝會自動略過。',
      '首次安裝需要連線下載，可能需要幾分鐘，請保持應用程式開啟。',
      '完成後可在翻譯服務中設定服務，再開啟 PDF 閱讀。',
    ],
    start: '開始安裝',
    retry: '重試此步驟',
    running: '處理中，請稍候…',
    done: '安裝完成，可以使用了',
    pending: '待處理',
    working: '進行中',
    complete: '已完成',
    failed: '失敗',
    help: '查看 uv 安裝說明',
    network: '請檢查網路連線、磁碟空間和目錄寫入權限後重試。已完成的步驟不會重複安裝。',
  },
  ja: {
    title: 'インストールガイド',
    intro:
      'コマンド入力は不要です。「開始」を押すと、環境を確認して不足しているコンポーネントをインストールします。',
    steps: [
      '環境を確認',
      'uv インストールツールを準備',
      '選択したカーネルをインストール',
      'カーネルの起動を確認',
    ],
    descriptions: [
      '既存のインストールを確認します。',
      'uv が Python とカーネルの依存関係をダウンロードします。既存のインストールは再利用されます。',
      '初回のインストールではオンラインでダウンロードするため、数分かかることがあります。アプリを開いたままにしてください。',
      '完了したら翻訳サービスを設定し、PDF を開きます。',
    ],
    start: 'インストールを開始',
    retry: 'この手順を再試行',
    running: '処理中です。しばらくお待ちください…',
    done: 'インストール完了。使用できます',
    pending: '保留中',
    working: '進行中',
    complete: '完了',
    failed: '失敗',
    help: 'uv のインストールヘルプ',
    network:
      'ネットワーク接続、ディスク容量、フォルダへの書き込み権限を確認してから再試行してください。完了したインストールは再利用されます。',
  },
  ko: {
    title: '설치 안내',
    intro:
      '명령어를 입력할 필요가 없습니다. 시작을 누르면 환경을 확인하고 필요한 구성 요소를 설치합니다.',
    steps: ['환경 확인', 'uv 설치 도구 준비', '선택한 커널 설치', '커널 시작 확인'],
    descriptions: [
      '기존 설치를 확인합니다.',
      'uv가 Python과 커널 종속 항목을 다운로드합니다. 이미 설치된 항목은 다시 사용합니다.',
      '처음 설치할 때는 인터넷에서 다운로드하므로 몇 분이 걸릴 수 있습니다. 앱을 열어 두세요.',
      '완료되면 번역 서비스를 설정한 다음 PDF를 엽니다.',
    ],
    start: '설치 시작',
    retry: '이 단계 다시 시도',
    running: '처리 중입니다. 잠시 기다려 주세요…',
    done: '설치가 완료되어 사용할 수 있습니다',
    pending: '대기 중',
    working: '진행 중',
    complete: '완료',
    failed: '실패',
    help: 'uv 설치 도움말',
    network:
      '네트워크 연결, 디스크 공간, 폴더 쓰기 권한을 확인한 후 다시 시도하세요. 완료된 설치는 재사용됩니다.',
  },
  fr: {
    title: 'Guide d’installation',
    intro:
      'Aucune commande n’est nécessaire. Vérifiez votre environnement et installez les composants manquants.',
    steps: [
      'Vérifier l’environnement',
      'Préparer l’outil d’installation uv',
      'Installer le noyau sélectionné',
      'Vérifier le démarrage du noyau',
    ],
    descriptions: [
      'Détecter les installations existantes.',
      'uv télécharge Python et les dépendances. Les installations existantes sont réutilisées.',
      'Le premier téléchargement peut prendre plusieurs minutes. Laissez l’application ouverte.',
      'Configurez un service de traduction, puis ouvrez un PDF.',
    ],
    start: 'Commencer l’installation',
    retry: 'Réessayer cette étape',
    running: 'Traitement en cours, veuillez patienter…',
    done: 'Installation terminée, prêt à l’emploi',
    pending: 'En attente',
    working: 'En cours',
    complete: 'Terminé',
    failed: 'Échec',
    help: 'Aide à l’installation de uv',
    network:
      'Vérifiez votre connexion, l’espace disque et les droits d’écriture, puis réessayez. Les installations terminées sont réutilisées.',
  },
  es: {
    title: 'Guía de instalación',
    intro: 'No necesitas usar comandos. Comprueba el entorno e instala los componentes que falten.',
    steps: [
      'Comprobar el entorno',
      'Preparar la herramienta de instalación uv',
      'Instalar el núcleo seleccionado',
      'Verificar el inicio del núcleo',
    ],
    descriptions: [
      'Detectar las instalaciones existentes.',
      'uv descarga Python y las dependencias. Se reutilizan las instalaciones existentes.',
      'La primera descarga puede tardar varios minutos. Mantén abierta la aplicación.',
      'Configura un servicio de traducción y abre un PDF.',
    ],
    start: 'Iniciar instalación',
    retry: 'Reintentar este paso',
    running: 'Procesando, espera un momento…',
    done: 'Instalación completada, ya puedes usarla',
    pending: 'Pendiente',
    working: 'En curso',
    complete: 'Completado',
    failed: 'Error',
    help: 'Ayuda para instalar uv',
    network:
      'Comprueba la conexión, el espacio del disco y los permisos de escritura, y vuelve a intentarlo. Las instalaciones completadas se reutilizan.',
  },
  de: {
    title: 'Installationsanleitung',
    intro: 'Keine Befehle nötig. Überprüfe deine Umgebung und installiere fehlende Komponenten.',
    steps: [
      'Umgebung prüfen',
      'uv-Installationswerkzeug vorbereiten',
      'Ausgewählten Kernel installieren',
      'Kernelstart überprüfen',
    ],
    descriptions: [
      'Vorhandene Installationen erkennen.',
      'uv lädt Python und Abhängigkeiten herunter. Vorhandene Installationen werden wiederverwendet.',
      'Der erste Download kann mehrere Minuten dauern. Lass die App geöffnet.',
      'Richte einen Übersetzungsdienst ein und öffne anschließend ein PDF.',
    ],
    start: 'Installation starten',
    retry: 'Diesen Schritt erneut versuchen',
    running: 'Wird verarbeitet, bitte warten …',
    done: 'Installation abgeschlossen, bereit zur Verwendung',
    pending: 'Ausstehend',
    working: 'In Bearbeitung',
    complete: 'Abgeschlossen',
    failed: 'Fehlgeschlagen',
    help: 'Hilfe zur uv-Installation',
    network:
      'Überprüfe deine Verbindung, den Speicherplatz und die Schreibberechtigungen, und versuche es erneut. Abgeschlossene Installationen werden wiederverwendet.',
  },
  pt: {
    title: 'Guia de instalação',
    intro: 'Não são necessários comandos. Verifique o ambiente e instale os componentes em falta.',
    steps: [
      'Verificar o ambiente',
      'Preparar a ferramenta de instalação uv',
      'Instalar o kernel selecionado',
      'Verificar o arranque do kernel',
    ],
    descriptions: [
      'Detetar instalações existentes.',
      'O uv descarrega o Python e as dependências. As instalações existentes são reutilizadas.',
      'A primeira instalação requer uma transferência e pode demorar alguns minutos. Mantenha a aplicação aberta.',
      'Configure um serviço de tradução e abra um PDF.',
    ],
    start: 'Iniciar instalação',
    retry: 'Tentar novamente este passo',
    running: 'A processar, aguarde…',
    done: 'Instalação concluída, pronta a utilizar',
    pending: 'Pendente',
    working: 'Em curso',
    complete: 'Concluído',
    failed: 'Falhou',
    help: 'Ajuda da instalação do uv',
    network:
      'Verifique a ligação, o espaço em disco e as permissões de escrita e tente novamente. As instalações concluídas são reutilizadas.',
  },
  ru: {
    title: 'Руководство по установке',
    intro: 'Команды не нужны. Мы проверим окружение и установим недостающие компоненты.',
    steps: [
      'Проверить окружение',
      'Подготовить установщик uv',
      'Установить выбранное ядро',
      'Проверить запуск ядра',
    ],
    descriptions: [
      'Проверить существующие установки.',
      'uv загрузит Python и зависимости. Уже установленные компоненты будут использованы повторно.',
      'При первой установке потребуется загрузка из интернета, которая может занять несколько минут. Не закрывайте приложение.',
      'После завершения настройте сервис перевода и откройте PDF.',
    ],
    start: 'Начать установку',
    retry: 'Повторить этот шаг',
    running: 'Выполняется, подождите…',
    done: 'Установка завершена, всё готово',
    pending: 'Ожидание',
    working: 'Выполняется',
    complete: 'Завершено',
    failed: 'Ошибка',
    help: 'Справка по установке uv',
    network:
      'Проверьте подключение, свободное место и права записи, затем повторите попытку. Завершённые установки будут использованы повторно.',
  },
  ar: {
    title: 'دليل التثبيت',
    intro: 'لا حاجة إلى إدخال أوامر. اضغط «بدء» وسنفحص البيئة ونثبّت المكوّنات الناقصة.',
    steps: [
      'فحص البيئة',
      'إعداد أداة تثبيت uv',
      'تثبيت نواة الترجمة المحددة',
      'التحقق من إمكانية تشغيل النواة',
    ],
    descriptions: [
      'التحقق من التثبيتات الموجودة على الجهاز.',
      'تستخدم uv لتنزيل Python وتبعيات النواة؛ وستُتخطّى التثبيتات الموجودة تلقائيًا.',
      'يتطلب التثبيت الأول تنزيلًا من الإنترنت وقد يستغرق دقائق. اترك التطبيق مفتوحًا.',
      'بعد الانتهاء، اضبط خدمة ترجمة ثم افتح ملف PDF.',
    ],
    start: 'بدء التثبيت',
    retry: 'إعادة محاولة هذه الخطوة',
    running: 'جارٍ التنفيذ، يُرجى الانتظار…',
    done: 'اكتمل التثبيت، وأصبح جاهزًا للاستخدام',
    pending: 'معلّق',
    working: 'قيد التنفيذ',
    complete: 'مكتمل',
    failed: 'فشل',
    help: 'عرض تعليمات تثبيت uv',
    network:
      'تحقق من اتصال الشبكة ومساحة القرص وأذونات الكتابة على المجلد، ثم أعد المحاولة. لن تُثبّت الخطوات المكتملة مرة أخرى.',
  },
  arz: {
    title: 'دليل التثبيت',
    intro: 'مش محتاج تكتب أوامر. دوس «ابدأ» وإحنا هنفحص البيئة ونثبّت المكوّنات الناقصة.',
    steps: [
      'افحص البيئة',
      'جهّز أداة تثبيت uv',
      'ثبّت النواة المختارة',
      'اتأكد إن النواة تقدر تشتغل',
    ],
    descriptions: [
      'افحص الحاجات المتثبتة على الجهاز.',
      'uv بتنزل Python واعتمادات النواة؛ والحاجات المتثبتة هتتستخدم تاني تلقائيًا.',
      'أول تثبيت محتاج تنزيل من النت وممكن ياخد كام دقيقة. سيب التطبيق مفتوح.',
      'بعد ما تخلص، ظبّط خدمة ترجمة وبعدين افتح PDF.',
    ],
    start: 'ابدأ التثبيت',
    retry: 'حاول الخطوة دي تاني',
    running: 'جاري التنفيذ، استنى شوية…',
    done: 'التثبيت خلص، جاهز للاستخدام',
    pending: 'مستني',
    working: 'شغال',
    complete: 'خلص',
    failed: 'فشل',
    help: 'مساعدة تثبيت uv',
    network:
      'اتأكد من اتصال النت ومساحة القرص وصلاحيات الكتابة، وبعدين حاول تاني. الحاجات اللي خلص تثبيتها هتتستخدم تاني.',
  },
  hi: {
    title: 'इंस्टॉलेशन गाइड',
    intro: 'किसी कमांड की ज़रूरत नहीं है। अपना वातावरण जाँचें और ज़रूरी घटक इंस्टॉल करें।',
    steps: [
      'वातावरण जाँचें',
      'uv इंस्टॉलेशन टूल तैयार करें',
      'चयनित कर्नेल इंस्टॉल करें',
      'कर्नेल शुरू होने की पुष्टि करें',
    ],
    descriptions: [
      'पहले से मौजूद इंस्टॉलेशन का पता लगाएँ।',
      'uv Python और कर्नेल की निर्भरताएँ डाउनलोड करता है। पहले से इंस्टॉल चीज़ों का फिर उपयोग किया जाता है।',
      'पहली बार इंस्टॉल करने पर डाउनलोड में कुछ मिनट लग सकते हैं। ऐप खुला रखें।',
      'पूरा होने पर अनुवाद सेवा कॉन्फ़िगर करें और PDF खोलें।',
    ],
    start: 'इंस्टॉलेशन शुरू करें',
    retry: 'इस चरण को फिर आज़माएँ',
    running: 'काम चल रहा है, कृपया प्रतीक्षा करें…',
    done: 'इंस्टॉलेशन पूरा हो गया, अब उपयोग कर सकते हैं',
    pending: 'लंबित',
    working: 'प्रगति में',
    complete: 'पूरा',
    failed: 'विफल',
    help: 'uv इंस्टॉलेशन सहायता',
    network:
      'कनेक्शन, डिस्क की जगह और लिखने की अनुमतियाँ जाँचकर फिर कोशिश करें। पूरे हो चुके इंस्टॉलेशन का दोबारा उपयोग किया जाता है।',
  },
  bn: {
    title: 'ইনস্টলেশন নির্দেশিকা',
    intro: 'কোনো কমান্ডের দরকার নেই। পরিবেশ পরীক্ষা করে অনুপস্থিত উপাদান ইনস্টল করুন।',
    steps: [
      'পরিবেশ পরীক্ষা করুন',
      'uv ইনস্টলেশন টুল প্রস্তুত করুন',
      'নির্বাচিত কার্নেল ইনস্টল করুন',
      'কার্নেল চালু হওয়া যাচাই করুন',
    ],
    descriptions: [
      'আগে থেকে থাকা ইনস্টলেশন শনাক্ত করুন।',
      'uv Python ও কার্নেলের নির্ভরতা ডাউনলোড করে। আগে থেকে থাকা ইনস্টলেশন পুনরায় ব্যবহার করা হয়।',
      'প্রথম ইনস্টলেশনে ডাউনলোড করতে কয়েক মিনিট লাগতে পারে। অ্যাপ খোলা রাখুন।',
      'শেষ হলে একটি অনুবাদ পরিষেবা কনফিগার করে PDF খুলুন।',
    ],
    start: 'ইনস্টলেশন শুরু করুন',
    retry: 'এই ধাপটি আবার চেষ্টা করুন',
    running: 'কাজ চলছে, অপেক্ষা করুন…',
    done: 'ইনস্টলেশন সম্পন্ন, ব্যবহার করা যাবে',
    pending: 'অপেক্ষমাণ',
    working: 'চলছে',
    complete: 'সম্পন্ন',
    failed: 'ব্যর্থ',
    help: 'uv ইনস্টলেশন সহায়তা',
    network:
      'সংযোগ, ডিস্কের জায়গা ও লেখার অনুমতি পরীক্ষা করে আবার চেষ্টা করুন। সম্পন্ন ইনস্টলেশন পুনরায় ব্যবহার করা হবে।',
  },
  ur: {
    title: 'انسٹالیشن گائیڈ',
    intro: 'کسی کمانڈ کی ضرورت نہیں۔ ماحول چیک کریں اور مطلوبہ اجزا انسٹال کریں۔',
    steps: [
      'ماحول چیک کریں',
      'uv انسٹالیشن ٹول تیار کریں',
      'منتخب کرنل انسٹال کریں',
      'کرنل کے شروع ہونے کی تصدیق کریں',
    ],
    descriptions: [
      'موجودہ انسٹالیشنز کا پتا لگائیں۔',
      'uv Python اور کرنل کی انحصاریاں ڈاؤن لوڈ کرتا ہے۔ موجودہ انسٹالیشنز دوبارہ استعمال ہوتی ہیں۔',
      'پہلی انسٹالیشن میں ڈاؤن لوڈ کے لیے چند منٹ لگ سکتے ہیں۔ ایپ کھلی رکھیں۔',
      'مکمل ہونے پر ترجمہ سروس ترتیب دیں، پھر PDF کھولیں۔',
    ],
    start: 'انسٹالیشن شروع کریں',
    retry: 'اس مرحلے کو دوبارہ آزمائیں',
    running: 'کام جاری ہے، براہِ کرم انتظار کریں…',
    done: 'انسٹالیشن مکمل، استعمال کے لیے تیار',
    pending: 'زیرِ التوا',
    working: 'جاری ہے',
    complete: 'مکمل',
    failed: 'ناکام',
    help: 'uv انسٹالیشن مدد',
    network:
      'کنکشن، ڈسک کی جگہ اور لکھنے کی اجازتیں چیک کرکے دوبارہ کوشش کریں۔ مکمل شدہ انسٹالیشنز دوبارہ استعمال ہوں گی۔',
  },
  pcm: {
    title: 'Installation guide',
    intro: 'You no need type command. Check your environment and install the things wey miss.',
    steps: [
      'Check environment',
      'Prepare uv',
      'Install selected kernel',
      'Check say kernel fit start',
    ],
    descriptions: [
      'Find the installations wey dey already there.',
      'uv dey download Python and kernel dependencies. E go use installations wey dey already there again.',
      'First installation fit take some minutes to download. Leave the app open.',
      'When e finish, set translation service and open PDF.',
    ],
    start: 'Start installation',
    retry: 'Try this step again',
    running: 'E dey work, abeg wait…',
    done: 'Installation don finish, you fit use am',
    pending: 'E never start',
    working: 'E dey work',
    complete: 'E don finish',
    failed: 'E fail',
    help: 'uv installation help',
    network:
      'Check your connection, disk space and write permission, then try again. Installation wey don finish go dey used again.',
  },
};
const copy = computed(() => copyByLanguage[uiLanguage.value] || copyByLanguage.en);
async function detect() {
  const startup = await props.request('/api/engines');
  const kernel = startup.engines.find((item) => item.id === props.engine);
  states.value[0] = 'complete';
  states.value[1] = startup.uv?.available ? 'complete' : 'pending';
  states.value[2] = kernel?.available ? 'complete' : 'pending';
  states.value[3] = kernel?.available ? 'complete' : 'pending';
  ready.value = !!kernel?.available;
  return { uv: startup.uv, kernel };
}
async function start() {
  if (busy.value || props.disabled) return;
  busy.value = true;
  emit('busy', true);
  failure.value = '';
  failedStep.value = -1;
  let step = 0;
  try {
    states.value[0] = 'working';
    const detected = await detect();
    if (!detected.uv?.available) {
      step = 1;
      states.value[1] = 'working';
      await props.request('/api/runtime/uv/install', { method: 'POST' });
      states.value[1] = 'complete';
    }
    if (!detected.kernel?.available) {
      step = 2;
      states.value[2] = 'working';
      await props.request(`/api/engines/${props.engine}/install`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: 'release' }),
      });
      states.value[2] = 'complete';
    }
    step = 3;
    states.value[3] = 'working';
    const verified = await detect();
    if (!verified.kernel?.available)
      throw Error(verified.kernel?.reason || 'Kernel verification failed');
    states.value[3] = 'complete';
    ready.value = true;
    emit('ready');
  } catch (error) {
    ready.value = false;
    failedStep.value = step;
    states.value[step] = 'failed';
    failure.value = error.message;
  } finally {
    busy.value = false;
    emit('busy', false);
  }
}
async function inspect() {
  if (busy.value) return;
  states.value = ['working', 'pending', 'pending', 'pending'];
  failure.value = '';
  ready.value = false;
  try {
    await detect();
  } catch (error) {
    states.value[0] = 'failed';
    failedStep.value = 0;
    failure.value = error.message;
  }
}
onMounted(inspect);
watch(() => props.engine, inspect);
</script>
<template>
  <section
    v-if="!ready || busy || failure"
    class="kernel-install-guide"
    :aria-label="copy.title"
    :aria-busy="busy"
  >
    <h4>{{ copy.title }}</h4>
    <p>{{ copy.intro }}</p>
    <ol>
      <li v-for="(label, index) in copy.steps" :key="index" :data-state="states[index]">
        <span class="install-step-number" aria-hidden="true">{{
          states[index] === 'complete' ? '✓' : index + 1
        }}</span>
        <div>
          <strong>{{ label }}</strong>
          <p>{{ copy.descriptions[index] }}</p>
        </div>
        <span class="install-step-state">{{ copy[states[index]] }}</span>
      </li>
    </ol>
    <div v-if="failure" class="install-error" role="alert">
      <p>{{ failure }}</p>
      <p>{{ copy.network }}</p>
      <a
        v-if="failedStep <= 1"
        href="https://docs.astral.sh/uv/getting-started/installation/"
        target="_blank"
        rel="noopener noreferrer"
        >{{ copy.help }} ↗</a
      >
    </div>
    <p v-if="ready" class="install-ready" role="status">{{ copy.done }}</p>
    <AppButton v-else variant="prominent" size="large" :disabled="busy || disabled" @click="start">
      {{ busy ? copy.running : failure ? copy.retry : copy.start }}
    </AppButton>
  </section>
</template>
<style scoped>
.kernel-install-guide {
  padding: 20px;
  color: var(--text, #1d1d1f);
  background: var(--chrome-raised, #fff);
  border: 1px solid var(--chrome-divider, #00000014);
  border-radius: 20px;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}
h4 {
  margin: 0 0 6px;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.2px;
}
p {
  margin: 5px 0 0;
  color: var(--text-secondary, #68686d);
  line-height: 1.5;
  font-size: 12px;
}
ol {
  list-style: none;
  margin: 18px 0;
  padding: 0;
}
li {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 0;
}
li + li {
  border-top: 1px solid var(--chrome-divider, #00000014);
}
li > div {
  flex: 1;
  min-width: 0;
}
strong {
  font-weight: 550;
  font-size: 13px;
}
.install-step-number {
  border-radius: 50%;
  background: var(--chrome-hover, #00000008);
  color: var(--text-secondary, #68686d);
  width: 28px;
  height: 28px;
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
[data-state='complete'] .install-step-number {
  color: var(--success, #248a3d);
  background: color-mix(in srgb, var(--success, #248a3d) 10%, transparent);
}
[data-state='working'] .install-step-number {
  color: var(--accent, #007aff);
  background: var(--accent-soft, #007aff15);
  outline: 2px solid var(--accent-soft, #007aff15);
  outline-offset: 2px;
}
[data-state='failed'] .install-step-number {
  color: var(--danger, #d92d20);
  background: var(--danger-soft, #d92d201a);
}
.install-step-state {
  padding-top: 2px;
  font-size: 11px;
  color: var(--text-tertiary, #8c8c91);
  white-space: nowrap;
}
[data-state='working'] .install-step-state {
  color: var(--accent, #007aff);
}
[data-state='failed'] .install-step-state {
  color: var(--danger, #d92d20);
}
.install-error {
  padding: 12px 14px;
  margin-bottom: 16px;
  border-radius: 12px;
  background: var(--danger-soft, #d92d201a);
  overflow-wrap: anywhere;
}
.install-error p:first-child {
  margin-top: 0;
  color: var(--danger, #d92d20);
}
.install-ready {
  color: var(--success, #248a3d);
  font-weight: 550;
}
a {
  display: inline-block;
  margin-top: 8px;
  color: var(--accent, #007aff);
}
a:focus-visible {
  outline: 2px solid var(--accent, #007aff);
  outline-offset: 3px;
}
@media (max-width: 420px) {
  .kernel-install-guide {
    padding: 16px;
  }
  li {
    flex-wrap: wrap;
  }
  .install-step-state {
    width: 100%;
    padding-left: 40px;
  }
}
</style>
