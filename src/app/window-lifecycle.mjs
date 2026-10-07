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
  let disposed = false;
  onMounted(async () => {
    stopRendererFrameMetrics = startRendererFrameMetrics();
    document.addEventListener('visibilitychange', bindings.visibility);
    // Issue independent IPC/config reads together. Apply preferences before
    // receiving documents so restored views and translation defaults stay valid.
    const initialState = Promise.all([
      window.previewActivity?.current(),
      !bindings.settingsWindowMode ? window.previewRecents?.list() : undefined,
      window.previewWindow?.fullscreen(),
      ['win32', 'linux'].includes(platform) ? window.previewWindow?.maximized() : undefined,
      window.previewPreferences?.load(),
      bindings.desktopServiceCredentials?.load?.().catch((loadError) => {
        if (loadError?.message) bindings.error.value = loadError.message;
        return undefined;
      }),
      window.previewAppearance?.current(),
      bindings.api('/api/config'),
    ]);
    // Attach a rejection handler immediately while event subscriptions are set up.
    void initialState.catch(() => {});
    let activityChanges = 0,
      preferenceChanges = 0,
      fullscreenChanges = 0,
      maximizedChanges = 0;
    if (window.previewActivity) {
      stopActivity = window.previewActivity.onChange((value) => {
        activityChanges++;
        bindings.activityActive.value = value;
        bindings.visibility();
      });
    }
    if (window.previewWindow) {
      stopFullscreen = window.previewWindow.onFullscreen((value) => {
        fullscreenChanges++;
        bindings.fullscreen.value = value;
      });
      if (['win32', 'linux'].includes(platform)) {
        stopMaximized = window.previewWindow.onMaximized((value) => {
          maximizedChanges++;
          bindings.maximized.value = value;
        });
      }
    }
    bindings.reader.value?.addEventListener('wheel', bindings.pinchWheel, { passive: false });
    document.addEventListener('keydown', bindings.keyboard);
    document.addEventListener('pointerdown', bindings.outsidePopover);
    document.addEventListener('focusin', bindings.outsidePopover);
    window.addEventListener('blur', bindings.dismissPopovers);
    stopActions = window.previewActions?.onAction(bindings.readerAction);
    if (window.previewPreferences)
      stopPreferences = window.previewPreferences.onChange?.((saved) => {
        preferenceChanges++;
        bindings.applySavedSettings(saved);
      });
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
    const [
      initialActivity,
      recentDocuments,
      fullscreen,
      maximized,
      saved,
      serviceCredentialValues,
      appearance,
      config,
    ] = await initialState;
    if (disposed) return;
    if (window.previewActivity) {
      if (!activityChanges) bindings.activityActive.value = initialActivity;
      bindings.foreground.value =
        !bindings.reduceResourceUsage.value ||
        (bindings.activityActive.value && !bindings.pageHidden());
      window.previewActivityActive = bindings.foreground.value;
    }
    if (recentDocuments) bindings.recentDocuments.value = recentDocuments;
    if (fullscreen !== undefined && !fullscreenChanges) bindings.fullscreen.value = fullscreen;
    if (maximized !== undefined && !maximizedChanges) bindings.maximized.value = maximized;
    if (saved && !preferenceChanges) {
      bindings.engine.value = saved.engine || 'pdf_inspector';
      bindings.applySavedSettings(saved);
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
    if (serviceCredentialValues) bindings.serviceCredentialValues.value = serviceCredentialValues;
    if (appearance) bindings.applyAppearance(appearance);
    bindings.applyConfig(config);
    bindings.model.value = config.model;
    await nextTick();
    bindings.syncScrubInputs();
    bindings.preferences.loadingPreferences = false;
    window.addEventListener('resize', bindings.resizeFit);
    resizeObserver = new ResizeObserver(bindings.resizeFit);
    if (bindings.reader.value)
      resizeObserver.observe(bindings.reader.value, { box: 'content-box' });
    if (window.previewAppearance) {
      stopAppearance = window.previewAppearance.onChange(bindings.applyAppearance);
    }
    const engineReady = bindings.checkEngine().then(() => bindings.settle());
    bindings.visibility();
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
    disposed = true;
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
