import { t } from '../../i18n/index.mjs';
import { reactive } from 'vue';

export function createTranslationQueue({
  session,
  preferences,
  translationState,
  activity,
  kernel,
  feedback,
  provider,
  view,
  actions,
}) {
  function schedulePages() {
    actions.translationScope.pruneTranslationQueue();
    const candidates = actions.translationScope
      .readingTranslationPages()
      .map((n) => session.pages.value[n - 1]);
    for (const p of candidates)
      if (
        p.status === 'idle' ||
        (p.status === 'ready' &&
          preferences.engine.value === 'pdf_inspector' &&
          p.blocks.some((b) => b.status === 'idle' && !b.translation))
      ) {
        p.status = 'queued';
        translationState.pageQueue.push({ p, token: session.epoch });
      }
    actions.translationScope.pruneTranslationQueue();
    pumpPages();
    pump();
  }

  function pumpPages() {
    if (!activity.foreground.value && preferences.translationMode.value !== 'full') return;
    while (
      translationState.pageRunning < preferences.pageConcurrency.value &&
      translationState.pageQueue.length
    ) {
      const job = translationState.pageQueue.shift();
      if (job.token !== session.epoch) continue;
      translationState.pageRunning++;
      processPage(job.p).finally(() => {
        translationState.pageRunning--;
        if (job.token === session.epoch && kernel.engineState.value?.available) schedulePages();
        else pumpPages();
      });
    }
  }

  async function processPage(p, manual = false) {
    if (!p || p.status === 'detecting') return;
    if (!kernel.engineState.value?.available) {
      feedback.error.value =
        kernel.engineState.value?.reason || t('pageStatus.checkKernelAvailability');
      actions.kernelSettings.reportKernelFailure(feedback.error.value);
      return;
    }
    const token = session.epoch;
    if (preferences.engine.value !== 'pdf_inspector')
      return actions.mathTranslation.mathPage(p, token, manual);
    if (!p.blocks.length && p.status !== 'ready') {
      p.status = 'detecting';
      try {
        const result = await actions.backendRequests.api('/api/layout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          translationJob: { page: p.number, manual },
          body: JSON.stringify({
            documentId: session.documentId,
            page: p.number,
            height: p.height,
          }),
        });
        if (token !== session.epoch) return;
        p.cached = false;
        p.translationModel = '';
        p.blocks = result.paragraphs.map((b) =>
          reactive({
            ...b,
            status: 'idle',
            translation: '',
            translated: view.showTranslations.value,
            cached: false,
            error: '',
          }),
        );
        p.status = 'ready';
        if (!p.blocks.length) p.message = t('pageStatus.noReadableText');
      } catch (e) {
        if (token === session.epoch) {
          p.status = e.name === 'AbortError' ? 'idle' : 'error';
          p.message = e.name === 'AbortError' ? '' : e.message;
          if (e.name !== 'AbortError') actions.kernelSettings.reportKernelFailure(e.message);
        }
        return;
      }
    }
    if (token !== session.epoch) return;
    p.status = 'ready';
    if (!manual && !actions.translationScope.scopePages().has(p.number)) return;
    for (const b of p.blocks)
      if (!b.translation && !['queued', 'translating'].includes(b.status)) {
        b.status = 'queued';
        translationState.queue.push({
          block: b,
          token,
          language: preferences.language.value,
          sourceLanguage: preferences.sourceLanguage.value,
          page: p.number,
          manual,
        });
      }
    actions.translationScope.pruneTranslationQueue();
    pump();
  }

  function pump() {
    if (!activity.foreground.value && preferences.translationMode.value !== 'full') return;
    while (
      translationState.running < Number(preferences.concurrency.value) &&
      translationState.queue.length
    ) {
      const job = translationState.queue.shift();
      if (job.token !== session.epoch) continue;
      translationState.running++;
      translate(job).finally(() => {
        translationState.running--;
        if (job.token === session.epoch && kernel.engineState.value?.available) schedulePages();
        else pump();
      });
    }
  }

  async function translate({
    block: b,
    token,
    language: target,
    sourceLanguage: source,
    page,
    manual,
  }) {
    b.translationActivity = 'cache';
    b.status = 'translating';
    b.error = '';
    try {
      const request = (cacheOnly) =>
        actions.backendRequests.api('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          translationJob: { page, manual },
          body: JSON.stringify({
            cacheOnly,
            documentId: session.documentId,
            text: b.text,
            glossary: provider.activeGlossary.value,
            language: target,
            sourceLanguage: source,
            reuseTranslations: preferences.reuseTranslations.value,
            forceRetranslation: translationState.forceRetranslation,
            concurrency: preferences.concurrency.value,
            translationService: provider.currentTranslationService.value,
          }),
        });
      let data = await request(true);
      if (token !== session.epoch) return;
      if (!data) {
        b.translationActivity = 'translating';
        data = await request(false);
      }
      if (token !== session.epoch) return;
      b.translation = data.translation;
      b.cached = data.cached === true;
      b.translationModel = data.model || '';
      b.status = 'ready';
      const owner = session.pages.value[page - 1];
      if (owner) {
        owner.cached =
          owner.blocks.length > 0 &&
          owner.blocks.every((block) => block.translation && block.cached === true);
        owner.translationModel =
          owner.blocks
            .map((block) => block.translationModel)
            .filter(Boolean)
            .at(-1) || '';
      }
    } catch (e) {
      if (token === session.epoch) {
        b.status = e.name === 'AbortError' ? 'idle' : 'error';
        b.error = e.name === 'AbortError' ? '' : e.message;
      }
    }
  }
  return { schedulePages, pumpPages, processPage, pump, translate };
}
