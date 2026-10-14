import { createDocumentLanguageGuard } from './document-language-guard.mjs';
import { createParagraphContinuation } from './paragraph-continuation.mjs';
import { paragraphDisplayText } from '../../../shared/translation/spacing.mjs';
import { splitParagraphTranslation } from '../../../shared/translation/paragraph-fragments.mjs';
import { t } from '../../i18n/index.mjs';
import { reactive } from 'vue';

export function createTranslationQueue({
  session,
  preferences,
  translationState,
  activity,
  provider,
  view,
  actions,
  paragraphContinuation,
  watermarkRemoval,
}) {
  const allowAutomaticTranslation = createDocumentLanguageGuard({
    session,
    preferences,
    api: (...args) => actions.backendRequests.api(...args),
  });
  // A speculative paragraph-neighbor lookup must share the normal page load,
  // while remaining independent of page scheduling. Weak keys also prevent a
  // closed document from retaining its page objects.
  let layoutLoads = new WeakMap();
  const groupJobs = new Map();
  let groupGeneration = 0;
  let internalParagraphContinuation;

  function continuationService() {
    return paragraphContinuation || actions.paragraphContinuation || internalParagraphContinuation;
  }

  function pageBlocks(page) {
    return Array.isArray(page?.blocks) ? page.blocks : [];
  }

  function createBlocks(paragraphs) {
    return (Array.isArray(paragraphs) ? paragraphs : []).map((block) =>
      reactive({
        ...block,
        status: 'idle',
        translation: '',
        translated: view.showTranslations.value,
        cached: false,
        error: '',
      }),
    );
  }

  // Leaves out the paragraphs that only hold the text of a removed watermark, so they are
  // neither covered by a translation nor sent to be translated.
  async function withoutWatermarks(page, result) {
    if (!watermarkRemoval?.enabled() || !Array.isArray(result?.paragraphs)) return result;
    try {
      const hidden = await watermarkRemoval.hiddenText(await session.pdf.getPage(page.number));
      if (!hidden) return result;
      return { ...result, paragraphs: result.paragraphs.filter((p) => !hidden.matches(p.text)) };
    } catch {
      return result;
    }
  }

  function applyLayout(page, result, token, markReady) {
    if (token !== session.epoch) return false;
    // A concurrent request may have populated this page while the layout
    // request was in flight. Keep that object and its block identities.
    if (pageBlocks(page).length || page.status === 'ready') {
      if (markReady && page.status === 'detecting') page.status = 'ready';
      return true;
    }
    page.cached = false;
    page.translationModel = '';
    page.blocks = createBlocks(result?.paragraphs);
    if (markReady) page.status = 'ready';
    if (!page.blocks.length) page.message = t('pageStatus.noReadableText');
    else page.message = '';
    return true;
  }

  /**
   * Load one page's layout without scheduling translations for it. The
   * paragraph continuation resolver uses this for a neighboring page; the
   * normal page path passes markReady so its queued page becomes ready.
   */
  async function ensureLayout(
    page,
    { token = session.epoch, manual = false, markReady = false } = {},
  ) {
    if (!page || token !== session.epoch) return false;
    if (pageBlocks(page).length || page.status === 'ready') return true;
    const active = layoutLoads.get(page);
    if (active?.epoch === token) {
      if (markReady && page.status === 'queued') page.status = 'detecting';
      await active.promise;
      return token === session.epoch;
    }
    if (markReady) page.status = 'detecting';
    const promise = (async () => {
      const result = await actions.backendRequests.api('/api/layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        translationJob: { page: page.number, manual },
        body: JSON.stringify({
          documentId: session.documentId,
          page: page.number,
          height: page.height,
        }),
      });
      applyLayout(page, await withoutWatermarks(page, result), token, markReady);
      return result;
    })();
    layoutLoads.set(page, { epoch: token, promise });
    try {
      await promise;
      return token === session.epoch;
    } finally {
      const current = layoutLoads.get(page);
      if (current?.promise === promise) layoutLoads.delete(page);
      if (token === session.epoch && markReady && page.status === 'detecting')
        page.status = 'ready';
    }
  }

  internalParagraphContinuation = createParagraphContinuation({
    context: () => ({
      epoch: session.epoch,
      enabled:
        preferences.engine.value === 'pdf_inspector' &&
        preferences.paragraphContinuationDetection?.value === true,
      token: preferences.jevApiToken?.value || '',
    }),
    pages: () => session.pages.value,
    // Scope pruning should not abort a bounded speculative layout lookup just
    // because its page is outside the current viewport. It never enqueues that
    // page's ordinary translation work; epoch cancellation still aborts it.
    ensureLayout: (page) =>
      ensureLayout(page, { token: session.epoch, manual: true, markReady: false }),
    api: (...args) => actions.backendRequests.api(...args),
  });

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

  function clearParagraphMetadata(block) {
    delete block.paragraphGroupId;
    delete block.paragraphIndex;
    delete block.paragraphText;
    delete block.paragraphTranslation;
    delete block.paragraphDisplayTranslation;
    delete block.paragraphDisplayOffset;
    delete block.paragraphSourceText;
    delete block.paragraphSourceOffset;
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

  function resetMembers(members, status, error = '') {
    for (const member of members || []) {
      const block = member.block;
      if (!block) continue;
      block.status = status;
      block.error = error;
      if (status === 'idle') block.translationActivity = '';
    }
  }

  function pagesForMembers(members) {
    const pages = [],
      seen = new Set();
    for (const member of members || []) {
      const page = member.page;
      if (!page || seen.has(page.number)) continue;
      seen.add(page.number);
      pages.push(page);
    }
    return pages;
  }

  function updatePageMetadata(members) {
    for (const page of pagesForMembers(members)) {
      const blocks = pageBlocks(page);
      page.cached =
        blocks.length > 0 && blocks.every((block) => block.translation && block.cached === true);
      page.translationModel =
        blocks
          .map((block) => block.translationModel)
          .filter(Boolean)
          .at(-1) || '';
    }
  }

  function freshGroupJob(job) {
    return job.token === session.epoch && job.generation === groupGeneration && !job.invalidated;
  }

  function onGroupPruned(job) {
    job.invalidated = true;
    groupJobs.delete(job.key);
    resetMembers(job.members, 'idle');
  }

  function enqueueSingle(block, page, token, language, sourceLanguage, manual) {
    if (block.translation || ['queued', 'translating'].includes(block.status)) return;
    clearParagraphMetadata(block);
    block.status = 'queued';
    translationState.queue.push({
      block,
      token,
      language,
      sourceLanguage,
      page: page.number,
      pages: [page.number],
      manual,
    });
  }

  function enqueueGroup(group, token, language, sourceLanguage, manual) {
    const members = group.members.filter((member) => member.page && member.block);
    if (members.length <= 1) {
      if (members[0])
        enqueueSingle(members[0].block, members[0].page, token, language, sourceLanguage, manual);
      return;
    }
    if (!translationState.forceRetranslation && members.every((member) => member.block.translation))
      return;
    const key = `${token}:${group.id}`;
    if (groupJobs.has(key)) return;
    const pages = [...new Set(members.map((member) => member.page.number))];
    const job = {
      group,
      members,
      key,
      token,
      generation: groupGeneration,
      language,
      sourceLanguage,
      page: Math.min(...pages),
      pages,
      manual,
      onPruned: () => onGroupPruned(job),
    };
    groupJobs.set(key, job);
    // Source/group metadata must exist before the request starts so topic
    // sentence and native-PDF layers have a stable full-paragraph context.
    assignGroupSourceMetadata(group);
    for (const member of members) {
      member.block.status = 'queued';
      member.block.error = '';
    }
    translationState.queue.push(job);
  }

  function translateAllDocumentPages() {
    if (!session.pages.value.length) return;
    translationState.translateAllPages = true;
    translationState.translationDeferred.value = false;
    for (const page of session.pages.value) {
      if (page.status === 'error') {
        page.status =
          preferences.engine.value === 'pdf_inspector' && pageBlocks(page).length
            ? 'ready'
            : 'idle';
        page.message = '';
      }
      for (const block of pageBlocks(page)) {
        if (block.status !== 'error' || block.translation) continue;
        block.status = 'idle';
        block.error = '';
      }
    }
    return schedulePages();
  }

  async function schedulePages() {
    const epoch = session.epoch;
    if (
      !translationState.translateAllPages &&
      !translationState.forceRetranslation &&
      !(await allowAutomaticTranslation())
    )
      return;
    if (epoch !== session.epoch) return;
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
    if (
      !activity.foreground.value &&
      preferences.translationMode.value !== 'full' &&
      !translationState.translateAllPages
    )
      return;
    while (
      translationState.pageRunning < preferences.pageConcurrency.value &&
      translationState.pageQueue.length
    ) {
      const job = translationState.pageQueue.shift();
      if (job.token !== session.epoch) continue;
      translationState.pageRunning++;
      processPage(job.p, translationState.translateAllPages === true).finally(() => {
        translationState.pageRunning--;
        if (job.token === session.epoch) schedulePages();
        else pumpPages();
      });
    }
  }

  async function processPage(p, manual = false) {
    if (!p || p.status === 'detecting') return;
    const token = session.epoch;
    if (!manual && !translationState.forceRetranslation && !(await allowAutomaticTranslation())) {
      if (token === session.epoch && p.status === 'queued')
        p.status = p.blocks.length ? 'ready' : 'idle';
      return;
    }
    if (token !== session.epoch) return;
    if (preferences.engine.value !== 'pdf_inspector')
      return actions.mathTranslation.mathPage(p, token, manual);
    try {
      await ensureLayout(p, { token, manual, markReady: true });
    } catch (e) {
      if (token === session.epoch) {
        p.status = e.name === 'AbortError' ? 'idle' : 'error';
        p.message = e.name === 'AbortError' ? '' : e.message;
        if (e.name !== 'AbortError') actions.kernelSettings.reportKernelFailure?.(e.message);
      }
      return;
    }
    if (token !== session.epoch) return;
    p.status = 'ready';
    const scoped = actions.translationScope.scopePages
      ? actions.translationScope.scopePages().has(p.number)
      : true;
    if (!manual && !scoped) return;
    const service = continuationService();
    const enqueueResolved = (block, rawGroup) => {
      if (token !== session.epoch) return;
      const group = normalizeGroup(p, block, rawGroup);
      if (group.members.length > 1)
        enqueueGroup(
          group,
          token,
          preferences.language.value,
          preferences.sourceLanguage.value,
          manual,
        );
      else
        enqueueSingle(
          block,
          p,
          token,
          preferences.language.value,
          preferences.sourceLanguage.value,
          manual,
        );
      actions.translationScope.pruneTranslationQueue();
      pump();
    };
    if (service?.groupFor) {
      // Do not make an unrelated paragraph wait for a slow boundary request.
      // groupJobs still deduplicates the same logical group when its members'
      // independent promises resolve in different orders.
      await Promise.all(
        p.blocks.map(async (block) => {
          let group;
          try {
            group = await service.groupFor(p, block);
          } catch {
            group = null;
          }
          enqueueResolved(block, group);
        }),
      );
    } else {
      for (const block of p.blocks)
        enqueueResolved(block, {
          id: `${p.number}:${block.id}`,
          members: [{ page: p, block }],
          text: block.text,
        });
    }
  }

  function pump() {
    if (
      !activity.foreground.value &&
      preferences.translationMode.value !== 'full' &&
      !translationState.translateAllPages
    )
      return;
    while (
      translationState.running < Number(preferences.concurrency.value) &&
      translationState.queue.length
    ) {
      const job = translationState.queue.shift();
      if (job.token !== session.epoch) {
        if (job.group) {
          groupJobs.delete(job.key);
          resetMembers(job.members, 'idle');
        }
        continue;
      }
      translationState.running++;
      translate(job).finally(() => {
        translationState.running--;
        if (job.group) groupJobs.delete(job.key);
        if (job.token === session.epoch) schedulePages();
        else pump();
      });
    }
  }

  async function requestTranslation(
    { text, page, pages, manual, token, target, source },
    onActivity,
  ) {
    const request = (cacheOnly) =>
      actions.backendRequests.api('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        translationJob: { page, pages, manual },
        body: JSON.stringify({
          cacheOnly,
          documentId: session.documentId,
          text,
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
    if (token !== session.epoch) return null;
    if (!data) {
      onActivity?.();
      data = await request(false);
    }
    if (token !== session.epoch) return null;
    return data;
  }

  async function translateGroup(job) {
    const members = job.members;
    for (const member of members) {
      member.block.translationActivity = 'cache';
      member.block.status = 'translating';
      member.block.error = '';
    }
    try {
      const data = await requestTranslation(
        {
          text: job.group.text,
          page: job.page,
          pages: job.pages,
          manual: job.manual,
          token: job.token,
          target: job.language,
          source: job.sourceLanguage,
        },
        () => members.forEach((member) => (member.block.translationActivity = 'translating')),
      );
      if (!data || !freshGroupJob(job)) return;
      if (typeof data.translation !== 'string' || !data.translation.trim())
        throw Error('Empty translation');
      const rawParts = splitParagraphTranslation(
        data.translation,
        members.map((member) => member.block),
      );
      const displayParts = rawParts.map((part) => paragraphDisplayText(part));
      const displayTranslation = displayParts.join('');
      let displayOffset = 0;
      members.forEach((member, index) => {
        const block = member.block;
        block.translation = rawParts[index] || ' ';
        block.cached = data.cached === true;
        block.translationModel = data.model || '';
        block.paragraphTranslation = data.translation;
        block.paragraphDisplayTranslation = displayTranslation;
        block.paragraphDisplayOffset = displayOffset;
        displayOffset += displayParts[index].length;
        block.status = 'ready';
        block.error = '';
      });
      updatePageMetadata(members);
    } catch (e) {
      if (freshGroupJob(job))
        resetMembers(
          members,
          e.name === 'AbortError' ? 'idle' : 'error',
          e.name === 'AbortError' ? '' : e.message,
        );
    }
  }

  async function translate({
    block: b,
    group,
    members,
    token,
    language: target,
    sourceLanguage: source,
    page,
    pages = [page],
    manual,
    key,
    generation,
    invalidated,
  }) {
    if (group)
      return translateGroup({
        group,
        members,
        token,
        language: target,
        sourceLanguage: source,
        page,
        pages,
        manual,
        key,
        generation,
        invalidated,
      });
    b.translationActivity = 'cache';
    b.status = 'translating';
    b.error = '';
    try {
      const data = await requestTranslation(
        { text: b.text, page, pages, manual, token, target, source },
        () => (b.translationActivity = 'translating'),
      );
      if (!data || token !== session.epoch) return;
      b.translation = data.translation;
      b.cached = data.cached === true;
      b.translationModel = data.model || '';
      b.status = 'ready';
      updatePageMetadata([{ page: session.pages.value[page - 1], block: b }]);
    } catch (e) {
      if (token === session.epoch) {
        b.status = e.name === 'AbortError' ? 'idle' : 'error';
        b.error = e.name === 'AbortError' ? '' : e.message;
      }
    }
  }

  function invalidateParagraphGroups() {
    groupGeneration++;
    continuationService()?.invalidate?.();
    for (let index = translationState.queue.length - 1; index >= 0; index--) {
      const job = translationState.queue[index];
      if (!job.group) continue;
      translationState.queue.splice(index, 1);
      onGroupPruned(job);
    }
    for (const job of groupJobs.values()) {
      job.invalidated = true;
      resetMembers(job.members, 'idle');
    }
    groupJobs.clear();
    layoutLoads = new WeakMap();
  }

  return {
    translateAllDocumentPages,
    schedulePages,
    pumpPages,
    processPage,
    pump,
    translate,
    ensureLayout,
    invalidateParagraphGroups,
  };
}
