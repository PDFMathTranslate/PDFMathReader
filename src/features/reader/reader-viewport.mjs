import { visibleReaderWindow } from './reader-layout.mjs';

export function createReaderViewport({ renderState, session, motion, view, activity, actions }) {
  function setRenderWindow(numbers) {
    const current = renderState.renderWindow.value;
    if (current.size !== numbers.length || numbers.some((n) => !current.has(n)))
      renderState.renderWindow.value = new Set(numbers);
    for (const [n, canvas] of renderState.canvasEls)
      if (!renderState.renderWindow.value.has(n)) actions.canvasRendering.releaseCanvas(canvas);
  }

  function mountAroundPage(number) {
    const layout = view.pageLayout.value,
      row = Math.floor((number - 1) / layout.columns),
      first = Math.max(0, row - 4),
      last = Math.min(layout.rows.length - 1, row + 4),
      numbers = [];
    for (let i = first; i <= last; i++)
      for (let n = layout.rows[i].start; n < layout.rows[i].end; n++) numbers.push(n + 1);
    setRenderWindow(numbers);
  }

  function viewportPages() {
    const host = renderState.layoutElement.value,
      el = view.reader.value;
    if (!host || !el) return [];
    renderState.renderMetrics.viewportLookups++;
    renderState.renderMetrics.geometryReads += 2;
    const rect = host.getBoundingClientRect(),
      bounds = el.getBoundingClientRect(),
      window = visibleReaderWindow(
        view.pageLayout.value,
        {
          left: bounds.left - rect.left,
          right: bounds.right - rect.left,
          top: bounds.top - rect.top,
          bottom: bounds.bottom - rect.top,
        },
        view.active.value,
      );
    for (const n of renderState.visiblePages)
      if (session.pages.value[n - 1]) session.pages.value[n - 1].visible = 0;
    renderState.visiblePages.clear();
    let best;
    for (const item of window.visible) {
      renderState.visiblePages.add(item.number);
      session.pages.value[item.number - 1].visible = item.ratio;
      if (!best || item.area > best.area) best = item;
    }
    // Keep the selected page within a visible row; a larger neighbour must not
    // override navigation or repeatedly change the fit scale in mixed-size PDFs.
    const selected = window.visible.find((item) => item.number === view.active.value);
    if (best && selected && selected.row === best.row) best = selected;
    if (
      best &&
      !motion.pageJumping &&
      !motion.layoutMotion &&
      !motion.fitAdjusting &&
      !session.restoringView.value &&
      !motion.pinching.value &&
      !motion.fitResizing
    )
      view.active.value = best.number;
    if (
      motion.referenceReturn.value &&
      !motion.referenceJumping &&
      !renderState.visiblePages.has(motion.referenceReturn.value.targetPage)
    )
      motion.referenceReturn.value = null;
    setRenderWindow(window.numbers);
    return window.numbers
      .map((n) => session.pages.value[n - 1])
      .sort(
        (a, b) =>
          Number(!renderState.visiblePages.has(a.number)) -
            Number(!renderState.visiblePages.has(b.number)) ||
          Math.abs(a.number - view.active.value) - Math.abs(b.number - view.active.value),
      );
  }

  function scheduleViewport(viewport = null) {
    if (viewport) renderState.scheduledViewport = viewport;
    else renderState.scheduledViewport = null;
    if (renderState.viewportFrame || !activity.foreground.value || motion.fitResizing) return;
    renderState.viewportFrame = requestAnimationFrame(() => {
      renderState.viewportFrame = 0;
      const next = renderState.scheduledViewport;
      renderState.scheduledViewport = null;
      void actions.canvasRendering.renderPages(false, false, next);
    });
  }

  function observe() {
    viewportPages();
  }
  return { setRenderWindow, mountAroundPage, viewportPages, scheduleViewport, observe };
}
