import { reactive, markRaw } from 'vue';
import { paragraphDisplayText } from '../../../../shared/translation/spacing.mjs';

export const ULTRA_FAST_KERNEL = 'pdf_inspector';

// Wanted pages come first, then their neighbors, each ordered by distance to focus.
function priority(number, wanted, focus) {
  return (wanted.has(number) ? 0 : 100000) + Math.abs(number - focus);
}

function errorMessage(body, fallback) {
  return (body && (body.error || body.reason)) || fallback;
}

/**
 * One side of the translation comparison. Each lane owns its queue, its abort
 * controller and its results, so the two sides never wait for each other; the
 * shared server limits are respected by sending the user's own parallelism.
 */
export function createCompareLane({
  config,
  documentId,
  getDocument,
  layoutFor,
  limits,
  fetcher = (...args) => globalThis.fetch(...args),
  progressInterval = 400,
}) {
  const controller = new AbortController();
  const pages = reactive({});
  const queue = [];
  const running = { page: 0, paragraph: 0 };
  let wanted = new Set();
  let focus = 1;
  let disposed = false;

  const paragraphMode = config.kernel === ULTRA_FAST_KERNEL;

  function entry(number) {
    if (!pages[number])
      pages[number] = {
        status: 'idle',
        activity: '',
        blocks: [],
        document: null,
        message: '',
        cached: false,
        model: '',
        progress: null,
      };
    return pages[number];
  }

  function near(number) {
    return wanted.has(number) || wanted.has(number - 1) || wanted.has(number + 1);
  }

  function limitFor(kind) {
    const value = Number(kind === 'page' ? limits.pages() : limits.paragraphs());
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  function pump() {
    if (disposed) return;
    queue.sort((a, b) => priority(a.page, wanted, focus) - priority(b.page, wanted, focus));
    for (let index = 0; index < queue.length;) {
      const job = queue[index];
      if (running[job.kind] >= limitFor(job.kind)) {
        index++;
        continue;
      }
      queue.splice(index, 1);
      running[job.kind]++;
      void job.run().finally(() => {
        running[job.kind]--;
        pump();
      });
    }
  }

  function enqueue(kind, page, run, drop) {
    queue.push({ kind, page, run, drop });
  }

  function aborted(error) {
    return disposed || error?.name === 'AbortError';
  }

  async function postJSON(url, body) {
    return fetcher(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  }

  async function translateParagraph(page, block) {
    if (disposed) return;
    block.status = 'working';
    block.activity = 'cache';
    page.status = 'working';
    try {
      const request = (cacheOnly) =>
        postJSON('/api/translate', {
          cacheOnly,
          documentId,
          text: block.text,
          glossary: config.glossary,
          language: config.language,
          sourceLanguage: config.sourceLanguage,
          reuseTranslations: config.reuseTranslations,
          forceRetranslation: false,
          concurrency: limits.paragraphs(),
          translationService: config.service,
        });
      let response = await request(true);
      if (disposed) return;
      if (response.status === 204) {
        block.activity = 'translating';
        response = await request(false);
        if (disposed) return;
      }
      const body = await response.json().catch(() => null);
      if (!response.ok) throw Error(errorMessage(body, 'Translation failed.'));
      if (typeof body?.translation !== 'string' || !body.translation.trim())
        throw Error('Empty translation');
      block.translation = paragraphDisplayText(body.translation);
      block.cached = body.cached === true;
      page.model = body.model || page.model;
      block.status = 'ready';
      block.message = '';
    } catch (error) {
      if (disposed) return;
      block.status = aborted(error) ? 'idle' : 'error';
      block.message = aborted(error) ? '' : error.message;
    } finally {
      block.activity = '';
      if (!disposed) settleParagraphPage(page);
    }
  }

  function settleParagraphPage(page) {
    if (page.status === 'idle' || page.status === 'queued') return;
    const blocks = page.blocks;
    if (blocks.some((block) => block.status === 'queued' || block.status === 'working')) {
      page.status = 'working';
      return;
    }
    const failed = blocks.find((block) => block.status === 'error');
    if (failed) {
      page.status = 'error';
      page.message = failed.message;
      return;
    }
    if (blocks.some((block) => block.status === 'idle')) {
      page.status = 'partial';
      return;
    }
    page.status = 'ready';
    page.message = '';
    page.cached = blocks.length > 0 && blocks.every((block) => block.cached);
  }

  function scheduleParagraphs(number, page) {
    for (const block of page.blocks) {
      if (block.status !== 'idle') continue;
      block.status = 'queued';
      enqueue(
        'paragraph',
        number,
        () => translateParagraph(page, block),
        () => {
          block.status = 'idle';
          settleParagraphPage(page);
        },
      );
    }
    settleParagraphPage(page);
  }

  async function loadParagraphPage(number, page) {
    if (disposed) return;
    page.status = 'working';
    page.activity = 'layout';
    try {
      const paragraphs = await layoutFor(number);
      if (disposed) return;
      page.blocks = paragraphs
        .filter((paragraph) => typeof paragraph.text === 'string' && paragraph.text.trim())
        .map((paragraph) =>
          reactive({
            id: paragraph.id,
            x: paragraph.x,
            y: paragraph.y,
            width: paragraph.width,
            height: paragraph.height,
            fontSize: paragraph.fontSize,
            bold: paragraph.bold === true,
            textAlign: paragraph.textAlign,
            text: paragraph.text,
            translation: '',
            status: 'idle',
            activity: '',
            cached: false,
            message: '',
          }),
        );
      page.activity = '';
      page.status = 'working';
      scheduleParagraphs(number, page);
    } catch (error) {
      if (disposed) return;
      page.activity = '';
      page.status = aborted(error) ? 'idle' : 'error';
      page.message = aborted(error) ? '' : error.message;
    }
  }

  async function loadMathPage(number, page) {
    if (disposed) return;
    page.status = 'working';
    page.activity = 'cache';
    const progressId = crypto.randomUUID();
    let timer;
    try {
      const request = (cacheOnly) =>
        fetcher(
          '/api/math-page?' +
            new URLSearchParams({
              engine: config.kernel,
              page: number,
              language: config.language,
              threads: limits.paragraphs(),
              pageLimit: limits.pages(),
            }),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cacheOnly,
              ...(cacheOnly ? {} : { progressId }),
              documentId,
              sourceLanguage: config.sourceLanguage,
              reuseTranslations: config.reuseTranslations,
              remoteKernel: config.remoteKernel,
              forceRetranslation: false,
              paragraphContinuationDetection: config.paragraphContinuationDetection,
              jevApiToken: config.jevApiToken,
              glossary: config.glossary,
              advancedOptions: config.advancedOptions,
              translationService: config.service,
            }),
            signal: controller.signal,
          },
        );
      let response = await request(true);
      if (disposed) return;
      if (response.status === 204) {
        page.activity = 'translating';
        let polling = false;
        timer = setInterval(async () => {
          if (polling || disposed) return;
          polling = true;
          try {
            const result = await fetcher('/api/math-progress/' + progressId, {
              signal: controller.signal,
            });
            if (result.ok && result.status !== 204 && page.status === 'working')
              page.progress = await result.json();
          } catch {
          } finally {
            polling = false;
          }
        }, progressInterval);
        response = await request(false);
        if (disposed) return;
      }
      if (!response.ok)
        throw Error(
          errorMessage(await response.json().catch(() => null), 'Page translation failed.'),
        );
      page.cached = response.headers.get('X-Translation-Cache') === 'hit';
      page.model = response.headers.get('X-Translation-Model') || '';
      const data = await response.arrayBuffer();
      if (disposed) return;
      const document = await getDocument({ data }).promise;
      if (disposed) {
        document.loadingTask?.destroy();
        return;
      }
      page.document = markRaw(document);
      page.status = 'ready';
      page.message = '';
    } catch (error) {
      if (disposed) return;
      page.status = aborted(error) ? 'idle' : 'error';
      page.message = aborted(error) ? '' : error.message;
    } finally {
      clearInterval(timer);
      page.progress = null;
      if (!disposed) page.activity = '';
    }
  }

  function schedulePage(number) {
    const page = entry(number);
    if (page.status === 'idle') {
      page.status = 'queued';
      enqueue(
        'page',
        number,
        () => (paragraphMode ? loadParagraphPage : loadMathPage)(number, page),
        () => {
          page.status = 'idle';
        },
      );
    } else if (paragraphMode && page.status === 'partial') scheduleParagraphs(number, page);
  }

  /**
   * Tells the lane which pages are on screen. Queued work for pages that scrolled
   * away is dropped (it is requeued when they return); running requests finish.
   */
  function want(numbers, focusPage = numbers[0]) {
    if (disposed) return;
    wanted = new Set(numbers.filter((number) => Number.isInteger(number) && number > 0));
    if (Number.isInteger(focusPage)) focus = focusPage;
    for (let index = queue.length - 1; index >= 0; index--)
      if (!near(queue[index].page)) queue.splice(index, 1)[0].drop();
    for (const number of wanted) {
      schedulePage(number);
      if (wanted.size <= 4) {
        if (number > 1) schedulePage(number - 1);
        if (!limits.pageCount || number < limits.pageCount()) schedulePage(number + 1);
      }
    }
    pump();
  }

  function retry(number) {
    const page = pages[number];
    if (!page || disposed) return;
    if (page.status === 'error' && !page.blocks.length) {
      page.status = 'idle';
      page.message = '';
    } else
      for (const block of page.blocks)
        if (block.status === 'error') {
          block.status = 'idle';
          block.message = '';
        }
    if (paragraphMode && page.blocks.length) {
      page.status = 'partial';
      page.message = '';
    }
    want([...new Set([...wanted, number])], number);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    queue.length = 0;
    controller.abort();
    for (const page of Object.values(pages)) {
      page.document?.loadingTask?.destroy();
      page.document = null;
    }
  }

  return {
    config,
    pages,
    paragraphMode,
    want,
    retry,
    dispose,
    get disposed() {
      return disposed;
    },
    get pending() {
      return queue.length + running.page + running.paragraph;
    },
  };
}
