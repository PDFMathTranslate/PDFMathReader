import { nextTick } from 'vue';

export function createReaderFit({
  renderState,
  preferences,
  session,
  motion,
  view,
  activity,
  actions,
}) {
  function updateReaderInsets() {
    const el = view.reader.value;
    if (!el) return false;
    const style = getComputedStyle(el),
      inline = Math.max(
        0,
        (el.offsetWidth -
          el.clientWidth -
          parseFloat(style.borderLeftWidth) -
          parseFloat(style.borderRightWidth)) /
          2,
      ),
      block = Math.max(
        0,
        el.offsetHeight -
          el.clientHeight -
          parseFloat(style.borderTopWidth) -
          parseFloat(style.borderBottomWidth),
      );
    const layout = el.querySelector('.page-layout'),
      available = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const contentWidth = layout
      ? layout.getBoundingClientRect().width - parseFloat(getComputedStyle(layout).paddingRight)
      : 0;
    const end = contentWidth > available + 1 ? inline * 2 : 0;
    let changed = false;
    for (const [name, value] of [
      ['--scrollbar-inline-inset', inline],
      ['--scrollbar-block-inset', block],
      ['--overflow-end-inset', end],
    ]) {
      const pixels = Math.min(48, value) + 'px';
      if (el.style.getPropertyValue(name) !== pixels) {
        el.style.setProperty(name, pixels);
        changed = true;
      }
    }
    return changed;
  }

  function applyFit() {
    updateReaderInsets();
    const source = view.currentPage.value,
      p = source && actions.readingPosition.croppedPage(source),
      el = view.reader.value;
    if (!p || !el || view.fitMode.value === 'manual') return;
    const style = getComputedStyle(el);
    const width = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const count = view.direction.value === 'vertical' ? view.columns.value : 1;
    const layout = el.querySelector('.page-layout'),
      gap = layout ? parseFloat(getComputedStyle(layout).columnGap) || 0 : 24;
    const availableWidth = (width - gap * (count - 1)) / count;
    const height = el.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
    const frame = actions.readingPosition.visiblePageHost(renderState.pageEls.get(p.number)),
      border = renderState.pageEls.get(p.number)
        ? getComputedStyle(renderState.pageEls.get(p.number))
        : null;
    const borderWidth = border
        ? parseFloat(border.borderLeftWidth) + parseFloat(border.borderRightWidth)
        : preferences.reducePadding.value
          ? 0
          : 2,
      borderHeight = border
        ? parseFloat(border.borderTopWidth) + parseFloat(border.borderBottomWidth)
        : preferences.reducePadding.value
          ? 0
          : 2;
    const scale = Math.max(
      0.1,
      Math.min(
        4,
        view.fitMode.value === 'width'
          ? (availableWidth - borderWidth) / p.width
          : (height - borderHeight) / p.height,
      ),
    );
    if (Math.abs(scale - view.zoom.value) < 0.0001) return;
    // Anchor the visible part of the active page before preceding pages resize.
    const bounds = el.getBoundingClientRect(),
      box = frame?.getBoundingClientRect();
    const point = box
      ? {
          x: Math.max(box.left, bounds.left + parseFloat(style.paddingLeft)),
          y: Math.max(box.top, bounds.top + parseFloat(style.paddingTop)),
        }
      : null;
    const anchor = box
        ? { x: (point.x - box.left) / box.width, y: (point.y - box.top) / box.height }
        : null,
      token = session.epoch;
    if (anchor && view.fitMode.value === 'width' && count === 1) {
      anchor.x = 0;
      point.x = bounds.left + parseFloat(style.paddingLeft);
    }
    motion.fitAdjusting = true;
    el.dataset.fitting = 'true';
    view.zoom.value = scale;
    nextTick(() => {
      if (token !== session.epoch) {
        motion.fitAdjusting = false;
        delete el.dataset.fitting;
        return;
      }
      const after = frame?.isConnected ? frame.getBoundingClientRect() : null;
      if (after && anchor) {
        el.scrollTop += after.top + anchor.y * after.height - point.y;
        el.scrollLeft += after.left + anchor.x * after.width - point.x;
      }
      motion.fitAdjusting = false;
      delete el.dataset.fitting;
      actions.readerViewport.scheduleViewport();
    });
  }

  function cancelResize() {
    cancelAnimationFrame(motion.fitFrame);
    motion.fitFrame = 0;
    clearTimeout(motion.fitResizeTimer);
    clearTimeout(motion.resizeRenderTimer);
    motion.fitResizing = false;
  }

  async function renderResize() {
    motion.resizeRenderTimer = undefined;
    if (motion.resizeDrawing || !activity.foreground.value) return;
    motion.resizeDrawing = true;
    motion.lastResizeDraw = performance.now();
    try {
      await actions.canvasRendering.renderPages(false, true);
    } finally {
      motion.resizeDrawing = false;
      if (motion.fitResizing) scheduleResizeDraw();
    }
  }

  function scheduleResizeDraw() {
    if (motion.resizeRenderTimer || motion.resizeDrawing) return;
    motion.resizeRenderTimer = setTimeout(
      renderResize,
      Math.max(0, 100 - (performance.now() - motion.lastResizeDraw)),
    );
  }

  function toggleSidebar() {
    if (!session.pages.value.length || session.restoringView.value) return;
    motion.sidebarLeaving.value = view.sidebar.value;
    view.sidebar.value = !view.sidebar.value;
    nextTick(() => resizeFit(true));
  }

  function resizeFit() {
    if (session.restoringView.value || !session.pages.value.length || !activity.foreground.value)
      return;
    motion.fitResizing = true;
    clearTimeout(motion.fitResizeTimer);
    if (!motion.fitFrame)
      motion.fitFrame = requestAnimationFrame(() => {
        motion.fitFrame = 0;
        applyFit();
        scheduleResizeDraw();
      });
    motion.fitResizeTimer = setTimeout(async () => {
      motion.fitResizing = false;
      clearTimeout(motion.resizeRenderTimer);
      motion.resizeRenderTimer = undefined;
      await nextTick();
      applyFit();
      await nextTick();
      await actions.canvasRendering.renderPages(false, true);
      actions.thumbnails.observeThumbnails();
      actions.readingPosition.scheduleReadingSave();
    }, 160);
  }
  return {
    updateReaderInsets,
    applyFit,
    cancelResize,
    renderResize,
    scheduleResizeDraw,
    toggleSidebar,
    resizeFit,
  };
}
