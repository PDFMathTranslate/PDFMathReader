import { t } from '../../i18n/index.mjs';
import { reactive, markRaw } from 'vue';
import { restoreFormulaPlaceholders } from './formula-placeholders.mjs';

export function createMathTranslation({
  translationState,
  preferences,
  session,
  feedback,
  provider,
  search,
  shell,
  actions,
}) {
  async function mathPage(p, token, manual = false) {
    feedback.error.value = '';
    p.translationActivity = 'cache';
    p.status = 'detecting';
    p.message = t('pageStatus.loadingTranslationPage');
    try {
      const controller = new AbortController();
      translationState.controllers.add(controller);
      translationState.translationRequests.set(controller, { page: p.number, manual });
      let response;
      const historyRequest = provider.historyTracker.begin({
        kernel: preferences.engine.value,
        service: provider.currentTranslationService.value.id || 'auto',
        epoch: token,
      });
      try {
        const request = (cacheOnly) =>
          fetch(
            '/api/math-page?' +
              new URLSearchParams({
                engine: preferences.engine.value,
                page: p.number,
                language: preferences.language.value,
                threads: preferences.concurrency.value,
                pageLimit: preferences.pageConcurrency.value,
              }),
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                cacheOnly,
                documentId: session.documentId,
                sourceLanguage: preferences.sourceLanguage.value,
                reuseTranslations: preferences.reuseTranslations.value,
                forceRetranslation: translationState.forceRetranslation,
                glossary: provider.activeGlossary.value,
                advancedOptions: actions.preferencePersistence.currentKernelAdvancedOptions(),
                translationService: provider.currentTranslationService.value,
              }),
              signal: controller.signal,
            },
          );
        response = await request(true);
        if (token !== session.epoch) return;
        if (response.status === 204) {
          p.translationActivity = 'translating';
          response = await request(false);
        }
        actions.rootActions.noteTranslationService(response);
        actions.translationHistory.recordServiceOutcome(
          response,
          historyRequest,
          controller.signal,
        );
        if (!response.ok) throw Error((await response.json()).error);
        const cacheHit = response.headers.get('X-Translation-Cache') === 'hit',
          translationModel = response.headers.get('X-Translation-Model') || '';
        const data = await response.arrayBuffer();
        const layout = await actions.backendRequests.api(
          '/api/math-layout/' + response.headers.get('X-Layout-Key'),
        );
        if (token !== session.epoch) return;
        p.cached = cacheHit;
        p.translationModel = translationModel;
        p.blocks = layout.paragraphs.map((b) =>
          reactive({
            ...restoreFormulaPlaceholders(b),
            math: true,
            status: 'ready',
            translated: true,
            cached: cacheHit,
            translationModel,
            error: '',
          }),
        );
        p.mathDocument = markRaw(await session.getDocument({ data }).promise);
      } finally {
        translationState.controllers.delete(controller);
        translationState.translationRequests.delete(controller);
      }
      if (token !== session.epoch) {
        p.mathDocument?.loadingTask.destroy();
        return;
      }
      p.status = 'ready';
      p.message = '';
      actions.readerPreview.queuePreview(p);
    } catch (e) {
      if (token === session.epoch) {
        p.status = e.name === 'AbortError' ? 'idle' : 'error';
        p.message = e.name === 'AbortError' ? '' : e.message;
        if (e.name !== 'AbortError') {
          feedback.error.value = e.message;
          actions.kernelSettings.reportKernelFailure(e.message);
        }
      }
    }
  }

  function resetTranslations(clearFrontendCache = false) {
    if (search.searchOpen.value) actions.rootActions.closeSearch();
    shell.selectedParagraph.value = null;
    actions.documentLifecycle.cancel();
    if (clearFrontendCache) actions.canvasRendering.resetBitmaps();
    for (const p of session.pages.value) {
      p.mathDocument?.loadingTask.destroy();
      p.mathDocument = null;
      p.blocks = [];
      p.cached = false;
      p.translationModel = '';
      p.status = 'idle';
      p.message = '';
    }
    actions.canvasRendering.renderPages();
  }
  return { mathPage, resetTranslations };
}
