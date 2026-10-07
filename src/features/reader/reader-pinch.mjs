import { nextTick } from 'vue';

export function createReaderPinch({ session, motion, renderState, view, actions }) {
  function pinchWheel(e) {
    if (!e.ctrlKey) {
      actions.readerPreview.interruptPreview();
      return;
    }
    if (!session.pages.value.length) return;
    e.preventDefault();
    if (!motion.pinching.value) {
      motion.pinching.value = true;
      actions.readerPopovers.dismissPopovers();
      renderState.revealControllers.forEach((c) => c.abort());
      renderState.revealControllers.clear();
      renderState.pageTasks.forEach((task) => task.cancel());
      ++renderState.renderEpoch;
      view.fitMode.value = 'manual';
      localStorage.setItem('readerFit', 'manual');
    }
    motion.pinchDelta +=
      e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? view.reader.value.clientHeight : 1);
    motion.pinchPoint = { x: e.clientX, y: e.clientY };
    if (!motion.pinchFrame) motion.pinchFrame = requestAnimationFrame(applyPinch);
    clearTimeout(motion.pinchTimer);
    motion.pinchTimer = setTimeout(finishPinch, 160);
  }

  async function applyPinch() {
    motion.pinchFrame = 0;
    const delta = motion.pinchDelta;
    motion.pinchDelta = 0;
    const el = view.reader.value;
    if (!el || !motion.pinchPoint) return;
    const point = motion.pinchPoint,
      hosts = [...renderState.pageEls.values()];
    const host =
      hosts.find((h) => {
        const r = h.getBoundingClientRect();
        return point.y >= r.top && point.y <= r.bottom;
      }) || renderState.pageEls.get(view.active.value);
    if (!host) return;
    const before = host.getBoundingClientRect(),
      x = (point.x - before.left) / before.width,
      y = (point.y - before.top) / before.height;
    view.zoom.value = Math.min(4, Math.max(0.1, view.zoom.value * Math.exp(-delta * 0.01)));
    await nextTick();
    const after = host.getBoundingClientRect();
    el.scrollLeft += after.left + x * after.width - point.x;
    el.scrollTop += after.top + y * after.height - point.y;
  }

  async function finishPinch() {
    const token = session.epoch;
    if (motion.pinchFrame) {
      cancelAnimationFrame(motion.pinchFrame);
      await applyPinch();
    }
    motion.pinching.value = false;
    await nextTick();
    await actions.canvasRendering.renderPages();
    if (token !== session.epoch) return;
    actions.preferencePersistence.saveView();
    actions.readerScroll.settle();
  }

  function manualZoom() {
    view.fitMode.value = 'manual';
    localStorage.setItem('readerFit', 'manual');
    actions.preferencePersistence.saveView();
  }
  return { pinchWheel, applyPinch, finishPinch, manualZoom };
}
