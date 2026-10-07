import { ref } from 'vue';
import { createAnnotationShake, updateAnnotationShake } from './annotation-shake.mjs';

export function useAnnotationGestures({ getHost, focused, motion, onHint, onFocusChanged }) {
  const pointer = ref({ x: 0, y: 0 });
  const gesture = ref(null);
  let suppressClickUntil = 0;

  function isClickSuppressed() {
    return performance.now() < suppressClickUntil;
  }

  function down(a, event) {
    if (event.button !== 0 || motion.erasing.value.has(a.id)) return;
    if (focused.value?.id !== a.id) onFocusChanged();
    focused.value = a;
    pointer.value = { x: event.clientX, y: event.clientY };
    onHint();
    gesture.value = {
      a,
      x: event.clientX,
      y: event.clientY,
      shake: createAnnotationShake(event.clientX, event.clientY),
      pointerId: event.pointerId,
      dragged: false,
    };
    motion.begin(a, event, getHost());
  }

  function observePointer(event) {
    pointer.value = { x: event.clientX, y: event.clientY };
  }

  function move(event) {
    pointer.value = { x: event.clientX, y: event.clientY };
    const current = gesture.value;
    if (!current || current.pointerId !== event.pointerId) return;
    const dx = event.clientX - current.x,
      dy = event.clientY - current.y;
    current.dragged ||= Math.hypot(dx, dy) > 4;
    motion.updateTarget(dx, dy);
    updateAnnotationShake(current.shake, event.clientX, event.clientY);
  }

  function finishGesture(event, cancelled = false) {
    const current = gesture.value;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!cancelled) move(event);
    gesture.value = null;
    if (current.dragged) suppressClickUntil = performance.now() + 400;
    motion.finish(current, cancelled);
  }

  function cleanup() {
    gesture.value = null;
    suppressClickUntil = 0;
  }

  return {
    pointer,
    gesture,
    down,
    move,
    finishGesture,
    observePointer,
    isClickSuppressed,
    cleanup,
  };
}
