import { ref } from 'vue';

const HIGHLIGHT_DURATION = 320;
const DRAG_RADIUS = 14;

export function useAnnotationMotion({ getZoom, getGesture, getEraseHasLines, onRemove }) {
  const motion = ref(null);
  const erasing = ref(new Map());
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const eraseTimers = new Map();
  let motionFrame = 0;
  let motionTime = 0;

  function motionStyle(a, r, m = motion.value) {
    if (m?.id !== a.id) return {};
    const zoom = getZoom();
    const x = r.x * zoom,
      y = r.y * zoom,
      w = r.width * zoom,
      h = r.height * zoom;
    const distance = Math.hypot(
      Math.max(x - m.anchorX, 0, m.anchorX - x - w),
      Math.max(y - m.anchorY, 0, m.anchorY - y - h),
    );
    const influence = Math.exp(-distance / 64),
      weight = influence,
      tiltLimit = (Math.atan2(2, Math.max(w, h, 16)) * 180) / Math.PI;
    return {
      transform: `translate(${m.x * weight}px,${m.y * weight}px) rotate(${Math.max(-tiltLimit, Math.min(tiltLimit, m.tilt)) * weight}deg) scale(${1 + m.stretch * weight},${1 - m.stretch * weight})`,
      transformOrigin: `${Math.max(0, Math.min(w, m.anchorX - x))}px ${Math.max(0, Math.min(h, m.anchorY - y))}px`,
      transition: 'none',
      zIndex: 2,
    };
  }

  function animateMotion(time) {
    motionFrame = 0;
    const m = motion.value;
    if (!m || m.deleting) return;
    const dt = Math.min((time - (motionTime || time)) / 1000, 1 / 60);
    motionTime = time;
    for (const axis of ['x', 'y']) {
      const velocity = axis === 'x' ? 'vx' : 'vy',
        target = axis === 'x' ? 'tx' : 'ty';
      // A tether restores the original position; gravity fades as it settles.
      const gravity = axis === 'y' && !getGesture() ? Math.min(90, Math.hypot(m.x, m.y) * 18) : 0;
      m[velocity] += (360 * (m[target] - m[axis]) - 30 * m[velocity] + gravity) * dt;
      m[axis] += m[velocity] * dt;
    }
    const displacement = Math.hypot(m.x, m.y);
    if (displacement > DRAG_RADIUS) {
      const ratio = DRAG_RADIUS / displacement;
      m.x *= ratio;
      m.y *= ratio;
      const outward = (m.vx * m.x + m.vy * m.y) / (DRAG_RADIUS * DRAG_RADIUS);
      if (outward > 0) {
        m.vx -= outward * m.x;
        m.vy -= outward * m.y;
      }
    }
    const speed = Math.hypot(m.vx, m.vy);
    m.stretch = reducedMotion.matches ? 0 : Math.min(0.025, speed / 10000);
    m.tilt = reducedMotion.matches ? 0 : Math.max(-1.2, Math.min(1.2, m.x / 12 + m.vx / 300));
    if (!getGesture() && Math.hypot(m.x, m.y) < 0.15 && speed < 1) {
      motion.value = null;
      motionTime = 0;
      return;
    }
    motionFrame = requestAnimationFrame(animateMotion);
  }

  function startMotion() {
    if (!motionFrame) {
      motionTime = 0;
      motionFrame = requestAnimationFrame(animateMotion);
    }
  }

  function begin(a, event, host) {
    cancelAnimationFrame(motionFrame);
    motionFrame = 0;
    const bounds = host.getBoundingClientRect();
    motion.value = {
      id: a.id,
      anchorX: event.clientX - bounds.left,
      anchorY: event.clientY - bounds.top,
      x: 0,
      y: 0,
      tx: 0,
      ty: 0,
      vx: 0,
      vy: 0,
      stretch: 0,
      tilt: 0,
      deleting: false,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {}
  }

  function updateTarget(dx, dy) {
    const m = motion.value;
    if (!m) return;
    const distance = Math.hypot(dx, dy),
      scale = distance ? (DRAG_RADIUS * Math.tanh(distance / 32)) / distance : 0;
    m.tx = dx * scale;
    m.ty = dy * scale;
    if (reducedMotion.matches) {
      m.x = m.tx;
      m.y = m.ty;
    }
    startMotion();
  }

  function finish(gesture, cancelled = false) {
    const m = motion.value;
    if (!m || m.id !== gesture.a.id) return;
    if (!cancelled && gesture.shake.recognized) {
      onRemove(gesture.a);
      return;
    }
    m.tx = 0;
    m.ty = 0;
    if (reducedMotion.matches) {
      cancelAnimationFrame(motionFrame);
      motionFrame = 0;
      motion.value = null;
    } else {
      m.vy += 24;
      startMotion();
    }
  }

  function beginErase(a) {
    const snapshot = { ...a };
    const timer = setTimeout(() => {
      erasing.value.delete(a.id);
      eraseTimers.delete(a.id);
    }, HIGHLIGHT_DURATION);
    erasing.value.set(a.id, snapshot);
    eraseTimers.set(a.id, timer);
  }

  function eraseStyle(a, index, r) {
    if (!erasing.value.has(a.id)) return {};
    const widths = a.rects.map((rect) => Math.max(1, rect.width));
    const total = widths.reduce((sum, width) => sum + width, 0);
    const hasLines = getEraseHasLines(a);
    const hasNote = a.eraseHasNote;
    const lineDuration = hasLines ? HIGHLIGHT_DURATION - (hasNote ? 60 : 0) : 0;
    const duration =
      index === undefined
        ? HIGHLIGHT_DURATION - lineDuration
        : (lineDuration * widths[index]) / total;
    const delay =
      index === undefined
        ? lineDuration
        : (lineDuration * widths.slice(index + 1).reduce((sum, width) => sum + width, 0)) / total;
    return {
      '--erase-duration': duration + 'ms',
      '--erase-delay': delay + 'ms',
      ...motionStyle(a, r, a.eraseMotion),
    };
  }

  function cancelFor(id) {
    if (motion.value?.id !== id) return;
    cancelAnimationFrame(motionFrame);
    motionFrame = 0;
    motion.value = null;
  }

  function cleanup() {
    cancelAnimationFrame(motionFrame);
    motionFrame = 0;
    motion.value = null;
    eraseTimers.forEach(clearTimeout);
    eraseTimers.clear();
    erasing.value.clear();
  }

  return {
    motion,
    erasing,
    reducedMotion,
    highlightDuration: HIGHLIGHT_DURATION,
    motionStyle,
    eraseStyle,
    begin,
    updateTarget,
    finish,
    beginErase,
    cancelFor,
    startMotion,
    cleanup,
  };
}
