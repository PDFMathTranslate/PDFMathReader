import { clampZoom, startZoomMotion, zoomStep } from './zoom-motion.mjs';
import { nextTick } from 'vue';
import { captureLayoutMotion } from './layout-motion.mjs';

export function createReaderZoom({ renderState, preferences, motion, session, view, actions }) {
  function captureZoomAnchor() {
    const el = view.reader.value,
      host = renderState.pageEls.get(view.active.value);
    if (!el || !host) return null;
    const bounds = el.getBoundingClientRect(),
      rect = host.getBoundingClientRect();
    // Manual zoom keeps the active page's top at its current screen position.
    const point = {
      x: Math.min(rect.right, Math.max(rect.left, bounds.left + bounds.width / 2)),
      y: rect.top,
    };
    return {
      page: view.active.value,
      x: (point.x - rect.left) / Math.max(1, rect.width),
      y: 0,
      clientX: point.x,
      clientY: point.y,
    };
  }

  function restoreZoomAnchor(anchor) {
    const el = view.reader.value,
      host = anchor && renderState.pageEls.get(anchor.page);
    if (!el || !host) return;
    const rect = host.getBoundingClientRect();
    el.scrollLeft += rect.left + anchor.x * rect.width - anchor.clientX;
    el.scrollTop += rect.top + anchor.y * rect.height - anchor.clientY;
  }

  function reducedMotion() {
    return preferences.reduceMotion.value || matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function startZoomAnimation(request) {
    const layout = renderState.layoutElement.value;
    if (!layout || !request?.animate || request.from === view.zoom.value) return;
    const host = renderState.pageEls.get(request.anchor?.page || view.active.value),
      layoutRect = layout.getBoundingClientRect(),
      hostRect = host?.getBoundingClientRect();
    const origin = hostRect
      ? `${hostRect.left - layoutRect.left + (request.anchor?.x || 0) * hostRect.width}px ${hostRect.top - layoutRect.top + (request.anchor?.y || 0) * hostRect.height}px`
      : '50% 50%';
    motion.zoomAnimation = startZoomMotion(layout, {
      from: request.from,
      to: view.zoom.value,
      origin,
      reducedMotion: reducedMotion(),
    });
  }

  function finishZoomAnimation() {
    if (motion.zoomAnimation) {
      motion.zoomAnimation.finish?.();
      motion.zoomAnimation.cancel?.();
      motion.zoomAnimation = null;
    }
  }

  function scheduleZoomRender() {
    clearTimeout(motion.zoomRenderTimer);
    const generation = ++motion.zoomRenderGeneration;
    motion.zoomRenderTimer = setTimeout(async () => {
      motion.zoomRenderTimer = 0;
      if (
        generation !== motion.zoomRenderGeneration ||
        session.restoringView.value ||
        motion.pinching.value ||
        motion.fitResizing
      ) {
        if (generation === motion.zoomRenderGeneration) motion.zoomTargetPending = false;
        return;
      }
      try {
        await actions.canvasRendering.renderPages();
      } finally {
        if (generation === motion.zoomRenderGeneration) motion.zoomTargetPending = false;
      }
    }, 70);
  }

  async function applyRequestedZoom(request) {
    const generation = ++motion.zoomMotionGeneration;
    finishZoomAnimation();
    await nextTick();
    if (generation !== motion.zoomMotionGeneration) return;
    restoreZoomAnchor(request.anchor);
    startZoomAnimation(request);
    motion.zoomTargetPending = true;
    scheduleZoomRender();
  }

  function requestZoom(value, { animate = true, anchor = captureZoomAnchor() } = {}) {
    const target = clampZoom(value);
    if (Math.abs(target - view.zoom.value) < 0.00001) return false;
    if (!motion.zoomRequest) motion.zoomRequest = { from: view.zoom.value, anchor, animate };
    else {
      motion.zoomRequest.to = target;
      motion.zoomRequest.animate = motion.zoomRequest.animate && animate;
    }
    motion.zoomTargetPending = true;
    view.zoom.value = target;
    return true;
  }

  async function chooseFit(mode, { animate = true } = {}) {
    ++motion.zoomMotionGeneration;
    motion.zoomTargetPending = false;
    motion.zoomRequest = null;
    clearTimeout(motion.zoomRenderTimer);
    motion.zoomRenderTimer = 0;
    ++motion.zoomRenderGeneration;
    finishZoomAnimation();
    if (animate) actions.rootActions.cancelLayoutMotion();
    const generation = motion.layoutMotionGeneration,
      page = view.active.value;
    const layoutTransition = animate
      ? captureLayoutMotion(view.reader.value, renderState.pageEls.get(page), {
          reducedMotion: reducedMotion(),
        })
      : null;
    if (layoutTransition) {
      motion.layoutMotion = layoutTransition;
      view.reader.value?.classList.add('layout-transitioning');
    }
    try {
      view.fitMode.value = mode;
      localStorage.setItem('readerFit', mode);
      actions.readerFit.applyFit();
      actions.preferencePersistence.saveView();
      await nextTick();
      if (generation !== motion.layoutMotionGeneration) return;
      await layoutTransition?.play(renderState.pageEls.get(page));
    } finally {
      if (layoutTransition && generation === motion.layoutMotionGeneration) {
        layoutTransition.cancel();
        motion.layoutMotion = null;
        view.reader.value?.classList.remove('layout-transitioning');
      }
    }
  }

  function changeZoom(delta) {
    view.fitMode.value = 'manual';
    localStorage.setItem('readerFit', 'manual');
    requestZoom(zoomStep(view.zoom.value, delta >= 0 ? 1 : -1, Math.abs(delta)));
    actions.preferencePersistence.saveView();
  }
  return {
    captureZoomAnchor,
    restoreZoomAnchor,
    reducedMotion,
    startZoomAnimation,
    finishZoomAnimation,
    scheduleZoomRender,
    applyRequestedZoom,
    requestZoom,
    chooseFit,
    changeZoom,
  };
}
