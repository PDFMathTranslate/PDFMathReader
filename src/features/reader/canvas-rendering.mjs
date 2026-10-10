import { renderPixelRatio, scrollPixelRatio, renderFrame } from './render-resolution.mjs';
import { snapshot, revealPDF } from '../../ui/motion/text-reveal.mjs';
import { nextTick } from 'vue';
import { animateParagraphGaps } from './paragraph-gap-motion.mjs';

export function createCanvasRendering({
  renderState,
  session,
  motion,
  preferences,
  view,
  activity,
  actions,
}) {
  function releaseCanvas(canvas) {
    if (!canvas) return;
    canvas.paragraphGapCleanup?.();
    canvas.paragraphGapState = null;
    renderState.pageTasks.get(canvas)?.cancel();
    renderState.pageTasks.delete(canvas);
    renderState.canvasCache.delete(canvas);
    canvas.width = canvas.height = 0;
  }

  function resetBitmaps() {
    renderState.bitmapFrames.clear();
    // Bitmap eviction must retain the mounted sidebar window so foreground
    // resume can repaint it even when its scroll position has not changed.
    renderState.thumbnailEpoch++;
    for (const canvas of [...renderState.canvasEls.values(), ...renderState.thumbEls.values()])
      releaseCanvas(canvas);
    renderState.renderWindow.value = new Set();
  }

  function bindPage(number, el) {
    if (el) renderState.pageEls.set(number, el);
    else renderState.pageEls.delete(number);
  }

  function bindCanvas(number, el) {
    const old = renderState.canvasEls.get(number);
    if (old && old !== el) releaseCanvas(old);
    if (el) renderState.canvasEls.set(number, el);
    else renderState.canvasEls.delete(number);
  }

  function mathSource(number, translated) {
    return translated
      ? actions.rootActions.displayedPage(session.pages.value[number - 1]).mathDocument.getPage(1)
      : session.pdf.getPage(number);
  }

  function nativeSource(number, b) {
    return {
      canvas: renderState.canvasEls.get(number),
      page: session.pdf.getPage(number),
      scale: view.zoom.value,
      origin: { x: b.x * view.zoom.value - 3, y: b.y * view.zoom.value - 3 },
      boxes: [
        {
          x: b.x * view.zoom.value,
          y: b.y * view.zoom.value,
          width: b.width * view.zoom.value,
          height: Math.max(b.height, b.fontSize * 1.1) * view.zoom.value,
        },
      ],
    };
  }

  function presentFrame(canvas, frame, page, scale, dpr, geometry = frame.pdfFrame) {
    if (
      canvas.closest('.page') &&
      renderState.visiblePages.has(Number(canvas.parentElement.dataset.page))
    )
      activity.performanceRecorder.painted();
    if (canvas.closest('.page')) {
      renderState.renderMetrics.pageFrames++;
      if (
        renderState.renderMetrics.firstPageMs === null &&
        renderState.visiblePages.has(Number(canvas.parentElement.dataset.page))
      )
        renderState.renderMetrics.firstPageMs =
          performance.now() - renderState.renderMetrics.openedAt;
    } else renderState.renderMetrics.thumbnailFrames++;
    if (canvas.closest('.page')) {
      let bytes =
        [...renderState.canvasEls.values()].reduce((n, c) => n + c.width * c.height * 4, 0) -
        canvas.width * canvas.height * 4 +
        frame.width * frame.height * 4;
      const candidates = [...renderState.canvasEls]
        .filter(([n, c]) => c !== canvas && !renderState.visiblePages.has(n))
        .sort(([a], [b]) => Math.abs(b - view.active.value) - Math.abs(a - view.active.value));
      for (const [, other] of candidates) {
        if (bytes <= 128 * 1024 * 1024) break;
        bytes -= other.width * other.height * 4;
        releaseCanvas(other);
      }
    }
    canvas.paragraphGapCleanup?.();
    const number = Number(canvas.closest('.page')?.dataset.page);
    const source = number && session.pages.value[number - 1];
    const displayed = source && actions.rootActions.displayedPage(source);
    const gapState = displayed && {
      source,
      cuts: displayed.paragraphCompaction,
      height: source.height,
      scale,
    };
    const previousGap = canvas.paragraphGapState;
    if (canvas.width !== frame.width) canvas.width = frame.width;
    if (canvas.height !== frame.height) canvas.height = frame.height;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(frame, 0, 0);
    canvas.pdfFrame = geometry;
    if (canvas.closest('.page')) {
      // Percentages also let the existing pinch preview follow the page size.
      canvas.style.setProperty(
        'width',
        (geometry.width / geometry.fullWidth) * 100 + '%',
        'important',
      );
      // The page height may change before its replacement bitmap is ready.
      // Derive height from this frame's aspect ratio, never stretch an old full
      // page into the compacted page's shorter container.
      canvas.style.setProperty('height', 'auto', 'important');
      canvas.style.aspectRatio = geometry.width + ' / ' + geometry.height;
      canvas.style.position = 'absolute';
      canvas.style.left = (geometry.x / geometry.fullWidth) * 100 + '%';
      canvas.style.top = `calc(var(--page-zoom, ${scale}) * ${geometry.y / scale}px)`;
    } else {
      canvas.style.width = frame.width / dpr + 'px';
      canvas.style.height = frame.height / dpr + 'px';
    }
    const cropKey = geometry.x + ':' + geometry.y + ':' + geometry.width + ':' + geometry.height;
    renderState.canvasCache.set(canvas, { page, scale, dpr, geometry, cropKey });
    canvas.paragraphGapState = gapState;
    if (gapState && previousGap?.source === source)
      animateParagraphGaps(canvas, previousGap, gapState, scale, geometry);
    canvas.dispatchEvent(new CustomEvent('pdf-frame-presented', { bubbles: true }));
    renderState.renderMetrics.peakResidentBytes = Math.max(
      renderState.renderMetrics.peakResidentBytes,
      [...renderState.canvasEls.values(), ...renderState.thumbEls.values()].reduce(
        (n, c) => n + c.width * c.height * 4,
        0,
      ),
    );
  }

  async function draw(page, canvas, scale, preview = false) {
    if (!activity.foreground.value || !canvas || !canvas.isConnected) return false;
    const number = Number(canvas.closest('.page')?.dataset.page);
    if (number && !renderState.renderWindow.value.has(number)) return false;
    const base = page.getViewport({ scale }),
      geometry = renderFrame(base.width, base.height, number ? view.pageCrop.value : undefined),
      cropKey = geometry.x + ':' + geometry.y + ':' + geometry.width + ':' + geometry.height,
      dpr = preview
        ? scrollPixelRatio(geometry.width, geometry.height, devicePixelRatio)
        : renderPixelRatio(
            geometry.width,
            geometry.height,
            devicePixelRatio,
            !!number && renderState.visiblePages.has(number),
          ),
      cached = renderState.canvasCache.get(canvas),
      current = renderState.pageTasks.get(canvas);
    if (
      cached?.page === page &&
      cached.scale === scale &&
      cached.dpr >= dpr &&
      cached.cropKey === cropKey
    ) {
      if (current) {
        renderState.pageTasks.delete(canvas);
        current.cancel();
      }
      return true;
    }
    if (
      current?.previewPage === page &&
      current.previewScale === scale &&
      current.previewDpr >= dpr &&
      current.previewCrop === cropKey
    )
      return current.previewResult;
    if (current) {
      renderState.pageTasks.delete(canvas);
      current.cancel();
    }
    if (!renderState.bitmapIds.has(page)) renderState.bitmapIds.set(page, ++renderState.bitmapId);
    const key = renderState.bitmapIds.get(page) + ':' + scale + ':' + dpr + ':' + cropKey,
      reusable = renderState.bitmapFrames.get(key);
    if (reusable) {
      renderState.renderMetrics.cacheHits++;
      if (!number || renderState.visiblePages.has(number))
        presentFrame(canvas, reusable, page, scale, dpr);
      return true;
    }
    if (number && renderState.visiblePages.has(number) && !canvas.width) {
      const previewDpr = scrollPixelRatio(geometry.width, geometry.height, devicePixelRatio);
      const fallback = renderState.bitmapFrames.get(
        renderState.bitmapIds.get(page) + ':' + scale + ':' + previewDpr + ':' + cropKey,
      );
      if (fallback) presentFrame(canvas, fallback, page, scale, previewDpr);
    }
    const viewport = page.getViewport({ scale }),
      frame = document.createElement('canvas');
    frame.width = Math.ceil(geometry.width * dpr);
    frame.height = Math.ceil(geometry.height * dpr);
    frame.pdfFrame = geometry;
    const task = page.render({
      canvasContext: frame.getContext('2d'),
      viewport,
      transform: [dpr, 0, 0, dpr, -geometry.x * dpr, -geometry.y * dpr],
    });
    Object.assign(task, {
      previewPage: page,
      previewScale: scale,
      previewDpr: dpr,
      previewCrop: cropKey,
    });
    renderState.pageTasks.set(canvas, task);
    task.onContinue = (continuation) => {
      const resume = () => {
        if (renderState.pageTasks.get(canvas) !== task) return;
        if (
          renderState.previewScrolling &&
          !motion.pinching.value &&
          number &&
          !renderState.visiblePages.has(number)
        ) {
          renderState.pageTasks.delete(canvas);
          task.cancel();
          return;
        }
        requestAnimationFrame(continuation);
      };
      resume();
    };
    task.previewResult = (async () => {
      try {
        await task.promise;
        if (
          renderState.pageTasks.get(canvas) !== task ||
          !canvas.isConnected ||
          !activity.foreground.value
        )
          return false;
        if (!number || renderState.visiblePages.has(number))
          presentFrame(canvas, frame, page, scale, dpr);
        renderState.bitmapFrames.set(key, frame);
        return true;
      } catch (e) {
        if (e.name !== 'RenderingCancelledException') throw e;
        return false;
      } finally {
        if (renderState.pageTasks.get(canvas) === task) renderState.pageTasks.delete(canvas);
        if (renderState.bitmapFrames.get(key) !== frame) {
          frame.width = 0;
          frame.height = 0;
        }
      }
    })();
    return task.previewResult;
  }

  async function animatePDF(p, page, previous, translated = view.showTranslations.value) {
    try {
      const host = renderState.pageEls.get(p.number);
      if (!host) return;
      const rect = host.getBoundingClientRect(),
        readerRect = view.reader.value.getBoundingClientRect();
      if (
        rect.bottom < readerRect.top ||
        rect.top > readerRect.bottom ||
        rect.right < readerRect.left ||
        rect.left > readerRect.right
      )
        return;
      const scale = view.zoom.value;
      const boxes = p.blocks
        .filter((b) => b.math && b.text !== b.translation)
        .map((b) => (translated ? b.translatedBox : b.sourceBox))
        .filter((b) => b && [b.x, b.y, b.width, b.height].every(Number.isFinite))
        .map((b) => ({
          x: b.x * scale,
          y: b.y * scale,
          width: b.width * scale,
          height: b.height * scale,
        }));
      const controller = new AbortController();
      renderState.revealControllers.add(controller);
      try {
        await revealPDF({
          canvas: renderState.canvasEls.get(p.number),
          page,
          scale,
          host,
          boxes,
          previous,
          signal: controller.signal,
        });
      } catch {
      } finally {
        renderState.revealControllers.delete(controller);
      }
    } finally {
      if (previous) previous.width = previous.height = 0;
    }
  }

  async function renderPages(animate = false, force = false, viewportOverride = null) {
    if (!activity.foreground.value || (!force && motion.fitResizing)) return;
    if (viewportOverride === null) renderState.scheduledViewport = null;
    await nextTick();
    if (!activity.foreground.value || (!force && motion.fitResizing)) return;
    const viewport = viewportOverride || actions.readerViewport.viewportPages(),
      ordered =
        motion.fitResizing || renderState.previewScrolling
          ? viewport.filter((p) => renderState.visiblePages.has(p.number))
          : viewport;
    await nextTick();
    if (renderState.previewScrolling && !force) {
      for (const [canvas, task] of renderState.pageTasks) {
        if (!task.previewPage) continue;
        const number = Number(canvas.closest('.page')?.dataset.page);
        if (number && !renderState.visiblePages.has(number)) {
          renderState.pageTasks.delete(canvas);
          task.cancel();
        }
      }
    }
    // Keep offscreen prefetch frames in the bounded cache, not in a second
    // resident/composited canvas. High zoom otherwise exhausts GPU tile memory.
    for (const [number, canvas] of renderState.canvasEls) {
      if (renderState.visiblePages.has(number) || !canvas.width) continue;
      renderState.canvasCache.delete(canvas);
      canvas.width = canvas.height = 0;
    }
    const token = ++renderState.renderEpoch;
    const renderPage = async (source) => {
      const p = actions.rootActions.displayedPage(source);
      if (token !== renderState.renderEpoch || !session.pdf) return;
      const translated = view.showTranslations.value;
      const page = await (p.mathDocument && translated
        ? p.mathDocument.getPage(1)
        : session.pdf.getPage(p.number));
      if (token !== renderState.renderEpoch) return;
      let previous =
        animate && p.mathDocument && renderState.visiblePages.has(p.number)
          ? snapshot(renderState.canvasEls.get(p.number))
          : null;
      try {
        const painted = await draw(
          page,
          renderState.canvasEls.get(p.number),
          view.zoom.value,
          renderState.previewScrolling && !force,
        );
        if (token !== renderState.renderEpoch) return;
        if (previous && painted) {
          void animatePDF(p, page, previous, translated);
          previous = null;
        }
      } finally {
        if (previous) previous.width = previous.height = 0;
      }
      // Visible pages take priority; release the farthest prefetch bitmap if the resident budget fills.
      let bytes = [...renderState.canvasEls.values()].reduce(
        (n, c) => n + c.width * c.height * 4,
        0,
      );
      for (const candidate of [...ordered].reverse()) {
        if (bytes <= 128 * 1024 * 1024) break;
        if (renderState.visiblePages.has(candidate.number)) continue;
        const canvas = renderState.canvasEls.get(candidate.number);
        if (!canvas) continue;
        bytes -= canvas.width * canvas.height * 4;
        releaseCanvas(canvas);
      }
    };
    // A slow page must not leave its visible neighbour blank. Keep two paint
    // lanes for visible pages; prefetch starts only after those lanes finish.
    const visible = ordered.filter((p) => renderState.visiblePages.has(p.number));
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(2, visible.length) }, async () => {
        while (next < visible.length && token === renderState.renderEpoch)
          await renderPage(visible[next++]);
      }),
    );
    for (const source of ordered) {
      if (token !== renderState.renderEpoch) return;
      if (!renderState.visiblePages.has(source.number)) await renderPage(source);
    }
    if (token !== renderState.renderEpoch) return;
    if (actions.readerFit.updateReaderInsets() && view.fitMode.value !== 'manual')
      actions.readerFit.applyFit();
  }
  return {
    releaseCanvas,
    resetBitmaps,
    bindPage,
    bindCanvas,
    mathSource,
    nativeSource,
    presentFrame,
    draw,
    animatePDF,
    renderPages,
  };
}
