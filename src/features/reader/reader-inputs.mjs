import {
  createScrubInput,
  formatPercentValue,
  parsePercentValue,
} from '../../ui/inputs/scrub-input.mjs';
import { clampZoom } from './zoom-motion.mjs';

export function createReaderInputs({ session, motion, shell, view, actions }) {
  function nativeReaderInput(control) {
    const input = control?.getInput?.() || control;
    if (input && control?.el) {
      input.inputMode = control.el.getAttribute('inputmode') || 'text';
      input.dataset.scrub = control.el.dataset.scrub;
    }
    return input;
  }

  function syncScrubInputs() {
    const specs = [
      [
        'page',
        nativeReaderInput(shell.pageInput.value),
        {
          getValue: () => Number(view.pageEntry.value) || view.active.value,
          setValue: (value) => {
            view.pageEntry.value = Math.round(value);
          },
          min: 1,
          max: Math.max(1, session.pages.value.length),
          step: 1,
          pixelsPerStep: 18,
          deltaToValue: (value, delta) => Math.round(value + delta),
          onCommit: submitPage,
        },
      ],
      [
        'zoom',
        nativeReaderInput(shell.zoomInput.value),
        {
          getValue: () => view.zoom.value,
          setValue: (value) => {
            view.zoomEntry.value = formatPercentValue(value);
            view.fitMode.value = 'manual';
            localStorage.setItem('readerFit', 'manual');
            actions.readerZoom.requestZoom(value, { animate: false });
          },
          min: 0.1,
          max: 4,
          step: 0.01,
          pixelsPerStep: 18,
          deltaToValue: (value, delta) => clampZoom(value * Math.exp(delta * 0.06)),
          onCommit: () => actions.preferencePersistence.saveView(),
        },
      ],
    ];
    const live = new Set();
    for (const [name, input, options] of specs) {
      if (!input) continue;
      live.add(name);
      if (motion.scrubbers.get(name)?.input === input) continue;
      motion.scrubbers.get(name)?.controller.destroy();
      motion.scrubbers.set(name, { input, controller: createScrubInput(input, options) });
    }
    for (const [name, entry] of motion.scrubbers)
      if (!live.has(name)) {
        entry.controller.destroy();
        motion.scrubbers.delete(name);
      }
  }

  function hideNavigatorLater() {
    clearTimeout(motion.navigatorTimer);
    motion.navigatorTimer = setTimeout(() => {
      if (
        !shell.navigator.value?.contains(document.activeElement) &&
        !shell.navigator.value?.matches(':hover')
      )
        motion.navigatorVisible.value = false;
    }, 1000);
  }

  function holdNavigator() {
    clearTimeout(motion.navigatorTimer);
  }

  function showNavigator() {
    motion.navigatorVisible.value = !!session.pages.value.length;
    hideNavigatorLater();
  }

  function submitPage() {
    actions.pageNavigation.go(Number(view.pageEntry.value), { animate: true });
  }

  function zoomEntryInput(event) {
    view.zoomEntry.value = event.target.value;
  }

  function submitZoom(event) {
    const target = parsePercentValue(view.zoomEntry.value, {
      min: 0.1,
      max: 4,
      fallback: view.zoom.value,
    });
    view.fitMode.value = 'manual';
    localStorage.setItem('readerFit', 'manual');
    actions.readerZoom.requestZoom(target);
    view.zoomEntry.value = formatPercentValue(target);
    actions.preferencePersistence.saveView();
    if (event?.target && event.target.value !== view.zoomEntry.value)
      event.target.value = view.zoomEntry.value;
  }
  return {
    nativeReaderInput,
    syncScrubInputs,
    hideNavigatorLater,
    holdNavigator,
    showNavigator,
    submitPage,
    zoomEntryInput,
    submitZoom,
  };
}
