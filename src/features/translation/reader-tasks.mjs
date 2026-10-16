// The renderer owns the presentation of a translation, while this client owns
// the small amount of state needed to reconnect to a server-side page task.
// Queue entries and AbortControllers deliberately stay renderer-local.  A task
// snapshot contains the opaque task id, requested page scope, and the exact
// settings used to create that task. Renderer queue entries stay local.

import { nextTick } from 'vue';
import { withSelectedService } from './translation-services.mjs';

const POLL_DELAY_MS = 250;

function valueOf(entry, fallback) {
  if (entry && typeof entry === 'object' && 'value' in entry) return entry.value;
  return entry === undefined ? fallback : entry;
}

function pageNumber(page) {
  const number = typeof page === 'number' ? page : page?.number;
  return Number.isInteger(number) && number > 0 ? number : null;
}

function cloneValue(value, fallback = value) {
  if (value === undefined) return fallback;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

export function createReaderTasks({
  session,
  preferences,
  translationState,
  provider,
  activity,
  actions,
}) {
  let current = null;
  let unsupported = false;
  let submitChain = Promise.resolve();
  let latestGeneration = 0;
  let activeSubmission = null;
  // A service-mode restore may contain active glossary or credential values
  // that cannot be reconstructed from ordinary window preferences. Keep those
  // exact values for the restored task while still detecting later user edits.
  let restoredSettings = null;
  let restoredPreferencesKey = '';

  function api() {
    return actions.backendRequests?.api;
  }

  function enabled() {
    return !unsupported && !!session.documentId && typeof api() === 'function';
  }

  function normalizeNumbers(pages) {
    const total = session.pages.value.length;
    return [
      ...new Set(
        (Array.isArray(pages) ? pages : []).map(pageNumber).filter((number) => number <= total),
      ),
    ].sort((a, b) => a - b);
  }

  function defaultScope() {
    const scope = actions.translationScope?.readingTranslationPages?.();
    const pages = normalizeNumbers(scope);
    if (pages.length) return pages;
    return translationState.translateAllPages ? session.pages.value.map((page) => page.number) : [];
  }

  function withHeights(numbers) {
    return numbers.map((number) => {
      const page = session.pages.value[number - 1];
      return { number, height: Number(page?.height) || 0 };
    });
  }

  function layoutScope(numbers) {
    const result = new Set(numbers);
    for (const number of numbers) {
      if (number > 1) result.add(number - 1);
      if (number < session.pages.value.length) result.add(number + 1);
    }
    return [...result].sort((a, b) => a - b);
  }

  function remoteKernel() {
    const enabled = valueOf(preferences.remoteKernelEnabled, false);
    const url = String(valueOf(preferences.remoteKernelUrl, '') || '').trim();
    if (!enabled || !url) return undefined;
    return {
      url,
      service: String(valueOf(preferences.remoteKernelService, '') || '').trim(),
    };
  }

  function currentSettings() {
    let advancedOptions = {};
    try {
      advancedOptions = actions.preferencePersistence?.currentKernelAdvancedOptions?.() || {};
    } catch {
      advancedOptions = {};
    }
    return {
      engine: valueOf(preferences.engine, 'pdf_inspector'),
      language: valueOf(preferences.language, ''),
      sourceLanguage: valueOf(preferences.sourceLanguage, ''),
      concurrency: Number(valueOf(preferences.concurrency, 1)),
      pageConcurrency: Number(valueOf(preferences.pageConcurrency, 1)),
      reuseTranslations: valueOf(preferences.reuseTranslations, true),
      forceRetranslation: translationState.forceRetranslation === true,
      remoteKernel: remoteKernel(),
      paragraphContinuationDetection: valueOf(preferences.paragraphContinuationDetection, false),
      jevApiToken: valueOf(preferences.jevApiToken, ''),
      glossary: provider.activeGlossary?.value || [],
      advancedOptions,
      translationService: provider.currentTranslationService?.value,
    };
  }

  function settings() {
    const next = currentSettings();
    if (restoredSettings) {
      if (settingsKey(next) === restoredPreferencesKey) return restoredSettings;
      restoredSettings = null;
      restoredPreferencesKey = '';
    }
    return next;
  }

  function settingsKey(next) {
    try {
      return JSON.stringify(next);
    } catch {
      return String(next?.engine || '');
    }
  }

  function publishStatus(status) {
    if (!status || !current || status.id !== current.id) return;
    current.state = status.state;
    current.completed = status.completed;
    current.total = status.total;
    current.pagesState = Array.isArray(status.pages) ? status.pages : [];
    // These fields are intentionally additive. Existing queue state remains
    // compatible with diagnostics and callers that do not use task mode.
    translationState.readerTaskState = {
      id: current.id,
      state: current.state,
      pages: current.pagesState,
      completed: current.completed,
      total: current.total,
    };
  }

  function snapshot() {
    if (!current) return null;
    return {
      taskId: current.id,
      documentId: current.documentId,
      settingsKey: current.settingsKey,
      settings: cloneValue(current.settings, undefined),
      pages: [...current.pages],
      layoutPages: [...current.layoutPages],
      state: current.state,
      completed: current.completed,
      total: current.total,
      pagesState: cloneValue(current.pagesState, []),
    };
  }

  function requestedState({ pages, layoutPages } = {}) {
    const requestedPages = normalizeNumbers(pages || defaultScope());
    const requestedLayout = normalizeNumbers(layoutPages || layoutScope(requestedPages));
    const sameDocument = current?.documentId === session.documentId;
    const requestedSettings = settings();
    const requestedSettingsKey = settingsKey(requestedSettings);
    const sameSettings = current?.settingsKey === requestedSettingsKey;
    const allPages = sameDocument && sameSettings ? new Set(current.pages) : new Set();
    const allLayout = sameDocument && sameSettings ? new Set(current.layoutPages) : new Set();
    requestedPages.forEach((number) => allPages.add(number));
    requestedLayout.forEach((number) => allLayout.add(number));
    return {
      pages: [...allPages].sort((a, b) => a - b),
      layoutPages: [...allLayout].sort((a, b) => a - b),
      settings: requestedSettings,
      settingsKey: requestedSettingsKey,
    };
  }

  async function submitScope(options = {}) {
    if (!enabled()) return null;
    const documentId = session.documentId;
    const next = requestedState(options);
    if (!next.pages.length) return snapshot();

    // A manual page request can arrive while another page's POST is still in
    // flight. Grow that submission's target so the later upsert cannot lose
    // the first page. Settings or document changes deliberately supersede the
    // active item and queue a fresh task after its stale POST is cleaned up.
    if (
      activeSubmission &&
      !activeSubmission.cancelled &&
      activeSubmission.documentId === documentId &&
      activeSubmission.settingsKey === next.settingsKey
    ) {
      next.pages.forEach((number) => activeSubmission.pages.add(number));
      next.layoutPages.forEach((number) => activeSubmission.layoutPages.add(number));
      return activeSubmission.promise;
    }
    if (
      current?.id &&
      current.documentId === documentId &&
      current.settingsKey === next.settingsKey &&
      next.pages.every((number) => current.pages.has(number)) &&
      next.layoutPages.every((number) => current.layoutPages.has(number))
    )
      return snapshot();

    if (activeSubmission && !activeSubmission.cancelled) {
      activeSubmission.cancelled = true;
      latestGeneration++;
    }
    const generation = ++latestGeneration;
    const item = {
      documentId,
      settingsKey: next.settingsKey,
      settings: cloneValue(next.settings, {}),
      pages: new Set(next.pages),
      layoutPages: new Set(next.layoutPages),
      generation,
      cancelled: false,
      promise: null,
    };
    const execute = async () => {
      try {
        if (item.cancelled || generation !== latestGeneration || session.documentId !== documentId)
          return null;
        if (current?.id && current.settingsKey !== item.settingsKey) {
          const oldTaskId = current.id;
          current = null;
          restoredSettings = null;
          restoredPreferencesKey = '';
          delete translationState.readerTaskId;
          delete translationState.readerTaskState;
          await deleteTask(oldTaskId);
        }
        if (item.cancelled || generation !== latestGeneration || session.documentId !== documentId)
          return null;

        for (;;) {
          if (
            item.cancelled ||
            generation !== latestGeneration ||
            session.documentId !== documentId
          )
            return null;
          const pages = [...item.pages].sort((a, b) => a - b);
          const layoutPages = [...item.layoutPages].sort((a, b) => a - b);
          const result = await api()('/api/reader-tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              documentId,
              settings: item.settings,
              pages: withHeights(pages),
              layoutPages: withHeights(layoutPages),
            }),
          });
          if (!result?.id) throw Error('Reader translation task did not return an id');
          if (
            item.cancelled ||
            generation !== latestGeneration ||
            session.documentId !== documentId
          ) {
            await deleteTask(result.id);
            return null;
          }
          current = {
            id: String(result.id),
            documentId,
            settingsKey: item.settingsKey,
            settings: cloneValue(item.settings, {}),
            pages: new Set(pages),
            layoutPages: new Set(layoutPages),
            state: result.state,
            completed: result.completed,
            total: result.total,
            pagesState: Array.isArray(result.pages) ? result.pages : [],
          };
          publishStatus(result);
          const pagesChanged =
            pages.length !== item.pages.size || pages.some((number) => !item.pages.has(number));
          const layoutChanged =
            layoutPages.length !== item.layoutPages.size ||
            layoutPages.some((number) => !item.layoutPages.has(number));
          if (!pagesChanged && !layoutChanged) return snapshot();
          // A same-settings caller grew the target while the POST was in
          // flight. The server upsert keeps this task id and adds the new
          // scope on the next iteration.
        }
      } finally {
        if (activeSubmission === item) activeSubmission = null;
      }
    };
    const promise = submitChain.catch(() => {}).then(execute);
    item.promise = promise;
    submitChain = promise.catch(() => {});
    activeSubmission = item;
    return promise;
  }

  async function deleteTask(taskId) {
    if (!taskId || typeof api() !== 'function') return;
    try {
      await api()('/api/reader-tasks/' + encodeURIComponent(taskId), { method: 'DELETE' });
    } catch {}
  }

  async function taskStatus() {
    if (!current?.id) return null;
    const status = await api()('/api/reader-tasks/' + encodeURIComponent(current.id));
    publishStatus(status);
    return status;
  }

  function isForeground() {
    return activity?.foreground?.value !== false;
  }

  async function pageResult(page) {
    const response = await fetch(
      '/api/reader-tasks/' + encodeURIComponent(current.id) + '/pages/' + page,
    );
    if (response.status === 202) return null;
    if (response.status === 204) return { kind: 'empty', response };
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok) {
      let message = response.statusText || 'Reader translation task failed';
      try {
        const body = await response.json();
        message = body.error || message;
      } catch {}
      throw Error(message);
    }
    if (contentType.includes('json')) {
      const body = await response.json();
      return { kind: 'inspector', ...body, response };
    }
    return {
      kind: 'math',
      data: await response.arrayBuffer(),
      layoutKey: response.headers.get('X-Layout-Key') || '',
      cached: response.headers.get('X-Translation-Cache') === 'hit',
      model: response.headers.get('X-Translation-Model') || '',
      response,
    };
  }

  async function waitForPage(page, { token = session.epoch, onProgress } = {}) {
    if (!current?.id || token !== session.epoch) return null;
    for (;;) {
      if (token !== session.epoch || !isForeground()) return null;
      const status = await taskStatus();
      if (token !== session.epoch) return null;
      const entry = status?.pages?.find((item) => item.number === page);
      onProgress?.(entry?.progress ?? null);
      const pageDone = entry?.state === 'done' || entry?.state === 'completed';
      if (entry?.state === 'failed' || (status?.state === 'failed' && !pageDone))
        throw Error(entry?.error || 'Reader translation task failed');
      const result = await pageResult(page);
      if (result) return result;
      if (token !== session.epoch || !isForeground()) return null;
      await new Promise((resolve) => setTimeout(resolve, POLL_DELAY_MS));
    }
  }

  function hasPendingWork() {
    if (current?.id || translationState.translateAllPages) return true;
    if (translationState.running > 0 || translationState.pageRunning > 0) return true;
    if (translationState.queue.length || translationState.pageQueue.length) return true;
    return session.pages.value.some(
      (page) =>
        ['queued', 'detecting'].includes(page.status) ||
        page.blocks?.some((block) => ['queued', 'translating'].includes(block.status)),
    );
  }

  async function applyRestoredSettings(taskSettings) {
    if (!taskSettings || typeof taskSettings !== 'object') return;
    const previousLoading = preferences.loadingPreferences;
    preferences.loadingPreferences = true;
    try {
      const assign = (name, value, predicate = () => value !== undefined) => {
        if (predicate(value) && preferences[name] && typeof preferences[name] === 'object')
          preferences[name].value = value;
      };
      assign('engine', taskSettings.engine, (value) => typeof value === 'string' && value);
      assign('language', taskSettings.language, (value) => typeof value === 'string');
      assign('sourceLanguage', taskSettings.sourceLanguage, (value) => typeof value === 'string');
      assign('concurrency', taskSettings.concurrency, (value) => Number.isFinite(value));
      assign('pageConcurrency', taskSettings.pageConcurrency, (value) => Number.isFinite(value));
      assign(
        'reuseTranslations',
        taskSettings.reuseTranslations,
        (value) => typeof value === 'boolean',
      );
      assign(
        'paragraphContinuationDetection',
        taskSettings.paragraphContinuationDetection,
        (value) => typeof value === 'boolean',
      );
      assign('jevApiToken', taskSettings.jevApiToken, (value) => typeof value === 'string');

      const remote = taskSettings.remoteKernel;
      if (remote && typeof remote === 'object') {
        assign('remoteKernelEnabled', true);
        assign('remoteKernelUrl', remote.url, (value) => typeof value === 'string');
        assign('remoteKernelService', remote.service || '', (value) => typeof value === 'string');
      } else {
        assign('remoteKernelEnabled', false);
      }

      const engine = typeof taskSettings.engine === 'string' ? taskSettings.engine : null;
      const service = taskSettings.translationService;
      if (engine && service && typeof service.id === 'string' && preferences.translationServices) {
        const nextServices = withSelectedService(
          preferences.translationServices.value,
          engine,
          service.id,
        );
        const config = nextServices[engine] || {};
        const values = service.values;
        nextServices[engine] = {
          ...config,
          ...(values && typeof values === 'object' && !Array.isArray(values)
            ? { values: cloneValue(values, {}) }
            : {}),
        };
        preferences.translationServices.value = nextServices;
      }

      if (
        taskSettings.advancedOptions &&
        typeof taskSettings.advancedOptions === 'object' &&
        preferences.kernelAdvancedOptions
      ) {
        const nextOptions = cloneValue(preferences.kernelAdvancedOptions.value, {});
        nextOptions[engine || ''] = cloneValue(taskSettings.advancedOptions, {});
        if (engine) preferences.kernelAdvancedOptions.value = nextOptions;
      }
      await nextTick();
    } finally {
      preferences.loadingPreferences = previousLoading;
    }
  }

  async function prepareServiceMode(options = {}) {
    const allPages = options.translateAllPages ?? translationState.translateAllPages === true;
    if (!hasPendingWork())
      return {
        taskId: current?.id || null,
        documentId: session.documentId,
        settingsKey: current?.settingsKey || settingsKey(currentSettings()),
        settings: cloneValue(current?.settings || currentSettings(), {}),
        pages: current ? [...current.pages] : [],
        layoutPages: current ? [...current.layoutPages] : [],
        translateAllPages: allPages,
        forceRetranslation: translationState.forceRetranslation === true,
      };
    const pages = allPages
      ? session.pages.value.map((page) => page.number)
      : options.pages || defaultScope();
    const state = await submitScope({
      pages,
      layoutPages: options.layoutPages,
      manual: options.manual,
    });
    return {
      taskId: state?.taskId || current?.id || null,
      documentId: session.documentId,
      settingsKey: state?.settingsKey || current?.settingsKey || '',
      settings: cloneValue(state?.settings || current?.settings, {}),
      pages: state?.pages || [...(current?.pages || [])],
      layoutPages: state?.layoutPages || [...(current?.layoutPages || [])],
      pagesState: cloneValue(current?.pagesState, []),
      translateAllPages: allPages,
      forceRetranslation: translationState.forceRetranslation === true,
    };
  }

  async function restoreServiceMode(metadata) {
    const source = metadata?.translation || metadata;
    const taskId = source?.taskId || source?.id;
    const taskSettings = cloneValue(source?.settings, null);
    if (taskSettings) await applyRestoredSettings(taskSettings);
    if (taskSettings) {
      restoredSettings = taskSettings;
      restoredPreferencesKey = settingsKey(currentSettings());
    }
    if (taskId) {
      current = {
        id: String(taskId),
        documentId: session.documentId || source.documentId,
        settingsKey: source.settingsKey || (taskSettings ? settingsKey(taskSettings) : ''),
        settings: taskSettings,
        pages: new Set(normalizeNumbers(source.pages)),
        layoutPages: new Set(normalizeNumbers(source.layoutPages)),
        state: source.state,
        completed: source.completed,
        total: source.total,
        pagesState: Array.isArray(source.pagesState) ? source.pagesState : [],
      };
      translationState.readerTaskId = current.id;
      if (current.pagesState.length)
        publishStatus({
          id: current.id,
          state: current.state,
          pages: current.pagesState,
          completed: current.completed,
          total: current.total,
        });
    }
    if (source && 'translateAllPages' in source)
      translationState.translateAllPages = source.translateAllPages === true;
    if (source && 'forceRetranslation' in source)
      translationState.forceRetranslation = source.forceRetranslation === true;
    // Reconnection intentionally does not start polling. The queue starts it
    // when the restored renderer is foregrounded and its epoch is current.
    return snapshot();
  }

  async function cancelTranslationTask() {
    const taskId = current?.id;
    latestGeneration++;
    if (activeSubmission) activeSubmission.cancelled = true;
    activeSubmission = null;
    current = null;
    restoredSettings = null;
    restoredPreferencesKey = '';
    delete translationState.readerTaskId;
    delete translationState.readerTaskState;
    await deleteTask(taskId);
  }

  return {
    enabled,
    submitScope,
    waitForPage,
    prepareServiceMode,
    restoreServiceMode,
    cancelTranslationTask,
    cancelReaderTask: cancelTranslationTask,
    cancelReaderTasks: cancelTranslationTask,
    readerTaskSnapshot: snapshot,
  };
}
