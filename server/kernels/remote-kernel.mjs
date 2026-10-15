import { randomUUID } from 'node:crypto';

// Experimental client for the zotero-pdf2zh HTTP server protocol
// (https://github.com/guaguastandup/zotero-pdf2zh). The server translates whole
// documents and keeps its own translation-service credentials, so this client
// uploads one-page PDFs and never forwards any API key.
const HEALTH_TIMEOUT_MS = 3000;
const HEALTH_TTL_MS = 15 * 1000;
const POLL_INTERVAL_MS = 1000;
const SUBMIT_TIMEOUT_MS = 60 * 1000;
const DOWNLOAD_TIMEOUT_MS = 2 * 60 * 1000;
const MAX_POLL_FAILURES = 5;
const JOB_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_RESPONSE_BYTES = 200 * 1024 * 1024;

export function normalizeRemoteKernelUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    return '';
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
  url.hash = '';
  url.search = '';
  return url.toString().replace(/\/+$/, '');
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(Error('Cancelled'));
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, ms);
    const abort = () => {
      clearTimeout(timer);
      reject(Error('Cancelled'));
    };
    signal?.addEventListener('abort', abort, { once: true });
  });
}

// Percent reached when a BabelDOC stage starts, matched against the status text
// the server reports. Only a rough guide: the server reports 0% until its
// progress parser sees a counter, which can be the whole job for a one-page
// upload, so the text is the better signal.
const STAGE_FLOORS = [
  [/初始化|initializ/i, 3],
  [/parse pdf|intermediate representation/i, 8],
  [/scanned/i, 12],
  [/layout/i, 18],
  [/parse paragraphs/i, 25],
  [/formulas|styles/i, 30],
  [/term/i, 35],
  [/translate paragraphs/i, 40],
  [/typeset/i, 80],
  [/font/i, 88],
  [/drawing/i, 92],
  [/save/i, 95],
];
const ESTIMATE_CEILING = 90;
const ESTIMATE_CREEP = 0.03;

// Estimates a monotonic percent from status text changes, with a slow creep
// between changes so a long stage still visibly advances. It never reaches 100:
// that is left to the finished job.
function createProgressEstimator() {
  let percent = 0;
  return (message, reported) => {
    const text = String(message || '');
    const counter = /\btranslate\s+(\d+)\/(\d+)/i.exec(text);
    const floor =
      counter && Number(counter[1]) > 0 && Number(counter[2]) > 0
        ? 15 + (75 * Math.min(Number(counter[1]), Number(counter[2]))) / Number(counter[2])
        : (STAGE_FLOORS.find(([pattern]) => pattern.test(text))?.[1] ?? 0);
    const server = Math.min(99, Math.max(0, Number(reported) || 0));
    percent = Math.max(
      percent,
      floor,
      server,
      percent + (ESTIMATE_CEILING - percent) * ESTIMATE_CREEP,
    );
    return Math.min(99, percent);
  };
}

function remoteProgress(stage, percent) {
  return {
    stage: String(stage || 'Remote translation').slice(0, 200),
    completed: percent,
    total: 100,
    percent,
  };
}

function taskId(record) {
  return String(record?.taskId ?? record?.task_id ?? '');
}

// Only a mono (translated-only) PDF is wanted; never fall back to a dual file.
function pickTranslatedFile(names) {
  const pdfs = names.filter((name) => /\.pdf$/i.test(name));
  return (
    pdfs.find((name) => /\.mono\.pdf$/i.test(name)) ||
    pdfs.find((name) => /mono/i.test(name) && !/dual|compare|cut/i.test(name)) ||
    ''
  );
}

export function createRemoteKernel({
  fetch: request = globalThis.fetch,
  healthTtlMs = HEALTH_TTL_MS,
  healthTimeoutMs = HEALTH_TIMEOUT_MS,
  pollIntervalMs = POLL_INTERVAL_MS,
  jobTimeoutMs = JOB_TIMEOUT_MS,
  submitTimeoutMs = SUBMIT_TIMEOUT_MS,
  pollTimeoutMs = 10_000,
  loadPdfLib = () => import('pdf-lib'),
  now = () => Date.now(),
} = {}) {
  const healthCache = new Map();

  async function getJson(url, signal, timeoutMs) {
    const timeout = AbortSignal.timeout(timeoutMs);
    const response = await request(url, {
      cache: 'no-store',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function probe(base, signal) {
    try {
      const body = await getJson(`${base}/health`, signal, healthTimeoutMs);
      if (body?.status !== 'ok') return { ok: false, reason: 'Unexpected health response' };
      return { ok: true, version: typeof body.version === 'string' ? body.version : '' };
    } catch (error) {
      if (signal?.aborted) throw Error('Cancelled');
      return { ok: false, reason: error?.message || 'Unreachable' };
    }
  }

  // The result is cached briefly so a burst of page requests costs one probe.
  async function health(url, { force = false, signal } = {}) {
    const base = normalizeRemoteKernelUrl(url);
    if (!base) return { ok: false, reason: 'Invalid server URL' };
    const cached = healthCache.get(base);
    if (!force && cached?.value && now() - cached.at < healthTtlMs) return cached.value;
    if (!force && cached?.pending) return cached.pending;
    const pending = probe(base, signal).then((value) => {
      healthCache.set(base, { at: now(), value });
      return value;
    });
    healthCache.set(base, { ...cached, pending });
    try {
      return await pending;
    } catch (error) {
      healthCache.delete(base);
      throw error;
    }
  }

  function markUnhealthy(url, reason = 'Remote job failed') {
    const base = normalizeRemoteKernelUrl(url);
    if (base) healthCache.set(base, { at: now(), value: { ok: false, reason } });
  }

  async function singlePage(bytes, page) {
    const { PDFDocument } = await loadPdfLib();
    const source = await PDFDocument.load(bytes);
    if (page < 1 || page > source.getPageCount()) throw Error('Page is out of range');
    const one = await PDFDocument.create();
    const [copied] = await one.copyPages(source, [page - 1]);
    one.addPage(copied);
    return Buffer.from(await one.save());
  }

  // `reached` is false only when no status endpoint answered at all; a 404 on
  // /api/tasks (newer servers) is normal as long as /api/history responds.
  async function findRecord(base, id, signal) {
    let reached = false;
    for (const [path, key] of [
      ['/api/tasks', 'tasks'],
      ['/api/history', 'history'],
    ]) {
      try {
        const list = (await getJson(base + path, signal, pollTimeoutMs))?.[key];
        reached = true;
        const match = Array.isArray(list) ? list.find((entry) => taskId(entry) === id) : null;
        if (match) return { record: match, reached };
      } catch {
        if (signal?.aborted) throw Error('Cancelled');
      }
    }
    return { record: null, reached };
  }

  async function download(base, name, signal) {
    const timeout = AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS);
    const response = await request(`${base}/translatedFile/${encodeURIComponent(name)}`, {
      cache: 'no-store',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    if (!response.ok) throw Error(`Remote download failed: HTTP ${response.status}`);
    const length = Number(response.headers?.get?.('content-length') || 0);
    if (length > MAX_RESPONSE_BYTES) throw Error('Remote result is too large');
    const body = Buffer.from(await response.arrayBuffer());
    if (!body.subarray(0, 1024).includes(Buffer.from('%PDF')))
      throw Error('Remote result is not a PDF');
    return body;
  }

  // Returns the translated one-page PDF. Throws on any remote failure so the
  // caller can fall back to the local kernel.
  async function translatePage({
    url,
    bytes,
    page,
    language,
    sourceLanguage,
    service = '',
    threads = 2,
    signal,
    onProgress,
  }) {
    const base = normalizeRemoteKernelUrl(url);
    if (!base) throw Error('Invalid server URL');
    if (signal?.aborted) throw Error('Cancelled');
    const upload = await singlePage(bytes, page);
    const body = {
      fileName: `pdfmathreader-${randomUUID()}.pdf`,
      fileContent: upload.toString('base64'),
      engine: 'pdf2zh_next',
      sourceLang: sourceLanguage || 'en',
      targetLang: language,
      qps: threads,
      mono: true,
      dual: false,
      noMono: false,
      noDual: true,
      asyncJob: true,
      // The local Precise kernel rewrites translated rich-text tags (<样式 id='1'>) to the
      // <style id='1'> BabelDOC parses. A remote server runs unpatched BabelDOC, which
      // typesets such tags literally, so it must not send style placeholders to the LLM.
      disableRichTextTranslate: true,
      ...(service ? { service, next_service: service } : {}),
    };
    const deadline = now() + jobTimeoutMs;
    const estimate = createProgressEstimator();
    onProgress?.(remoteProgress('Remote translation', estimate('', 0)));
    // An accepted job answers immediately, so a server that stays silent is stuck.
    const submitTimeout = AbortSignal.timeout(submitTimeoutMs);
    const response = await request(`${base}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-PDF2zh-Protocol': 'accepted' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: signal ? AbortSignal.any([signal, submitTimeout]) : submitTimeout,
    });
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw Error(`Remote server returned HTTP ${response.status}`);
    }
    if (!response.ok || payload?.status === 'error')
      throw Error(`Remote translation failed: ${payload?.message || `HTTP ${response.status}`}`);
    let files = Array.isArray(payload?.fileList) ? payload.fileList : null;
    if (!files) {
      const id = taskId(payload);
      if (payload?.status !== 'accepted' || !id) throw Error('Remote server sent no task id');
      let failures = 0;
      while (!files) {
        if (now() > deadline) throw Error('Remote translation timed out');
        const { record, reached } = await findRecord(base, id, signal);
        failures = reached ? 0 : failures + 1;
        if (failures >= MAX_POLL_FAILURES) throw Error('Remote server stopped responding');
        if (record) {
          const status = String(record.status || '');
          if (['失败', 'failed'].includes(status))
            throw Error(`Remote translation failed: ${record.error || record.message || status}`);
          const list = record.result?.fileList ?? record.fileList;
          if (Array.isArray(list) && list.length && record.finished === true) files = list;
          else if (record.finished !== true)
            onProgress?.(remoteProgress(record.message, estimate(record.message, record.progress)));
        }
        if (!files) await sleep(pollIntervalMs, signal);
      }
    }
    const name = pickTranslatedFile(files);
    if (!name) throw Error('Remote server returned no translated PDF');
    const translated = await download(base, name, signal);
    return singlePage(translated, 1);
  }

  return { health, markUnhealthy, translatePage };
}
