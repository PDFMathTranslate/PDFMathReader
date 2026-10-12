import { abortError, generateToc } from './toc-generator.mjs';
import { collectPageLines } from './toc-page-text.mjs';
import { tocGenerationLabel } from './toc-generation-labels.mjs';

export const IDLE_TOC_GENERATION = Object.freeze({ status: 'idle' });

// Generated entries carry `source`; bookmarks read from the PDF do not.
export const isGeneratedOutline = (outline) => outline.length > 0 && outline.every((i) => i.source);

export function createTocGeneration({ session, shell, view, preferences, actions }) {
  let controller = null;
  let timer = 0;
  const state = () => shell.tocGeneration;

  function reset() {
    controller?.abort();
    controller = null;
    clearTimeout(timer);
    state().value = IDLE_TOC_GENERATION;
  }

  function dismiss() {
    clearTimeout(timer);
    if (state().value.status === 'running') return;
    state().value = IDLE_TOC_GENERATION;
  }

  async function generate() {
    const pdf = session.pdf;
    if (!preferences.tocGenerationEnabled.value || !pdf || !session.pages.value.length) return;
    if (state().value.status === 'running') return;
    const existing = shell.documentOutline.value;
    if (existing.length && !isGeneratedOutline(existing)) {
      actions.rootActions.notifyCopy(tocGenerationLabel('exists'), 3500);
      return;
    }
    reset();
    const token = session.epoch;
    const run = (controller = new AbortController());
    const current = () => token === session.epoch && run === controller;
    state().value = { status: 'running', phase: 'toc-page', done: 0, total: pdf.numPages };
    if (!view.sidebar.value) actions.readerFit.toggleSidebar();
    shell.sidebarMode.value = 'outline';
    try {
      const result = await generateToc({
        numPages: pdf.numPages,
        signal: run.signal,
        getPageLines: (number) => collectPageLines(pdf, number),
        onProgress: ({ phase, done, total }) => {
          if (current()) state().value = { status: 'running', phase, done, total };
        },
      });
      if (!current()) return;
      if (!result.items.length) {
        state().value = { status: 'empty' };
        return;
      }
      shell.documentOutline.value = result.items;
      state().value = { status: 'done', source: result.source, count: result.items.length };
      timer = setTimeout(dismiss, 5000);
    } catch (error) {
      if (!current()) return;
      if (error?.name === abortError().name) state().value = IDLE_TOC_GENERATION;
      else state().value = { status: 'error' };
    } finally {
      if (run === controller && state().value.status !== 'running') controller = null;
    }
  }

  function cancel() {
    if (state().value.status === 'running') controller?.abort();
  }

  return {
    startTocGeneration: generate,
    cancelTocGeneration: cancel,
    dismissTocGeneration: dismiss,
    resetTocGeneration: reset,
  };
}
