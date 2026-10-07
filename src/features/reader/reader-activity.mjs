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
    clearTimeout(runtime.resourceReleaseTimer);
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
      ++renderState.renderEpoch;
      ++renderState.thumbnailEpoch;
      renderState.pageTasks.forEach((task) => task.cancel());
      renderState.pageTasks.clear();
      renderState.revealControllers.forEach((c) => c.abort());
      renderState.revealControllers.clear();
      feedback.reading.value = t('reading.paused');
      actions.rootActions.stopRecentPreviews();
      runtime.resourceReleaseTimer = setTimeout(() => {
        if (!activity.foreground.value && preferences.reduceResourceUsage.value)
          actions.canvasRendering.resetBitmaps();
      }, 1000);
    } else {
      actions.readerViewport.scheduleViewport();
      actions.thumbnails.observeThumbnails();
      actions.rootActions.scheduleRecentPreviews();
      actions.readerScroll.settle();
    }
  }

  function visibility() {
    updateForeground();
    if (activity.foreground.value) {
      actions.readerScroll.settle();
      actions.translationQueue.pumpPages();
      actions.translationQueue.pump();
    }
  }
  return { updateSessionTimer, updateForeground, visibility };
}
