import { snapshot } from '../../ui/motion/text-reveal.mjs';

export function createReaderPreview({
  renderState,
  motion,
  session,
  preferences,
  search,
  activity,
  view,
  actions,
}) {
  function interruptPreview() {
    if (!renderState.previewScrolling) {
      renderState.previewScrolling = true;
      renderState.revealControllers.forEach((c) => c.abort());
      renderState.revealControllers.clear();
    }
    clearTimeout(renderState.previewTimer);
    renderState.previewTimer = setTimeout(() => {
      renderState.previewScrolling = false;
      void actions.canvasRendering.renderPages();
      void actions.thumbnails.renderThumbnails();
      flushPreview();
    }, 180);
  }

  function queuePreview(p) {
    renderState.pendingPreview.set(p.number, p);
    if (search.searchOpen.value) return;
    if (!renderState.previewScrolling && !motion.pinching.value)
      requestAnimationFrame(flushPreview);
  }

  async function flushPreview() {
    if (
      !activity.foreground.value ||
      renderState.previewFlushing ||
      renderState.previewScrolling ||
      motion.pinching.value
    )
      return;
    renderState.previewFlushing = true;
    try {
      const token = session.epoch;
      for (const [number, p] of renderState.pendingPreview) {
        if (renderState.previewScrolling || motion.pinching.value || token !== session.epoch)
          return;
        renderState.pendingPreview.delete(number);
        const host = renderState.pageEls.get(number);
        if (!host) continue;
        const rect = host.getBoundingClientRect(),
          bounds = view.reader.value.getBoundingClientRect();
        if (
          rect.bottom < bounds.top ||
          rect.top > bounds.bottom ||
          rect.right < bounds.left ||
          rect.left > bounds.right
        )
          continue;
        const display = actions.rootActions.displayedPage(p);
        const translated = view.showTranslations.value;
        const page = await (display.mathDocument && translated
          ? display.mathDocument.getPage(1)
          : session.pdf.getPage(number));
        if (token !== session.epoch) return;
        const changed =
          renderState.canvasCache.get(renderState.canvasEls.get(number))?.page !== page;
        let previous =
          changed && p.mathDocument ? snapshot(renderState.canvasEls.get(number)) : null;
        try {
          if (
            (await actions.canvasRendering.draw(
              page,
              renderState.canvasEls.get(number),
              view.zoom.value,
            )) &&
            changed &&
            previous &&
            !renderState.previewScrolling
          ) {
            void actions.canvasRendering.animatePDF(p, page, previous, translated);
            previous = null;
          }
        } finally {
          if (previous) previous.width = previous.height = 0;
        }
      }
    } finally {
      renderState.previewFlushing = false;
      if (
        renderState.pendingPreview.size &&
        !renderState.previewScrolling &&
        !motion.pinching.value
      )
        requestAnimationFrame(flushPreview);
    }
  }
  return { interruptPreview, queuePreview, flushPreview };
}
