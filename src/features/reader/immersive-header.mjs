import { ref, watch, nextTick } from 'vue';

// Header visibility owns only the immersive reader affordance.  It deliberately
// receives the reader state it observes instead of reaching into the window
// composition object, which keeps the scroll policy independent from layout.
export function createImmersiveHeader({
  autoHideHeader,
  pages,
  loading,
  restoringView,
  motion,
  pinching,
  settings,
  searchOpen,
  windowsMenuOpen,
  selectedParagraph,
  direction,
  reader,
  resizeFit,
}) {
  const immersiveHeaderHidden = ref(false);
  let immersiveLastPosition = 0;
  let immersiveTravel = 0;
  let immersiveIntentUntil = 0;
  let immersiveLightsTimer;

  function revealHeader() {
    immersiveHeaderHidden.value = false;
    immersiveTravel = 0;
  }

  function immersiveIntent(event) {
    if (!autoHideHeader.value || event.ctrlKey || event.metaKey) return;
    immersiveIntentUntil = performance.now() + 1500;
  }

  function immersiveScroll() {
    const el = reader.value;
    if (!el) return;
    const position = direction.value === 'horizontal' ? el.scrollLeft : el.scrollTop;
    const delta = position - immersiveLastPosition;
    immersiveLastPosition = position;
    if (!autoHideHeader.value) {
      if (immersiveHeaderHidden.value) revealHeader();
      return;
    }
    if (
      !pages.value.length ||
      loading.value ||
      restoringView.value ||
      motion.fitResizing ||
      pinching.value ||
      settings.value ||
      searchOpen.value ||
      windowsMenuOpen.value ||
      selectedParagraph.value ||
      performance.now() > immersiveIntentUntil
    ) {
      immersiveTravel = 0;
      return;
    }
    if (position <= 2) {
      revealHeader();
      return;
    }
    if (Math.abs(delta) < 0.5) return;
    immersiveTravel =
      Math.sign(delta) === Math.sign(immersiveTravel) ? immersiveTravel + delta : delta;
    if (immersiveTravel >= 18) {
      immersiveHeaderHidden.value = true;
      immersiveTravel = 0;
    } else if (immersiveTravel <= -6) revealHeader();
  }

  function immersivePointer(event) {
    if (!autoHideHeader.value || event.clientY <= 12) revealHeader();
  }

  watch(autoHideHeader, (enabled) => {
    if (!enabled) {
      clearTimeout(immersiveLightsTimer);
      revealHeader();
      void window.previewWindow?.setHeaderHidden?.(false);
    }
    nextTick(() => resizeFit(true));
  });

  watch(immersiveHeaderHidden, (hidden) => {
    clearTimeout(immersiveLightsTimer);
    if (!autoHideHeader.value) {
      if (hidden) immersiveHeaderHidden.value = false;
      void window.previewWindow?.setHeaderHidden?.(false);
      return;
    }
    if (hidden)
      immersiveLightsTimer = setTimeout(() => window.previewWindow?.setHeaderHidden?.(true), 180);
    else void window.previewWindow?.setHeaderHidden?.(false);
  });

  watch([direction, settings, searchOpen, () => pages.value.length], () => {
    revealHeader();
    immersiveIntentUntil = 0;
    nextTick(() => {
      immersiveLastPosition =
        direction.value === 'horizontal'
          ? reader.value?.scrollLeft || 0
          : reader.value?.scrollTop || 0;
    });
  });

  return {
    immersiveHeaderHidden,
    revealHeader,
    immersiveIntent,
    immersiveScroll,
    immersivePointer,
    get immersiveLightsTimer() {
      return immersiveLightsTimer;
    },
    set immersiveLightsTimer(value) {
      immersiveLightsTimer = value;
    },
  };
}
