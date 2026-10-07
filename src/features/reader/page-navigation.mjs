import { nextTick } from 'vue';

export function createPageNavigation({
  motion,
  session,
  translationState,
  renderState,
  view,
  actions,
}) {
  function cancelPageScroll() {
    motion.pageScrollMotion?.();
    motion.pageScrollMotion = null;
  }

  function interruptPageScroll() {
    if (!motion.pageJumping) return;
    ++motion.pageJumpGeneration;
    cancelPageScroll();
    motion.pageJumping = false;
    actions.readerViewport.scheduleViewport();
    actions.readerScroll.scrolling();
  }

  function animatePageScroll(el, left, top) {
    const fromLeft = el.scrollLeft,
      fromTop = el.scrollTop;
    return new Promise((resolve) => {
      let frame = 0,
        start;
      const finish = () => {
        cancelAnimationFrame(frame);
        if (motion.pageScrollMotion === finish) motion.pageScrollMotion = null;
        resolve();
      };
      motion.pageScrollMotion = finish;
      const tick = (now) => {
        start ??= now;
        const progress = Math.min(1, (now - start) / 300);
        // Smoothstep has zero velocity at both ends, without overshoot.
        const eased = progress * progress * (3 - 2 * progress);
        el.scrollLeft = fromLeft + (left - fromLeft) * eased;
        el.scrollTop = fromTop + (top - fromTop) * eased;
        if (progress < 1) frame = requestAnimationFrame(tick);
        else finish();
      };
      frame = requestAnimationFrame(tick);
    });
  }

  async function go(n, { animate = false } = {}) {
    if (!session.pages.value.length) return;
    const previous = view.active.value,
      token = session.epoch,
      request = ++motion.pageJumpGeneration;
    cancelPageScroll();
    n = Math.min(session.pages.value.length, Math.max(1, Math.round(Number(n) || 1)));
    if (n !== previous) translationState.readingDirection = Math.sign(n - previous);
    translationState.translationMoving = true;
    motion.pageJumping = true;
    view.active.value = n;
    view.pageEntry.value = n;
    try {
      // Fit the destination before calculating its scroll position or content offsets.
      actions.readerViewport.mountAroundPage(n);
      await nextTick();
      if (token !== session.epoch || request !== motion.pageJumpGeneration) return;
      actions.readerFit.applyFit();
      await nextTick();
      if (token !== session.epoch || request !== motion.pageJumpGeneration) return;
      const frame = view.pageLayout.value.frames[n - 1],
        el = view.reader.value,
        host = renderState.layoutElement.value;
      if (frame && el && host) {
        const rect = host.getBoundingClientRect(),
          bounds = el.getBoundingClientRect(),
          style = getComputedStyle(el);
        const top = Math.max(
          0,
          Math.min(
            el.scrollHeight - el.clientHeight,
            el.scrollTop + rect.top + frame.y - bounds.top - parseFloat(style.paddingTop),
          ),
        );
        const left = Math.max(
          0,
          Math.min(
            el.scrollWidth - el.clientWidth,
            el.scrollLeft + rect.left + frame.x - bounds.left - parseFloat(style.paddingLeft),
          ),
        );
        if (animate && !actions.readerZoom.reducedMotion()) await animatePageScroll(el, left, top);
        else {
          el.scrollTop = top;
          el.scrollLeft = left;
        }
      }
    } finally {
      if (request === motion.pageJumpGeneration) {
        motion.pageJumping = false;
        if (token === session.epoch) {
          actions.readerViewport.viewportPages();
          actions.readerViewport.scheduleViewport();
          actions.readerScroll.scrolling();
        }
      }
    }
  }
  return { cancelPageScroll, interruptPageScroll, animatePageScroll, go };
}
