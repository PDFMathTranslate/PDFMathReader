import sample from './data/sample.json';
import packageInfo from '../package.json';
import sampleUrl from '../public/sample.pdf?url';

const ENGINE = 'pdf_inspector';
const PREPARED_MODEL = 'prepared-data';
const UI_LOCALES = new Set(['en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'fr', 'es', 'hi', 'bn']);
const TARGET_BY_UI_LOCALE = {
  en: 'zh-CN',
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-CN',
  ja: 'ja',
  ko: 'ko',
  fr: 'fr',
  es: 'es',
  hi: 'hi',
  bn: 'bn',
};
const LANGUAGE_BY_LOCALE = {
  en: 'English',
  'zh-CN': 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  fr: 'French',
  es: 'Spanish',
  hi: 'Hindi',
  bn: 'Bengali',
};
const LOCALE_BY_LANGUAGE = {
  English: 'en',
  'Simplified Chinese': 'zh-CN',
  'Traditional Chinese': 'zh-TW',
  Japanese: 'ja',
  Korean: 'ko',
  French: 'fr',
  Spanish: 'es',
  Hindi: 'hi',
  Bengali: 'bn',
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function json(value, status = 200) {
  return new globalThis.Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function empty(status = 204) {
  return new globalThis.Response(null, { status });
}

function error(message, status = 501) {
  return json({ error: message }, status);
}

function selectedLocale(language) {
  const locale = LOCALE_BY_LANGUAGE[language] || language;
  return Object.hasOwn(sample.paragraphs[0].translations, locale) ? locale : null;
}

function languageForLocale(locale) {
  return LANGUAGE_BY_LOCALE[locale] || LANGUAGE_BY_LOCALE.en;
}

function translationFor(paragraph, language) {
  const locale = selectedLocale(language);
  return locale ? paragraph.translations[locale] || paragraph.text : null;
}

function unsupportedLanguage(language) {
  return `No prepared translation is available for ${language || 'the requested language'}.`;
}

function layoutParagraphs() {
  return sample.paragraphs.map(({ translations, ...paragraph }) => ({ ...paragraph }));
}

function translatedParagraphs(language) {
  return sample.paragraphs.map((paragraph) => ({
    ...clone(paragraph),
    translation: translationFor(paragraph, language),
    translationModel: PREPARED_MODEL,
    translated: true,
    cached: true,
    status: 'ready',
    error: '',
  }));
}

function parseBody(options) {
  if (typeof options?.body !== 'string') return {};
  try {
    const body = JSON.parse(options.body);
    return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  } catch {
    return {};
  }
}

function clonePreferences(value) {
  return clone({ ...value, engine: ENGINE, showKernelToolbarShortcut: false });
}

function engineState(id) {
  const installed = id === ENGINE;
  return {
    id,
    installed,
    available: installed,
    version: installed ? 'prepared-data' : '',
    reason: installed
      ? ''
      : 'This demo includes only the prepared pdf_inspector engine.',
  };
}

function serviceCatalog(id) {
  return {
    id,
    version: 'prepared-data',
    services: [
      { id: 'auto', label: 'Automatic', fields: [] },
      { id: 'siliconflow-free', label: 'SiliconFlow free', fields: [] },
      {
        id: 'openai',
        label: 'OpenAI compatible',
        fields: [
          { id: 'key', label: 'API key', type: 'string', secret: true, required: true },
          { id: 'base_url', label: 'Base URL', type: 'string', default: 'https://api.openai.com/v1' },
          { id: 'model', label: 'Model', type: 'string', default: 'gpt-4.1-mini' },
        ],
      },
    ],
  };
}

function cacheState(cacheLimitMB) {
  const bytes = new globalThis.TextEncoder().encode(JSON.stringify(sample)).byteLength;
  return { bytes, documents: [], limitMB: cacheLimitMB ?? null };
}

// The Vue renderer remains the production application. This adapter supplies only
// the local document, prepared layout/translation data, and read-only service state.
export function installDemoBackend() {
  const root = globalThis;
  const realFetch = root.fetch.bind(root);
  const queryLocale = new root.URLSearchParams(root.location.search).get('locale');
  const uiLocale = UI_LOCALES.has(queryLocale) ? queryLocale : 'en';
  let preferences = {
    engine: ENGINE,
    uiLanguage: uiLocale,
    language: languageForLocale(TARGET_BY_UI_LOCALE[uiLocale]),
    sourceLanguage: 'English',
    interactionMode: 'reading',
    documentOpenMode: 'translation',
    fit: 'width',
    zoom: 1,
    columns: 1,
    direction: 'vertical',
    translationMode: 'reading-ahead',
    automatic: true,
    concurrency: 2,
    pageConcurrency: 2,
    reduceResourceUsage: true,
    reduceBackgroundFrameRate: true,
    restoreDocuments: false,
    reuseTranslations: true,
    showKernelToolbarShortcut: false,
    cacheLimitMB: null,
  };
  let delivered = false;
  let nextTaskId = 1;
  const listeners = new Set();
  const tasks = new Map();

  const notifyPreferences = () => {
    const saved = clonePreferences(preferences);
    for (const listener of listeners) listener(saved);
  };

  root.previewPreferences = {
    load: async () => clonePreferences(preferences),
    save: async (value) => {
      const next = value && typeof value === 'object' ? value : {};
      preferences = { ...preferences, ...clone(next), engine: ENGINE, showKernelToolbarShortcut: false };
      notifyPreferences();
      return clonePreferences(preferences);
    },
    onChange(listener) {
      if (typeof listener !== 'function') return () => {};
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  root.previewAppearance = {
    platform: 'darwin',
    current: async () => ({ dark: false, accent: '#007aff' }),
    onChange: () => () => {},
  };
  root.previewCredentials = {
    onChange: () => () => {},
    clear: async () => ({ configured: false, keySource: 'none', keyStorageAvailable: false }),
    save: async () => {
      throw Error('Credentials are unavailable in the prepared-data demo.');
    },
  };
  root.previewDocuments = {
    onAvailable: () => () => {},
    next: async () => {
      if (delivered) return null;
      delivered = true;
      const response = await realFetch(sampleUrl);
      return {
        name: `${sample.title}.pdf`,
        ticket: 'prepared-sample',
        bytes: await response.arrayBuffer(),
      };
    },
    saveView: async () => {},
    closed: async () => {},
    open: async () => {
      throw Error('Opening arbitrary files is available in the desktop app.');
    },
  };

  root.fetch = async (input, options = {}) => {
    const inputUrl = typeof input === 'string' ? input : input?.url;
    const url = new root.URL(inputUrl || '', root.location.href);
    if (url.origin !== root.location.origin)
      return error('External requests are disabled in the prepared-data demo.', 403);
    const path = url.pathname;
    if (!path.startsWith('/api/')) {
      if (path === '/sample.pdf') return realFetch(sampleUrl, options);
      if (path === '/build-info.json')
        return json({ version: packageInfo.version, app: { version: packageInfo.version }, kernels: [] });
      return realFetch(input, options);
    }

    const body = parseBody(options);
    if (path === '/api/config')
      return json({ configured: false, keySource: 'none', keyStorageAvailable: false, model: PREPARED_MODEL });
    if (path === '/api/documents' && (options.method || 'GET').toUpperCase() === 'POST')
      return json({ id: 'prepared-sample' });
    if (path.startsWith('/api/documents/')) return empty();
    if (path === '/api/engines')
      return json({
        engines: [ENGINE, 'pdf_math_fast', 'pdf_math_precise'].map(engineState),
        uv: { available: false, version: '' },
      });
    if (path.startsWith('/api/engines/') && path.endsWith('/install'))
      return error('Runtime engine installation is unavailable in the prepared-data demo.', 501);
    if (path.startsWith('/api/engines/') && path.endsWith('/services'))
      return json(serviceCatalog(path.split('/')[3] || ENGINE));
    if (path.startsWith('/api/engines/') && path.endsWith('/advanced'))
      return json({ options: [], reason: 'Advanced engine options are unavailable in the demo.' });
    if (path.startsWith('/api/engines/')) return json(engineState(path.split('/')[3] || ENGINE));
    if (path === '/api/layout')
      return json({ kind: 'inspector', paragraphs: layoutParagraphs(), engine: ENGINE });
    if (path === '/api/translate') {
      const paragraph = sample.paragraphs.find((item) => item.text === body.text);
      if (!paragraph)
        return body.cacheOnly ? empty() : error('No prepared translation matches this paragraph.', 422);
      if (!selectedLocale(body.language)) return error(unsupportedLanguage(body.language), 422);
      return json({
        translation: translationFor(paragraph, body.language),
        cached: true,
        model: PREPARED_MODEL,
        engine: ENGINE,
      });
    }
    if (path === '/api/reader-tasks' && (options.method || 'GET').toUpperCase() === 'POST') {
      if (!selectedLocale(body.settings?.language))
        return error(unsupportedLanguage(body.settings?.language), 422);
      const pages = Array.isArray(body.pages)
        ? body.pages.map((page) => Number(page?.number)).filter((page) => Number.isInteger(page) && page > 0)
        : [1];
      const id = `prepared-task-${nextTaskId++}`;
      const task = {
        id,
        documentId: body.documentId || 'prepared-sample',
        settings: body.settings || {},
        pages: [...new Set(pages)],
      };
      tasks.set(id, task);
      return json({
        id,
        state: 'completed',
        completed: task.pages.length,
        total: task.pages.length,
        pages: task.pages.map((number) => ({ number, state: 'done', progress: 1 })),
      });
    }
    if (path.startsWith('/api/reader-tasks/')) {
      const [, , , taskId, pagePart] = path.split('/');
      const task = tasks.get(taskId);
      if (!task) return error('Prepared reader task not found.', 404);
      if (pagePart === 'pages') {
        const page = Number(path.split('/').at(-1));
        if (page !== 1 || !task.pages.includes(page)) return empty();
        return json({
          kind: 'inspector',
          paragraphs: translatedParagraphs(task.settings.language),
          engine: ENGINE,
          cached: true,
          model: PREPARED_MODEL,
        });
      }
      if ((options.method || 'GET').toUpperCase() === 'DELETE') {
        tasks.delete(taskId);
        return empty();
      }
      return json({
        id: task.id,
        state: 'completed',
        completed: task.pages.length,
        total: task.pages.length,
        pages: task.pages.map((number) => ({ number, state: 'done', progress: 1 })),
      });
    }
    if (path.startsWith('/api/cache')) {
      if (path.endsWith('/limit')) preferences.cacheLimitMB = body.limitMB ?? null;
      return json(cacheState(preferences.cacheLimitMB));
    }
    if (path === '/api/performance')
      return json({ requests: 0, requestBodyBytes: 0, responseBodyBytes: 0, uploadBytes: 0 });
    return error('This operation is unavailable in the prepared-data demo.', 501);
  };
}
