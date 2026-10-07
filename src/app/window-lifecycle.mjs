import { platform } from '../platform/runtime.mjs';
import { startRendererFrameMetrics } from '../features/developer/renderer-frame-metrics.mjs';
import { nextTick, onMounted, onBeforeUnmount } from 'vue';
import { formatPercentValue } from '../ui/inputs/scrub-input.mjs';

// Registered in setup order; Vue disposes these observers with their window.
export function installWindowLifecycle({ bindings, lifecycle }) {
  let stopRendererFrameMetrics,
    stopSettingsSection,
    stopSettingsCredentials,
    stopSettingsServiceCredentials,
    stopFullscreen,
    stopMaximized,
    stopActivity,
    resizeObserver,
    stopActions,
    stopPreferences,
    stopAppearance,
    stopDocuments;
  onMounted(async () => {
    stopRendererFrameMetrics = startRendererFrameMetrics();
    document.addEventListener('visibilitychange', bindings.visibility);
    if (window.previewActivity) {
      let activityChanges = 0;
      stopActivity = window.previewActivity.onChange((value) => {
        activityChanges++;
        bindings.activityActive.value = value;
        bindings.visibility();
      });
      const initialActivity = await window.previewActivity.current();
      if (!activityChanges) bindings.activityActive.value = initialActivity;
      bindings.foreground.value =
        !bindings.reduceResourceUsage.value ||
        (bindings.activityActive.value && !bindings.pageHidden());
      window.previewActivityActive = bindings.foreground.value;
    }
    if (!bindings.settingsWindowMode && window.previewRecents) {
      bindings.recentDocuments.value = await window.previewRecents.list();
      bindings.scheduleRecentPreviews();
    }
    if (window.previewWindow) {
      stopFullscreen = window.previewWindow.onFullscreen(
        (value) => (bindings.fullscreen.value = value),
      );
      if (['win32', 'linux'].includes(platform)) {
        stopMaximized = window.previewWindow.onMaximized(
          (value) => (bindings.maximized.value = value),
        );
        bindings.maximized.value = await window.previewWindow.maximized();
      }
      bindings.fullscreen.value = await window.previewWindow.fullscreen();
    }
    bindings.reader.value?.addEventListener('wheel', bindings.pinchWheel, { passive: false });
    document.addEventListener('keydown', bindings.keyboard);
    document.addEventListener('pointerdown', bindings.outsidePopover);
    document.addEventListener('focusin', bindings.outsidePopover);
    window.addEventListener('blur', bindings.dismissPopovers);
    stopActions = window.previewActions?.onAction(bindings.readerAction);
    if (window.previewPreferences) {
      const saved = await window.previewPreferences.load();
      bindings.engine.value = saved.engine || 'pdf_inspector';
      bindings.applySavedSettings(saved);
      stopPreferences = window.previewPreferences.onChange?.(bindings.applySavedSettings);
      bindings.applyAppearance(saved);
      bindings.direction.value = saved.direction || 'vertical';
      bindings.columns.value = saved.columns || 1;
      bindings.fitMode.value = saved.fit;
      bindings.translationMode.value = saved.translationMode || 'reading';
      if (saved.fit === 'manual') {
        bindings.zoom.value = saved.zoom;
        bindings.zoomEntry.value = formatPercentValue(bindings.zoom.value);
      }
    }
    stopSettingsCredentials = window.previewCredentials?.onChange?.(() => {
      for (const kernel of ['pdf_inspector', 'pdf_math_fast', 'pdf_math_precise'])
        bindings.resetServiceHistory(kernel, 'openai');
      void bindings
        .api('/api/config')
        .then(bindings.applyConfig)
        .catch(() => {});
    });
    stopSettingsServiceCredentials = bindings.desktopServiceCredentials?.onChange?.(() => {
      void bindings.desktopServiceCredentials
        .load()
        .then((values) => {
          bindings.serviceCredentialValues.value = values;
        })
        .catch(() => {});
    });
    if (typeof bindings.desktopServiceCredentials?.load === 'function') {
      try {
        bindings.serviceCredentialValues.value = await bindings.desktopServiceCredentials.load();
      } catch (loadError) {
        if (loadError?.message) bindings.error.value = loadError.message;
      }
    }
    await nextTick();
    bindings.syncScrubInputs();
    bindings.preferences.loadingPreferences = false;
    window.addEventListener('resize', bindings.resizeFit);
    resizeObserver = new ResizeObserver(bindings.resizeFit);
    if (bindings.reader.value)
      resizeObserver.observe(bindings.reader.value, { box: 'content-box' });
    if (window.previewAppearance) {
      bindings.applyAppearance(await window.previewAppearance.current());
      stopAppearance = window.previewAppearance.onChange(bindings.applyAppearance);
    }
    const engineReady = bindings.checkEngine().then(() => bindings.settle());
    const c = await bindings.api('/api/config');
    bindings.applyConfig(c);
    bindings.model.value = c.model;
    if (!bindings.settingsWindowMode && window.previewDocuments) {
      stopDocuments = window.previewDocuments.onAvailable(bindings.receiveDocuments);
      await bindings.receiveDocuments();
    }
    bindings.visibility();
    bindings.settle();
    bindings.scheduleRecentPreviews();
    if (bindings.settingsWindowMode) {
      stopSettingsSection = window.previewWindow?.onSettingsSection?.((section) => {
        bindings.settingsSection.value = section;
      });
      await bindings.openSettings(
        bindings.settingsSection.value === 'translation'
          ? 'language'
          : bindings.settingsSection.value === 'kernel'
            ? 'kernel'
            : undefined,
      );
    }
    if (bindings.testMode) await engineReady;
    window.previewReady = true;
  });
  onBeforeUnmount(() => {
    stopRendererFrameMetrics?.();
    clearTimeout(lifecycle.kernelIgnoreTimer);
    stopSettingsSection?.();
    stopSettingsCredentials?.();
    stopSettingsServiceCredentials?.();
    lifecycle.settingsDropdownObserver?.disconnect();
    clearTimeout(lifecycle.resourceReleaseTimer);
    bindings.stopRecentPreviews();
    clearInterval(bindings.session.sessionTimer);
    bindings.session.documentMotionController?.abort();
    clearTimeout(lifecycle.immersiveLightsTimer);
    bindings.closeSearch();
    bindings.cancelResize();
    bindings.performanceRecorder.destroy();
    stopActivity?.();
    void bindings.releaseDocument();
    void bindings.saveReadingView();
    clearTimeout(bindings.session.readingSaveTimer);
    delete window.previewSaveReadingView;
    bindings.invalidateRecentPreviews();
    stopFullscreen?.();
    stopMaximized?.();
    bindings.reader.value?.removeEventListener('wheel', bindings.pinchWheel);
    cancelAnimationFrame(bindings.motion.pinchFrame);
    clearTimeout(bindings.motion.pinchTimer);
    document.removeEventListener('keydown', bindings.keyboard);
    document.removeEventListener('pointerdown', bindings.outsidePopover);
    document.removeEventListener('focusin', bindings.outsidePopover);
    window.removeEventListener('blur', bindings.dismissPopovers);
    stopActions?.();
    resizeObserver?.disconnect();
    window.removeEventListener('resize', bindings.resizeFit);
    cancelAnimationFrame(bindings.motion.fitFrame);
    clearTimeout(bindings.motion.fitResizeTimer);
    clearTimeout(bindings.motion.navigatorTimer);
    bindings.renderState.scrollbarTimers.forEach(clearTimeout);
    bindings.renderState.scrollbarTimers.clear();
    clearTimeout(bindings.renderState.previewTimer);
    clearTimeout(bindings.motion.zoomRenderTimer);
    bindings.motion.scrubbers.forEach((entry) => entry.controller.destroy());
    bindings.motion.scrubbers.clear();
    bindings.finishZoomAnimation();
    cancelAnimationFrame(bindings.renderState.viewportFrame);
    bindings.resetBitmaps();
    stopAppearance?.();
    stopPreferences?.();
    stopDocuments?.();
    bindings.cancel();
    clearTimeout(bindings.translationState.timer);
    void Promise.allSettled(
      [
        bindings.session.pdf?.loadingTask,
        bindings.session.pendingPDFTask,
        ...bindings.pages.value.map((p) => p.mathDocument?.loadingTask),
      ]
        .filter(Boolean)
        .map((task) => task.destroy()),
    ).then(() => bindings.session.pdfWorker?.destroy());
    document.removeEventListener('visibilitychange', bindings.visibility);
  });
}
