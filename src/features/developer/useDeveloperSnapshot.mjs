import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { normalizeDeveloperLanguage } from '../../i18n/developer-locales.mjs';

const HISTORY_LENGTH = 28;
const SAMPLE_INTERVAL = 1000;
const EMPTY_VALUE = '—';

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (isRecord(value))
    return Object.entries(value).map(([id, item]) =>
      isRecord(item) ? { id, ...item } : { id, value: item },
    );
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
  if (
    typeof value === 'number' ||
    (typeof value === 'string' && value.trim() && /^\d+(\.\d+)?$/.test(value.trim()))
  ) {
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
  if (isRecord(value))
    value = firstValue(value, ['percent', 'percentage', 'progress', 'value'], null);
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
  const role = String(value || fallback)
    .trim()
    .toLowerCase();
  if (!role) return fallback;
  if (role.includes('render')) return 'renderer';
  if (role.includes('kernel') || role.includes('worker')) return 'kernel';
  if (role.includes('backend') || role.includes('server') || role.includes('service'))
    return 'backend';
  if (role.includes('main') || role.includes('browser')) return 'main';
  return role;
}

function normalizeProcess(raw, source, fallbackRole = 'unknown') {
  const item = isRecord(raw) ? raw : {};
  const pidValue = firstValue(item, ['pid', 'processId', 'processID', 'id'], null);
  const pid =
    pidValue === null || pidValue === undefined || pidValue === '' ? null : String(pidValue);
  const role = roleName(firstValue(item, ['role', 'type', 'kind'], fallbackRole), fallbackRole);
  const name = String(firstValue(item, ['name', 'processName', 'label', 'command'], role) || role);
  const cpuPercentBasis = String(
    firstValue(item, ['cpuPercentBasis', 'cpuBasis', 'cpuSampleBasis'], '') || '',
  );
  const commandValue = firstValue(item, ['command', 'argv', 'commandLine', 'args'], '');
  return {
    pid,
    role,
    name,
    kernel: String(item.kernel || ''),
    command: Array.isArray(commandValue) ? commandValue.join(' ') : String(commandValue || ''),
    cpuPercent: nullableNonNegativeNumber(
      firstValue(item, ['cpuPercent', 'cpu', 'cpuUsage', 'usage'], null),
    ),
    cpuPercentBasis,
    rssBytes: nullableNonNegativeNumber(
      firstValue(item, ['rssBytes', 'rss', 'residentBytes', 'memoryBytes', 'memory'], null),
    ),
    sourceWindowId:
      source?.windowId === undefined || source?.windowId === null ? null : String(source.windowId),
    sourceTitle: String(source?.title || ''),
    rowKey: `${pid || 'unknown'}:${role}:${source?.windowId || 'root'}`,
  };
}

function normalizeProcessesStatus(value) {
  if (value === null || value === undefined) return { available: null, reason: '' };
  if (typeof value === 'boolean') return { available: value, reason: value ? '' : 'Unavailable' };
  if (typeof value === 'string')
    return { available: !/unavailable|unsupported|denied|error/i.test(value), reason: value };
  const item = isRecord(value) ? value : {};
  const availableValue = firstValue(item, ['available', 'enabled', 'supported'], null);
  return {
    available: availableValue === null ? null : availableValue !== false,
    reason: String(firstValue(item, ['reason', 'message', 'detail', 'error'], '') || ''),
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
  const id = normalizeId(
    firstValue(item, ['id', 'commandId', 'sequence'], null),
    String(index + 1),
  );
  return {
    id,
    rowKey: `${source.windowId || 'root'}:command:${id}`,
    time: normalizeTime(firstValue(item, ['time', 'timestamp', 'createdAt', 'at'], null)),
    command: String(
      firstValue(item, ['command', 'name', 'message', 'text'], event ? 'command' : '') || '',
    ),
    result: String(firstValue(item, ['result', 'status', 'output', 'response'], '') || ''),
    kernel: String(firstValue(item, ['kernel', 'engine', 'service'], '') || ''),
    backendId: source.windowId === undefined ? null : String(source.windowId),
    backend: String(source.title || source.windowId || EMPTY_VALUE),
  };
}

function normalizeBackend(raw, index) {
  const item = isRecord(raw) ? raw : {};
  const windowId = normalizeId(
    firstValue(item, ['windowId', 'windowID', 'id', 'window'], null),
    String(index + 1),
  );
  const title = String(
    firstValue(item, ['title', 'name', 'label'], `Window ${windowId}`) || `Window ${windowId}`,
  );
  const source = { windowId, title };
  const processSources = asArray(
    firstValue(item, ['processes', 'backendProcesses', 'workerProcesses'], []),
  );
  const eventSources = asArray(firstValue(item, ['events', 'logs', 'console'], []));
  const taskSources = asArray(firstValue(item, ['tasks', 'taskQueue', 'queue'], []));
  const commandSources = asArray(firstValue(item, ['commands', 'commandHistory'], []));
  const events = eventSources.map((event, eventIndex) => normalizeEvent(event, eventIndex, source));
  const tasks = taskSources.map((task, taskIndex) => normalizeTask(task, taskIndex, source));
  const commands = commandSources.map((command, commandIndex) =>
    normalizeCommand(command, commandIndex, source),
  );
  return {
    windowId,
    title,
    enabled: firstValue(item, ['enabled', 'active'], true) !== false,
    error: firstValue(item, ['error', 'failure', 'lastError'], null),
    processesStatus: normalizeProcessesStatus(
      firstValue(item, ['processesStatus', 'processStatus', 'processAvailability'], null),
    ),
    processes: processSources.map((process) => normalizeProcess(process, source, 'backend')),
    rendererFrameMetrics: normalizeRendererFrameMetrics(
      firstValue(item, ['rendererFrameMetrics', 'frameMetrics'], null),
    ),
    events,
    tasks,
    commands,
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
  const values = items.map((item) => item?.[field]).filter(Number.isFinite);
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

function rendererFrameMeasurement(data) {
  const samples = (data?.backends || [])
    .map((backend) => backend.rendererFrameMetrics)
    .filter(
      (metrics) =>
        metrics &&
        ['fps', 'frameIntervalMs', 'latencyMs'].some((key) => Number.isFinite(metrics[key])),
    );
  return {
    fps: averageBy(samples, 'fps'),
    frameIntervalMs: averageBy(samples, 'frameIntervalMs'),
    latencyMs: averageBy(samples, 'latencyMs'),
    hidden:
      samples.length && samples.every((metrics) => metrics.hidden === true)
        ? true
        : samples.length && samples.every((metrics) => metrics.hidden === false)
          ? false
          : null,
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
  const root = { windowId: null, title: '', processes: [] };
  const topProcesses = asArray(firstValue(source, ['processes', 'allProcesses'], []));
  const processes = topProcesses.map((process) => normalizeProcess(process, root));
  const seenPids = new Set(
    processes.filter((process) => process.pid).map((process) => process.pid),
  );
  for (const backend of backends) {
    for (const process of backend.processes) {
      if (process.pid && seenPids.has(process.pid)) continue;
      if (process.pid) seenPids.add(process.pid);
      processes.push(process);
    }
  }

  const rootSource = { windowId: 'root', title: 'Main' };
  const rootEvents = asArray(firstValue(source, ['events', 'logs', 'console'], [])).map(
    (event, index) => normalizeEvent(event, index, rootSource),
  );
  const backendEvents = backends.flatMap((backend) => backend.events);
  const events = rootEvents.length ? rootEvents : backendEvents;
  const rootTasks = asArray(firstValue(source, ['tasks', 'taskQueue', 'queue'], [])).map(
    (task, index) => normalizeTask(task, index, rootSource),
  );
  const backendTasks = backends.flatMap((backend) => backend.tasks);
  const tasks = rootTasks.length ? rootTasks : backendTasks;
  const rootCommands = asArray(firstValue(source, ['commands', 'commandHistory'], [])).map(
    (command, index) => normalizeCommand(command, index, rootSource),
  );
  const backendCommands = backends.flatMap((backend) => backend.commands);
  const eventCommands = events
    .filter((event) => /spawn|stdin|command|request|response|invoke/i.test(event.kind))
    .map((event, index) =>
      normalizeCommand(event, index, { windowId: event.backendId, title: event.backend }, true),
    );
  const commands = rootCommands.length
    ? rootCommands
    : backendCommands.length
      ? backendCommands
      : eventCommands;
  const systemSource = isRecord(source.system) ? source.system : {};
  const normalized = {
    sampledAt: normalizeTime(firstValue(source, ['sampledAt', 'timestamp', 'time'], null)),
    mainOperationMetrics: normalizeMainOperationMetrics(
      firstValue(source, ['mainOperationMetrics'], null),
    ),
    backendCommunicationMetrics: normalizeBackendCommunicationMetrics(
      firstValue(source, ['backendCommunicationMetrics'], null),
    ),
    system: {
      totalMemory: nonNegativeNumber(
        firstValue(systemSource, ['totalMemory', 'totalMemoryBytes', 'total'], 0),
      ),
      freeMemory: nonNegativeNumber(
        firstValue(systemSource, ['freeMemory', 'freeMemoryBytes', 'free'], 0),
      ),
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
  const processes = data?.processes?.filter((process) => processMatches(process, key)) || [];
  const backendCount = data?.backends?.length || 0;
  const enabledBackendCount = data?.backends?.filter((backend) => backend.enabled).length || 0;
  return {
    cpu:
      processes.length && processes.every((process) => process.cpuPercent === null)
        ? null
        : sumBy(processes, 'cpuPercent'),
    rss: sumBy(processes, 'rssBytes'),
    processCount: processes.length,
    count: key === 'backend' ? backendCount : processes.length,
    enabledCount: key === 'backend' ? enabledBackendCount : processes.length,
    hasError: key === 'backend' && Boolean(data?.backends?.some((backend) => backend.error)),
    frameMetrics: key === 'renderers' ? rendererFrameMeasurement(data) : null,
    mainOperationMetrics: key === 'main' ? data?.mainOperationMetrics : null,
    backendCommunicationMetrics: key === 'backend' ? data?.backendCommunicationMetrics : null,
  };
}

export function useDeveloperSnapshot({ language, text }) {
  const snapshotData = ref(null);
  const loading = ref(true);
  const refreshing = ref(false);
  const snapshotError = ref(false);
  const bridgeMissing = ref(false);
  const lastUpdated = ref(null);
  const paused = ref(false);
  const copied = ref(false);
  const copyFailed = ref(false);
  const metricHistory = ref({
    main: { cpu: [], rss: [] },
    renderers: { cpu: [], rss: [] },
    backend: { cpu: [], rss: [] },
    kernel: { cpu: [], rss: [] },
  });

  let refreshTimer = null;
  let copyNoticeTimer = null;
  let disposed = false;
  let refreshInFlight = false;
  let visible = true;

  function recordMetricHistory(data) {
    const next = { ...metricHistory.value };
    for (const key of ['main', 'renderers', 'backend', 'kernel']) {
      const measurement = resourceMeasurement(data, key);
      next[key] = {
        cpu: [...(next[key]?.cpu || []), measurement.cpu].slice(-HISTORY_LENGTH),
        rss: [...(next[key]?.rss || []), measurement.rss].slice(-HISTORY_LENGTH),
      };
    }
    metricHistory.value = next;
  }

  const hasSample = computed(() => Boolean(snapshotData.value));
  const primary = computed(() => snapshotData.value?.primaryMetrics || primaryMetrics({}));
  const systemMemory = computed(
    () => snapshotData.value?.system || { totalMemory: 0, freeMemory: 0 },
  );
  const resourceCards = computed(() => {
    const data = snapshotData.value || {};
    return [
      { key: 'main', label: text('resources.main'), tone: 'blue' },
      { key: 'renderers', label: text('resources.renderers'), tone: 'violet' },
      { key: 'backend', label: text('resources.backend'), tone: 'amber' },
      { key: 'kernel', label: text('resources.kernel'), tone: 'green' },
    ].map((card) => {
      const measurement = resourceMeasurement(data, card.key);
      const history = metricHistory.value[card.key] || { cpu: [], rss: [] };
      return {
        ...card,
        ...measurement,
        history,
        status: measurement.hasError ? 'error' : measurement.count > 0 ? 'active' : 'idle',
      };
    });
  });
  const unavailableBackendProcesses = computed(() =>
    (snapshotData.value?.backends || [])
      .filter((backend) => backend.processesStatus?.available === false)
      .map((backend) => ({ title: backend.title, reason: backend.processesStatus.reason })),
  );

  function readLanguage() {
    if (typeof window === 'undefined') return 'en';
    const requested = new URLSearchParams(window.location.search).get('language');
    return normalizeDeveloperLanguage(requested || 'en');
  }

  function updateSnapshot(raw) {
    const normalized = normalizeSnapshot(raw);
    snapshotData.value = normalized;
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
    refreshTimer = window.setTimeout(() => {
      void refreshSnapshot();
    }, SAMPLE_INTERVAL);
  }

  async function refreshSnapshot({ manual = false } = {}) {
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
    void refreshSnapshot({ manual: true });
  }

  function togglePaused() {
    paused.value = !paused.value;
    clearTimeout(refreshTimer);
    refreshTimer = null;
    if (!paused.value) void refreshSnapshot({ manual: true });
  }

  function handleVisibilityChange() {
    visible = document.visibilityState === 'visible';
    if (!visible) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    } else if (!paused.value) {
      void refreshSnapshot({ manual: true });
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
      backendCommunicationMetrics:
        data.backendCommunicationMetrics || normalizeBackendCommunicationMetrics(null),
      processes: (data.processes || []).map((process) => ({
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
      backends: (data.backends || []).map((backend) => ({
        windowId: backend.windowId,
        enabled: backend.enabled,
        hasError: Boolean(backend.error),
        eventCount: backend.events.length,
        taskCount: backend.tasks.length,
        processCount: backend.processes.length,
        rendererFrameMetrics: backend.rendererFrameMetrics,
        kernels: [
          ...new Set(
            [...backend.events, ...backend.tasks, ...backend.commands]
              .map((item) => item.kernel)
              .filter(Boolean),
          ),
        ],
      })),
      events: (data.events || []).map((event) => ({
        id: event.id,
        time: event.time,
        kind: event.kind,
        kernel: event.kernel,
        pid: event.pid,
        backendId: event.backendId,
        message: event.message,
      })),
      tasks: (data.tasks || []).map((task) => ({
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
      commands: (data.commands || []).map((command) => ({
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
      if (result && typeof result === 'object' && result.ok === false)
        throw new Error('copy rejected');
      if (result === false) throw new Error('copy rejected');
      copied.value = true;
      clearTimeout(copyNoticeTimer);
      copyNoticeTimer = window.setTimeout(() => {
        copied.value = false;
      }, 2400);
    } catch {
      copyFailed.value = true;
    }
  }

  onMounted(() => {
    language.value = readLanguage();
    visible = document.visibilityState === 'visible';
    document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });
    void refreshSnapshot({ manual: true });
  });

  onBeforeUnmount(() => {
    disposed = true;
    clearTimeout(refreshTimer);
    clearTimeout(copyNoticeTimer);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  });

  return {
    bridgeMissing,
    copied,
    copyDiagnostics,
    copyFailed,
    hasSample,
    lastUpdated,
    loading,
    primary,
    paused,
    refreshNow,
    refreshing,
    resourceCards,
    snapshotData,
    snapshotError,
    systemMemory,
    togglePaused,
    unavailableBackendProcesses,
  };
}
