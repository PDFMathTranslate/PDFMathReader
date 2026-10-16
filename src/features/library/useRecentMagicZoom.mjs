import { onBeforeUnmount, ref, watch } from 'vue';
import { magicZoomLayout, revealScrollTarget } from './recent-magic-zoom.mjs';

const motionReduced = () =>
  document.documentElement.dataset.reduceMotion === 'true' ||
  matchMedia('(prefers-reduced-motion: reduce)').matches;

// Binds the dock-style zoom to a Recents gallery. `active` gates the whole effect.
// The gallery is a click-through overlay, so pointer events come from its section: they
// count while over a cover or within the cover row's band (the gaps between covers).
const ROW_MARGIN = 14;
// Time constants (ms): fade of the whole effect, and the lag when following the pointer.
const FADE_MS = 110;
const FOLLOW_MS = 45;
// A cover cut off by the gallery edge slides into view once the pointer rests on it.
const REVEAL_DELAY_MS = 140;
const REVEAL_MIN_MS = 360;
const REVEAL_MAX_MS = 900;
// The pointer must travel this far (px) before another reveal can start, so the scroll
// itself (which slides new covers under a still pointer) cannot chain into more scrolls.
const REVEAL_RETRIGGER_PX = 4;
// Space (px) a revealed cover keeps from the gallery edge, so it has room to zoom.
const REVEAL_MARGIN = 112;
export function useRecentMagicZoom(gallery, active) {
  const magnifying = ref(false);
  // Pointer target and the smoothed position/amount that chase it. `amount` fades the
  // whole effect in on hover start and out on hover end; the rest follows the pointer.
  let targetX = null;
  let currentX = 0;
  let amount = 0;
  let goal = 0;
  let frame = 0;
  let last = 0;
  // Layout is measured when a hover starts (and on resize), never inside the frame loop:
  // reading geometry after writing transforms would force a style/layout pass per frame.
  let items = [];
  let boxes = [];
  let origin = 0;
  let scrollLeft = 0;
  let viewWidth = 0;
  let measured = false;
  // What each item currently shows, so unchanged items are not rewritten.
  let applied = [];

  function measure() {
    const element = gallery.value;
    if (!element) return;
    items = [...element.querySelectorAll('.recent-document')];
    boxes = items.map((item) => ({
      center: item.offsetLeft + item.offsetWidth / 2,
      width: item.offsetWidth,
    }));
    origin = element.getBoundingClientRect().left + element.clientLeft;
    scrollLeft = element.scrollLeft;
    viewWidth = element.clientWidth;
    applied = items.map(() => '');
    measured = true;
  }

  function reset() {
    for (const item of gallery.value?.querySelectorAll('.recent-document') ?? []) {
      item.style.removeProperty('transform');
      item.style.removeProperty('z-index');
    }
    applied = items.map(() => '');
  }

  function paint() {
    if (!measured) return;
    const x = currentX - origin + scrollLeft;
    // Smoothstep so the fade starts and ends gently instead of at full speed.
    const fade = amount * amount * (3 - 2 * amount);
    const first = boxes[0];
    const lastBox = boxes.at(-1);
    const room = first
      ? {
          leftRoom: Math.max(0, first.center - first.width / 2 - scrollLeft),
          rightRoom: Math.max(0, scrollLeft + viewWidth - lastBox.center - lastBox.width / 2),
        }
      : {};
    magicZoomLayout(boxes, x, room).forEach(({ scale, shift }, index) => {
      const eased = 1 + (scale - 1) * fade;
      // Covers that are not scaled get a translate-only 3D transform, so they slide on
      // the compositor; only the few magnified covers are re-rasterised.
      const shifted = (shift * fade).toFixed(1);
      const transform =
        eased < 1.001
          ? `translate3d(${shifted}px,0,0)`
          : `translate3d(${shifted}px,0,0) scale(${eased.toFixed(3)})`;
      if (transform === applied[index]) return;
      applied[index] = transform;
      const style = items[index].style;
      style.transform = transform;
      // Bigger covers stack above their smaller neighbours.
      style.zIndex = String(Math.round((eased - 1) * 100));
    });
  }

  function tick(now) {
    frame = 0;
    const dt = Math.min(now - (last || now - 16), 50);
    last = now;
    amount += (goal - amount) * (1 - Math.exp(-dt / FADE_MS));
    if (targetX !== null) currentX += (targetX - currentX) * (1 - Math.exp(-dt / FOLLOW_MS));
    const settled =
      Math.abs(goal - amount) < 0.002 && (targetX === null || Math.abs(targetX - currentX) < 0.3);
    if (settled) {
      amount = goal;
      if (targetX !== null) currentX = targetX;
    }
    if (goal === 0 && amount === 0) {
      reset();
      magnifying.value = false;
      last = 0;
      return;
    }
    paint();
    if (settled) last = 0;
    else schedule();
  }

  function schedule() {
    if (!frame) frame = requestAnimationFrame(tick);
  }

  function move(event) {
    if (!active.value || event.pointerType === 'touch' || motionReduced()) return;
    if (!onRow(event)) return leave();
    targetX = event.clientX;
    const hovered = event.target.closest?.('.recent-document');
    if (hovered) considerReveal(hovered, targetX);
    if (
      !measured ||
      (goal === 0 && amount === 0) ||
      items.length !== gallery.value?.children.length
    )
      measure();
    // First contact: start under the pointer so only the fade-in animates.
    if (goal === 0 && amount === 0) currentX = targetX;
    goal = 1;
    magnifying.value = true;
    schedule();
  }

  function leave() {
    // Keep the last position so the zoom fades out in place.
    goal = 0;
    reveal.anchor = null;
    clearTimeout(reveal.timer);
    reveal.timer = 0;
    if (amount > 0) schedule();
  }

  const reveal = { frame: 0, timer: 0, item: null, anchor: null };

  function revealTarget(item) {
    const element = gallery.value;
    if (!element) return null;
    return revealScrollTarget({
      left: item.offsetLeft,
      width: item.offsetWidth,
      scrollLeft: element.scrollLeft,
      viewWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      margin: REVEAL_MARGIN,
    });
  }

  function stopReveal() {
    cancelAnimationFrame(reveal.frame);
    clearTimeout(reveal.timer);
    reveal.frame = 0;
    reveal.timer = 0;
    reveal.item = null;
  }

  function animateScroll(to) {
    const element = gallery.value;
    if (!element) return;
    const from = element.scrollLeft;
    const distance = to - from;
    const duration = Math.min(REVEAL_MAX_MS, REVEAL_MIN_MS + Math.abs(distance) * 1.1);
    const began = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - began) / duration);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      element.scrollLeft = from + distance * eased;
      reveal.frame = t < 1 ? requestAnimationFrame(step) : 0;
    };
    reveal.frame = requestAnimationFrame(step);
  }

  function considerReveal(item, x) {
    if (reveal.frame) return;
    if (reveal.anchor !== null && Math.abs(x - reveal.anchor) <= REVEAL_RETRIGGER_PX) return;
    if (!revealTarget(item)) {
      clearTimeout(reveal.timer);
      reveal.timer = 0;
      reveal.item = null;
      return;
    }
    if (reveal.timer && reveal.item === item) return;
    clearTimeout(reveal.timer);
    reveal.item = item;
    reveal.timer = setTimeout(() => {
      reveal.timer = 0;
      const target = revealTarget(item);
      if (target === null) return;
      reveal.anchor = targetX;
      animateScroll(target);
    }, REVEAL_DELAY_MS);
  }

  function onRow(event) {
    if (event.target.closest?.('.recent-document')) return true;
    const element = gallery.value;
    const first = element?.querySelector('.recent-document');
    if (!first) return false;
    const top = element.getBoundingClientRect().top + element.clientTop - element.scrollTop;
    const rowTop = top + first.offsetTop - ROW_MARGIN;
    return event.clientY >= rowTop && event.clientY <= rowTop + first.offsetHeight + 2 * ROW_MARGIN;
  }

  const scroll = () => {
    scrollLeft = gallery.value?.scrollLeft ?? 0;
    if (goal) schedule();
  };
  const invalidate = () => {
    measured = false;
  };
  window.addEventListener('resize', invalidate);

  watch(active, (on) => {
    if (!on) {
      goal = 0;
      amount = 0;
      targetX = null;
      reset();
      magnifying.value = false;
    }
  });
  onBeforeUnmount(() => {
    cancelAnimationFrame(frame);
    stopReveal();
    window.removeEventListener('resize', invalidate);
  });

  return { magnifying, move, leave, scroll, stopReveal };
}
