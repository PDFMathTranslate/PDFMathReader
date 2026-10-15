import { t } from '../../i18n/index.mjs';

export function createReaderActivity({
  session,
  preferences,
  translationState,
  renderState,
  activity,
  feedback,
  runtime,
  actions,
}) {
  let lastForeground;
  function updateSessionTimer() {
    clearInterval(session.sessionTimer);
    if (activity.foreground.value)
      session.sessionTimer = setInterval(() => {
        if (!session.loading.value && !session.restoringView.value) {
          const view = actions.readingPosition.readingView();
          if (view)
            void window.previewDocuments?.saveView(view).catch(() => {
              feedback.error.value = t('error.saveReadingPosition');
            });
        }
      }, 60000);
  }

  function updateForeground() {
    const value =
      !preferences.reduceResourceUsage.value ||
      (activity.activityActive.value && !actions.rootActions.pageHidden());
    // Native blur/hide and DOM visibility events often describe the same
    // transition. Do not restart the eviction deadline or resume work twice.
    if (lastForeground === value) return;
    lastForeground = value;
    clearTimeout(runtime.resourceReleaseTimer);
    runtime.resourceReleaseTimer = undefined;
    activity.foreground.value = value;
    activity.performanceRecorder.setActive(value);
    updateSessionTimer();
    window.previewActivityActive = value;
    if (!value) {
      actions.readerFit.cancelResize();
      void actions.readingPosition.saveReadingView();
      clearTimeout(translationState.timer);
      cancelAnimationFrame(renderState.viewportFrame);
      renderState.viewportFrame = 0;
      renderState.scheduledViewport = null;
      clearTimeout(renderState.previewTimer);
      renderState.previewScrolling = false;
      actions.canvasRendering.suspendRendering();
      feedback.reading.value = t('reading.paused');
      actions.rootActions.stopRecentPreviews();
      runtime.resourceReleaseTimer = setTimeout(() => {
        runtime.resourceReleaseTimer = undefined;
        if (!activity.foreground.value && preferences.reduceResourceUsage.value)
          actions.canvasRendering.resetBitmaps();
      }, 1000);
    } else {
      actions.readerViewport.scheduleViewport();
      actions.thumbnails.observeThumbnails();
      actions.rootActions.scheduleRecentPreviews();
      actions.readerScroll.settle();
    }
    return true;
  }

  function visibility() {
    if (updateForeground() && activity.foreground.value) {
      actions.translationQueue.pumpPages();
      actions.translationQueue.pump();
    }
  }
  return { updateSessionTimer, updateForeground, visibility };
}
