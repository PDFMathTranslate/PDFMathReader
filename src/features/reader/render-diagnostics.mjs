// Registered in setup order; Vue disposes these observers with their window.
export function installRenderDiagnostics({ bindings }) {
  if (bindings.testMode)
    window.previewRenderDiagnostics = () => ({
      translationOrder: bindings.readingTranslationPages(),
      translationMoving: bindings.translationState.translationMoving,
      readingDirection: bindings.translationState.readingDirection,
      translationQueue: bindings.translationState.queue.map((job) => job.page),
      pageQueue: bindings.translationState.pageQueue.map((job) => job.p.number),
      translationRequests: [...bindings.translationState.translationRequests.values()],
      annotationKey: bindings.annotationKey.value,
      annotationCount: bindings.annotations.value.length,
      active: bindings.active.value,
      zoom: bindings.zoom.value,
      direction: bindings.direction.value,
      previewScrolling: bindings.renderState.previewScrolling,
      fitAdjusting: bindings.motion.fitAdjusting,
      resizeActive: bindings.motion.fitResizing,
      opening: bindings.loading.value,
      readingView: bindings.readingView(),
      recentId: bindings.session.currentRecentId,
      documentId: bindings.session.documentId,
      foreground: bindings.foreground.value,
      metrics: { ...bindings.renderState.renderMetrics },
      totalPages: bindings.pages.value.length,
      mountedPages: bindings.renderState.pageEls.size,
      mountedThumbnails: bindings.renderState.thumbEls.size,
      translatedPages: bindings.pages.value.filter(
        (p) => p.mathDocument || p.blocks.some((b) => b.translation),
      ).length,
      cache: bindings.renderState.bitmapFrames.stats(),
      window: [...bindings.renderWindow.value],
      canvasMapping: [...bindings.renderState.canvasEls].map(([n, c]) => ({
        number: n,
        actual: c.parentElement?.dataset.page,
        connected: c.isConnected,
        width: c.width,
      })),
      pages: [...bindings.renderState.canvasEls].filter(([, c]) => c.width > 0).map(([n]) => n),
      thumbnails: [...bindings.renderState.thumbEls].filter(([, c]) => c.width > 0).map(([n]) => n),
      pageResolution: [...bindings.renderState.canvasEls].map(([number, canvas]) => ({
        number,
        dpr: bindings.renderState.canvasCache.get(canvas)?.dpr || 0,
      })),
      residentBytes: [
        ...bindings.renderState.canvasEls.values(),
        ...bindings.renderState.thumbEls.values(),
      ].reduce((n, c) => n + c.width * c.height * 4, 0),
    });
}
