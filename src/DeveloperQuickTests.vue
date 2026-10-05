<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const SUPPORTED_LANGUAGES = Object.freeze(['en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'fr', 'es']);
const NO_WINDOW_ID = Symbol('no-window-id');
const RESULT_STATUSES = Object.freeze([
  'pending',
  'running',
  'success',
  'error',
  'skipped',
  'cancelled',
]);

const props = defineProps({
  language: {
    type: String,
    default: 'en',
  },
});

const messages = Object.freeze({
  en: Object.freeze({
    title: 'Quick translation tests',
    subtitle: 'Run focused checks against the current preview window.',
    context: 'Current context',
    reader: 'Reader window',
    readerUnavailable: 'No reader window reported',
    engine: 'Kernel',
    source: 'Source',
    target: 'Target',
    provider: 'Provider',
    configured: 'Configured',
    notConfigured: 'Not configured',
    concurrency: 'Concurrency',
    pageConcurrency: 'Page concurrency',
    unavailable: 'Unavailable',
    loading: 'Loading…',
    refresh: 'Refresh context',
    cancel: 'Cancel test',
    kernelAction: 'Test kernel communication',
    kernelDescription:
      'Use a sample PDF to verify kernel processing; the translation channel uses a local mock response.',
    kernelInspectorDescription:
      'Inspect a sample PDF and verify extraction and grouping through the local kernel.',
    providerAction: 'Test current translation provider',
    providerDescription: 'Send a small diagnostic translation through the selected provider.',
    batchAction: 'Batch test providers',
    batchDescription: 'Run the provider checks for this kernel in one batch.',
    batchHint:
      'Provider and batch tests make real requests. Batch uses configured providers only; no secret fields appear here.',
    noBridge: 'The developer test bridge is unavailable.',
    contextError: 'Could not load the current test context.',
    statusError: 'Could not read the test status.',
    runError: 'Could not start this test.',
    cancelError: 'Could not cancel this test.',
    results: 'Results',
    resultsEmpty: 'Run a test to see its checks here.',
    output: 'Show output',
    noMessage: 'No diagnostic message.',
    running: 'Running',
    waiting: 'Waiting',
    success: 'Success',
    error: 'Error',
    skipped: 'Skipped',
    cancelled: 'Cancelled',
    milliseconds: 'ms',
    seconds: 's',
    runId: 'Run {id}',
    liveStarted: 'Translation test started.',
    liveExisting: 'A translation test is already running.',
    liveProgress: '{completed} of {total} checks complete.',
    liveFinished:
      'Translation test finished: {success} succeeded, {error} errored, {skipped} skipped, {cancelled} cancelled.',
    liveFinishedEmpty: 'Translation test finished with no reported checks.',
    selectedReader: 'Selected reader window',
  }),
  'zh-CN': Object.freeze({
    title: '快速翻译测试',
    subtitle: '针对当前预览窗口运行专门检查。',
    context: '当前上下文',
    reader: '阅读器窗口',
    readerUnavailable: '未报告阅读器窗口',
    engine: '内核',
    source: '源语言',
    target: '目标语言',
    provider: '提供商',
    configured: '已配置',
    notConfigured: '未配置',
    concurrency: '并发数',
    pageConcurrency: '页面并发数',
    unavailable: '不可用',
    loading: '正在加载…',
    refresh: '刷新上下文',
    cancel: '取消测试',
    kernelAction: '测试内核通信',
    kernelDescription: '用示例 PDF 验证内核处理；翻译通道使用本地模拟响应。',
    kernelInspectorDescription: '使用本地内核检查示例 PDF 的提取和分组。',
    providerAction: '测试当前翻译提供商',
    providerDescription: '通过当前提供商发送一次小型诊断翻译。',
    batchAction: '批量测试提供商',
    batchDescription: '一次运行此内核的提供商检查。',
    batchHint:
      '当前提供商和批量测试会发出真实请求；批量测试仅使用已配置的提供商，此处不显示密钥字段。',
    noBridge: '开发者测试桥接不可用。',
    contextError: '无法加载当前测试上下文。',
    statusError: '无法读取测试状态。',
    runError: '无法启动此测试。',
    cancelError: '无法取消此测试。',
    results: '结果',
    resultsEmpty: '运行测试后，检查结果会显示在这里。',
    output: '显示输出',
    noMessage: '没有诊断消息。',
    running: '运行中',
    waiting: '等待中',
    success: '成功',
    error: '错误',
    skipped: '已跳过',
    cancelled: '已取消',
    milliseconds: '毫秒',
    seconds: '秒',
    runId: '运行 {id}',
    liveStarted: '翻译测试已开始。',
    liveExisting: '已有翻译测试正在运行。',
    liveProgress: '已完成 {completed} / {total} 项检查。',
    liveFinished:
      '翻译测试已结束：成功 {success} 项，错误 {error} 项，跳过 {skipped} 项，取消 {cancelled} 项。',
    liveFinishedEmpty: '翻译测试结束，但没有报告检查结果。',
    selectedReader: '已选阅读器窗口',
  }),
  'zh-TW': Object.freeze({
    title: '快速翻譯測試',
    subtitle: '針對目前預覽視窗執行專門檢查。',
    context: '目前內容',
    reader: '閱讀器視窗',
    readerUnavailable: '未回報閱讀器視窗',
    engine: '核心',
    source: '來源語言',
    target: '目標語言',
    provider: '提供者',
    configured: '已設定',
    notConfigured: '未設定',
    concurrency: '並行數',
    pageConcurrency: '頁面並行數',
    unavailable: '無法使用',
    loading: '載入中…',
    refresh: '重新整理內容',
    cancel: '取消測試',
    kernelAction: '測試核心通訊',
    kernelDescription: '使用範例 PDF 驗證核心處理；翻譯通道使用本機模擬回應。',
    kernelInspectorDescription: '使用本機核心檢查範例 PDF 的擷取與分組。',
    providerAction: '測試目前翻譯提供者',
    providerDescription: '透過目前提供者傳送小型診斷翻譯。',
    batchAction: '批次測試提供者',
    batchDescription: '一次執行此核心的提供者檢查。',
    batchHint:
      '目前提供者與批次測試會發出實際請求；批次測試僅使用已設定的提供者，此處不顯示密鑰欄位。',
    noBridge: '開發者測試橋接無法使用。',
    contextError: '無法載入目前測試內容。',
    statusError: '無法讀取測試狀態。',
    runError: '無法啟動此測試。',
    cancelError: '無法取消此測試。',
    results: '結果',
    resultsEmpty: '執行測試後，檢查結果會顯示在這裡。',
    output: '顯示輸出',
    noMessage: '沒有診斷訊息。',
    running: '執行中',
    waiting: '等待中',
    success: '成功',
    error: '錯誤',
    skipped: '已略過',
    cancelled: '已取消',
    milliseconds: '毫秒',
    seconds: '秒',
    runId: '執行 {id}',
    liveStarted: '翻譯測試已開始。',
    liveExisting: '已有翻譯測試正在執行。',
    liveProgress: '已完成 {total} 項檢查中的 {completed} 項。',
    liveFinished:
      '翻譯測試已結束：成功 {success} 項，錯誤 {error} 項，略過 {skipped} 項，取消 {cancelled} 項。',
    liveFinishedEmpty: '翻譯測試結束，但沒有回報檢查結果。',
    selectedReader: '已選閱讀器視窗',
  }),
  ja: Object.freeze({
    title: 'クイック翻訳テスト',
    subtitle: '現在のプレビューウィンドウを対象に検査を実行します。',
    context: '現在のコンテキスト',
    reader: 'リーダーウィンドウ',
    readerUnavailable: 'リーダーウィンドウが報告されていません',
    engine: 'カーネル',
    source: '原文',
    target: '翻訳先',
    provider: 'プロバイダー',
    configured: '設定済み',
    notConfigured: '未設定',
    concurrency: '同時実行数',
    pageConcurrency: 'ページ同時実行数',
    unavailable: '利用不可',
    loading: '読み込み中…',
    refresh: 'コンテキストを更新',
    cancel: 'テストをキャンセル',
    kernelAction: 'カーネル通信をテスト',
    kernelDescription:
      'サンプル PDF でカーネル処理を確認します。翻訳経路はローカルのモック応答を使用します。',
    kernelInspectorDescription: 'ローカルカーネルでサンプル PDF の抽出とグループ化を確認します。',
    providerAction: '現在の翻訳プロバイダーをテスト',
    providerDescription: '選択中のプロバイダーで小さな診断翻訳を送信します。',
    batchAction: 'プロバイダーを一括テスト',
    batchDescription: 'このカーネルのプロバイダー検査をまとめて実行します。',
    batchHint:
      '現在のプロバイダーと一括テストは実際のリクエストを送信します。一括テストは設定済みプロバイダーだけを対象にします。',
    noBridge: '開発者テストブリッジを利用できません。',
    contextError: '現在のテストコンテキストを読み込めませんでした。',
    statusError: 'テスト状態を読み取れませんでした。',
    runError: 'テストを開始できませんでした。',
    cancelError: 'テストをキャンセルできませんでした。',
    results: '結果',
    resultsEmpty: 'テストを実行すると、ここに検査結果が表示されます。',
    output: '出力を表示',
    noMessage: '診断メッセージはありません。',
    running: '実行中',
    waiting: '待機中',
    success: '成功',
    error: 'エラー',
    skipped: 'スキップ',
    cancelled: 'キャンセル済み',
    milliseconds: 'ミリ秒',
    seconds: '秒',
    runId: '実行 {id}',
    liveStarted: '翻訳テストを開始しました。',
    liveExisting: '翻訳テストがすでに実行中です。',
    liveProgress: '{total} 件中 {completed} 件の検査が完了しました。',
    liveFinished:
      '翻訳テストが終了しました。成功 {success} 件、エラー {error} 件、スキップ {skipped} 件、キャンセル {cancelled} 件です。',
    liveFinishedEmpty: '翻訳テストは終了しましたが、検査結果は報告されませんでした。',
    selectedReader: '選択中のリーダーウィンドウ',
  }),
  ko: Object.freeze({
    title: '빠른 번역 테스트',
    subtitle: '현재 미리보기 창을 대상으로 집중 검사를 실행합니다.',
    context: '현재 컨텍스트',
    reader: '리더 창',
    readerUnavailable: '보고된 리더 창이 없습니다',
    engine: '커널',
    source: '원문',
    target: '대상 언어',
    provider: '제공자',
    configured: '구성됨',
    notConfigured: '구성되지 않음',
    concurrency: '동시성',
    pageConcurrency: '페이지 동시성',
    unavailable: '사용할 수 없음',
    loading: '로드 중…',
    refresh: '컨텍스트 새로 고침',
    cancel: '테스트 취소',
    kernelAction: '커널 통신 테스트',
    kernelDescription:
      '샘플 PDF로 커널 처리를 확인합니다. 번역 경로는 로컬 모의 응답을 사용합니다.',
    kernelInspectorDescription: '로컬 커널로 샘플 PDF의 추출과 그룹화를 확인합니다.',
    providerAction: '현재 번역 제공자 테스트',
    providerDescription: '선택한 제공자로 작은 진단 번역을 보냅니다.',
    batchAction: '제공자 일괄 테스트',
    batchDescription: '이 커널의 제공자 검사를 한 번에 실행합니다.',
    batchHint:
      '현재 제공자와 일괄 테스트는 실제 요청을 보냅니다. 일괄 테스트는 구성된 제공자만 테스트하며 비밀 필드는 표시하지 않습니다.',
    noBridge: '개발자 테스트 브리지를 사용할 수 없습니다.',
    contextError: '현재 테스트 컨텍스트를 불러오지 못했습니다.',
    statusError: '테스트 상태를 읽지 못했습니다.',
    runError: '테스트를 시작하지 못했습니다.',
    cancelError: '테스트를 취소하지 못했습니다.',
    results: '결과',
    resultsEmpty: '테스트를 실행하면 여기에 검사 결과가 표시됩니다.',
    output: '출력 보기',
    noMessage: '진단 메시지가 없습니다.',
    running: '실행 중',
    waiting: '대기 중',
    success: '성공',
    error: '오류',
    skipped: '건너뜀',
    cancelled: '취소됨',
    milliseconds: '밀리초',
    seconds: '초',
    runId: '실행 {id}',
    liveStarted: '번역 테스트를 시작했습니다.',
    liveExisting: '번역 테스트가 이미 실행 중입니다.',
    liveProgress: '{total}개 검사 중 {completed}개가 완료되었습니다.',
    liveFinished:
      '번역 테스트가 끝났습니다. 성공 {success}개, 오류 {error}개, 건너뜀 {skipped}개, 취소 {cancelled}개입니다.',
    liveFinishedEmpty: '번역 테스트가 끝났지만 보고된 검사가 없습니다.',
    selectedReader: '선택한 리더 창',
  }),
  fr: Object.freeze({
    title: 'Tests de traduction rapides',
    subtitle: 'Exécutez des vérifications ciblées sur la fenêtre d’aperçu actuelle.',
    context: 'Contexte actuel',
    reader: 'Fenêtre de lecture',
    readerUnavailable: 'Aucune fenêtre de lecture signalée',
    engine: 'Noyau',
    source: 'Source',
    target: 'Cible',
    provider: 'Fournisseur',
    configured: 'Configuré',
    notConfigured: 'Non configuré',
    concurrency: 'Concurrence',
    pageConcurrency: 'Concurrence des pages',
    unavailable: 'Indisponible',
    loading: 'Chargement…',
    refresh: 'Actualiser le contexte',
    cancel: 'Annuler le test',
    kernelAction: 'Tester la communication du noyau',
    kernelDescription:
      'Vérifiez le traitement du noyau avec un PDF d’exemple ; le canal de traduction utilise une réponse simulée locale.',
    kernelInspectorDescription:
      'Vérifiez l’extraction et le groupement d’un PDF d’exemple avec le noyau local.',
    providerAction: 'Tester le fournisseur de traduction actuel',
    providerDescription: 'Envoyez une petite traduction de diagnostic au fournisseur sélectionné.',
    batchAction: 'Tester les fournisseurs par lot',
    batchDescription: 'Exécutez en une fois les vérifications des fournisseurs de ce noyau.',
    batchHint:
      'Les tests du fournisseur actuel et par lot effectuent de vraies requêtes. Le lot utilise uniquement les fournisseurs configurés ; aucun champ secret n’apparaît ici.',
    noBridge: 'Le pont de test développeur est indisponible.',
    contextError: 'Impossible de charger le contexte de test actuel.',
    statusError: 'Impossible de lire l’état du test.',
    runError: 'Impossible de démarrer ce test.',
    cancelError: 'Impossible d’annuler ce test.',
    results: 'Résultats',
    resultsEmpty: 'Lancez un test pour voir ses vérifications ici.',
    output: 'Afficher la sortie',
    noMessage: 'Aucun message de diagnostic.',
    running: 'En cours',
    waiting: 'En attente',
    success: 'Réussi',
    error: 'Erreur',
    skipped: 'Ignoré',
    cancelled: 'Annulé',
    milliseconds: 'ms',
    seconds: 's',
    runId: 'Exécution {id}',
    liveStarted: 'Le test de traduction a commencé.',
    liveExisting: 'Un test de traduction est déjà en cours.',
    liveProgress: '{completed} vérifications sur {total} sont terminées.',
    liveFinished:
      'Le test de traduction est terminé : {success} réussie(s), {error} erreur(s), {skipped} ignorée(s), {cancelled} annulée(s).',
    liveFinishedEmpty: 'Le test de traduction est terminé sans vérification signalée.',
    selectedReader: 'Fenêtre de lecture sélectionnée',
  }),
  es: Object.freeze({
    title: 'Pruebas rápidas de traducción',
    subtitle: 'Ejecuta comprobaciones específicas en la ventana de vista previa actual.',
    context: 'Contexto actual',
    reader: 'Ventana del lector',
    readerUnavailable: 'No se ha informado de ninguna ventana del lector',
    engine: 'Núcleo',
    source: 'Origen',
    target: 'Destino',
    provider: 'Proveedor',
    configured: 'Configurado',
    notConfigured: 'No configurado',
    concurrency: 'Concurrencia',
    pageConcurrency: 'Concurrencia de páginas',
    unavailable: 'No disponible',
    loading: 'Cargando…',
    refresh: 'Actualizar contexto',
    cancel: 'Cancelar prueba',
    kernelAction: 'Probar la comunicación del núcleo',
    kernelDescription:
      'Verifica el procesamiento del núcleo con un PDF de muestra; el canal de traducción usa una respuesta simulada local.',
    kernelInspectorDescription:
      'Comprueba la extracción y la agrupación de un PDF de muestra con el núcleo local.',
    providerAction: 'Probar el proveedor de traducción actual',
    providerDescription: 'Envía una pequeña traducción de diagnóstico al proveedor seleccionado.',
    batchAction: 'Probar proveedores por lotes',
    batchDescription: 'Ejecuta en un lote las comprobaciones de proveedores de este núcleo.',
    batchHint:
      'Las pruebas del proveedor actual y por lotes realizan solicitudes reales. El lote usa solo proveedores configurados; aquí no aparecen campos secretos.',
    noBridge: 'El puente de pruebas de desarrollador no está disponible.',
    contextError: 'No se pudo cargar el contexto de prueba actual.',
    statusError: 'No se pudo leer el estado de la prueba.',
    runError: 'No se pudo iniciar esta prueba.',
    cancelError: 'No se pudo cancelar esta prueba.',
    results: 'Resultados',
    resultsEmpty: 'Ejecuta una prueba para ver aquí sus comprobaciones.',
    output: 'Mostrar salida',
    noMessage: 'No hay mensaje de diagnóstico.',
    running: 'En curso',
    waiting: 'En espera',
    success: 'Correcto',
    error: 'Error',
    skipped: 'Omitido',
    cancelled: 'Cancelado',
    milliseconds: 'ms',
    seconds: 's',
    runId: 'Ejecución {id}',
    liveStarted: 'La prueba de traducción ha comenzado.',
    liveExisting: 'Ya hay una prueba de traducción en curso.',
    liveProgress: '{completed} de {total} comprobaciones completadas.',
    liveFinished:
      'La prueba de traducción terminó: {success} correctas, {error} con error, {skipped} omitidas y {cancelled} canceladas.',
    liveFinishedEmpty: 'La prueba de traducción terminó sin comprobaciones informadas.',
    selectedReader: 'Ventana del lector seleccionada',
  }),
});

const languageNames = Object.freeze({
  en: 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  ja: '日本語',
  ko: '한국어',
  fr: 'Français',
  es: 'Español',
});

const locale = computed(() =>
  SUPPORTED_LANGUAGES.includes(props.language) ? props.language : 'en',
);
const context = ref(null);
const run = ref(null);
const selectedWindowId = ref('');
const contextLoading = ref(false);
const statusLoading = ref(false);
const actionBusy = ref(false);
const cancelBusy = ref(false);
const contextError = ref('');
const statusError = ref('');
const runError = ref('');
const cancelError = ref('');
const liveMessage = ref('');
const bridgeAvailable = ref(false);

let pollTimer = null;
let pollInFlight = false;
let disposed = false;

function text(key, values = {}) {
  const value = messages[locale.value]?.[key] ?? messages.en[key] ?? key;
  return String(value).replace(/\{(\w+)\}/g, (_, name) =>
    values[name] === undefined ? `{${name}}` : String(values[name]),
  );
}

function getBridge() {
  return globalThis.window?.previewDeveloper || null;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function errorMessage(error, fallback) {
  if (error && typeof error.message === 'string' && error.message.trim()) return error.message;
  if (typeof error === 'string' && error.trim()) return error;
  return fallback;
}

function finiteNumber(value) {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeContext(value) {
  const source = isRecord(value) ? value : {};
  const providers = Array.isArray(source.providers)
    ? source.providers.map((provider, index) => {
        const item = isRecord(provider) ? provider : {};
        const id = item.id === undefined || item.id === null ? String(index) : item.id;
        return {
          id,
          label: String(item.label ?? id),
          configured: Boolean(item.configured),
        };
      })
    : [];
  const readers = Array.isArray(source.readers)
    ? source.readers.map((reader, index) => {
        const item = isRecord(reader) ? reader : {};
        const id = item.id === undefined || item.id === null ? String(index) : item.id;
        return { id, title: String(item.title ?? `${text('reader')} ${id}`) };
      })
    : [];
  return {
    windowId: source.windowId === undefined ? null : source.windowId,
    engine: source.engine === undefined || source.engine === null ? '' : String(source.engine),
    language:
      source.language === undefined || source.language === null ? '' : String(source.language),
    sourceLanguage:
      source.sourceLanguage === undefined || source.sourceLanguage === null
        ? ''
        : String(source.sourceLanguage),
    concurrency: source.concurrency,
    pageConcurrency: source.pageConcurrency,
    providerId: source.providerId === undefined ? null : source.providerId,
    providers,
    readers,
  };
}

function normalizeResult(value, index) {
  const source = isRecord(value) ? value : {};
  const status = RESULT_STATUSES.includes(source.status) ? source.status : 'error';
  const id = source.id === undefined || source.id === null ? String(index + 1) : source.id;
  return {
    id,
    label: String(source.label ?? id),
    status,
    elapsedMs: finiteNumber(source.elapsedMs),
    message: source.message === undefined || source.message === null ? '' : String(source.message),
    output: source.output,
  };
}

function normalizeRunSnapshot(value) {
  if (!isRecord(value)) return null;
  const results = Array.isArray(value.results) ? value.results.map(normalizeResult) : [];
  const running =
    value.running === undefined
      ? results.some((result) => result.status === 'running' || result.status === 'pending')
      : Boolean(value.running);
  return {
    id: value.id === undefined || value.id === null ? '' : String(value.id),
    running,
    results,
  };
}

function currentReader() {
  const readers = context.value?.readers || [];
  return readers.find((reader) => String(reader.id) === String(selectedWindowId.value)) || null;
}

const readers = computed(() => context.value?.readers || []);
const currentWindowId = computed(() => {
  const reader = currentReader();
  if (reader) return reader.id;
  return context.value?.windowId === undefined ? null : context.value?.windowId;
});
const selectedProvider = computed(() => {
  const providerId = context.value?.providerId;
  return (
    (context.value?.providers || []).find(
      (provider) => String(provider.id) === String(providerId),
    ) || null
  );
});
const providerName = computed(() => {
  if (selectedProvider.value) return selectedProvider.value.label;
  if (
    context.value?.providerId !== undefined &&
    context.value?.providerId !== null &&
    context.value?.providerId !== ''
  )
    return String(context.value.providerId);
  return text('notConfigured');
});
const providerConfiguration = computed(() => {
  if (!selectedProvider.value) return text('notConfigured');
  return selectedProvider.value.configured ? text('configured') : text('notConfigured');
});
const kernelActionDescription = computed(() =>
  context.value?.engine === 'pdf_inspector'
    ? text('kernelInspectorDescription')
    : text('kernelDescription'),
);
const isRunning = computed(() => Boolean(run.value?.running));
const isBusy = computed(
  () => contextLoading.value || statusLoading.value || actionBusy.value || cancelBusy.value,
);

function formatLanguage(value) {
  if (value === undefined || value === null || value === '') return '—';
  return languageNames[value] ? `${languageNames[value]} (${value})` : String(value);
}

function formatContextValue(value) {
  if (value === undefined || value === null || value === '') return '—';
  return String(value);
}

function formatElapsed(value) {
  if (!Number.isFinite(value)) return '—';
  if (value < 1000) return `${Math.round(value)} ${text('milliseconds')}`;
  return `${(value / 1000).toFixed(1)} ${text('seconds')}`;
}

function formatOutput(value) {
  if (typeof value === 'string') return value;
  try {
    const serialized = JSON.stringify(value, null, 2);
    return serialized === undefined ? String(value) : serialized;
  } catch {
    return String(value);
  }
}

function hasOutput(result) {
  return result.output !== undefined && result.output !== null;
}

function resultStatusLabel(status) {
  return text(status === 'pending' ? 'waiting' : status);
}

function resultSignature(snapshot) {
  return `${snapshot.running}|${snapshot.results.map((result) => `${result.id}:${result.status}`).join(',')}`;
}

function countsFor(snapshot) {
  return snapshot.results.reduce(
    (counts, result) => {
      if (result.status === 'running') counts.running += 1;
      else if (result.status === 'pending') counts.pending += 1;
      else if (result.status === 'success') counts.success += 1;
      else if (result.status === 'error') counts.error += 1;
      else if (result.status === 'skipped') counts.skipped += 1;
      else if (result.status === 'cancelled') counts.cancelled += 1;
      return counts;
    },
    { pending: 0, running: 0, success: 0, error: 0, skipped: 0, cancelled: 0 },
  );
}

function announceSnapshot(snapshot, previous) {
  if (!previous) {
    if (snapshot.running) liveMessage.value = text('liveExisting');
    else if (snapshot.results.length) liveMessage.value = text('liveFinished', countsFor(snapshot));
    else liveMessage.value = text('liveStarted');
    return;
  }
  const counts = countsFor(snapshot);
  if (snapshot.running) {
    liveMessage.value = text('liveProgress', {
      completed: snapshot.results.length - counts.running - counts.pending,
      total: snapshot.results.length,
    });
    return;
  }
  if (!snapshot.results.length) {
    liveMessage.value = text('liveFinishedEmpty');
    return;
  }
  liveMessage.value = text('liveFinished', counts);
}

function syncRunSnapshot(value, announce = true) {
  const snapshot = normalizeRunSnapshot(value);
  if (!snapshot) return null;
  const previous = run.value;
  const changed = !previous || resultSignature(previous) !== resultSignature(snapshot);
  run.value = snapshot;
  if (announce && changed) announceSnapshot(snapshot, previous);
  if (!snapshot.running) clearPollTimer();
  return snapshot;
}

function clearPollTimer() {
  if (pollTimer !== null) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function schedulePoll(delay = 700) {
  if (disposed || !run.value?.running || pollTimer !== null) return;
  pollTimer = setTimeout(() => {
    pollTimer = null;
    void pollStatus();
  }, delay);
}

async function loadContext(windowId = NO_WINDOW_ID) {
  const bridge = getBridge();
  if (!bridge || typeof bridge.testContext !== 'function') {
    bridgeAvailable.value = false;
    contextError.value = text('noBridge');
    return false;
  }
  bridgeAvailable.value = true;
  contextLoading.value = true;
  contextError.value = '';
  try {
    const value =
      windowId === NO_WINDOW_ID ? await bridge.testContext() : await bridge.testContext(windowId);
    if (disposed) return false;
    const next = normalizeContext(value);
    context.value = next;
    const nextReaders = next.readers;
    const selectedStillExists =
      selectedWindowId.value &&
      nextReaders.some((reader) => String(reader.id) === String(selectedWindowId.value));
    if (!selectedStillExists) {
      const contextReader = nextReaders.find(
        (reader) => String(reader.id) === String(next.windowId),
      );
      selectedWindowId.value = contextReader
        ? String(contextReader.id)
        : nextReaders[0]
          ? String(nextReaders[0].id)
          : '';
    }
    return true;
  } catch (error) {
    if (!disposed) contextError.value = errorMessage(error, text('contextError'));
    return false;
  } finally {
    if (!disposed) contextLoading.value = false;
  }
}

async function readStatus({ announce = true } = {}) {
  const bridge = getBridge();
  if (!bridge || typeof bridge.testStatus !== 'function') {
    statusError.value = text('noBridge');
    return null;
  }
  statusLoading.value = true;
  statusError.value = '';
  try {
    const value = await bridge.testStatus();
    if (disposed) return null;
    const snapshot = syncRunSnapshot(value, announce);
    if (snapshot?.running) schedulePoll();
    return snapshot;
  } catch (error) {
    if (!disposed) statusError.value = errorMessage(error, text('statusError'));
    if (!disposed && run.value?.running) schedulePoll(1500);
    return null;
  } finally {
    if (!disposed) statusLoading.value = false;
  }
}

async function pollStatus() {
  if (disposed || pollInFlight || !run.value?.running) return;
  pollInFlight = true;
  try {
    await readStatus();
  } finally {
    pollInFlight = false;
    if (!disposed && run.value?.running) schedulePoll(statusError.value ? 1500 : 700);
  }
}

function requestWindowId(request) {
  const id = currentWindowId.value;
  if (id !== undefined && id !== null && id !== '') request.windowId = id;
  return request;
}

async function startTest(kind) {
  if (isBusy.value || isRunning.value) return;
  const bridge = getBridge();
  if (!bridge || typeof bridge.runTest !== 'function') {
    bridgeAvailable.value = false;
    runError.value = text('noBridge');
    return;
  }
  actionBusy.value = true;
  runError.value = '';
  cancelError.value = '';
  const refreshed = await loadContext(
    currentWindowId.value === null ? NO_WINDOW_ID : currentWindowId.value,
  );
  if (!refreshed || disposed) {
    actionBusy.value = false;
    return;
  }
  try {
    const snapshot = await bridge.runTest(requestWindowId({ kind }));
    if (disposed) return;
    const next = syncRunSnapshot(snapshot);
    if (next?.running) schedulePoll();
  } catch (error) {
    if (!disposed) runError.value = errorMessage(error, text('runError'));
  } finally {
    if (!disposed) actionBusy.value = false;
  }
}

async function cancelRun() {
  if (!run.value?.running || cancelBusy.value) return;
  const bridge = getBridge();
  if (!bridge || typeof bridge.cancelTest !== 'function') {
    cancelError.value = text('noBridge');
    return;
  }
  cancelBusy.value = true;
  cancelError.value = '';
  try {
    const value = await bridge.cancelTest();
    if (disposed) return;
    const snapshot = syncRunSnapshot(value);
    if (!snapshot || snapshot.running) await pollStatus();
  } catch (error) {
    if (!disposed) cancelError.value = errorMessage(error, text('cancelError'));
  } finally {
    if (!disposed) cancelBusy.value = false;
  }
}

async function selectReader(event) {
  if (isRunning.value) return;
  const value = event.target.value;
  selectedWindowId.value = value;
  const reader = readers.value.find((item) => String(item.id) === value);
  await loadContext(reader ? reader.id : NO_WINDOW_ID);
}

async function refreshContext() {
  if (isBusy.value) return;
  await loadContext(currentWindowId.value === null ? NO_WINDOW_ID : currentWindowId.value);
}

async function loadInitialState() {
  await Promise.allSettled([loadContext(), readStatus()]);
}

onMounted(() => {
  bridgeAvailable.value = Boolean(getBridge());
  void loadInitialState();
});

onBeforeUnmount(() => {
  disposed = true;
  clearPollTimer();
});
</script>

<template>
  <section class="developer-quick-tests" :aria-busy="isBusy">
    <div class="quick-tests-card">
      <header class="quick-tests-header">
        <div>
          <p class="eyebrow">{{ text('context') }}</p>
          <h2>{{ text('title') }}</h2>
          <p class="subtitle">{{ text('subtitle') }}</p>
        </div>
        <button
          class="quiet-button"
          type="button"
          :disabled="isBusy || !bridgeAvailable"
          @click="refreshContext"
        >
          {{ contextLoading ? text('loading') : text('refresh') }}
        </button>
      </header>

      <div v-if="contextError" class="message-banner message-banner--error" role="alert">
        {{ contextError }}
      </div>
      <div v-if="statusError" class="message-banner message-banner--error" role="alert">
        {{ statusError }}
      </div>
      <div v-if="runError" class="message-banner message-banner--error" role="alert">
        {{ runError }}
      </div>
      <div v-if="cancelError" class="message-banner message-banner--error" role="alert">
        {{ cancelError }}
      </div>

      <div v-if="readers.length > 1" class="reader-picker">
        <label for="developer-test-reader">{{ text('selectedReader') }}</label>
        <select
          id="developer-test-reader"
          :value="selectedWindowId"
          :disabled="isBusy || isRunning"
          @change="selectReader"
        >
          <option v-for="reader in readers" :key="String(reader.id)" :value="String(reader.id)">
            {{ reader.title }}
          </option>
        </select>
      </div>

      <dl class="context-grid" :aria-label="text('context')">
        <div class="context-item">
          <dt>{{ text('engine') }}</dt>
          <dd>{{ formatContextValue(context?.engine) }}</dd>
        </div>
        <div class="context-item">
          <dt>{{ text('source') }}</dt>
          <dd>{{ formatLanguage(context?.sourceLanguage) }}</dd>
        </div>
        <div class="context-item">
          <dt>{{ text('target') }}</dt>
          <dd>{{ formatLanguage(context?.language) }}</dd>
        </div>
        <div class="context-item">
          <dt>{{ text('provider') }}</dt>
          <dd>
            <span>{{ providerName }}</span
            ><span class="context-subvalue">{{ providerConfiguration }}</span>
          </dd>
        </div>
        <div class="context-item">
          <dt>{{ text('concurrency') }}</dt>
          <dd>{{ formatContextValue(context?.concurrency) }}</dd>
        </div>
        <div class="context-item">
          <dt>{{ text('pageConcurrency') }}</dt>
          <dd>{{ formatContextValue(context?.pageConcurrency) }}</dd>
        </div>
      </dl>

      <div class="test-actions" :aria-label="text('title')">
        <button
          class="test-action"
          type="button"
          :disabled="isBusy || isRunning || !bridgeAvailable"
          @click="startTest('kernel')"
        >
          <span class="test-action-title">{{ text('kernelAction') }}</span>
          <span class="test-action-description">{{ kernelActionDescription }}</span>
        </button>
        <button
          class="test-action"
          type="button"
          :disabled="isBusy || isRunning || !bridgeAvailable"
          @click="startTest('provider')"
        >
          <span class="test-action-title">{{ text('providerAction') }}</span>
          <span class="test-action-description">{{ text('providerDescription') }}</span>
        </button>
        <button
          class="test-action"
          type="button"
          :disabled="isBusy || isRunning || !bridgeAvailable"
          @click="startTest('batch')"
        >
          <span class="test-action-title">{{ text('batchAction') }}</span>
          <span class="test-action-description">{{ text('batchDescription') }}</span>
        </button>
      </div>

      <p class="batch-hint">{{ text('batchHint') }}</p>

      <section
        v-if="run?.results?.length"
        class="test-results"
        :aria-labelledby="'developer-test-results-' + (run?.id || 'empty')"
        :aria-describedby="run?.id ? 'developer-test-run-' + run.id : undefined"
      >
        <div class="results-heading">
          <div>
            <h3 :id="'developer-test-results-' + (run?.id || 'empty')">{{ text('results') }}</h3>
            <span v-if="run?.id" class="sr-only" :id="'developer-test-run-' + run.id">{{
              text('runId', { id: run.id })
            }}</span>
          </div>
          <button
            v-if="isRunning"
            class="cancel-button"
            type="button"
            :disabled="cancelBusy"
            @click="cancelRun"
          >
            {{ cancelBusy ? text('loading') : text('cancel') }}
          </button>
        </div>

        <ul class="result-list">
          <li v-for="result in run.results" :key="String(result.id)" class="result-row">
            <div class="result-main">
              <span class="result-label">{{ result.label }}</span>
              <span class="result-message">{{ result.message || text('noMessage') }}</span>
            </div>
            <div class="result-meta">
              <span class="result-status" :class="`result-status--${result.status}`">{{
                resultStatusLabel(result.status)
              }}</span>
              <span class="result-elapsed">{{ formatElapsed(result.elapsedMs) }}</span>
            </div>
            <details v-if="hasOutput(result)" class="result-output">
              <summary>{{ text('output') }}</summary>
              <pre>{{ formatOutput(result.output) }}</pre>
            </details>
          </li>
        </ul>
      </section>

      <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">{{ liveMessage }}</p>
    </div>
  </section>
</template>

<style scoped>
.developer-quick-tests {
  max-width: 1480px;
  margin: 0 auto 18px;
  color: var(--dev-text, #1d1d1f);
}

.quick-tests-card {
  overflow: hidden;
  border: 1px solid var(--dev-border, rgba(33, 45, 68, 0.1));
  border-radius: 16px;
  background: var(--dev-panel, #fff);
  box-shadow: var(--dev-shadow, 0 1px 3px rgba(0, 0, 0, 0.035));
}

.quick-tests-header,
.reader-picker,
.context-grid,
.test-actions,
.batch-hint,
.test-results {
  padding-right: 16px;
  padding-left: 16px;
}

.quick-tests-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-top: 16px;
  padding-bottom: 14px;
}

.eyebrow {
  margin: 0 0 3px;
  color: var(--dev-muted, #636366);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

h2,
h3,
p {
  margin-top: 0;
}

h2 {
  margin-bottom: 3px;
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.018em;
}

.subtitle {
  margin-bottom: 0;
  color: var(--dev-muted, #636366);
  font-size: 12px;
  line-height: 1.45;
}

button,
select {
  font: inherit;
}

button {
  cursor: pointer;
}

button:disabled,
select:disabled {
  cursor: default;
}

.quiet-button,
.cancel-button {
  flex: 0 0 auto;
  min-height: 32px;
  padding: 6px 11px;
  border: 1px solid var(--dev-border-strong, rgba(33, 45, 68, 0.16));
  border-radius: 9px;
  color: var(--dev-text, #1d1d1f);
  background: var(--dev-panel-solid, var(--dev-panel, #fff));
  font-size: 11px;
  font-weight: 600;
  transition:
    background-color 140ms ease,
    border-color 140ms ease,
    transform 100ms ease;
}

.quiet-button:hover:not(:disabled),
.cancel-button:hover:not(:disabled) {
  border-color: var(--dev-accent, #326bdf);
  background: var(--dev-accent-soft, rgba(50, 107, 223, 0.1));
}

.quiet-button:active:not(:disabled),
.cancel-button:active:not(:disabled),
.test-action:active:not(:disabled) {
  transform: scale(0.985);
  transition-duration: 60ms;
}

.message-banner {
  margin: 0 16px 10px;
  padding: 9px 11px;
  border: 1px solid var(--dev-border, rgba(33, 45, 68, 0.1));
  border-radius: 9px;
  font-size: 11px;
  line-height: 1.45;
}

.message-banner--error {
  border-color: color-mix(in srgb, var(--dev-error, #d92d20) 28%, transparent);
  color: var(--dev-error, #b42318);
  background: color-mix(in srgb, var(--dev-error, #d92d20) 10%, transparent);
}

.reader-picker {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding-bottom: 10px;
}

.reader-picker label {
  color: var(--dev-muted, #636366);
  font-size: 11px;
  font-weight: 600;
}

.reader-picker select {
  min-width: min(100%, 280px);
  min-height: 32px;
  padding: 5px 28px 5px 9px;
  border: 1px solid var(--dev-border, rgba(33, 45, 68, 0.1));
  border-radius: 9px;
  color: var(--dev-text, #1d1d1f);
  background: var(--dev-bg, #f5f5f7);
}

.context-grid {
  display: grid;
  grid-template-columns: 0.9fr 1fr 1fr 1.7fr 0.7fr 0.9fr;
  gap: 8px 16px;
  margin: 0;
  padding-bottom: 14px;
}

.context-item {
  min-width: 0;
  padding: 2px 0;
}

.context-item dt {
  overflow: hidden;
  margin-bottom: 3px;
  color: var(--dev-muted, #636366);
  font-size: 10px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.context-item dd {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 5px;
  min-height: 17px;
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--dev-text, #1d1d1f);
  font-size: 11px;
  font-weight: 600;
}

.context-subvalue {
  color: var(--dev-muted, #636366);
  font-size: 10px;
  font-weight: 500;
}

.test-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 14px;
  padding-bottom: 10px;
  border-top: 1px solid var(--dev-border, rgba(33, 45, 68, 0.1));
}

.test-action {
  display: flex;
  flex: 1 1 230px;
  min-width: 210px;
  min-height: 78px;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 5px;
  padding: 12px 13px;
  border: 1px solid var(--dev-border-strong, rgba(33, 45, 68, 0.16));
  border-radius: 12px;
  color: var(--dev-text, #1d1d1f);
  background: var(--dev-panel-solid, var(--dev-panel, #fff));
  text-align: left;
  transition:
    border-color 140ms ease,
    background-color 140ms ease,
    transform 100ms ease;
}

.test-action:hover:not(:disabled) {
  border-color: var(--dev-accent, #326bdf);
  background: var(--dev-accent-soft, rgba(50, 107, 223, 0.1));
}

.test-action-title {
  font-size: 12px;
  font-weight: 650;
  line-height: 1.3;
}

.test-action-description {
  color: var(--dev-muted, #636366);
  font-size: 11px;
  font-weight: 400;
  line-height: 1.4;
}

.batch-hint {
  margin-bottom: 0;
  padding-bottom: 14px;
  color: var(--dev-muted, #636366);
  font-size: 11px;
  line-height: 1.45;
}

.test-results {
  padding-top: 14px;
  padding-bottom: 16px;
  border-top: 1px solid var(--dev-border, rgba(33, 45, 68, 0.1));
}

.results-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 9px;
}

h3 {
  margin-bottom: 2px;
  font-size: 13px;
  font-weight: 650;
}

.empty-results {
  margin-bottom: 0;
  padding: 16px 0 5px;
  color: var(--dev-muted, #636366);
  font-size: 11px;
}

.result-list {
  display: grid;
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.result-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 12px;
  padding: 10px 11px;
  border: 1px solid var(--dev-border, rgba(33, 45, 68, 0.1));
  border-radius: 10px;
  background: color-mix(in srgb, var(--dev-bg, #f5f5f7) 62%, transparent);
}

.result-main {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.result-label {
  overflow: hidden;
  color: var(--dev-text, #1d1d1f);
  font-size: 11px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-message {
  overflow-wrap: anywhere;
  color: var(--dev-muted, #636366);
  font-size: 11px;
  line-height: 1.4;
}

.result-meta {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 8px;
  white-space: nowrap;
}

.result-status {
  padding: 3px 7px;
  border-radius: 999px;
  color: var(--dev-muted, #636366);
  background: color-mix(in srgb, var(--dev-muted, #636366) 13%, transparent);
  font-size: 10px;
  font-weight: 650;
}

.result-status--running,
.result-status--pending {
  color: var(--dev-accent, #326bdf);
  background: var(--dev-accent-soft, rgba(50, 107, 223, 0.1));
}

.result-status--success {
  color: var(--dev-success, #248a3d);
  background: color-mix(in srgb, var(--dev-success, #248a3d) 14%, transparent);
}

.result-status--error {
  color: var(--dev-error, #b42318);
  background: color-mix(in srgb, var(--dev-error, #d92d20) 12%, transparent);
}

.result-status--skipped,
.result-status--cancelled {
  color: var(--dev-muted, #636366);
}

.result-elapsed {
  min-width: 40px;
  color: var(--dev-muted, #636366);
  font-family: var(--dev-mono, ui-monospace, monospace);
  font-size: 10px;
  text-align: right;
}

.result-output {
  grid-column: 1 / -1;
  border-top: 1px solid var(--dev-border, rgba(33, 45, 68, 0.1));
  padding-top: 6px;
}

.result-output summary {
  width: fit-content;
  color: var(--dev-accent, #326bdf);
  cursor: pointer;
  font-size: 10px;
  font-weight: 600;
}

.result-output pre {
  max-height: 220px;
  margin: 7px 0 0;
  overflow: auto;
  padding: 9px;
  border: 1px solid var(--dev-border, rgba(33, 45, 68, 0.1));
  border-radius: 8px;
  color: var(--dev-text, #1d1d1f);
  background: var(--dev-panel-solid, var(--dev-panel, #fff));
  font: 10px/1.5 var(--dev-mono, ui-monospace, monospace);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

button:focus-visible,
select:focus-visible,
summary:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--dev-accent, #326bdf) 65%, transparent);
  outline-offset: 3px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 980px) {
  .context-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .quick-tests-header {
    flex-direction: column;
  }

  .quiet-button {
    width: 100%;
  }

  .context-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .test-action {
    min-width: 100%;
  }

  .result-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .result-meta {
    justify-content: flex-start;
  }
}

@media (prefers-color-scheme: dark) {
  .developer-quick-tests {
    --dev-success: #84c99e;
    --dev-error: #f0a39c;
  }
}

@media (prefers-reduced-motion: reduce) {
  .quiet-button,
  .cancel-button,
  .test-action {
    transition: none;
  }
}

@media (prefers-contrast: more) {
  .quick-tests-card,
  .test-action,
  .result-row,
  .reader-picker select {
    border-color: color-mix(in srgb, var(--dev-text, #1d1d1f) 45%, transparent);
  }
}
</style>
