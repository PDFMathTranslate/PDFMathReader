<script setup>
import {computed, nextTick, onBeforeUnmount, onMounted, ref, watch} from 'vue';
import DeveloperQuickTests from './DeveloperQuickTests.vue';
import {developerText, normalizeDeveloperLanguage} from './developer-locales.mjs';

const HISTORY_LENGTH = 28;
const SAMPLE_INTERVAL = 1000;
const EMPTY_VALUE = '—';

const rendererMetricMessages = Object.freeze({
  en: Object.freeze({
    fps: 'FPS',
    frameInterval: 'Frame interval',
    latency: 'RAF scheduling latency',
    fpsTooltip: 'Measured from requestAnimationFrame callbacks.',
    frameIntervalTooltip: 'Average interval between requestAnimationFrame callbacks.',
    latencyTooltip: 'Average callback scheduling lateness: performance.now() minus the requestAnimationFrame timestamp; this is not PDF render time.',
    metricsAria: 'Renderer frame metrics',
    hidden: 'Hidden',
  }),
  'zh-CN': Object.freeze({
    fps: 'FPS',
    frameInterval: '帧间隔',
    latency: '帧回调延迟',
    fpsTooltip: '根据 requestAnimationFrame 回调测得的每秒帧数。',
    frameIntervalTooltip: 'requestAnimationFrame 回调之间的平均间隔。',
    latencyTooltip: '回调调度延迟的平均值：performance.now() 减去 requestAnimationFrame 时间戳；这不是 PDF 渲染时长。',
    metricsAria: '渲染器帧指标',
    hidden: '隐藏',
  }),
  'zh-TW': Object.freeze({
    fps: 'FPS',
    frameInterval: '畫格間隔',
    latency: 'RAF 排程延遲',
    fpsTooltip: '根據 requestAnimationFrame 回呼測得的每秒畫格數。',
    frameIntervalTooltip: 'requestAnimationFrame 回呼之間的平均間隔。',
    latencyTooltip: '回呼排程延遲的平均值：performance.now() 減去 requestAnimationFrame 時間戳；這不是 PDF 渲染時間。',
    metricsAria: '渲染器畫格指標',
    hidden: '隱藏',
  }),
  fr: Object.freeze({
    fps: 'FPS',
    frameInterval: 'Intervalle entre les images',
    latency: 'Latence de planification RAF',
    fpsTooltip: 'Mesuré à partir des rappels requestAnimationFrame.',
    frameIntervalTooltip: 'Intervalle moyen entre les rappels requestAnimationFrame.',
    latencyTooltip: 'Moyenne du retard de planification du rappel : performance.now() moins l’horodatage requestAnimationFrame ; ce n’est pas la durée du rendu PDF.',
    metricsAria: 'Mesures des images du moteur de rendu',
    hidden: 'Masqué',
  }),
  es: Object.freeze({
    fps: 'FPS',
    frameInterval: 'Intervalo entre fotogramas',
    latency: 'Latencia de programación de RAF',
    fpsTooltip: 'Medidos a partir de las devoluciones de llamada de requestAnimationFrame.',
    frameIntervalTooltip: 'Intervalo medio entre las devoluciones de llamada de requestAnimationFrame.',
    latencyTooltip: 'Promedio del retraso de programación de la devolución de llamada: performance.now() menos la marca de tiempo de requestAnimationFrame; no es la duración del renderizado del PDF.',
    metricsAria: 'Métricas de fotogramas del renderizador',
    hidden: 'Oculto',
  }),
  ja: Object.freeze({
    fps: 'FPS',
    frameInterval: 'フレーム間隔',
    latency: 'RAF スケジューリング遅延',
    fpsTooltip: 'requestAnimationFrame コールバックから測定した値。',
    frameIntervalTooltip: 'requestAnimationFrame コールバック間の平均間隔。',
    latencyTooltip: 'コールバックのスケジューリング遅延の平均: performance.now() から requestAnimationFrame のタイムスタンプを引いた値。PDF のレンダリング時間ではありません。',
    metricsAria: 'レンダラーのフレーム指標',
    hidden: '非表示',
  }),
  ko: Object.freeze({
    fps: 'FPS',
    frameInterval: '프레임 간격',
    latency: 'RAF 예약 지연',
    fpsTooltip: 'requestAnimationFrame 콜백에서 측정한 값입니다.',
    frameIntervalTooltip: 'requestAnimationFrame 콜백 사이의 평균 간격입니다.',
    latencyTooltip: '콜백 예약 지연 평균: performance.now()에서 requestAnimationFrame 타임스탬프를 뺀 값이며 PDF 렌더링 시간이 아닙니다.',
    metricsAria: '렌더러 프레임 지표',
    hidden: '숨김',
  }),
});

const operationMetricMessages = Object.freeze({
  en: Object.freeze({
    mainMetricsAria: 'Main process latency metrics',
    operation: 'Avg operation latency',
    fileOpen: 'Avg file-open latency',
    operationTooltip: 'Average duration of completed main-process IPC handlers, excluding monitoring and performance polls.',
    fileOpenTooltip: 'Average shell file-open delivery latency; excludes first-page rendering.',
    backendMetricsAria: 'Backend communication metrics',
    errorRate: 'Error rate',
    communication: 'Avg communication duration',
    errorRateTooltip: 'Backend requests ending in an error divided by all requests.',
    communicationTooltip: 'Average browser-to-local-backend request round trip.',
  }),
  'zh-CN': Object.freeze({
    mainMetricsAria: '主进程延迟指标',
    operation: '平均操作延迟',
    fileOpen: '平均文件打开延迟',
    operationTooltip: '已完成的主进程 IPC 处理程序平均耗时，不包括监控和性能轮询。',
    fileOpenTooltip: 'Shell 传递文件打开请求的平均延迟；不包括首屏渲染。',
    backendMetricsAria: '后端通信指标',
    errorRate: '错误率',
    communication: '平均通信时长',
    errorRateTooltip: '以错误结束的后端请求数除以请求总数。',
    communicationTooltip: '浏览器到本地后端请求的平均往返时长。',
  }),
  'zh-TW': Object.freeze({
    mainMetricsAria: '主程序延遲指標',
    operation: '平均操作延遲',
    fileOpen: '平均檔案開啟延遲',
    operationTooltip: '已完成的主程序 IPC 處理常式平均耗時，不包括監控與效能輪詢。',
    fileOpenTooltip: 'Shell 傳遞檔案開啟請求的平均延遲；不包括首頁渲染。',
    backendMetricsAria: '後端通訊指標',
    errorRate: '錯誤率',
    communication: '平均通訊時長',
    errorRateTooltip: '以錯誤結束的後端請求數除以請求總數。',
    communicationTooltip: '瀏覽器到本機後端請求的平均往返時長。',
  }),
  fr: Object.freeze({
    mainMetricsAria: 'Métriques de latence du processus principal',
    operation: 'Latence moyenne des opérations',
    fileOpen: "Latence moyenne d’ouverture de fichier",
    operationTooltip: 'Durée moyenne des gestionnaires IPC terminés du processus principal, hors sondages de surveillance et de performance.',
    fileOpenTooltip: 'Latence moyenne de remise du fichier par le shell ; hors rendu de la première page.',
    backendMetricsAria: 'Métriques de communication du backend',
    errorRate: "Taux d’erreur",
    communication: 'Durée moyenne de communication',
    errorRateTooltip: 'Nombre de requêtes backend terminées en erreur divisé par le nombre total de requêtes.',
    communicationTooltip: 'Durée moyenne aller-retour d’une requête du navigateur vers le backend local.',
  }),
  es: Object.freeze({
    mainMetricsAria: 'Métricas de latencia del proceso principal',
    operation: 'Latencia media de operaciones',
    fileOpen: 'Latencia media de apertura de archivos',
    operationTooltip: 'Duración media de los controladores IPC completados del proceso principal, sin sondeos de supervisión ni rendimiento.',
    fileOpenTooltip: 'Latencia media de entrega de apertura de archivos por el shell; no incluye el renderizado de la primera página.',
    backendMetricsAria: 'Métricas de comunicación del backend',
    errorRate: 'Tasa de errores',
    communication: 'Duración media de comunicación',
    errorRateTooltip: 'Número de solicitudes del backend terminadas con error dividido por el total de solicitudes.',
    communicationTooltip: 'Duración media del viaje de ida y vuelta de una solicitud del navegador al backend local.',
  }),
  ja: Object.freeze({
    mainMetricsAria: 'メインプロセスの遅延指標',
    operation: '平均操作遅延',
    fileOpen: '平均ファイルオープン遅延',
    operationTooltip: '監視とパフォーマンスポーリングを除く、完了したメインプロセス IPC ハンドラーの平均時間。',
    fileOpenTooltip: 'シェルからファイルオープンが渡されるまでの平均遅延。最初のページの描画時間は含みません。',
    backendMetricsAria: 'バックエンド通信指標',
    errorRate: 'エラー率',
    communication: '平均通信時間',
    errorRateTooltip: 'エラーで終了したバックエンドリクエスト数を全リクエスト数で割った値。',
    communicationTooltip: 'ブラウザからローカルバックエンドまでのリクエスト往復時間の平均。',
  }),
  ko: Object.freeze({
    mainMetricsAria: '메인 프로세스 지연 지표',
    operation: '평균 작업 지연',
    fileOpen: '평균 파일 열기 지연',
    operationTooltip: '모니터링 및 성능 폴링을 제외한 완료된 메인 프로세스 IPC 핸들러의 평균 시간입니다.',
    fileOpenTooltip: '셸에서 파일 열기 요청을 전달하는 평균 지연이며 첫 페이지 렌더링은 포함하지 않습니다.',
    backendMetricsAria: '백엔드 통신 지표',
    errorRate: '오류율',
    communication: '평균 통신 시간',
    errorRateTooltip: '오류로 끝난 백엔드 요청 수를 전체 요청 수로 나눈 값입니다.',
    communicationTooltip: '브라우저에서 로컬 백엔드로 가는 요청의 평균 왕복 시간입니다.',
  }),
});

const language = ref('en');
const snapshotData = ref(null);
const loading = ref(true);
const refreshing = ref(false);
const snapshotError = ref(false);
const bridgeMissing = ref(false);
const lastUpdated = ref(null);
const paused = ref(false);
const autoScroll = ref(true);
const activeTab = ref('console');
const kernelFilter = ref('all');
const searchQuery = ref('');
const copied = ref(false);
const copyFailed = ref(false);
const consoleViewport = ref(null);
const clearedEventIds = ref(new Set());
const clearedCommandIds = ref(new Set());
const metricHistory = ref({
  main: {cpu: [], rss: []},
  renderers: {cpu: [], rss: []},
  backend: {cpu: [], rss: []},
  kernel: {cpu: [], rss: []},
});

let refreshTimer = null;
let copyNoticeTimer = null;
let disposed = false;
let refreshInFlight = false;
let visible = true;

function text(key, values) {
  return developerText(language.value, key, values);
}

function readLanguage() {
  if (typeof window === 'undefined') return 'en';
  const requested = new URLSearchParams(window.location.search).get('language');
  return normalizeDeveloperLanguage(requested || 'en');
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (isRecord(value)) return Object.entries(value).map(([id, item]) => isRecord(item) ? ({id, ...item}) : ({id, value: item}));
  return [];
}

function firstValue(source, keys, fallback = undefined) {
  for (const key of keys) {
    if (source && source[key] !== undefined && source[key] !== null) return source[key];
  }
  return fallback;
}

function finiteNumber(value, fallback = 0) {
  const number = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegativeNumber(value, fallback = 0) {
  return Math.max(0, finiteNumber(value, fallback));
}

function nullableNonNegativeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? Math.max(0, number) : null;
}

function nullableFraction(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : null;
}

function normalizeTime(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value === 'number' || (typeof value === 'string' && value.trim() && /^\d+(\.\d+)?$/.test(value.trim()))) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    return numeric < 1e12 ? numeric * 1000 : numeric;
  }
  const time = Date.parse(String(value || ''));
  return Number.isFinite(time) ? time : null;
}

function normalizeId(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

function normalizeProgress(value) {
  if (isRecord(value)) value = firstValue(value, ['percent', 'percentage', 'progress', 'value'], null);
  if (typeof value === 'string' && value.trim().endsWith('%')) return finiteNumber(value, 0);
  if (value === undefined || value === null || value === '') return null;
  const number = finiteNumber(value, Number.NaN);
  if (!Number.isFinite(number)) return null;
  return number >= 0 && number <= 1 ? number * 100 : Math.min(100, Math.max(0, number));
}

function normalizeRendererFrameMetrics(raw) {
  const item = isRecord(raw) ? raw : {};
  return {
    fps: nullableNonNegativeNumber(item.fps),
    frameIntervalMs: nullableNonNegativeNumber(item.frameIntervalMs),
    latencyMs: nullableNonNegativeNumber(item.latencyMs),
    sampledAt: normalizeTime(item.sampledAt),
    hidden: typeof item.hidden === 'boolean' ? item.hidden : null,
  };
}

function normalizeMainOperationMetrics(raw) {
  const item = isRecord(raw) ? raw : {};
  return {
    operationCount: nullableNonNegativeNumber(item.operationCount),
    averageOperationMs: nullableNonNegativeNumber(item.averageOperationMs),
    fileOpenCount: nullableNonNegativeNumber(item.fileOpenCount),
    averageFileOpenMs: nullableNonNegativeNumber(item.averageFileOpenMs),
  };
}

function normalizeBackendCommunicationMetrics(raw) {
  const item = isRecord(raw) ? raw : {};
  return {
    requestCount: nullableNonNegativeNumber(item.requestCount),
    errorCount: nullableNonNegativeNumber(item.errorCount),
    errorRate: nullableFraction(item.errorRate),
    averageCommunicationMs: nullableNonNegativeNumber(item.averageCommunicationMs),
  };
}

function roleName(value, fallback = 'unknown') {
  const role = String(value || fallback).trim().toLowerCase();
  if (!role) return fallback;
  if (role.includes('render')) return 'renderer';
  if (role.includes('kernel') || role.includes('worker')) return 'kernel';
  if (role.includes('backend') || role.includes('server') || role.includes('service')) return 'backend';
  if (role.includes('main') || role.includes('browser')) return 'main';
  return role;
}

function normalizeProcess(raw, source, fallbackRole = 'unknown') {
  const item = isRecord(raw) ? raw : {};
  const pidValue = firstValue(item, ['pid', 'processId', 'processID', 'id'], null);
  const pid = pidValue === null || pidValue === undefined || pidValue === '' ? null : String(pidValue);
  const role = roleName(firstValue(item, ['role', 'type', 'kind'], fallbackRole), fallbackRole);
  const name = String(firstValue(item, ['name', 'processName', 'label', 'command'], role) || role);
  const cpuPercentBasis = String(firstValue(item, ['cpuPercentBasis', 'cpuBasis', 'cpuSampleBasis'], '') || '');
  const commandValue = firstValue(item, ['command', 'argv', 'commandLine', 'args'], '');
  return {
    pid,
    role,
    name,
    kernel: String(item.kernel || ''),
    command: Array.isArray(commandValue) ? commandValue.join(' ') : String(commandValue || ''),
    cpuPercent: nullableNonNegativeNumber(firstValue(item, ['cpuPercent', 'cpu', 'cpuUsage', 'usage'], null)),
    cpuPercentBasis,
    rssBytes: nullableNonNegativeNumber(firstValue(item, ['rssBytes', 'rss', 'residentBytes', 'memoryBytes', 'memory'], null)),
    sourceWindowId: source?.windowId === undefined || source?.windowId === null ? null : String(source.windowId),
    sourceTitle: String(source?.title || ''),
    rowKey: `${pid || 'unknown'}:${role}:${source?.windowId || 'root'}`,
  };
}

function normalizeProcessesStatus(value) {
  if (value === null || value === undefined) return {available: null, reason: ''};
  if (typeof value === 'boolean') return {available: value, reason: value ? '' : 'Unavailable'};
  if (typeof value === 'string') return {available: !/unavailable|unsupported|denied|error/i.test(value), reason: value};
  const item = isRecord(value) ? value : {};
  const availableValue = firstValue(item, ['available', 'enabled', 'supported'], null);
  return {
    available: availableValue === null ? null : availableValue !== false,
    reason: String(firstValue(item, ['reason', 'message', 'detail', 'error'], '') || ''),
  };
}

function normalizeBackend(raw, index) {
  const item = isRecord(raw) ? raw : {};
  const windowId = normalizeId(firstValue(item, ['windowId', 'windowID', 'id', 'window'], null), String(index + 1));
  const title = String(firstValue(item, ['title', 'name', 'label'], `Window ${windowId}`) || `Window ${windowId}`);
  const source = {windowId, title};
  const processSources = asArray(firstValue(item, ['processes', 'backendProcesses', 'workerProcesses'], []));
  const eventSources = asArray(firstValue(item, ['events', 'logs', 'console'], []));
  const taskSources = asArray(firstValue(item, ['tasks', 'taskQueue', 'queue'], []));
  const commandSources = asArray(firstValue(item, ['commands', 'commandHistory'], []));
  const events = eventSources.map((event, eventIndex) => normalizeEvent(event, eventIndex, source));
  const tasks = taskSources.map((task, taskIndex) => normalizeTask(task, taskIndex, source));
  const commands = commandSources.map((command, commandIndex) => normalizeCommand(command, commandIndex, source));
  return {
    windowId,
    title,
    enabled: firstValue(item, ['enabled', 'active'], true) !== false,
    error: firstValue(item, ['error', 'failure', 'lastError'], null),
    processesStatus: normalizeProcessesStatus(firstValue(item, ['processesStatus', 'processStatus', 'processAvailability'], null)),
    processes: processSources.map(process => normalizeProcess(process, source, 'backend')),
    rendererFrameMetrics: normalizeRendererFrameMetrics(firstValue(item, ['rendererFrameMetrics', 'frameMetrics'], null)),
    events,
    tasks,
    commands,
  };
}

function normalizeEvent(raw, index, source = {}) {
  const item = isRecord(raw) ? raw : {};
  const id = normalizeId(firstValue(item, ['id', 'eventId', 'sequence'], null), String(index + 1));
  return {
    id,
    key: `${source.windowId || 'root'}:event:${id}`,
    time: normalizeTime(firstValue(item, ['time', 'timestamp', 'createdAt', 'at'], null)),
    kind: String(firstValue(item, ['kind', 'type', 'level'], 'event') || 'event'),
    kernel: String(firstValue(item, ['kernel', 'engine', 'service'], '') || ''),
    pid: normalizeId(firstValue(item, ['pid', 'processId', 'processID'], null), ''),
    message: String(firstValue(item, ['message', 'text', 'detail', 'output', 'error'], '') || ''),
    backendId: source.windowId === undefined ? null : String(source.windowId),
    backend: String(source.title || source.windowId || EMPTY_VALUE),
  };
}

function normalizeTask(raw, index, source = {}) {
  const item = isRecord(raw) ? raw : {};
  const id = normalizeId(firstValue(item, ['id', 'taskId', 'requestId'], null), String(index + 1));
  const status = String(firstValue(item, ['status', 'state', 'phase'], 'unknown') || 'unknown');
  return {
    id,
    rowKey: `${source.windowId || 'root'}:task:${id}:${index}`,
    kind: String(firstValue(item, ['kind', 'type', 'operation', 'name'], 'task') || 'task'),
    label: String(firstValue(item, ['label', 'title', 'description'], '') || ''),
    kernel: String(firstValue(item, ['kernel', 'engine', 'service'], '') || ''),
    status,
    progress: normalizeProgress(firstValue(item, ['progress', 'percent', 'percentage'], null)),
    page: firstValue(item, ['page', 'pageNumber', 'pageIndex'], null),
    queuedAt: normalizeTime(firstValue(item, ['queuedAt', 'enqueuedAt', 'createdAt'], null)),
    startedAt: normalizeTime(firstValue(item, ['startedAt', 'runningAt'], null)),
    backendId: source.windowId === undefined ? null : String(source.windowId),
    backend: String(source.title || source.windowId || EMPTY_VALUE),
  };
}

function normalizeCommand(raw, index, source = {}, event = false) {
  const item = isRecord(raw) ? raw : {};
  const id = normalizeId(firstValue(item, ['id', 'commandId', 'sequence'], null), String(index + 1));
  return {
    id,
    rowKey: `${source.windowId || 'root'}:command:${id}`,
    time: normalizeTime(firstValue(item, ['time', 'timestamp', 'createdAt', 'at'], null)),
    command: String(firstValue(item, ['command', 'name', 'message', 'text'], event ? 'command' : '') || ''),
    result: String(firstValue(item, ['result', 'status', 'output', 'response'], '') || ''),
    kernel: String(firstValue(item, ['kernel', 'engine', 'service'], '') || ''),
    backendId: source.windowId === undefined ? null : String(source.windowId),
    backend: String(source.title || source.windowId || EMPTY_VALUE),
  };
}

function sumBy(items, field) {
  let total = 0;
  let found = false;
  for (const item of items) {
    if (item[field] === null || item[field] === undefined) continue;
    const value = Number(item[field]);
    if (!Number.isFinite(value)) continue;
    found = true;
    total += Math.max(0, value);
  }
  return found ? total : null;
}

function averageBy(items, field) {
  const values = items.map(item => item?.[field]).filter(Number.isFinite);
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

function rendererFrameMeasurement(data) {
  const samples = (data?.backends || [])
    .map(backend => backend.rendererFrameMetrics)
    .filter(metrics => metrics && ['fps', 'frameIntervalMs', 'latencyMs'].some(key => Number.isFinite(metrics[key])));
  return {
    fps: averageBy(samples, 'fps'),
    frameIntervalMs: averageBy(samples, 'frameIntervalMs'),
    latencyMs: averageBy(samples, 'latencyMs'),
    hidden: samples.length && samples.every(metrics => metrics.hidden === true) ? true : samples.length && samples.every(metrics => metrics.hidden === false) ? false : null,
    sampleCount: samples.length,
  };
}

// The compact header relies on exactly six stable, document-free diagnostics.
function primaryMetrics(data) {
  const processes = Array.isArray(data?.processes) ? data.processes : [];
  return Object.freeze({
    totalCpuPercent: sumBy(processes, 'cpuPercent'),
    totalRssBytes: sumBy(processes, 'rssBytes'),
    freeMemoryBytes: nonNegativeNumber(data?.system?.freeMemory),
    processCount: processes.length,
    taskCount: Array.isArray(data?.tasks) ? data.tasks.length : 0,
    eventCount: Array.isArray(data?.events) ? data.events.length : 0,
  });
}

function normalizeSnapshot(input) {
  const source = isRecord(input) ? input : {};
  const backendSources = asArray(firstValue(source, ['backends', 'backendWindows', 'windows'], []));
  const backends = backendSources.map(normalizeBackend);
  const root = {windowId: null, title: '', processes: []};
  const topProcesses = asArray(firstValue(source, ['processes', 'allProcesses'], []));
  const processes = topProcesses.map(process => normalizeProcess(process, root));
  const seenPids = new Set(processes.filter(process => process.pid).map(process => process.pid));
  for (const backend of backends) {
    for (const process of backend.processes) {
      if (process.pid && seenPids.has(process.pid)) continue;
      if (process.pid) seenPids.add(process.pid);
      processes.push(process);
    }
  }

  const rootSource = {windowId: 'root', title: 'Main'};
  const rootEvents = asArray(firstValue(source, ['events', 'logs', 'console'], [])).map((event, index) => normalizeEvent(event, index, rootSource));
  const backendEvents = backends.flatMap(backend => backend.events);
  const events = rootEvents.length ? rootEvents : backendEvents;
  const rootTasks = asArray(firstValue(source, ['tasks', 'taskQueue', 'queue'], [])).map((task, index) => normalizeTask(task, index, rootSource));
  const backendTasks = backends.flatMap(backend => backend.tasks);
  const tasks = rootTasks.length ? rootTasks : backendTasks;
  const rootCommands = asArray(firstValue(source, ['commands', 'commandHistory'], [])).map((command, index) => normalizeCommand(command, index, rootSource));
  const backendCommands = backends.flatMap(backend => backend.commands);
  const eventCommands = events.filter(event => /spawn|stdin|command|request|response|invoke/i.test(event.kind)).map((event, index) => normalizeCommand(event, index, {windowId: event.backendId, title: event.backend}, true));
  const commands = rootCommands.length ? rootCommands : (backendCommands.length ? backendCommands : eventCommands);
  const systemSource = isRecord(source.system) ? source.system : {};
  const normalized = {
    sampledAt: normalizeTime(firstValue(source, ['sampledAt', 'timestamp', 'time'], null)),
    mainOperationMetrics: normalizeMainOperationMetrics(firstValue(source, ['mainOperationMetrics'], null)),
    backendCommunicationMetrics: normalizeBackendCommunicationMetrics(firstValue(source, ['backendCommunicationMetrics'], null)),
    system: {
      totalMemory: nonNegativeNumber(firstValue(systemSource, ['totalMemory', 'totalMemoryBytes', 'total'], 0)),
      freeMemory: nonNegativeNumber(firstValue(systemSource, ['freeMemory', 'freeMemoryBytes', 'free'], 0)),
    },
    processes,
    backends,
    events,
    tasks,
    commands,
  };
  normalized.primaryMetrics = primaryMetrics(normalized);
  return normalized;
}

function processMatches(process, key) {
  if (key === 'main') return process.role === 'main';
  if (key === 'renderers') return process.role === 'renderer';
  if (key === 'backend') return process.role === 'backend';
  if (key === 'kernel') return process.role === 'kernel';
  return false;
}

function resourceMeasurement(data, key) {
  const processes = data?.processes?.filter(process => processMatches(process, key)) || [];
  const backendCount = data?.backends?.length || 0;
  const enabledBackendCount = data?.backends?.filter(backend => backend.enabled).length || 0;
  return {
    cpu: processes.length && processes.every(process => process.cpuPercent === null) ? null : sumBy(processes, 'cpuPercent'),
    rss: sumBy(processes, 'rssBytes'),
    processCount: processes.length,
    count: key === 'backend' ? backendCount : processes.length,
    enabledCount: key === 'backend' ? enabledBackendCount : processes.length,
    hasError: key === 'backend' && Boolean(data?.backends?.some(backend => backend.error)),
    frameMetrics: key === 'renderers' ? rendererFrameMeasurement(data) : null,
    mainOperationMetrics: key === 'main' ? data?.mainOperationMetrics : null,
    backendCommunicationMetrics: key === 'backend' ? data?.backendCommunicationMetrics : null,
  };
}

function recordMetricHistory(data) {
  const next = {...metricHistory.value};
  for (const key of ['main', 'renderers', 'backend', 'kernel']) {
    const measurement = resourceMeasurement(data, key);
    next[key] = {
      cpu: [...(next[key]?.cpu || []), measurement.cpu].slice(-HISTORY_LENGTH),
      rss: [...(next[key]?.rss || []), measurement.rss].slice(-HISTORY_LENGTH),
    };
  }
  metricHistory.value = next;
}

function sparklinePoints(values) {
  const usable = Array.isArray(values) ? values.filter(Number.isFinite) : [];
  const series = usable.length ? usable : [0];
  const known = series.filter(value => Number.isFinite(Number(value))).map(Number);
  if (!known.length) return '';
  let previous = known[0];
  const plotted = series.map(value => {
    const number = Number(value);
    if (Number.isFinite(number)) previous = number;
    return previous;
  });
  const min = Math.min(...plotted);
  const max = Math.max(...plotted);
  const range = max - min || 1;
  return plotted.map((value, index) => {
    const x = plotted.length === 1 ? 50 : (index / (plotted.length - 1)) * 100;
    const y = 28 - ((value - min) / range) * 22;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
}

function formatBytes(value) {
  const number = nonNegativeNumber(value, Number.NaN);
  if (!Number.isFinite(number) || number <= 0) return EMPTY_VALUE;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let amount = number;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) { amount /= 1024; index++; }
  const digits = amount >= 100 || index === 0 ? 0 : amount >= 10 ? 1 : 2;
  return `${amount.toFixed(digits)} ${units[index]}`;
}

function formatCpu(value) {
  const number = nonNegativeNumber(value, Number.NaN);
  return Number.isFinite(number) ? `${number.toFixed(1)}%` : EMPTY_VALUE;
}

function rendererText(key) {
  return rendererMetricMessages[language.value]?.[key] || rendererMetricMessages.en[key];
}

function formatMilliseconds(value) {
  const number = nonNegativeNumber(value, Number.NaN);
  return Number.isFinite(number) ? `${number.toFixed(1)} ms` : EMPTY_VALUE;
}

function formatFps(value) {
  const number = nonNegativeNumber(value, Number.NaN);
  return Number.isFinite(number) ? number.toFixed(1) : EMPTY_VALUE;
}

function rendererMetricRows(metrics) {
  return [
    {key: 'fps', label: rendererText('fps'), value: formatFps(metrics?.fps), title: rendererText('fpsTooltip')},
    {key: 'frameInterval', label: rendererText('frameInterval'), value: formatMilliseconds(metrics?.frameIntervalMs), title: rendererText('frameIntervalTooltip')},
    {key: 'latency', label: rendererText('latency'), value: formatMilliseconds(metrics?.latencyMs), title: rendererText('latencyTooltip')},
  ];
}

function operationMetricText(key) {
  return operationMetricMessages[language.value]?.[key] || operationMetricMessages.en[key];
}

function formatPercentage(value) {
  const number = nullableFraction(value);
  return number === null ? EMPTY_VALUE : `${(number * 100).toFixed(1)}%`;
}

function hasSamples(count) {
  return Number.isFinite(count) && count > 0;
}

function formatSampledMilliseconds(value, count) {
  return hasSamples(count) ? formatMilliseconds(value) : EMPTY_VALUE;
}

function formatSampledPercentage(value, count) {
  return hasSamples(count) ? formatPercentage(value) : EMPTY_VALUE;
}

function operationMetricRows(card) {
  if (card.key === 'main') {
    const metrics = card.mainOperationMetrics || {};
    return [
      {key: 'operation', label: operationMetricText('operation'), value: formatSampledMilliseconds(metrics.averageOperationMs, metrics.operationCount), title: operationMetricText('operationTooltip')},
      {key: 'fileOpen', label: operationMetricText('fileOpen'), value: formatSampledMilliseconds(metrics.averageFileOpenMs, metrics.fileOpenCount), title: operationMetricText('fileOpenTooltip')},
    ];
  }
  if (card.key === 'backend') {
    const metrics = card.backendCommunicationMetrics || {};
    return [
      {key: 'errorRate', label: operationMetricText('errorRate'), value: formatSampledPercentage(metrics.errorRate, metrics.requestCount), title: operationMetricText('errorRateTooltip')},
      {key: 'communication', label: operationMetricText('communication'), value: formatSampledMilliseconds(metrics.averageCommunicationMs, metrics.requestCount), title: operationMetricText('communicationTooltip')},
    ];
  }
  return [];
}

function formatCount(value) {
  return new Intl.NumberFormat(localeCode.value).format(Math.max(0, Math.round(finiteNumber(value, 0))));
}

function formatTime(value) {
  if (!value) return EMPTY_VALUE;
  try {
    return new Intl.DateTimeFormat(localeCode.value, {hour: '2-digit', minute: '2-digit', second: '2-digit'}).format(new Date(value));
  } catch {
    return EMPTY_VALUE;
  }
}

function formatProgress(value) {
  return value === null || value === undefined ? EMPTY_VALUE : `${Math.round(Math.max(0, Math.min(100, value)))}%`;
}

function stateKey(value) {
  const state = String(value || '').toLowerCase();
  if (state.includes('queue')) return 'queued';
  if (state.includes('run') || state.includes('process')) return 'running';
  if (state.includes('complete') || state.includes('done') || state.includes('success')) return 'completed';
  if (state.includes('fail') || state.includes('error')) return 'failed';
  if (state.includes('wait') || state.includes('pending')) return 'waiting';
  return 'unknown';
}

const localeCode = computed(() => language.value === 'en' ? 'en-US' : language.value);
const hasSample = computed(() => Boolean(snapshotData.value));
const sampleState = computed(() => {
  if (paused.value) return 'paused';
  if (refreshing.value) return 'refreshing';
  if (!snapshotData.value) return 'waiting';
  return 'live';
});
const sampleStateLabel = computed(() => text(`status.${sampleState.value}`));
const updatedLabel = computed(() => lastUpdated.value ? text('status.updated', {time: formatTime(lastUpdated.value)}) : '');
const systemMemory = computed(() => snapshotData.value?.system || {totalMemory: 0, freeMemory: 0});
const primary = computed(() => snapshotData.value?.primaryMetrics || primaryMetrics({}));

const resourceCards = computed(() => {
  const data = snapshotData.value || {};
  return [
    {key: 'main', label: text('resources.main'), tone: 'blue'},
    {key: 'renderers', label: text('resources.renderers'), tone: 'violet'},
    {key: 'backend', label: text('resources.backend'), tone: 'amber'},
    {key: 'kernel', label: text('resources.kernel'), tone: 'green'},
  ].map(card => {
    const measurement = resourceMeasurement(data, card.key);
    const history = metricHistory.value[card.key] || {cpu: [], rss: []};
    return {...card, ...measurement, history, status: measurement.hasError ? 'error' : measurement.count > 0 ? 'active' : 'idle'};
  });
});

const processRows = computed(() => [...(snapshotData.value?.processes || [])].sort((a, b) => b.cpuPercent - a.cpuPercent || String(a.pid || '').localeCompare(String(b.pid || ''))));
const kernelOptions = computed(() => {
  const values = new Set();
  for (const process of snapshotData.value?.processes || []) if (process.kernel) values.add(process.kernel);
  for (const event of snapshotData.value?.events || []) if (event.kernel) values.add(event.kernel);
  for (const task of snapshotData.value?.tasks || []) if (task.kernel) values.add(task.kernel);
  for (const command of snapshotData.value?.commands || []) if (command.kernel) values.add(command.kernel);
  return [...values].sort((a, b) => a.localeCompare(b));
});
const normalizedQuery = computed(() => searchQuery.value.trim().toLowerCase());

function matchesFilter(item) {
  if (kernelFilter.value !== 'all' && item.kernel !== kernelFilter.value) return false;
  if (!normalizedQuery.value) return true;
  const haystack = [item.kind, item.kernel, item.message, item.command, item.result, item.backend, item.id, item.status].join(' ').toLowerCase();
  return haystack.includes(normalizedQuery.value);
}

const visibleEvents = computed(() => [...(snapshotData.value?.events || [])]
  .filter(event => !clearedEventIds.value.has(event.key) && matchesFilter(event))
  .sort((a, b) => (a.time || 0) - (b.time || 0)));
const visibleCommands = computed(() => [...(snapshotData.value?.commands || [])]
  .filter(command => !clearedCommandIds.value.has(command.rowKey) && matchesFilter(command))
  .sort((a, b) => (a.time || 0) - (b.time || 0)));
const visibleTasks = computed(() => [...(snapshotData.value?.tasks || [])].filter(matchesFilter));

const visibleEventCount = computed(() => visibleEvents.value.length);
const visibleCommandCount = computed(() => visibleCommands.value.length);
const hasEvents = computed(() => (snapshotData.value?.events?.length || 0) > 0);
const hasTasks = computed(() => (snapshotData.value?.tasks?.length || 0) > 0);
const hasCommands = computed(() => (snapshotData.value?.commands?.length || 0) > 0);
const unavailableBackendProcesses = computed(() => (snapshotData.value?.backends || [])
  .filter(backend => backend.processesStatus?.available === false)
  .map(backend => ({title: backend.title, reason: backend.processesStatus.reason})));
const taskCounts = computed(() => {
  const counts = {queued: 0, running: 0, completed: 0, failed: 0, other: 0};
  for (const task of snapshotData.value?.tasks || []) {
    const state = stateKey(task.status);
    if (state in counts) counts[state]++;
    else counts.other++;
  }
  return counts;
});

function scrollConsoleToEnd() {
  if (!autoScroll.value || activeTab.value !== 'console') return;
  nextTick(() => {
    if (consoleViewport.value) consoleViewport.value.scrollTop = consoleViewport.value.scrollHeight;
  });
}

watch(() => [visibleEvents.value.at(-1)?.key, activeTab.value, autoScroll.value], scrollConsoleToEnd);

function clearView() {
  if (activeTab.value === 'console') {
    const next = new Set(clearedEventIds.value);
    for (const event of visibleEvents.value) next.add(event.key);
    clearedEventIds.value = next;
  } else {
    const commands = new Set(clearedCommandIds.value);
    for (const command of visibleCommands.value) commands.add(command.rowKey);
    clearedCommandIds.value = commands;
  }
}

function updateSnapshot(raw) {
  const normalized = normalizeSnapshot(raw);
  snapshotData.value = normalized;
  const eventKeys = new Set(normalized.events.map(event => event.key));
  const commandKeys = new Set(normalized.commands.map(command => command.rowKey));
  clearedEventIds.value = new Set([...clearedEventIds.value].filter(key => eventKeys.has(key)));
  clearedCommandIds.value = new Set([...clearedCommandIds.value].filter(key => commandKeys.has(key)));
  recordMetricHistory(normalized);
  lastUpdated.value = Date.now();
  loading.value = false;
  snapshotError.value = false;
  bridgeMissing.value = false;
}

function scheduleRefresh() {
  clearTimeout(refreshTimer);
  refreshTimer = null;
  if (disposed || paused.value || !visible) return;
  refreshTimer = window.setTimeout(() => { void refreshSnapshot(); }, SAMPLE_INTERVAL);
}

async function refreshSnapshot({manual = false} = {}) {
  if (disposed || !visible || refreshInFlight || (!manual && paused.value)) return;
  const bridge = window.previewDeveloper;
  if (!bridge || typeof bridge.snapshot !== 'function') {
    loading.value = false;
    bridgeMissing.value = true;
    snapshotError.value = true;
    scheduleRefresh();
    return;
  }
  refreshInFlight = true;
  refreshing.value = true;
  try {
    updateSnapshot(await bridge.snapshot());
  } catch {
    loading.value = false;
    snapshotError.value = true;
  } finally {
    refreshInFlight = false;
    refreshing.value = false;
    scheduleRefresh();
  }
}

function refreshNow() {
  void refreshSnapshot({manual: true});
}

function togglePaused() {
  paused.value = !paused.value;
  clearTimeout(refreshTimer);
  refreshTimer = null;
  if (!paused.value) void refreshSnapshot({manual: true});
}

function handleVisibilityChange() {
  visible = document.visibilityState === 'visible';
  if (!visible) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  } else if (!paused.value) {
    void refreshSnapshot({manual: true});
  }
}

function diagnosticPayload() {
  const data = snapshotData.value || {};
  return {
    app: 'PDFMathReader',
    sampledAt: data.sampledAt,
    system: data.system,
    primaryMetrics: primaryMetrics(data),
    mainOperationMetrics: data.mainOperationMetrics || normalizeMainOperationMetrics(null),
    backendCommunicationMetrics: data.backendCommunicationMetrics || normalizeBackendCommunicationMetrics(null),
    processes: (data.processes || []).map(process => ({
      pid: process.pid,
      role: process.role,
      name: process.name,
      kernel: process.kernel,
      command: process.command,
      cpuPercentBasis: process.cpuPercentBasis,
      cpuPercent: process.cpuPercent,
      rssBytes: process.rssBytes,
      sourceWindowId: process.sourceWindowId,
    })),
    backends: (data.backends || []).map(backend => ({
      windowId: backend.windowId,
      enabled: backend.enabled,
      hasError: Boolean(backend.error),
      eventCount: backend.events.length,
      taskCount: backend.tasks.length,
      processCount: backend.processes.length,
      rendererFrameMetrics: backend.rendererFrameMetrics,
      kernels: [...new Set([...backend.events, ...backend.tasks, ...backend.commands].map(item => item.kernel).filter(Boolean))],
    })),
    events: (data.events || []).map(event => ({
      id: event.id,
      time: event.time,
      kind: event.kind,
      kernel: event.kernel,
      pid: event.pid,
      backendId: event.backendId,
      message: event.message,
    })),
    tasks: (data.tasks || []).map(task => ({
      id: task.id,
      kind: task.kind,
      kernel: task.kernel,
      status: task.status,
      progress: task.progress,
      page: task.page,
      queuedAt: task.queuedAt,
      startedAt: task.startedAt,
      backendId: task.backendId,
      label: task.label,
    })),
    commands: (data.commands || []).map(command => ({
      id: command.id,
      time: command.time,
      kernel: command.kernel,
      backendId: command.backendId,
      command: command.command,
      result: command.result,
    })),
  };
}

async function copyDiagnostics() {
  copyFailed.value = false;
  copied.value = false;
  const copy = window.previewDeveloper?.copy;
  if (typeof copy !== 'function') {
    copyFailed.value = true;
    return;
  }
  try {
    const result = await copy(JSON.stringify(diagnosticPayload(), null, 2));
    if (result && typeof result === 'object' && result.ok === false) throw new Error('copy rejected');
    if (result === false) throw new Error('copy rejected');
    copied.value = true;
    clearTimeout(copyNoticeTimer);
    copyNoticeTimer = window.setTimeout(() => { copied.value = false; }, 2400);
  } catch {
    copyFailed.value = true;
  }
}

onMounted(() => {
  language.value = readLanguage();
  visible = document.visibilityState === 'visible';
  document.addEventListener('visibilitychange', handleVisibilityChange, {passive: true});
  void refreshSnapshot({manual: true});
});

onBeforeUnmount(() => {
  disposed = true;
  clearTimeout(refreshTimer);
  clearTimeout(copyNoticeTimer);
  document.removeEventListener('visibilitychange', handleVisibilityChange);
});
</script>

<template>
  <main class="developer-window">
    <header class="developer-header">
      <div class="brand-lockup">
        <div class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div>
        <div>
          <h1>{{ text('app.title') }}</h1>
          <p>{{ text('app.subtitle') }}</p>
        </div>
      </div>

      <div class="header-actions">
        <div class="sample-status" :class="`sample-status--${sampleState}`" aria-live="polite">
          <span class="status-dot" aria-hidden="true"></span>
          <span>{{ sampleStateLabel }}</span>
          <span v-if="updatedLabel" class="updated-label">{{ updatedLabel }}</span>
        </div>
        <button class="icon-button" type="button" :aria-label="text('action.refresh')" :title="text('action.refresh')" @click="refreshNow">
          <span aria-hidden="true">↻</span>
        </button>
        <button class="secondary-button" type="button" :title="text('action.copyDiagnostics')" @click="copyDiagnostics">
          <span aria-hidden="true">⧉</span>
          <span>{{ copied ? text('action.copied') : text('action.copyDiagnostics') }}</span>
        </button>
        <button class="primary-button" type="button" :aria-pressed="paused" :title="paused ? text('action.resume') : text('action.pause')" @click="togglePaused">
          <span aria-hidden="true">{{ paused ? '▶' : 'Ⅱ' }}</span>
          <span>{{ paused ? text('action.resume') : text('action.pause') }}</span>
        </button>
      </div>
    </header>

    <div v-if="snapshotError" class="error-banner" role="alert">
      <span class="error-icon" aria-hidden="true">!</span>
      <span>{{ bridgeMissing ? text('error.noBridge') : text('error.snapshot') }}</span>
      <button type="button" class="banner-action" @click="refreshNow">{{ text('action.refresh') }}</button>
    </div>
    <div v-if="copyFailed" class="copy-banner" role="status">{{ text('error.copy') }}</div>

    <DeveloperQuickTests :language="language" />

    <section v-if="hasSample" class="summary-strip" :aria-label="text('resources.title')">
      <div class="summary-stat">
        <span class="summary-label">{{ text('resources.cpu') }}</span>
        <strong>{{ formatCpu(primary.totalCpuPercent) }}</strong>
      </div>
      <div class="summary-stat">
        <span class="summary-label">{{ text('resources.rss') }}</span>
        <strong>{{ formatBytes(primary.totalRssBytes) }}</strong>
      </div>
      <div class="summary-stat">
        <span class="summary-label">{{ text('system.totalMemory') }}</span>
        <strong>{{ formatBytes(systemMemory.totalMemory) }}</strong>
      </div>
      <div class="summary-stat">
        <span class="summary-label">{{ text('system.freeMemory') }}</span>
        <strong>{{ formatBytes(systemMemory.freeMemory) }}</strong>
      </div>
      <div class="summary-stat">
        <span class="summary-label">{{ text('processes.title') }}</span>
        <strong>{{ formatCount(primary.processCount) }}</strong>
      </div>
      <div class="summary-stat">
        <span class="summary-label">{{ text('tasks.title') }}</span>
        <strong>{{ formatCount(primary.taskCount) }}</strong>
      </div>
    </section>

    <section v-if="hasSample" class="section-block resources-section">
      <div class="section-heading">
        <div>
          <h2>{{ text('resources.title') }}</h2>
          <span class="section-caption">{{ text('app.developerHint') }}</span>
        </div>
        <span class="section-count">{{ formatCount(primary.eventCount) }} {{ text('console.events').toLowerCase() }}</span>
      </div>
      <div class="resource-grid">
        <article v-for="card in resourceCards" :key="card.key" class="resource-card" :class="`resource-card--${card.tone}`">
          <div class="resource-card-topline">
            <div class="resource-name"><span class="resource-symbol" aria-hidden="true"></span>{{ card.label }}</div>
            <span class="resource-state" :class="`resource-state--${card.status}`"><span class="state-dot"></span>{{ text(`resources.${card.status}`) }}</span>
          </div>
          <div class="resource-card-body">
            <div class="resource-number">{{ card.key === 'backend' ? formatCount(card.count) : formatCount(card.processCount) }}</div>
            <div class="resource-detail">{{ card.key === 'backend' ? text('resources.windows', {count: formatCount(card.count)}) : text('resources.processes', {count: formatCount(card.processCount)}) }}</div>
          </div>
          <div class="sparkline-stack" :aria-label="`${card.label} ${text('resources.cpu')} ${formatCpu(card.cpu)}, ${text('resources.rss')} ${formatBytes(card.rss)}`">
            <div class="sparkline-row"><span>{{ text('resources.cpu') }}</span><svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline :points="sparklinePoints(card.history.cpu)"></polyline></svg><strong>{{ formatCpu(card.cpu) }}</strong></div>
            <div class="sparkline-row sparkline-row--rss"><span>{{ text('resources.rss') }}</span><svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline :points="sparklinePoints(card.history.rss)"></polyline></svg><strong>{{ formatBytes(card.rss) }}</strong></div>
          </div>
          <div v-if="card.key === 'renderers'" class="renderer-frame-metrics" :aria-label="rendererText('metricsAria')">
            <div v-for="metric in rendererMetricRows(card.frameMetrics)" :key="metric.key" class="renderer-frame-metric" :title="metric.title">
              <span>{{ metric.label }}</span><strong>{{ metric.value }}</strong>
            </div>
            <span v-if="card.frameMetrics.hidden === true" class="renderer-hidden-state">{{ rendererText('hidden') }}</span>
          </div>
          <div v-if="card.key === 'main' || card.key === 'backend'" class="renderer-frame-metrics resource-operation-metrics" :aria-label="operationMetricText(card.key === 'main' ? 'mainMetricsAria' : 'backendMetricsAria')">
            <div v-for="metric in operationMetricRows(card)" :key="metric.key" class="renderer-frame-metric" :title="metric.title">
              <span>{{ metric.label }}</span><strong>{{ metric.value }}</strong>
            </div>
          </div>
          <div v-if="card.status === 'idle'" class="resource-footnote">{{ text('resources.noProcess') }}</div>
        </article>
      </div>
      <div v-if="unavailableBackendProcesses.length" class="availability-strip" role="status">
        <span class="availability-icon" aria-hidden="true">i</span>
        <strong>{{ text('processes.monitorUnavailable') }}</strong>
        <span v-for="status in unavailableBackendProcesses" :key="status.title" class="availability-item">
          {{ status.title }}<span v-if="status.reason"> · {{ text('processes.monitorReason') }}: {{ status.reason }}</span>
        </span>
      </div>
    </section>

    <section v-if="hasSample" class="panel console-panel">
      <div class="panel-heading console-heading">
        <div class="tab-list" role="tablist" :aria-label="text('app.title')">
          <button class="tab-button" :class="{active: activeTab === 'console'}" role="tab" :aria-selected="activeTab === 'console'" type="button" @click="activeTab = 'console'">{{ text('console.consoleTab') }}</button>
          <button class="tab-button" :class="{active: activeTab === 'commands'}" role="tab" :aria-selected="activeTab === 'commands'" type="button" @click="activeTab = 'commands'">{{ text('console.commandsTab') }}</button>
        </div>
        <div class="console-tools">
          <label class="search-field">
            <span class="search-icon" aria-hidden="true">⌕</span>
            <span class="sr-only">{{ text('console.search') }}</span>
            <input v-model="searchQuery" type="search" :placeholder="text('console.searchPlaceholder')" />
          </label>
          <label class="kernel-select">
            <span class="sr-only">{{ text('console.kernel') }}</span>
            <select v-model="kernelFilter">
              <option value="all">{{ text('console.allKernels') }}</option>
              <option v-for="kernel in kernelOptions" :key="kernel" :value="kernel">{{ kernel }}</option>
            </select>
          </label>
          <label class="toggle-control"><input v-model="autoScroll" type="checkbox" /><span class="toggle-track"><span></span></span><span>{{ text('console.autoScroll') }}</span></label>
          <button class="small-button" type="button" :disabled="activeTab === 'console' ? !visibleEventCount : !visibleCommandCount" @click="clearView">{{ text('action.clearView') }}</button>
        </div>
      </div>

      <div ref="consoleViewport" class="console-viewport">
        <table v-if="activeTab === 'console'" class="data-table console-table">
          <thead><tr><th>{{ text('events.time') }}</th><th>{{ text('events.kind') }}</th><th>{{ text('events.kernel') }}</th><th>{{ text('events.pid') }}</th><th>{{ text('events.backend') }}</th><th>{{ text('events.message') }}</th></tr></thead>
          <tbody>
            <tr v-for="event in visibleEvents" :key="event.key">
              <td class="time-cell">{{ formatTime(event.time) }}</td>
              <td><span class="kind-pill">{{ event.kind }}</span></td>
              <td class="mono-cell">{{ event.kernel || EMPTY_VALUE }}</td>
              <td class="mono-cell">{{ event.pid || EMPTY_VALUE }}</td>
              <td class="source-cell">{{ event.backend }}</td>
              <td class="message-cell" :title="event.message">{{ event.message || EMPTY_VALUE }}</td>
            </tr>
            <tr v-if="!visibleEvents.length" class="empty-row"><td colspan="6"><span class="empty-table-icon" aria-hidden="true">⌁</span>{{ hasEvents ? text('events.noMatch') : text('events.empty') }}</td></tr>
          </tbody>
        </table>

        <table v-else class="data-table commands-table">
          <thead><tr><th>{{ text('commands.time') }}</th><th>{{ text('commands.command') }}</th><th>{{ text('commands.result') }}</th><th>{{ text('commands.kernel') }}</th><th>{{ text('commands.backend') }}</th></tr></thead>
          <tbody>
            <tr v-for="command in visibleCommands" :key="command.rowKey">
              <td class="time-cell">{{ formatTime(command.time) }}</td>
              <td class="message-cell" :title="command.command">{{ command.command || EMPTY_VALUE }}</td>
              <td class="message-cell" :title="command.result">{{ command.result || EMPTY_VALUE }}</td>
              <td class="mono-cell">{{ command.kernel || EMPTY_VALUE }}</td>
              <td class="source-cell">{{ command.backend }}</td>
            </tr>
            <tr v-if="!visibleCommands.length" class="empty-row"><td colspan="5"><span class="empty-table-icon" aria-hidden="true">⌁</span>{{ hasCommands ? text('console.filterResults') : text('commands.empty') }}</td></tr>
          </tbody>
        </table>
      </div>
      <div v-if="paused" class="panel-footnote"><span class="pause-mark" aria-hidden="true">Ⅱ</span>{{ text('console.pauseHint') }}</div>
    </section>

    <section v-if="hasSample" class="lower-grid">
      <section class="panel table-panel">
        <div class="panel-heading"><div><h2>{{ text('processes.title') }}</h2><span class="section-caption">{{ formatCount(processRows.length) }}</span></div><span class="panel-icon" aria-hidden="true">⌁</span></div>
        <div class="table-scroll">
          <table class="data-table process-table">
            <thead><tr><th>{{ text('processes.pid') }}</th><th>{{ text('processes.role') }}</th><th>{{ text('processes.name') }}</th><th>{{ text('processes.cpu') }}</th><th>{{ text('processes.rss') }}</th><th>{{ text('processes.source') }}</th></tr></thead>
            <tbody>
              <tr v-for="process in processRows" :key="process.rowKey">
                <td class="mono-cell pid-cell">{{ process.pid || EMPTY_VALUE }}</td>
                <td><span class="role-badge" :class="`role-${process.role.replace(/\s+/g, '-')}`">{{ process.role }}</span></td>
                <td class="process-name" :title="process.command || process.name">
                  <details v-if="process.command || process.cpuPercentBasis" class="process-details">
                    <summary>{{ process.name }}</summary>
                    <div class="process-detail">
                      <span v-if="process.command" class="process-command">{{ process.command }}</span>
                      <span v-if="process.cpuPercentBasis" class="process-cpu-basis">{{ process.cpuPercentBasis }}</span>
                    </div>
                  </details>
                  <span v-else>{{ process.name }}</span>
                  <span v-if="process.kernel" class="process-kernel">{{ process.kernel }}</span>
                </td>
                <td class="numeric-cell" :title="process.cpuPercentBasis || text('resources.cpu')">{{ formatCpu(process.cpuPercent) }}</td>
                <td class="numeric-cell">{{ formatBytes(process.rssBytes) }}</td>
                <td class="source-cell">{{ process.sourceTitle || text('resources.main') }}</td>
              </tr>
              <tr v-if="!processRows.length" class="empty-row"><td colspan="6"><span class="empty-table-icon" aria-hidden="true">◌</span>{{ text('processes.empty') }}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel table-panel">
        <div class="panel-heading"><div><h2>{{ text('tasks.title') }}</h2><span class="section-caption">{{ formatCount(visibleTasks.length) }}</span></div><div class="queue-counts"><span v-if="taskCounts.queued">{{ taskCounts.queued }} {{ text('state.queued') }}</span><span v-if="taskCounts.running">{{ taskCounts.running }} {{ text('state.running') }}</span><span v-if="taskCounts.failed" class="queue-count--failed">{{ taskCounts.failed }} {{ text('state.failed') }}</span><span class="panel-icon" aria-hidden="true">◷</span></div></div>
        <div class="table-scroll">
          <table class="data-table task-table">
            <thead><tr><th>{{ text('tasks.id') }}</th><th>{{ text('tasks.label') }}</th><th>{{ text('tasks.kernel') }}</th><th>{{ text('tasks.status') }}</th><th>{{ text('tasks.progress') }}</th><th>{{ text('tasks.page') }}</th><th>{{ text('tasks.queuedAt') }}</th><th>{{ text('tasks.startedAt') }}</th><th>{{ text('tasks.backend') }}</th></tr></thead>
            <tbody>
              <tr v-for="task in visibleTasks" :key="task.rowKey">
                <td class="mono-cell task-id">{{ task.id }}</td>
                <td :title="task.kind">{{ task.label || task.kind }}</td>
                <td class="mono-cell">{{ task.kernel || EMPTY_VALUE }}</td>
                <td><span class="task-state" :class="`task-state--${stateKey(task.status)}`">{{ text(`state.${stateKey(task.status)}`) }}</span></td>
                <td><div class="progress-cell"><div class="progress-track"><span :style="{width: `${task.progress === null ? 0 : task.progress}%`}"></span></div><span>{{ formatProgress(task.progress) }}</span></div></td>
                <td class="mono-cell">{{ task.page === null || task.page === undefined ? EMPTY_VALUE : task.page }}</td>
                <td class="time-cell">{{ formatTime(task.queuedAt) }}</td>
                <td class="time-cell">{{ formatTime(task.startedAt) }}</td>
                <td class="source-cell">{{ task.backend }}</td>
              </tr>
              <tr v-if="!visibleTasks.length" class="empty-row"><td colspan="9"><span class="empty-table-icon" aria-hidden="true">◌</span>{{ hasTasks ? text('tasks.noMatch') : text('tasks.empty') }}</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </section>

    <section v-if="!hasSample && loading" class="standalone-state loading-state"><span class="loading-orbit" aria-hidden="true"></span><h2>{{ text('status.waiting') }}</h2></section>
    <section v-else-if="!hasSample" class="standalone-state empty-state"><div class="empty-illustration" aria-hidden="true"><span></span><span></span><span></span></div><h2>{{ text('empty.title') }}</h2><p>{{ text('empty.body') }}</p></section>
  </main>
</template>

<style scoped>
:global(html), :global(body), :global(#app) {
  min-width: 760px;
  min-height: 560px;
  margin: 0;
}

:global(body) {
  overflow: hidden;
  background: #f4f5f8;
  color: #182132;
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif;
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
}

:global(button), :global(input), :global(select) { font: inherit; }

.developer-window {
  --dev-bg: #f5f5f7;
  --dev-panel: #fff;
  --dev-panel-solid: #fff;
  --dev-border: rgba(33, 45, 68, .1);
  --dev-border-strong: rgba(33, 45, 68, .16);
  --dev-text: #1d1d1f;
  --dev-muted: #636366;
  --dev-faint: #76767b;
  --dev-accent: #326bdf;
  --dev-accent-soft: #eaf0ff;
  --dev-shadow: 0 1px 3px rgba(0, 0, 0, .035);
  --dev-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  width: 100%;
  min-width: 760px;
  min-height: 560px;
  height: 100dvh;
  overflow: auto;
  padding: 26px 30px 34px;
  color: var(--dev-text);
  background: var(--dev-bg);
  color-scheme: light dark;
}

.developer-header { display: flex; align-items: center; justify-content: space-between; gap: 26px; max-width: 1480px; margin: 0 auto 22px; }
.brand-lockup { display: flex; align-items: center; min-width: 0; gap: 13px; }
.brand-mark { display: flex; align-items: flex-end; justify-content: center; gap: 3px; width: 38px; height: 38px; padding: 9px; border: 1px solid rgba(50, 107, 223, .16); border-radius: 12px; background: linear-gradient(145deg, #eef3ff, #dbe7ff); box-shadow: inset 0 1px rgba(255,255,255,.8), 0 5px 13px rgba(50,107,223,.12); }
.brand-mark span { width: 4px; border-radius: 4px; background: #4b7de1; }
.brand-mark span:nth-child(1) { height: 11px; opacity: .58; }
.brand-mark span:nth-child(2) { height: 17px; }
.brand-mark span:nth-child(3) { height: 8px; opacity: .72; }
h1, h2, p { margin: 0; }
h1 { font-size: 20px; letter-spacing: -.025em; font-weight: 700; }
.brand-lockup p { margin-top: 3px; color: var(--dev-muted); font-size: 12px; }
.header-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-wrap: wrap; }
.sample-status { display: inline-flex; align-items: center; gap: 7px; min-height: 29px; margin-right: 3px; padding: 0 10px; border: 1px solid var(--dev-border); border-radius: 99px; color: #2c6b43; background: rgba(237, 251, 241, .78); font-size: 12px; font-weight: 650; white-space: nowrap; }
.status-dot, .state-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 13%, transparent); }
.sample-status--paused { color: #896316; background: rgba(255, 247, 224, .85); }
.sample-status--refreshing .status-dot { animation: pulse-dot 1s ease-in-out infinite; }
.sample-status--waiting { color: var(--dev-muted); background: rgba(128, 139, 158, .1); }
.updated-label { color: inherit; opacity: .62; font-weight: 500; }
.icon-button, .secondary-button, .primary-button, .small-button, .banner-action { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 30px; border: 1px solid transparent; border-radius: 8px; cursor: pointer; transition: background-color .16s ease, border-color .16s ease, transform .16s ease; }
.icon-button:hover, .secondary-button:hover, .primary-button:hover, .small-button:hover, .banner-action:hover { transform: none; background: color-mix(in srgb, var(--dev-accent) 8%, var(--dev-panel)); }
.icon-button { width: 30px; border-color: var(--dev-border); color: var(--dev-muted); background: var(--dev-panel); font-size: 18px; }
.secondary-button, .small-button { padding: 0 10px; border-color: var(--dev-border); color: var(--dev-text); background: var(--dev-panel); font-size: 12px; font-weight: 600; }
.primary-button { padding: 0 12px; border-color: #326bdf; color: white; background: #326bdf; box-shadow: 0 4px 10px rgba(50,107,223,.2); font-size: 12px; font-weight: 650; }
.icon-button:disabled, .secondary-button:disabled, .primary-button:disabled, .small-button:disabled { opacity: .48; cursor: default; transform: none; }

.error-banner, .copy-banner { display: flex; align-items: center; gap: 9px; max-width: 1480px; margin: 0 auto 14px; padding: 10px 12px; border: 1px solid rgba(191, 77, 75, .22); border-radius: 10px; color: #934844; background: rgba(255, 241, 240, .9); font-size: 12px; }
.copy-banner { border-color: rgba(50, 107, 223, .2); color: #315cae; background: rgba(237, 243, 255, .9); }
.error-icon { display: inline-flex; align-items: center; justify-content: center; width: 17px; height: 17px; border-radius: 50%; color: white; background: #c65b55; font-size: 11px; font-weight: 700; }
.banner-action { margin-left: auto; padding: 0 8px; border-color: currentColor; color: inherit; background: transparent; }
.summary-strip { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); max-width: 1480px; margin: 0 auto 18px; border: 1px solid var(--dev-border); border-radius: 12px; overflow: hidden; background: var(--dev-panel); box-shadow: var(--dev-shadow); }
.summary-stat { min-width: 0; padding: 11px 15px; border-right: 1px solid var(--dev-border); }
.summary-stat:last-child { border-right: 0; }
.summary-label { display: block; overflow: hidden; color: var(--dev-muted); font-size: 10px; font-weight: 650; letter-spacing: .01em; line-height: 1.3; text-overflow: ellipsis; text-transform: none; white-space: nowrap; }
.summary-stat strong { display: block; margin-top: 5px; color: var(--dev-text); font-family: var(--dev-mono); font-size: 15px; font-weight: 650; }
.section-block, .panel { max-width: 1480px; margin-right: auto; margin-left: auto; }
.section-block { margin-bottom: 18px; }
.section-heading, .panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 9px; }
.section-heading h2, .panel-heading h2 { font-size: 13px; font-weight: 700; letter-spacing: .01em; }
.section-caption, .section-count { display: block; margin-top: 2px; color: var(--dev-muted); font-size: 11px; }
.section-count { margin-top: 0; font-family: var(--dev-mono); }
.resource-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 11px; }
.resource-card { min-width: 0; padding: 14px; border: 1px solid var(--dev-border); border-radius: 13px; background: var(--dev-panel); box-shadow: var(--dev-shadow); }
.resource-card-topline { display: flex; align-items: center; justify-content: space-between; gap: 7px; }
.resource-name { display: flex; align-items: center; min-width: 0; gap: 7px; color: var(--dev-text); font-size: 12px; font-weight: 680; }
.resource-symbol { width: 8px; height: 8px; border-radius: 3px; background: #5280dc; box-shadow: 0 0 0 3px rgba(82,128,220,.12); }
.resource-card--violet .resource-symbol { background: #8062d9; box-shadow: 0 0 0 3px rgba(128,98,217,.12); }
.resource-card--amber .resource-symbol { background: #c98a32; box-shadow: 0 0 0 3px rgba(201,138,50,.14); }
.resource-card--green .resource-symbol { background: #38a36c; box-shadow: 0 0 0 3px rgba(56,163,108,.12); }
.resource-state { display: inline-flex; align-items: center; gap: 5px; color: #388054; font-size: 10px; font-weight: 650; white-space: nowrap; }
.resource-state--idle { color: var(--dev-muted); }
.resource-state--error { color: #b5534f; }
.resource-card-body { display: flex; align-items: baseline; gap: 7px; margin: 15px 0 12px; }
.resource-number { color: var(--dev-text); font-family: var(--dev-mono); font-size: 25px; font-weight: 600; letter-spacing: -.055em; }
.resource-detail { overflow: hidden; color: var(--dev-muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.sparkline-stack { display: grid; gap: 4px; }
.sparkline-row { display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; align-items: center; gap: 5px; min-width: 0; color: var(--dev-muted); font-family: var(--dev-mono); font-size: 9px; }
.sparkline-row svg { width: 100%; height: 22px; overflow: visible; }
.sparkline-row polyline { fill: none; stroke: #4c7fe2; stroke-linecap: round; stroke-linejoin: round; stroke-width: 2.2; }
.sparkline-row--rss polyline { stroke: #a4b9e9; }
.sparkline-row strong { color: var(--dev-text); font-size: 10px; font-weight: 600; white-space: nowrap; }
.renderer-frame-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; margin-top: 11px; padding-top: 10px; border-top: 1px solid var(--dev-border); }
.resource-operation-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.renderer-frame-metric { min-width: 0; cursor: help; }
.renderer-frame-metric span { display: block; overflow: hidden; color: var(--dev-muted); font-size: 9px; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
.renderer-frame-metric strong { display: block; margin-top: 3px; color: var(--dev-text); font-family: var(--dev-mono); font-size: 11px; font-weight: 650; white-space: nowrap; }
.renderer-hidden-state { grid-column: 1 / -1; color: var(--dev-faint); font-size: 9px; }
.resource-footnote { margin-top: 7px; color: var(--dev-faint); font-size: 10px; }
.availability-strip { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 9px; margin-top: 10px; padding: 8px 10px; border: 1px solid rgba(201, 138, 50, .22); border-radius: 9px; color: #8d641f; background: rgba(255, 247, 228, .82); font-size: 10px; }
.availability-icon { display: inline-flex; align-items: center; justify-content: center; width: 15px; height: 15px; border-radius: 50%; color: #fff; background: #c98a32; font-size: 10px; font-weight: 700; }
.availability-item { color: var(--dev-muted); }

.panel { border: 1px solid var(--dev-border); border-radius: 13px; background: var(--dev-panel); box-shadow: var(--dev-shadow); }
.console-panel { margin-bottom: 18px; overflow: hidden; }
.panel-heading { min-height: 50px; margin: 0; padding: 0 14px; border-bottom: 1px solid var(--dev-border); }
.console-heading { align-items: stretch; padding-right: 10px; }
.tab-list { display: flex; align-items: stretch; gap: 4px; }
.tab-button { position: relative; padding: 0 11px; border: 0; color: var(--dev-muted); background: transparent; cursor: pointer; font-size: 12px; font-weight: 650; }
.tab-button::after { position: absolute; right: 9px; bottom: -1px; left: 9px; height: 2px; border-radius: 2px; background: transparent; content: ''; }
.tab-button:hover { color: var(--dev-text); }
.tab-button.active { color: var(--dev-accent); }
.tab-button.active::after { background: var(--dev-accent); }
.console-tools { display: flex; align-items: center; justify-content: flex-end; gap: 7px; min-width: 0; }
.search-field { display: flex; align-items: center; width: min(28vw, 260px); min-width: 150px; height: 29px; gap: 5px; padding: 0 8px; border: 1px solid var(--dev-border); border-radius: 7px; color: var(--dev-muted); background: var(--dev-bg); }
.search-field input { width: 100%; min-width: 0; border: 0; outline: 0; color: var(--dev-text); background: transparent; font-size: 11px; }
.search-field input::placeholder { color: var(--dev-faint); }
.search-icon { font-size: 16px; line-height: 1; }
.kernel-select select { height: 29px; max-width: 130px; padding: 0 25px 0 8px; border: 1px solid var(--dev-border); border-radius: 7px; outline: 0; color: var(--dev-text); background: var(--dev-bg); font-size: 11px; }
.toggle-control { display: inline-flex; align-items: center; gap: 6px; color: var(--dev-muted); font-size: 10px; white-space: nowrap; }
.toggle-control input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.toggle-track { display: inline-flex; align-items: center; width: 25px; height: 15px; padding: 2px; border-radius: 99px; background: #c4cbd6; transition: background-color .16s ease; }
.toggle-track span { width: 11px; height: 11px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.2); transition: transform .16s ease; }
.toggle-control input:checked + .toggle-track { background: var(--dev-accent); }
.toggle-control input:checked + .toggle-track span { transform: translateX(10px); }
.small-button { min-height: 29px; padding: 0 8px; font-size: 10px; }
.console-viewport { max-height: 292px; min-height: 122px; overflow: auto; }
.data-table { width: 100%; border-collapse: collapse; table-layout: fixed; }
.data-table th { position: sticky; top: 0; z-index: 1; padding: 8px 11px; border-bottom: 1px solid var(--dev-border); color: var(--dev-muted); background: color-mix(in srgb, var(--dev-panel-solid) 94%, transparent); font-size: 9px; font-weight: 700; letter-spacing: .01em; text-align: left; text-transform: none; white-space: nowrap; }
.data-table td { max-width: 0; padding: 9px 11px; border-bottom: 1px solid var(--dev-border); color: var(--dev-text); font-size: 11px; vertical-align: middle; }
.data-table tr:last-child td { border-bottom: 0; }
.data-table tbody tr:hover td { background: color-mix(in srgb, var(--dev-accent-soft) 52%, transparent); }
.console-table th:nth-child(1) { width: 77px; }.console-table th:nth-child(2) { width: 95px; }.console-table th:nth-child(3) { width: 112px; }.console-table th:nth-child(4) { width: 66px; }.console-table th:nth-child(5) { width: 150px; }
.commands-table th:nth-child(1) { width: 77px; }.commands-table th:nth-child(4) { width: 112px; }.commands-table th:nth-child(5) { width: 150px; }
.time-cell, .mono-cell { color: var(--dev-muted) !important; font-family: var(--dev-mono); font-size: 10px !important; white-space: nowrap; }
.kind-pill, .role-badge, .task-state { display: inline-flex; max-width: 100%; overflow: hidden; padding: 3px 6px; border-radius: 5px; color: #536da8; background: #edf2ff; font-size: 9px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.message-cell, .source-cell, .process-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.process-kernel { display: block; margin-top: 4px; color: var(--dev-accent); font: 10px var(--dev-mono); }
.source-cell { color: var(--dev-muted) !important; font-size: 10px !important; }
.empty-row td { height: 104px; color: var(--dev-muted); text-align: center; }
.empty-table-icon { display: block; margin-bottom: 6px; color: var(--dev-faint); font-size: 20px; }
.panel-footnote { display: flex; align-items: center; gap: 6px; padding: 7px 13px; border-top: 1px solid var(--dev-border); color: var(--dev-muted); font-size: 10px; }
.pause-mark { font-family: var(--dev-mono); }
.lower-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); max-width: 1480px; margin: 0 auto; gap: 14px; padding-bottom: 18px; }
.table-panel { width: 100%; min-width: 0; overflow: hidden; }
.panel-icon { color: var(--dev-faint); font-size: 18px; }
.queue-counts { display: flex; align-items: center; gap: 7px; color: var(--dev-muted); font-size: 9px; white-space: nowrap; }.queue-count--failed { color: #b5534f; }
.table-scroll { max-height: 286px; overflow: auto; }
.process-table th:nth-child(1) { width: 68px; }.process-table th:nth-child(2) { width: 91px; }.process-table th:nth-child(4) { width: 61px; }.process-table th:nth-child(5) { width: 72px; }.process-table th:nth-child(6) { width: 116px; }
.task-table { min-width: 760px; }.task-table th:nth-child(1) { width: 63px; }.task-table th:nth-child(2) { width: 108px; }.task-table th:nth-child(3) { width: 86px; }.task-table th:nth-child(4) { width: 86px; }.task-table th:nth-child(5) { width: 93px; }.task-table th:nth-child(6) { width: 52px; }.task-table th:nth-child(7), .task-table th:nth-child(8) { width: 78px; }.task-table th:nth-child(9) { width: 116px; }
.pid-cell, .task-id { font-weight: 600; }
.role-badge { color: var(--dev-muted); background: color-mix(in srgb, var(--dev-muted) 10%, transparent); }
.role-renderer { color: #7651b7; background: #f1ecff; }.role-backend { color: #a26919; background: #fff5df; }.role-kernel, .role-kernel-worker { color: #278355; background: #e8f8ef; }.role-main { color: #3569bd; background: #eaf0ff; }
.numeric-cell { color: var(--dev-text); font-family: var(--dev-mono); font-size: 10px !important; white-space: nowrap; }
.process-details summary { overflow: hidden; cursor: pointer; text-overflow: ellipsis; white-space: nowrap; }.process-details summary::marker { color: var(--dev-faint); }.process-detail { display: grid; gap: 2px; max-width: 260px; padding: 5px 0 1px; color: var(--dev-muted); font-family: var(--dev-mono); font-size: 9px; line-height: 1.35; }.process-command, .process-cpu-basis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }.process-cpu-basis { color: var(--dev-faint); }
.task-state { color: var(--dev-muted); background: color-mix(in srgb, var(--dev-muted) 10%, transparent); }.task-state--running { color: #3c63b2; background: #eaf0ff; }.task-state--queued, .task-state--waiting { color: #95691e; background: #fff5df; }.task-state--completed { color: #2d8257; background: #e8f8ef; }.task-state--failed { color: #ae534d; background: #fff0ef; }
.progress-cell { display: flex; align-items: center; gap: 7px; color: var(--dev-muted); font-family: var(--dev-mono); font-size: 9px; white-space: nowrap; }
.progress-track { width: 43px; height: 4px; overflow: hidden; border-radius: 5px; background: color-mix(in srgb, var(--dev-muted) 16%, transparent); }.progress-track span { display: block; height: 100%; border-radius: inherit; background: var(--dev-accent); }
.standalone-state { display: grid; place-items: center; max-width: 600px; min-height: 300px; margin: 70px auto; color: var(--dev-muted); text-align: center; }.standalone-state h2 { margin-top: 15px; color: var(--dev-text); font-size: 16px; }.standalone-state p { max-width: 450px; margin-top: 6px; font-size: 12px; line-height: 1.6; }.loading-state { display: flex; flex-direction: column; }.loading-orbit { width: 26px; height: 26px; border: 2px solid rgba(50,107,223,.18); border-top-color: var(--dev-accent); border-radius: 50%; animation: spin 1s linear infinite; }.empty-illustration { display: flex; align-items: end; justify-content: center; gap: 5px; width: 78px; height: 52px; padding: 12px; border: 1px solid var(--dev-border); border-radius: 17px; background: var(--dev-panel); }.empty-illustration span { width: 9px; border-radius: 5px; background: #bed0f5; }.empty-illustration span:nth-child(1) { height: 17px; }.empty-illustration span:nth-child(2) { height: 28px; background: #7ea1ea; }.empty-illustration span:nth-child(3) { height: 22px; background: #a5bceb; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0; }

@keyframes pulse-dot { 0%, 100% { opacity: .45; transform: scale(.85); } 50% { opacity: 1; transform: scale(1.15); } }
@keyframes spin { to { transform: rotate(360deg); } }

@media (max-width: 980px) {
  .developer-window { padding: 21px 20px 28px; }
  .developer-header { align-items: flex-start; flex-direction: column; gap: 14px; }
  .header-actions { width: 100%; justify-content: flex-start; }
  .summary-strip { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .summary-stat:nth-child(3) { border-right: 0; }.summary-stat:nth-child(n + 4) { border-top: 1px solid var(--dev-border); }
  .summary-stat:nth-child(4) { border-right: 1px solid var(--dev-border); }
  .resource-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .console-heading { align-items: flex-start; flex-direction: column; padding-top: 9px; }
  .console-tools { width: 100%; justify-content: flex-start; padding-bottom: 9px; }
}

@media (max-width: 820px) {
  .lower-grid { grid-template-columns: minmax(0, 1fr); }
}

@media (prefers-color-scheme: dark) {
  :global(body) { background: #11151c; color: #e8edf6; }
  .developer-window { --dev-bg: #202022; --dev-panel: #2c2c2e; --dev-panel-solid: #2c2c2e; --dev-border: rgba(220, 231, 250, .11); --dev-border-strong: rgba(220, 231, 250, .18); --dev-text: #e8edf6; --dev-muted: #9ea9bb; --dev-faint: #687487; --dev-accent: #83aaf8; --dev-accent-soft: #243452; --dev-shadow: 0 1px 3px rgba(0,0,0,.12); background: var(--dev-bg); }
  .brand-mark { border-color: rgba(131,170,248,.22); background: linear-gradient(145deg, #243557, #1d2942); }.brand-mark span { background: #83aaf8; }
  .sample-status { color: #84c99e; background: rgba(48, 106, 72, .23); }.sample-status--paused { color: #ddb86b; background: rgba(126, 91, 25, .22); }.sample-status--waiting { color: var(--dev-muted); background: rgba(160, 174, 198, .1); }
  .primary-button { color: #101725; background: #83aaf8; border-color: #83aaf8; }.error-banner { color: #f0a39c; background: rgba(116, 45, 42, .23); border-color: rgba(240,163,156,.24); }.copy-banner { color: #a9c5ff; background: rgba(44, 73, 132, .25); border-color: rgba(131,170,248,.24); }.error-icon { color: #231216; background: #f0a39c; }.availability-strip { color: #e5bd78; background: rgba(126, 91, 25, .22); border-color: rgba(229,189,120,.22); }.availability-icon { color: #2b2112; background: #e5bd78; }
  .kind-pill { color: #aec7ff; background: #25385e; }.role-renderer { color: #c4affd; background: #362d58; }.role-backend { color: #e5bd78; background: #4a3b25; }.role-kernel, .role-kernel-worker { color: #8ad3ad; background: #254b39; }.role-main { color: #aec7ff; background: #25385e; }.task-state { color: var(--dev-muted); background: rgba(160,174,198,.12); }.task-state--running { color: #aec7ff; background: #25385e; }.task-state--queued, .task-state--waiting { color: #e5bd78; background: #4a3b25; }.task-state--completed { color: #8ad3ad; background: #254b39; }.task-state--failed { color: #f0a39c; background: #532d2b; }.toggle-track { background: #536074; }.toggle-track span { background: #d9e2f5; }
  .sparkline-row polyline { stroke: #83aaf8; }.sparkline-row--rss polyline { stroke: #536f9f; }.empty-illustration span { background: #3d527c; }.empty-illustration span:nth-child(2) { background: #83aaf8; }.empty-illustration span:nth-child(3) { background: #627fac; }
}


/* The control layer floats above quiet, opaque diagnostic content. */
.developer-header {
  position: sticky; top: -26px; z-index: 5;
  padding: 16px 18px; margin-bottom: 24px; border-radius: 20px;
  background: color-mix(in srgb, var(--dev-panel-solid) 82%, transparent);
  backdrop-filter: blur(24px) saturate(140%);
  border: 1px solid var(--dev-border);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.22), 0 4px 16px rgba(0,0,0,.05);
}
h1 { font-size: 18px; font-weight: 650; }
.brand-mark { width: 34px; height: 34px; border-radius: 10px; box-shadow: none; }
.sample-status { border: 0; background: transparent; font-size: 11px; font-weight: 500; }
.sample-status--paused, .sample-status--waiting { background: transparent; }
.icon-button, .secondary-button, .primary-button { min-height: 32px; border-radius: 99px; }
.icon-button { width: 32px; }
.primary-button { color: var(--dev-text); border-color: var(--dev-border); background: var(--dev-panel); box-shadow: none; font-weight: 600; }
.primary-button[aria-pressed="true"] { color: var(--dev-accent); background: var(--dev-accent-soft); }
.icon-button:active:not(:disabled), .secondary-button:active:not(:disabled), .primary-button:active:not(:disabled), .small-button:active:not(:disabled), .tab-button:active { transform: scale(.97); transition-duration: 60ms; }
button:focus-visible, select:focus-visible, .search-field:focus-within, .toggle-control:has(input:focus-visible) .toggle-track { outline: 3px solid color-mix(in srgb, var(--dev-accent) 65%, transparent); outline-offset: 3px; }
.summary-strip { border-radius: 16px; }
.summary-stat { padding: 14px 16px; }
.summary-stat strong { font-family: inherit; font-size: 20px; font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: -.02em; }
.resource-grid { gap: 12px; }
.resource-card { padding: 16px; border-radius: 16px; }
.resource-number { font-family: inherit; font-variant-numeric: tabular-nums; letter-spacing: -.025em; font-size: 28px; }
.section-heading h2, .panel-heading h2 { font-weight: 600; }
.panel { border-radius: 16px; }
.console-heading { gap: 12px; padding: 12px; }
.tab-list { align-self: center; flex-shrink: 0; gap: 2px; padding: 3px; border-radius: 10px; background: color-mix(in srgb, var(--dev-muted) 10%, transparent); }
.tab-button { min-height: 28px; padding: 0 12px; border-radius: 7px; font-size: 12px; font-weight: 500; }
.tab-button::after { content: none; }
.tab-button.active { color: var(--dev-text); background: var(--dev-panel-solid); box-shadow: 0 1px 4px rgba(0,0,0,.12); }
.search-field { height: 32px; border-radius: 9px; }
.kernel-select select { height: 32px; border-radius: 9px; }
.data-table th { font-size: 11px; font-weight: 600; padding-top: 10px; padding-bottom: 10px; }
.data-table tbody tr:nth-child(even) { background: color-mix(in srgb, var(--dev-muted) 4%, transparent); }
.data-table td { border-bottom-color: color-mix(in srgb, var(--dev-border) 45%, transparent); }
.kind-pill, .role-badge, .task-state { border-radius: 6px; font-size: 10px; }
@media (max-width: 980px) {
  .developer-header { top: -21px; gap: 12px; }
  .console-tools { flex-wrap: wrap; gap: 10px; padding-bottom: 0; }
  .search-field { flex: 1; width: auto; }
}
@media (prefers-color-scheme: dark) {
  .primary-button { color: var(--dev-text); border-color: var(--dev-border); background: var(--dev-panel); }
  .sample-status, .sample-status--paused, .sample-status--waiting { background: transparent; }
  .resource-state { color: #84c99e; }
  .resource-state--idle { color: var(--dev-muted); }
  .resource-state--error { color: #f0a39c; }
}
@media (prefers-reduced-transparency: reduce) {
  .developer-header { background: var(--dev-panel-solid); backdrop-filter: none; }
}
@media (prefers-contrast: more) {
  .developer-window { --dev-border: color-mix(in srgb, var(--dev-text) 45%, transparent); --dev-muted: var(--dev-text); --dev-faint: var(--dev-text); }
  .developer-header { background: var(--dev-panel-solid); backdrop-filter: none; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; transition-duration: .001ms !important; }
}
</style>
