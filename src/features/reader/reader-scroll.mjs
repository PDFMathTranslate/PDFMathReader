import { t } from '../../i18n/index.mjs';

export function createReaderScroll({
  renderState,
  session,
  motion,
  translationState,
  preferences,
  activity,
  feedback,
  view,
  actions,
}) {
  function showScrollbar(event) {
    const el = event?.currentTarget;
    if (!el) return;
    el.dataset.scrolling = 'true';
    clearTimeout(renderState.scrollbarTimers.get(el));
    renderState.scrollbarTimers.set(
      el,
      setTimeout(() => {
        delete el.dataset.scrolling;
        renderState.scrollbarTimers.delete(el);
      }, 800),
    );
  }

  function scrolling(event) {
    actions.rootActions.immersiveScroll();
    if (session.restoringView.value || motion.fitResizing) return;
    activity.performanceRecorder.scroll();
    const el = view.reader.value,
      now = performance.now(),
      position = view.direction.value === 'horizontal' ? el?.scrollLeft : el?.scrollTop,
      extent = view.direction.value === 'horizontal' ? el?.clientWidth : el?.clientHeight;
    if (translationState.lastTranslationScroll && position !== undefined) {
      const delta = position - translationState.lastTranslationScroll.position;
      if (Math.abs(delta) > 1) translationState.readingDirection = Math.sign(delta);
      translationState.translationMoving =
        Math.abs(delta) > extent * 0.6 ||
        Math.abs(delta) / Math.max(16, now - translationState.lastTranslationScroll.time) >
          extent / 700;
    }
    translationState.lastTranslationScroll = { position: position || 0, time: now };
    const viewport = actions.readerViewport.viewportPages();
    if (!motion.pinching.value) actions.translationQueue.schedulePages();
    actions.readerViewport.scheduleViewport(viewport);
    actions.readingPosition.scheduleReadingSave();
    showScrollbar(event);
    actions.readerPreview.interruptPreview();
    actions.readerInputs.showNavigator();
    feedback.reading.value = t('reading.scrolling');
    clearTimeout(translationState.timer);
    translationState.timer = setTimeout(() => {
      if (!motion.pinching.value) settle();
    }, 180);
  }

  function settle() {
    translationState.translationMoving = false;
    if (!activity.foreground.value && preferences.translationMode.value !== 'full') return;
    if (!renderState.previewScrolling && !motion.pinching.value) {
      for (const n of renderState.visiblePages) {
        const p = session.pages.value[n - 1];
        if (p) renderState.pendingPreview.set(n, p);
      }
      actions.readerPreview.flushPreview();
    }
    if (!activity.foreground.value && preferences.translationMode.value !== 'full') return;
    const p = session.pages.value[view.active.value - 1];
    if (!p) return;
    feedback.reading.value = t('reading.readingPage', { page: p.number });
    p.dwell++;
    actions.translationQueue.schedulePages();
  }
  return { showScrollbar, scrolling, settle };
}
