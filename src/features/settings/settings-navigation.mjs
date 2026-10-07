import { nextTick } from 'vue';

export function createSettingsNavigation({ preferences, shell, runtime, kernel }) {
  async function openSettings(target) {
    if (
      !shell.settingsWindowMode &&
      shell.platform === 'darwin' &&
      window.previewWindow?.settings &&
      !window.previewWindow.settingsInline
    ) {
      await window.previewWindow.settings(
        target === 'language'
          ? 'translation'
          : target === 'kernel'
            ? 'kernel'
            : shell.settingsSection.value,
      );
      return;
    }
    shell.selectedParagraph.value = null;
    shell.settingsSection.value =
      target === 'language'
        ? 'translation'
        : target === 'kernel'
          ? 'kernel'
          : shell.settingsSection.value;
    shell.settings.value = true;
    await nextTick();
    if (target === 'language') {
      shell.languageInput.value?.focus();
      shell.languageMenuOpen.value = true;
    } else if (target === 'kernel') {
      runtime.kernelFocusPending = kernel.engineBusy.value;
      shell.kernelInput.value?.el
        ?.querySelector(
          '.macvue-pop-up-button,.macvue-segment[data-state="on"],[role=radio][aria-checked=true]',
        )
        ?.focus();
    }
  }

  function closeSettingsWindow() {
    void window.previewWindow?.close();
  }

  function chooseKernel(id) {
    runtime.kernelFocusPending = !!shell.kernelInput.value?.el?.contains(document.activeElement);
    preferences.engine.value = id;
  }

  function kernelKeys(e) {
    const current = kernel.kernelOptions.findIndex((k) => k.id === preferences.engine.value);
    const index =
      e.key === 'ArrowRight'
        ? Math.min(2, current + 1)
        : e.key === 'ArrowLeft'
          ? Math.max(0, current - 1)
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? 2
              : null;
    if (index === null) return;
    e.preventDefault();
    if (kernel.engineBusy.value) return;
    runtime.kernelFocusPending = true;
    preferences.engine.value = kernel.kernelOptions[index].id;
    nextTick(() =>
      shell.kernelInput.value?.el
        ?.querySelector(
          '.macvue-pop-up-button,.macvue-segment[data-state="on"],[role=radio][aria-checked=true]',
        )
        ?.focus(),
    );
  }

  function syncSettingsDropdownWidths() {
    if (shell.platform !== 'darwin') return;
    const panel = document.querySelector('.settings:not(.paragraph-detail)');
    if (!panel) return;
    const controls = [...panel.querySelectorAll('.macvue-pop-up-button')];
    let width = 0;
    for (const control of controls) {
      const sample = control.cloneNode(true);
      sample.removeAttribute('id');
      sample.setAttribute('aria-hidden', 'true');
      Object.assign(sample.style, {
        position: 'fixed',
        visibility: 'hidden',
        pointerEvents: 'none',
        width: 'max-content',
        minWidth: '0',
        maxWidth: 'none',
        font: getComputedStyle(control).font,
      });
      document.body.append(sample);
      width = Math.max(width, Math.ceil(sample.getBoundingClientRect().width));
      sample.remove();
    }
    if (width) panel.style.setProperty('--settings-dropdown-width', width + 'px');
  }
  return {
    openSettings,
    closeSettingsWindow,
    chooseKernel,
    kernelKeys,
    syncSettingsDropdownWidths,
  };
}
