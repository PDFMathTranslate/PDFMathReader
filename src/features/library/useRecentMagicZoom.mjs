import { onBeforeUnmount, ref, watch } from 'vue';
import { magicZoomLayout } from './recent-magic-zoom.mjs';

const motionReduced = () =>
  document.documentElement.dataset.reduceMotion === 'true' ||
  matchMedia('(prefers-reduced-motion: reduce)').matches;

// Binds the dock-style zoom to a Recents gallery. `active` gates the whole effect.
export function useRecentMagicZoom(gallery, active) {
  const magnifying = ref(false);
  let pointerX = null;
  let frame = 0;

  function reset() {
    for (const item of gallery.value?.querySelectorAll('.recent-document') ?? []) {
      item.style.removeProperty('--magic-scale');
      item.style.removeProperty('--magic-shift');
    }
  }

  function paint() {
    frame = 0;
    const element = gallery.value;
    if (!element || pointerX === null) return reset();
    const items = [...element.querySelectorAll('.recent-document')];
    const x =
      pointerX - element.getBoundingClientRect().left - element.clientLeft + element.scrollLeft;
    const boxes = items.map((item) => ({
      center: item.offsetLeft + item.offsetWidth / 2,
      width: item.offsetWidth,
    }));
    magicZoomLayout(boxes, x).forEach(({ scale, shift }, index) => {
      items[index].style.setProperty('--magic-scale', scale.toFixed(4));
      items[index].style.setProperty('--magic-shift', `${shift.toFixed(2)}px`);
    });
  }

  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(paint);
  };

  function move(event) {
    if (!active.value || event.pointerType === 'touch' || motionReduced()) return;
    pointerX = event.clientX;
    magnifying.value = true;
    schedule();
  }

  function leave() {
    pointerX = null;
    magnifying.value = false;
    schedule();
  }

  const scroll = () => {
    if (pointerX !== null) schedule();
  };

  watch(active, (on) => {
    if (!on) leave();
  });
  onBeforeUnmount(() => cancelAnimationFrame(frame));

  return { magnifying, move, leave, scroll };
}
