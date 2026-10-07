import { watch, nextTick } from 'vue';
import { captureLayoutMotion } from './layout-motion.mjs';
import { formatPercentValue } from '../../ui/inputs/scrub-input.mjs';

// Registered in setup order; Vue disposes these observers with their window.
export function installReaderViewObservers({ bindings }) {
  watch(
    bindings.active,
    (n) => {
      bindings.pageEntry.value = n;
      if (bindings.restoringView.value || bindings.motion.fitResizing) return;
      if (!bindings.motion.pageJumping) bindings.applyFit();
      nextTick(() => bindings.scrollThumbnailTo(n));
    },
    { flush: 'post' },
  );
  watch(bindings.reducePadding, async () => {
    if (bindings.restoringView.value || !bindings.pages.value.length) return;
    const page = bindings.active.value;
    await nextTick();
    bindings.applyFit();
    await nextTick();
    await bindings.go(page);
    bindings.renderPages();
  });
  watch(
    [bindings.direction, bindings.columns],
    async ([nextDirection], [previousDirection]) => {
      if (bindings.restoringView.value) return;
      bindings.cancelLayoutMotion();
      const generation = bindings.motion.layoutMotionGeneration,
        page = bindings.active.value;
      const directionChanged =
        nextDirection !== previousDirection && !bindings.preferences.loadingPreferences;
      bindings.finishZoomAnimation();
      bindings.reader.value?.classList.add('layout-transitioning');
      const layoutTransition = bindings.preferences.loadingPreferences
        ? null
        : captureLayoutMotion(bindings.reader.value, bindings.renderState.pageEls.get(page), {
            reducedMotion: bindings.reducedMotion(),
          });
      bindings.motion.layoutMotion = layoutTransition;
      bindings.dismissPopovers();
      try {
        await nextTick();
        if (generation !== bindings.motion.layoutMotionGeneration) return;
        if (directionChanged)
          bindings.chooseFit(nextDirection === 'horizontal' ? 'height' : 'width', {
            animate: false,
          });
        else bindings.applyFit();
        bindings.mountAroundPage(page);
        await nextTick();
        if (generation !== bindings.motion.layoutMotionGeneration) return;
        await bindings.go(page);
        if (generation !== bindings.motion.layoutMotionGeneration) return;
        void bindings.renderPages();
        bindings.saveView();
        await layoutTransition?.play(bindings.renderState.pageEls.get(page));
      } finally {
        if (generation === bindings.motion.layoutMotionGeneration) {
          layoutTransition?.cancel();
          bindings.motion.layoutMotion = null;
          bindings.reader.value?.classList.remove('layout-transitioning');
        }
      }
    },
    { flush: 'sync' },
  );
  watch(bindings.sidebar, () => {
    if (!bindings.restoringView.value)
      nextTick(() => {
        bindings.observeThumbnails();
        bindings.resizeFit(true);
      });
  });
  watch(bindings.title, (value) => {
    document.title = value;
  });
  watch(bindings.zoom, async () => {
    if (bindings.restoringView.value) return;
    bindings.renderState.revealControllers.forEach((c) => c.abort());
    bindings.renderState.revealControllers.clear();
    localStorage.setItem('readerZoom', String(bindings.zoom.value));
    const input = bindings.nativeReaderInput(bindings.zoomInput.value);
    if (document.activeElement !== input && document.activeElement !== bindings.zoomInput.value?.el)
      bindings.zoomEntry.value = formatPercentValue(bindings.zoom.value);
    const request = bindings.motion.zoomRequest;
    bindings.motion.zoomRequest = null;
    if (request && !bindings.pinching.value && !bindings.motion.fitResizing) {
      await bindings.applyRequestedZoom({ ...request, to: bindings.zoom.value });
    } else if (!bindings.pinching.value && !bindings.motion.fitResizing) {
      await nextTick();
      await bindings.renderPages();
    }
  });
  watch(bindings.concurrency, bindings.pump);
  watch(bindings.automatic, () => {
    if (bindings.automatic.value) bindings.settle();
  });
  watch(bindings.showTranslations, (v) => {
    if (bindings.restoringView.value) return;
    if (v && bindings.translationDeferred.value) {
      bindings.translationDeferred.value = false;
      bindings.settle();
    }
    for (const p of bindings.pages.value) for (const b of p.blocks) b.translated = v;
    if (bindings.searchPages.value)
      for (const p of bindings.searchPages.value.values())
        for (const b of p.blocks) b.translated = v;
    if (bindings.engine.value !== 'pdf_inspector') {
      bindings.renderState.revealControllers.forEach((c) => c.abort());
      bindings.renderState.revealControllers.clear();
      bindings.renderPages(true);
    }
  });
  watch(bindings.reduceBackgroundFrameRate, () => bindings.saveView());
  watch(bindings.reduceResourceUsage, () => {
    bindings.visibility();
    bindings.saveView();
  });
  watch(
    [
      bindings.active,
      bindings.zoom,
      bindings.direction,
      bindings.columns,
      bindings.fitMode,
      bindings.sidebar,
      bindings.sidebarMode,
      bindings.showTranslations,
    ],
    bindings.scheduleReadingSave,
  );
}
