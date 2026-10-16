import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { isTranslationLanguageSupported } from '../../shared/translation/languages.mjs';
import { paragraphDisplayText } from '../../shared/translation/spacing.mjs';
import { splitParagraphTranslation } from '../../shared/translation/paragraph-fragments.mjs';

export const MAX_READER_TASKS = 32;
// A full-document task may cover a long book. Keep the bound high enough for
// ordinary books while retaining a hard request limit and disk-backed results.
export const MAX_READER_TASK_PAGES = 4096;
export const MAX_READER_LAYOUT_PAGES = 8192;
export const READER_TASK_TTL_MS = 10 * 60 * 1000;

const PAGE_NUMBER_LIMIT = 100000;
const PAGE_HEIGHT_LIMIT = 100000;
const MAX_ERROR_LENGTH = 512;
const MATH_HEADERS = [
  'content-type',
  'x-layout-key',
  'x-translation-cache',
  'x-translation-model',
  'x-translation-outcome',
];

function statusError(message, status = 400) {
  const error = Error(message);
  error.status = status;
  return error;
}

function isObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (isObject(value))
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, stableValue(value[key])]),
    );
  return value;
}

export function canonicalSettings(value = {}) {
  if (!isObject(value)) throw statusError('Settings must be an object.');
  return stableValue(value);
}

function canonicalKey(documentId, settings) {
  return `${documentId}\0${JSON.stringify(canonicalSettings(settings))}`;
}

function validateGlossary(value) {
  return (
    Array.isArray(value) &&
    value.length <= 5000 &&
    value.every(
      (entry) =>
        isObject(entry) &&
        typeof entry.source === 'string' &&
        entry.source.length > 0 &&
        entry.source.length <= 500 &&
        typeof entry.target === 'string' &&
        entry.target.length > 0 &&
        entry.target.length <= 500,
    )
  );
}

function validateRemoteKernel(value) {
  return (
    value === undefined ||
    value === null ||
    (isObject(value) &&
      typeof value.url === 'string' &&
      value.url.length > 0 &&
      value.url.length <= 2048 &&
      (value.service === undefined ||
        (typeof value.service === 'string' && value.service.length <= 100)))
  );
}

function validateSettings(value) {
  if (!isObject(value)) throw statusError('Settings must be an object.');
  const engine = value.engine;
  if (!['pdf_inspector', 'pdf_math_fast', 'pdf_math_precise'].includes(engine))
    throw statusError('Invalid translation engine.');
  if (typeof value.language !== 'string' || !isTranslationLanguageSupported(engine, value.language))
    throw statusError('Invalid translation language.');
  if (
    value.sourceLanguage !== undefined &&
    value.sourceLanguage !== '' &&
    (typeof value.sourceLanguage !== 'string' ||
      !isTranslationLanguageSupported('pdf_inspector', value.sourceLanguage, 'source'))
  )
    throw statusError('Invalid source language.');
  for (const [name, fallback] of [
    ['concurrency', 2],
    ['pageConcurrency', 2],
  ]) {
    const setting = value[name] === undefined ? fallback : value[name];
    if (!Number.isInteger(setting) || setting < 1 || setting > 12)
      throw statusError(`Invalid ${name}.`);
  }
  for (const name of [
    'reuseTranslations',
    'forceRetranslation',
    'paragraphContinuationDetection',
  ]) {
    if (value[name] !== undefined && typeof value[name] !== 'boolean')
      throw statusError(`Invalid ${name}.`);
  }
  if (
    value.jevApiToken !== undefined &&
    (typeof value.jevApiToken !== 'string' || Array.from(value.jevApiToken).length > 4096)
  )
    throw statusError('Invalid Jev token.');
  if (!validateGlossary(value.glossary || [])) throw statusError('Invalid glossary.');
  if (!validateRemoteKernel(value.remoteKernel)) throw statusError('Invalid remote kernel.');
  if (value.advancedOptions !== undefined && !isObject(value.advancedOptions))
    throw statusError('Invalid advanced options.');
  if (value.translationService !== undefined && value.translationService !== null) {
    if (!isObject(value.translationService)) throw statusError('Invalid translation service.');
    if (
      value.translationService.id !== undefined &&
      (typeof value.translationService.id !== 'string' || value.translationService.id.length > 256)
    )
      throw statusError('Invalid translation service.');
  }
  return {
    engine,
    language: value.language,
    ...(value.sourceLanguage !== undefined && value.sourceLanguage !== ''
      ? { sourceLanguage: value.sourceLanguage }
      : {}),
    concurrency: value.concurrency === undefined ? 2 : value.concurrency,
    pageConcurrency: value.pageConcurrency === undefined ? 2 : value.pageConcurrency,
    reuseTranslations: value.reuseTranslations === true,
    forceRetranslation: value.forceRetranslation === true,
    remoteKernel: value.remoteKernel === null ? undefined : clone(value.remoteKernel),
    paragraphContinuationDetection: value.paragraphContinuationDetection === true,
    jevApiToken: value.jevApiToken || '',
    glossary: clone(value.glossary || []),
    advancedOptions: clone(value.advancedOptions || {}),
    ...(value.translationService !== undefined && value.translationService !== null
      ? { translationService: clone(value.translationService) }
      : {}),
  };
}

function normalizePage(value, label) {
  if (!isObject(value)) throw statusError(`Invalid ${label}.`);
  const number = value.number,
    height = value.height;
  if (
    !Number.isInteger(number) ||
    number < 1 ||
    number > PAGE_NUMBER_LIMIT ||
    !Number.isFinite(height) ||
    height <= 0 ||
    height > PAGE_HEIGHT_LIMIT
  )
    throw statusError(`Invalid ${label}.`);
  return { number, height };
}

function normalizePages(value, label, maximum) {
  if (!Array.isArray(value) || value.length > maximum) throw statusError(`Invalid ${label}.`);
  const pages = new Map();
  for (const entry of value) pages.set(entry.number, normalizePage(entry, label));
  return [...pages.values()].sort((a, b) => a.number - b.number);
}

function safeError(error) {
  if (error?.name === 'AbortError') return 'Task cancelled.';
  const message = String(error?.message || error || 'Translation failed.')
    .replace(/(bearer)\s+[^\s,;]+/gi, '$1 [redacted]')
    .replace(/(bearer|authorization|api[_-]?key|token|secret)\s*[:=]\s*[^\s,;]+/gi, '$1=[redacted]')
    .replace(/[\r\n]+/g, ' ')
    .trim();
  return (message || 'Translation failed.').slice(0, MAX_ERROR_LENGTH);
}

function abortError() {
  const error = Error('Task cancelled.');
  error.name = 'AbortError';
  return error;
}

function pageInputMap(pages) {
  return new Map(pages.map((page) => [page.number, page]));
}

function descriptorFor(task, number) {
  return task.layoutDescriptors.get(number) || task.pageDescriptors.get(number);
}

async function responseJSON(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function responseError(response) {
  const body = await responseJSON(response);
  return safeError(body?.error || `Backend request failed (${response.status}).`);
}

async function writeResponseBody(response, path) {
  await mkdir(dirname(path), { recursive: true });
  if (response.body && typeof response.body.getReader === 'function') {
    await pipeline(Readable.fromWeb(response.body), createWriteStream(path));
    return;
  }
  await writeFile(path, Buffer.from(await response.arrayBuffer()));
}

function setProgress(page, value) {
  if (!isObject(value)) return;
  const progress = { ...value };
  if (typeof progress.percent === 'number')
    progress.percent = Math.max(0, Math.min(100, progress.percent));
  page.progress = progress;
}

function mapLimit(items, limit, worker) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  });
  return Promise.all(workers);
}

export function createReaderTasks({
  documents,
  origin = () => '',
  token,
  fetchImpl = globalThis.fetch,
  tempRoot = join(resolve('.cache/translations'), 'reader-tasks'),
  maxTasks = MAX_READER_TASKS,
  taskTtlMs = READER_TASK_TTL_MS,
} = {}) {
  if (!documents || typeof documents.getEntry !== 'function')
    throw Error('Reader tasks require a document store.');
  if (typeof fetchImpl !== 'function') throw Error('Reader tasks require fetch.');
  const tasks = new Map();
  const byKey = new Map();
  const retiredTasks = new Set();
  let closed = false;

  const terminalTaskTtl =
    Number.isFinite(taskTtlMs) && taskTtlMs > 0 ? taskTtlMs : READER_TASK_TTL_MS;
  const cleanupTimer = setInterval(
    () => {
      const cutoff = Date.now() - terminalTaskTtl;
      for (const task of tasks.values()) {
        if (task.state === 'running' || !task.finishedAt || task.finishedAt > cutoff) continue;
        // Keep completed results available for reconnecting renderers while
        // their document remains live. Document deletion retires its tasks
        // explicitly; this sweep only handles orphaned terminal tasks.
        if (documents.getEntry(task.documentId)) continue;
        retireTask(task);
      }
    },
    Math.min(terminalTaskTtl, 60_000),
  );
  cleanupTimer.unref?.();

  function active() {
    return [...tasks.values()].filter((task) => task.state === 'running').length;
  }

  function taskStatus(task) {
    const pages = [...task.pages.values()]
      .sort((a, b) => a.number - b.number)
      .map((page) => ({
        number: page.number,
        state: page.state,
        progress: page.progress ? clone(page.progress) : null,
        ...(page.error ? { error: page.error } : {}),
      }));
    return {
      id: task.id,
      state: task.state,
      pages,
      completed: pages.filter((page) => ['done', 'failed', 'cancelled'].includes(page.state))
        .length,
      total: pages.length,
    };
  }

  function resetDone(task) {
    task.done = new Promise((resolveDone) => {
      task.resolveDone = resolveDone;
    });
  }

  async function request(task, path, options = {}) {
    if (task.controller.signal.aborted) throw abortError();
    const headers = new Headers(options.headers || {});
    if (token) headers.set('X-Preview-Token', token);
    let response;
    try {
      response = await fetchImpl(`${origin()}${path}`, {
        ...options,
        headers,
        signal: task.controller.signal,
      });
    } catch (error) {
      if (task.controller.signal.aborted) throw abortError();
      throw error;
    }
    return response;
  }

  async function requestJSON(task, path, options = {}) {
    const response = await request(task, path, options);
    if (!response.ok) throw Error(await responseError(response));
    return responseJSON(response);
  }

  function bodyForSettings(task, extra = {}) {
    const settings = task.settings;
    return {
      documentId: task.documentId,
      sourceLanguage: settings.sourceLanguage,
      glossary: settings.glossary,
      advancedOptions: settings.advancedOptions,
      remoteKernel: settings.remoteKernel,
      jevApiToken: settings.jevApiToken,
      paragraphContinuationDetection: settings.paragraphContinuationDetection,
      reuseTranslations: settings.reuseTranslations,
      forceRetranslation: settings.forceRetranslation,
      translationService: settings.translationService,
      ...extra,
    };
  }

  function progressPoll(task, page, progressId) {
    let stopped = false;
    const poll = async () => {
      if (stopped || task.controller.signal.aborted) return;
      try {
        const response = await request(task, `/api/math-progress/${progressId}`);
        if (response.status === 200) setProgress(page, await responseJSON(response));
      } catch {
        // The actual math request owns the failure. Polling is advisory.
      }
    };
    const timer = setInterval(() => void poll(), 250);
    timer.unref?.();
    void poll();
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }

  async function requestMath(task, page) {
    const settings = task.settings;
    const query = new URLSearchParams({
      engine: settings.engine,
      page: String(page.number),
      language: settings.language,
      threads: String(settings.concurrency),
      pageLimit: String(settings.pageConcurrency),
    });
    const cacheResponse = await request(task, `/api/math-page?${query}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyForSettings(task, { cacheOnly: true })),
    });
    let response = cacheResponse;
    if (cacheResponse.status === 204) {
      const progressId = randomUUID();
      const stop = progressPoll(task, page, progressId);
      try {
        response = await request(task, `/api/math-page?${query}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyForSettings(task, { cacheOnly: false, progressId })),
        });
      } finally {
        stop();
      }
    }
    if (!response.ok) throw Error(await responseError(response));
    if (response.status === 204) return { kind: 'empty' };
    const path = join(task.tempDir, `page-${page.number}.pdf`);
    await writeResponseBody(response, path);
    const headers = {};
    for (const name of MATH_HEADERS) {
      const value = response.headers.get(name);
      if (value) headers[name] = value;
    }
    return { kind: 'math', path, headers };
  }

  async function layoutFor(task, number) {
    if (task.layoutCache.has(number)) return task.layoutCache.get(number);
    const active = task.layoutLoads.get(number);
    if (active) return active;
    const descriptor = descriptorFor(task, number);
    if (!descriptor) throw Error(`Layout for page ${number} is unavailable.`);
    const promise = requestJSON(task, '/api/layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId: task.documentId,
        page: descriptor.number,
        height: descriptor.height,
      }),
    }).then((result) => {
      if (!result || !Array.isArray(result.paragraphs)) throw Error('Invalid page layout.');
      const page = task.layoutPages[number - 1] || {
        number: descriptor.number,
        height: descriptor.height,
        blocks: [],
      };
      // The continuation resolver keeps page objects as weak keys. Fill the
      // existing placeholder so a neighbor loaded concurrently retains its
      // identity and any group references already handed to another page.
      Object.assign(page, {
        number: descriptor.number,
        height: descriptor.height,
        blocks: result.paragraphs.map((block) => ({ ...block })),
      });
      task.layoutCache.set(number, page);
      task.layoutPages[number - 1] = page;
      return page;
    });
    task.layoutLoads.set(number, promise);
    try {
      return await promise;
    } finally {
      if (task.layoutLoads.get(number) === promise) task.layoutLoads.delete(number);
    }
  }

  async function continuationFor(task) {
    if (task.continuation) return task.continuation;
    const { createParagraphContinuation } =
      await import('../../shared/translation/paragraph-continuation.mjs');
    task.continuation = createParagraphContinuation({
      context: () => ({
        epoch: task.continuationEpoch,
        enabled: task.settings.paragraphContinuationDetection === true,
        token: task.settings.jevApiToken || '',
      }),
      pages: () => task.layoutPages,
      ensureLayout: (page) => layoutFor(task, page.number),
      api: async (path, options = {}) => {
        const result = await requestJSON(task, path, options);
        return result || {};
      },
    });
    return task.continuation;
  }

  function memberKey(member) {
    return `${member?.page?.number}:${member?.block?.id}`;
  }

  function normalizeGroup(page, block, group) {
    const members = [],
      seen = new Set();
    for (const member of group?.members || [{ page, block }]) {
      if (!member?.page || !member?.block || seen.has(memberKey(member))) continue;
      seen.add(memberKey(member));
      members.push(member);
    }
    if (!members.length) members.push({ page, block });
    return {
      id: String(group?.id || `${page.number}:${block.id}`),
      members,
      text: String(group?.text || block.text || ''),
    };
  }

  function assignGroupSourceMetadata(group) {
    const sourceParts = group.members.map((member) => String(member.block.text || '').trim());
    const sourceText = sourceParts.join(' ');
    let offset = 0;
    group.members.forEach((member, index) => {
      const block = member.block;
      block.paragraphGroupId = group.id;
      block.paragraphIndex = index;
      block.paragraphText = group.text;
      block.paragraphTranslation = '';
      block.paragraphDisplayTranslation = '';
      block.paragraphDisplayOffset = 0;
      block.paragraphSourceText = sourceText;
      block.paragraphSourceOffset = offset;
      offset += sourceParts[index].length + 1;
    });
  }

  async function translateText(task, group) {
    const settings = task.settings;
    const requestTranslation = (cacheOnly) =>
      request(task, '/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          bodyForSettings(task, {
            cacheOnly,
            text: group.text,
            language: settings.language,
            concurrency: settings.concurrency,
          }),
        ),
      });
    let response = await requestTranslation(true);
    if (response.status === 204) response = await requestTranslation(false);
    if (!response.ok) throw Error(await responseError(response));
    const result = await responseJSON(response);
    if (typeof result?.translation !== 'string' || !result.translation.trim())
      throw Error('Empty translation.');
    return result;
  }

  async function requestInspector(task, page) {
    const layout = await layoutFor(task, page.number);
    const continuation = await continuationFor(task);
    const groups = new Map();
    await Promise.all(
      layout.blocks.map(async (block) => {
        const group = normalizeGroup(layout, block, await continuation.groupFor(layout, block));
        if (!groups.has(group.id)) groups.set(group.id, group);
      }),
    );
    const failures = [];
    await mapLimit([...groups.values()], task.settings.concurrency, async (group) => {
      if (task.controller.signal.aborted) throw abortError();
      try {
        await translateGroupOnce(task, group);
      } catch (error) {
        if (error?.name === 'AbortError') throw error;
        const message = safeError(error);
        failures.push(message);
        for (const member of group.members) {
          member.block.status = 'error';
          member.block.error = message;
        }
      }
    });
    if (failures.length) throw Error(failures[0]);
    const path = join(task.tempDir, `page-${page.number}.json`);
    await writeFile(path, JSON.stringify({ paragraphs: layout.blocks }));
    return { kind: 'inspector', path };
  }

  function translateGroupOnce(task, group) {
    const key = `${group.id}\0${group.text}`;
    const previous = task.groupTranslations.get(key);
    if (previous) return previous;
    const promise = (async () => {
      assignGroupSourceMetadata(group);
      const data = await translateText(task, group);
      const rawParts = splitParagraphTranslation(
        data.translation,
        group.members.map((member) => member.block),
      );
      const displayParts = rawParts.map((part) => paragraphDisplayText(part));
      const displayTranslation = displayParts.join('');
      let displayOffset = 0;
      group.members.forEach((member, index) => {
        const block = member.block;
        block.translation = rawParts[index] || ' ';
        block.cached = data.cached === true;
        block.translationModel = data.model || '';
        block.paragraphTranslation = data.translation;
        block.paragraphDisplayTranslation = displayTranslation;
        block.paragraphDisplayOffset = displayOffset;
        displayOffset += displayParts[index].length;
        block.status = 'ready';
        block.translated = true;
        block.error = '';
      });
      return data;
    })();
    task.groupTranslations.set(key, promise);
    return promise;
  }

  async function processPage(task, page) {
    const entry = documents.getEntry(task.documentId);
    if (!entry) throw statusError('Document unavailable.', 404);
    page.progress = { stage: 'Translating', percent: 0 };
    return task.settings.engine === 'pdf_inspector'
      ? requestInspector(task, page)
      : requestMath(task, page);
  }

  async function cleanupTaskFiles(task) {
    if (!task.tempDir) return;
    if (task.cleanupPromise) return task.cleanupPromise;
    if (task.filesCleaned) return;
    task.filesCleaned = true;
    task.cleanupPromise = rm(task.tempDir, { recursive: true, force: true }).catch(() => {});
    return task.cleanupPromise;
  }

  function taskSettled(task) {
    return Promise.all([task.done || Promise.resolve(), task.startPromise || Promise.resolve()]);
  }

  function retireTask(task) {
    if (!task || task.retired) return;
    task.retired = true;
    tasks.delete(task.id);
    if (byKey.get(task.key) === task) byKey.delete(task.key);
    retiredTasks.add(task);
    void taskSettled(task)
      .then(() => cleanupTaskFiles(task))
      .finally(() => retiredTasks.delete(task));
  }

  function finish(task) {
    if (task.running > 0 || [...task.pages.values()].some((page) => page.state === 'queued'))
      return;
    if (task.state === 'running') {
      const failed = [...task.pages.values()].some((page) => page.state === 'failed');
      task.state = failed ? 'failed' : 'complete';
    }
    task.finishedAt = Date.now();
    if (task.state === 'cancelled') {
      // Abort can race a worker's final write. Defer cleanup until all workers
      // and startup have settled so late writes cannot recreate the directory.
      void taskSettled(task).then(() => cleanupTaskFiles(task));
    }
    task.resolveDone?.();
  }

  function pump(task) {
    if (task.state !== 'running') {
      for (const page of task.pages.values()) if (page.state === 'queued') page.state = 'cancelled';
      finish(task);
      return;
    }
    if (!task.ready) return;
    while (task.running < task.settings.pageConcurrency) {
      const page = [...task.pages.values()].find((candidate) => candidate.state === 'queued');
      if (!page) break;
      page.state = 'running';
      page.progress = { stage: 'Queued', percent: 0 };
      task.running++;
      const work = processPage(task, page)
        .then((result) => {
          page.resultKind = result.kind;
          page.resultPath = result.path;
          page.resultHeaders = result.headers || {};
          page.progress = null;
          page.state = 'done';
        })
        .catch((error) => {
          page.progress = null;
          if (task.controller.signal.aborted || error?.name === 'AbortError') {
            page.state = 'cancelled';
            page.error = '';
          } else {
            page.state = 'failed';
            page.error = safeError(error);
          }
        })
        .finally(() => {
          task.running--;
          task.workers.delete(work);
          if (task.state === 'running') pump(task);
          else finish(task);
        });
      task.workers.add(work);
    }
    finish(task);
  }

  async function start(task) {
    try {
      await mkdir(tempRoot, { recursive: true });
      task.tempDir = await mkdtemp(join(resolve(tempRoot), `reader-task-${task.id}-`));
      if (task.controller.signal.aborted) {
        await cleanupTaskFiles(task);
        finish(task);
        return;
      }
      task.ready = true;
      pump(task);
    } catch (error) {
      task.state = 'failed';
      for (const page of task.pages.values()) {
        page.state = 'failed';
        page.error = safeError(error);
      }
      finish(task);
    }
  }

  function addPages(task, pages, layoutPages) {
    const existingNumbers = new Set(task.pages.keys());
    const existingLayoutNumbers = new Set(task.layoutDescriptors.keys());
    for (const descriptor of pages) {
      task.pageDescriptors.set(descriptor.number, descriptor);
      if (!task.pages.has(descriptor.number))
        task.pages.set(descriptor.number, {
          ...descriptor,
          state: 'queued',
          progress: null,
          error: '',
          resultKind: '',
          resultPath: '',
          resultHeaders: {},
        });
    }
    for (const descriptor of layoutPages) {
      task.layoutDescriptors.set(descriptor.number, descriptor);
      if (!task.layoutPages[descriptor.number - 1])
        task.layoutPages[descriptor.number - 1] = {
          number: descriptor.number,
          height: descriptor.height,
          blocks: [],
        };
    }
    // Requested pages are always valid layout neighbors, even when callers only supplied pages.
    for (const descriptor of pages) {
      if (!task.layoutDescriptors.has(descriptor.number))
        task.layoutDescriptors.set(descriptor.number, descriptor);
      if (!task.layoutPages[descriptor.number - 1])
        task.layoutPages[descriptor.number - 1] = {
          number: descriptor.number,
          height: descriptor.height,
          blocks: [],
        };
    }
    if (
      existingNumbers.size !== task.pages.size ||
      existingLayoutNumbers.size !== task.layoutDescriptors.size
    )
      task.continuationEpoch++;
    return existingNumbers.size !== task.pages.size;
  }

  function create(input) {
    if (closed) throw statusError('Reader task service is closed.', 503);
    if (!isObject(input)) throw statusError('Invalid reader task request.');
    const documentId = input.documentId;
    if (typeof documentId !== 'string' || !documents.getEntry(documentId))
      throw statusError('Document unavailable.', 404);
    const settings = validateSettings(input.settings);
    const pages = normalizePages(input.pages, 'pages', MAX_READER_TASK_PAGES);
    const layoutPages = normalizePages(
      input.layoutPages === undefined ? pages : input.layoutPages,
      'layoutPages',
      MAX_READER_LAYOUT_PAGES,
    );
    if (!pages.length) throw statusError('At least one page is required.');
    const key = canonicalKey(documentId, settings);
    const previous = byKey.get(key);
    if (previous && previous.state !== 'cancelled' && previous.state !== 'failed') {
      const added = addPages(previous, pages, layoutPages);
      if (added && previous.state === 'complete') {
        resetDone(previous);
        previous.state = 'running';
        previous.finishedAt = 0;
      }
      if (previous.state === 'running') pump(previous);
      return previous;
    }
    if (previous) {
      retireTask(previous);
    }
    if (tasks.size >= maxTasks) {
      const retired = [...tasks.values()]
        .filter((task) => task.state !== 'running' && task.running === 0 && task.finishedAt > 0)
        .sort((a, b) => a.finishedAt - b.finishedAt)[0];
      if (retired) retireTask(retired);
    }
    if (tasks.size >= maxTasks) throw statusError('Too many active reader tasks.', 429);
    const task = {
      id: randomUUID(),
      key,
      documentId,
      settings,
      state: 'running',
      ready: false,
      pages: new Map(),
      pageDescriptors: pageInputMap(pages),
      layoutDescriptors: pageInputMap(layoutPages),
      layoutCache: new Map(),
      layoutLoads: new Map(),
      layoutPages: [],
      groupTranslations: new Map(),
      continuation: null,
      continuationEpoch: 0,
      controller: new AbortController(),
      running: 0,
      workers: new Set(),
      tempDir: '',
      filesCleaned: false,
      cleanupPromise: null,
      finishedAt: 0,
      retired: false,
      done: null,
      resolveDone: null,
      startPromise: null,
    };
    resetDone(task);
    addPages(task, pages, layoutPages);
    for (const descriptor of task.layoutDescriptors.values())
      task.layoutPages[descriptor.number - 1] = {
        number: descriptor.number,
        height: descriptor.height,
        blocks: [],
      };
    tasks.set(task.id, task);
    byKey.set(key, task);
    task.startPromise = start(task);
    void task.startPromise;
    return task;
  }

  function get(id) {
    return tasks.get(id) || null;
  }

  function page(id, number) {
    const task = get(id);
    if (!task) return null;
    return task.pages.get(number) || null;
  }

  function cancel(id) {
    const task = get(id);
    if (!task) return false;
    if (task.state !== 'cancelled') task.state = 'cancelled';
    task.controller.abort();
    for (const candidate of task.pages.values()) {
      if (candidate.state === 'queued') candidate.state = 'cancelled';
      candidate.progress = null;
    }
    finish(task);
    return true;
  }

  function cancelForDocument(documentId) {
    for (const task of [...tasks.values()]) {
      if (task.documentId !== documentId) continue;
      cancel(task.id);
      retireTask(task);
    }
  }

  async function close() {
    if (closed) return;
    closed = true;
    clearInterval(cleanupTimer);
    const tracked = new Set([...tasks.values(), ...retiredTasks]);
    for (const task of tasks.values()) cancel(task.id);
    let timeout;
    await Promise.race([
      Promise.allSettled([...tracked].map((task) => taskSettled(task))),
      new Promise((resolveDone) => {
        timeout = setTimeout(resolveDone, 5000);
        timeout.unref?.();
      }),
    ]);
    clearTimeout(timeout);
    await Promise.all(
      [...new Set([...tracked, ...tasks.values(), ...retiredTasks])].map((task) =>
        cleanupTaskFiles(task),
      ),
    );
    tasks.clear();
    byKey.clear();
    retiredTasks.clear();
  }

  return {
    active,
    cancel,
    cancelForDocument,
    close,
    create,
    get,
    page,
    status: taskStatus,
    tasks: () => [...tasks.values()].map(taskStatus),
  };
}
