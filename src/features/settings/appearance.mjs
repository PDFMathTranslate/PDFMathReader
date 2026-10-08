import { platform } from '../../platform/runtime.mjs';

export function createAppearanceSettings({ preferences, appearance, runtime }) {
  function renderAppearance() {
    const root = document.documentElement,
      theme =
        preferences.appearanceChoice.value === 'system'
          ? appearance.systemDark.value
            ? 'dark'
            : 'light'
          : preferences.appearanceChoice.value;
    const reduced =
      preferences.reduceMotion.value || matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.dataset.interfaceStyle =
      platform === 'darwin' ? preferences.interfaceStyle.value : 'default';
    root.dataset.reduceMotion = String(preferences.reduceMotion.value);
    root.dataset.reduceTransparency = String(preferences.reduceTransparency.value);
    root.dataset.reducePadding = String(preferences.reducePadding.value);
    const color =
      preferences.accentColor.value === 'system'
        ? appearance.systemAccentColor.value
        : preferences.accentColor.value;
    root.style.setProperty('--system-accent', appearance.systemAccentColor.value);
    root.style.setProperty('--accent', color);
    root.style.setProperty('--macvue-accent', color);
    const applyTheme = () => {
      root.dataset.macvueAppearance = runtime.appearanceTarget;
      root.dataset.appearance = runtime.appearanceTarget;
    };
    if (reduced) {
      runtime.appearanceTransition?.skipTransition();
      runtime.appearanceTarget = theme;
      applyTheme();
      return;
    }
    if (runtime.appearanceTarget === theme) return;
    runtime.appearanceTarget = theme;
    runtime.appearanceTransition?.skipTransition();
    if (
      !preferences.loadingPreferences &&
      root.dataset.appearance &&
      document.startViewTransition
    ) {
      runtime.appearanceTransition = document.startViewTransition(applyTheme);
      runtime.appearanceTransition.ready.catch(() => {});
      runtime.appearanceTransition.finished.catch(() => {});
    } else applyTheme();
  }

  function applyAppearance(state) {
    const { accent, dark } = state;
    if (typeof dark === 'boolean') appearance.systemDark.value = dark;
    if (accent) appearance.systemAccentColor.value = accent.slice(0, 7);
    if (state.appearance) {
      preferences.interfaceStyle.value =
        state.interfaceStyle === 'liquid-glass' ? 'liquid-glass' : 'default';
      preferences.appearanceChoice.value = state.appearance;
      preferences.accentColor.value = state.accentColor || 'system';
      preferences.reduceMotion.value = !!state.reduceMotion;
      preferences.reduceTransparency.value = !!state.reduceTransparency;
      preferences.reducePadding.value = !!state.reducePadding;
    }
    renderAppearance();
  }
  return { renderAppearance, applyAppearance };
}
