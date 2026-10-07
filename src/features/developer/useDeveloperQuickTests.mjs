import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { QUICK_TEST_MESSAGES } from './quick-test-messages.mjs';

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
const LANGUAGE_NAMES = Object.freeze({
  en: 'English',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  ja: '日本語',
  ko: '한국어',
  fr: 'Français',
  es: 'Español',
});

export function useDeveloperQuickTests({ language }) {
  const locale = computed(() =>
    SUPPORTED_LANGUAGES.includes(language.value) ? language.value : 'en',
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
    const value = QUICK_TEST_MESSAGES[locale.value]?.[key] ?? QUICK_TEST_MESSAGES.en[key] ?? key;
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
      message:
        source.message === undefined || source.message === null ? '' : String(source.message),
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
    return LANGUAGE_NAMES[value] ? `${LANGUAGE_NAMES[value]} (${value})` : String(value);
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
      else if (snapshot.results.length)
        liveMessage.value = text('liveFinished', countsFor(snapshot));
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

  function clearPollTimer() {
    if (pollTimer !== null) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
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

  return {
    context,
    run,
    selectedWindowId,
    contextLoading,
    statusLoading,
    actionBusy,
    cancelBusy,
    contextError,
    statusError,
    runError,
    cancelError,
    liveMessage,
    bridgeAvailable,
    readers,
    providerName,
    providerConfiguration,
    kernelActionDescription,
    isRunning,
    isBusy,
    text,
    formatLanguage,
    formatContextValue,
    formatElapsed,
    formatOutput,
    hasOutput,
    resultStatusLabel,
    startTest,
    cancelRun,
    selectReader,
    refreshContext,
  };
}
