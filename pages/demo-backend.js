import layout from './data/layout.json';
import preparedTranslations from 'virtual:website-translation-cache';
import sampleUrl from '../public/sample.pdf?url';
import packageInfo from '../package.json';

const config = {
  configured: false,
  keySource: 'none',
  keyStorageAvailable: false,
  model: '官网预置译文',
};
const noOp = () => () => {};
const json = (value, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
function delay(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, milliseconds);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

// The production Vue renderer is unchanged. Only the desktop transport is replaced
// inside this demo iframe; PDF.js, rendering, layout, settings and controls stay real.
export function installDemoBackend() {
  const realFetch = window.fetch.bind(window);
  let delivered = false;
  let preferences = {
    engine: 'pdf_inspector',
    uiLanguage: 'zh-CN',
    language: 'Simplified Chinese',
    sourceLanguage: 'English',
    interactionMode: 'reading',
    documentOpenMode: 'translation',
    fit: 'width',
    zoom: 1,
    columns: 1,
    direction: 'vertical',
    translationMode: 'reading',
    autoHideHeader: false,
    automatic: true,
    concurrency: 2,
    pageConcurrency: 1,
    appearance: 'light',
    reduceResourceUsage: true,
    restoreDocuments: false,
  };
  const listeners = new Set();
  const appearanceListeners = new Set();
  const channel = new BroadcastChannel('pdfmathreader-website-demo');
  channel.onmessage = ({ data }) => {
    if (data.type === 'preferences') {
      preferences = { ...preferences, ...data.value };
      listeners.forEach((listener) => listener(preferences));
      appearanceListeners.forEach((listener) => listener(preferences));
    } else if (data.type === 'request')
      channel.postMessage({ type: 'preferences', value: preferences });
  };
  channel.postMessage(
    new URLSearchParams(location.search).has('replay')
      ? { type: 'preferences', value: preferences }
      : { type: 'request' },
  );
  window.previewPreferences = {
    load: async () => ({ ...preferences }),
    save: async (value) => {
      preferences = { ...preferences, ...JSON.parse(JSON.stringify(value)) };
      channel.postMessage({ type: 'preferences', value: preferences });
      return { ...preferences };
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  window.previewAppearance = {
    platform: 'darwin',
    current: async () => ({ dark: false, accent: '#007aff' }),
    onChange(listener) {
      appearanceListeners.add(listener);
      return () => appearanceListeners.delete(listener);
    },
  };
  window.previewCredentials = {
    onChange: noOp,
    clear: async () => config,
    save: async () => {
      throw Error('官网演示不保存密钥，请在桌面应用中配置。');
    },
  };
  window.previewDocuments = {
    onAvailable: noOp,
    next: async () => {
      if (delivered) return null;
      delivered = true;
      return {
        name: 'A quieter way to read.pdf',
        ticket: 'website-demo',
        bytes: await (await realFetch(sampleUrl)).arrayBuffer(),
      };
    },
    saveView: async () => {},
    closed: async () => {},
    open: async () => {
      throw Error('请下载桌面应用打开自己的 PDF。');
    },
  };
  const engine = (id) => ({
    id,
    installed: id === 'pdf_inspector',
    available: id === 'pdf_inspector',
    version: id === 'pdf_inspector' ? '官网预置数据' : '',
    reason: id === 'pdf_inspector' ? '' : '快速与精确内核在桌面应用中运行。官网演示使用超快内核。',
  });
  const cache = new Map(Object.entries(preparedTranslations));
  window.fetch = async (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.origin !== location.origin) return json({ error: '官网演示不连接外部翻译服务。' }, 403);
    const path = url.pathname;
    if (!path.startsWith('/api/')) {
      if (path === '/sample.pdf') return realFetch(sampleUrl, options);
      if (path === '/build-info.json')
        return json({
          version: packageInfo.version,
          app: { version: packageInfo.version },
          dependencies: [],
          kernels: [],
        });
      return realFetch(input, options);
    }
    const body = typeof options.body === 'string' ? JSON.parse(options.body) : {};
    if (path === '/api/config') return json(config);
    if (path === '/api/documents') return json({ id: 'prepared-sample' });
    if (path.startsWith('/api/documents/')) return new Response(null, { status: 204 });
    if (path === '/api/engines')
      return json({
        engines: ['pdf_inspector', 'pdf_math_fast', 'pdf_math_precise'].map(engine),
        uv: { available: false, version: '' },
      });
    if (path.endsWith('/services'))
      return json({
        id: path.split('/')[3],
        version: 'website',
        services: [
          { id: 'auto', label: 'Automatic (SiliconFlow free)', fields: [] },
          { id: 'siliconflow-free', label: 'SiliconFlow free', fields: [] },
          {
            id: 'openai',
            label: 'OpenAI compatible',
            fields: [
              { id: 'key', label: 'API key', type: 'string', secret: true, required: true },
              {
                id: 'base_url',
                label: 'Base URL',
                type: 'string',
                default: 'https://api.openai.com/v1',
              },
              { id: 'model', label: 'Model', type: 'string', default: 'gpt-4.1-mini' },
            ],
          },
        ],
      });
    if (path.endsWith('/advanced'))
      return json({ options: [], reason: '更多内核选项请在桌面应用查看。' });
    if (path.startsWith('/api/engines/')) return json(engine(path.split('/')[3]));
    if (path === '/api/layout') {
      await delay(280, options.signal);
      return json({ paragraphs: layout[body.page - 1] || [], engine: 'pdf-inspector' });
    }
    if (path === '/api/translate') {
      const key = body.language + ':' + body.text;
      if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      if (!cache.has(key))
        return body.cacheOnly
          ? new Response(null, { status: 204 })
          : json({ error: '官网演示没有此语言或段落的预置译文。' }, 422);
      return json({ translation: cache.get(key), cached: true, model: '预置译文' });
    }
    if (path.startsWith('/api/cache')) {
      // Build-time demonstration data remains available after clearing session cache.
      if (path.endsWith('/limit')) preferences.cacheLimitMB = body.limitMB;
      return json({
        bytes: [...cache.values()].reduce(
          (n, text) => n + new TextEncoder().encode(text).length,
          0,
        ),
        documents: [],
        limitMB: preferences.cacheLimitMB ?? null,
      });
    }
    if (path === '/api/performance')
      return json({ requests: 0, requestBodyBytes: 0, responseBodyBytes: 0, uploadBytes: 0 });
    return json({ error: '此操作需要桌面应用。' }, 501);
  };
  window.addEventListener('pagehide', () => channel.close(), { once: true });
}
