// Experimental: wheel input in the reader drives a target offset that the view
// chases every frame, so notched mouse wheels and juddering event streams glide
// instead of jumping. Pinch zoom (ctrl+wheel) keeps its own handler.
const TIME_CONSTANT_MS = 70;
// Chromium snaps read-back offsets to device pixels; larger drift means
// something else (scrollbar, keyboard, page jump, zoom) moved the view.
const DRIFT_PX = 2;

// A notched wheel reports whole-line or 120-unit steps on one axis; trackpads
// stream small, fractional or two-axis deltas. Once a trackpad is seen, its
// momentum tail stays classified as trackpad.
let lastTrackpad = 0;
export function isMouseWheel(e, now = performance.now()) {
  const notched =
    e.deltaMode !== 0 ||
    (!e.deltaX &&
      Number.isInteger(e.deltaY) &&
      e.wheelDeltaY !== undefined &&
      Math.abs(e.wheelDeltaY) >= 120 &&
      e.wheelDeltaY % 120 === 0);
  if (!notched) {
    lastTrackpad = now;
    return false;
  }
  return now - lastTrackpad > 250;
}

export function wheelPixels(event, el) {
  const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? null : 1;
  return {
    x: event.deltaX * (scale ?? el.clientWidth),
    y: event.deltaY * (scale ?? el.clientHeight),
  };
}

// Fraction of the remaining distance covered in `dt` ms (exponential chase).
export function chaseStep(position, target, dt, tau = TIME_CONSTANT_MS) {
  return position + (target - position) * (1 - Math.exp(-Math.max(0, dt) / tau));
}

function clamp(value, max) {
  return Math.min(Math.max(0, max), Math.max(0, value));
}

// A scrollable element between the event target and the reader takes the wheel itself.
export function nestedScroller(target, root, dx, dy, style = getComputedStyle) {
  for (let node = target; node && node !== root; node = node.parentElement) {
    if (node.nodeType !== 1) continue;
    const { overflowX, overflowY } = style(node);
    const scrollsY = /auto|scroll/.test(overflowY) && node.scrollHeight > node.clientHeight;
    const scrollsX = /auto|scroll/.test(overflowX) && node.scrollWidth > node.clientWidth;
    if (
      (dy &&
        scrollsY &&
        (dy < 0 ? node.scrollTop > 0 : node.scrollTop + node.clientHeight < node.scrollHeight)) ||
      (dx &&
        scrollsX &&
        (dx < 0 ? node.scrollLeft > 0 : node.scrollLeft + node.clientWidth < node.scrollWidth))
    )
      return node;
  }
  return null;
}

export function createSmoothWheel({ motion, preferences, view }) {
  let frame = 0,
    last = 0,
    position = null,
    target = null;

  function cancelSmoothWheel() {
    cancelAnimationFrame(frame);
    frame = 0;
    position = target = null;
  }

  function reduced() {
    return preferences.reduceMotion.value || matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function tick(now) {
    frame = 0;
    const el = view.reader.value;
    if (!el || !position || motion.pageJumping || motion.pinching.value) return cancelSmoothWheel();
    if (
      Math.abs(el.scrollLeft - position.x) > DRIFT_PX ||
      Math.abs(el.scrollTop - position.y) > DRIFT_PX
    )
      return cancelSmoothWheel();
    const dt = Math.min(64, now - last);
    last = now;
    position = {
      x: chaseStep(position.x, target.x, dt),
      y: chaseStep(position.y, target.y, dt),
    };
    if (Math.abs(target.x - position.x) < 0.5 && Math.abs(target.y - position.y) < 0.5)
      position = { ...target };
    el.scrollLeft = position.x;
    el.scrollTop = position.y;
    if (position.x === target.x && position.y === target.y) return cancelSmoothWheel();
    frame = requestAnimationFrame(tick);
  }

  function smoothWheel(e) {
    if (!preferences.forceSmoothScrolling.value || e.ctrlKey || e.defaultPrevented) return;
    if (preferences.smoothScrollingMouseOnly?.value && !isMouseWheel(e)) return;
    const el = view.reader.value;
    if (!el || motion.pinching.value || reduced()) return;
    const delta = wheelPixels(e, el);
    if (!delta.x && !delta.y) return;
    if (nestedScroller(e.target, el, delta.x, delta.y)) return;
    const maxX = el.scrollWidth - el.clientWidth,
      maxY = el.scrollHeight - el.clientHeight;
    // Resume from where the view actually is unless a glide is already underway.
    if (!frame || !position) {
      position = { x: el.scrollLeft, y: el.scrollTop };
      target = { ...position };
      last = performance.now();
    }
    target = { x: clamp(target.x + delta.x, maxX), y: clamp(target.y + delta.y, maxY) };
    e.preventDefault();
    frame ||= requestAnimationFrame(tick);
  }

  return { smoothWheel, cancelSmoothWheel };
}
