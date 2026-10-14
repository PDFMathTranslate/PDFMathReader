import { visibleReaderWindow } from '../reader/reader-layout.mjs';
import { translationPages } from './scope-pages.mjs';

export function createTranslationScope({
  translationState,
  renderState,
  preferences,
  session,
  view,
}) {
  function readingTranslationPages() {
    if (translationState.translationDeferred.value) return [];
    const host = renderState.layoutElement.value,
      el = view.reader.value;
    let ahead = [];
    if (host && el) {
      const rect = host.getBoundingClientRect(),
        bounds = el.getBoundingClientRect(),
        horizontal = view.direction.value === 'horizontal';
      const dx = horizontal ? el.clientWidth * translationState.readingDirection : 0,
        dy = horizontal ? 0 : el.clientHeight * translationState.readingDirection;
      ahead = visibleReaderWindow(
        view.pageLayout.value,
        {
          left: bounds.left - rect.left + dx,
          right: bounds.right - rect.left + dx,
          top: bounds.top - rect.top + dy,
          bottom: bounds.bottom - rect.top + dy,
        },
        view.active.value,
        0,
      ).visible.map((item) => item.number);
    }
    return translationPages(
      translationState.translateAllPages ? 'full' : preferences.translationMode.value,
      view.active.value,
      session.pages.value.length,
      {
        visible: [...renderState.visiblePages],
        ahead,
        direction: translationState.readingDirection,
        moving: translationState.translationMoving,
      },
    );
  }

  function scopePages() {
    return new Set(readingTranslationPages());
  }

  function pruneTranslationQueue() {
    const order = readingTranslationPages(),
      allowed = new Set(order),
      rank = new Map(order.map((n, i) => [n, i]));
    const jobPages = (job) => {
      const pages = Array.isArray(job?.pages) && job.pages.length ? job.pages : [job?.page];
      return pages.filter((page) => Number.isInteger(page));
    };
    const jobRank = (job) =>
      jobPages(job).reduce((best, page) => Math.min(best, rank.get(page) ?? Infinity), Infinity);
    const retained = (job) => job.manual || jobPages(job).some((page) => allowed.has(page));
    for (const [controller, job] of translationState.translationRequests)
      if (!retained(job)) controller.abort();
    for (let i = translationState.pageQueue.length - 1; i >= 0; i--)
      if (!allowed.has(translationState.pageQueue[i].p.number)) {
        const { p } = translationState.pageQueue.splice(i, 1)[0];
        if (p.status === 'queued') p.status = p.blocks.length ? 'ready' : 'idle';
      }
    for (let i = translationState.queue.length - 1; i >= 0; i--)
      if (!retained(translationState.queue[i])) {
        const job = translationState.queue.splice(i, 1)[0];
        if (job.onPruned) job.onPruned();
        else if (job.block?.status === 'queued') job.block.status = 'idle';
      }
    translationState.pageQueue.sort((a, b) => rank.get(a.p.number) - rank.get(b.p.number));
    translationState.queue.sort(
      (a, b) => Number(b.manual) - Number(a.manual) || jobRank(a) - jobRank(b),
    );
  }
  return { readingTranslationPages, scopePages, pruneTranslationQueue };
}
