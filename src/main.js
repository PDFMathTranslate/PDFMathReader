import { createApp } from 'vue';
import './style.css';
import { preparePlatform } from './platform/runtime.mjs';

// Resolve the visual adapter before Vue mounts. The adapter owns its platform
// CSS and, on Windows, waits for Fluent custom-element definitions as well.
await preparePlatform();
// Global overrides retain their original place after library/control styles.
await import('./ui/styles/continuous-corners.css');
await import('./ui/styles/experimental-typography.css');
// Enabled for the experimental test build; typography=original keeps the baseline.
if (new URLSearchParams(location.search).get('typography') !== 'original')
  document.documentElement.dataset.experimentalTypography = 'true';
if (new URLSearchParams(location.search).get('developer') === '1') {
  const { default: DeveloperWindow } = await import('./features/developer/DeveloperWindow.vue');
  createApp(DeveloperWindow).mount('#app');
} else {
  const { default: App } = await import('./App.vue');
  createApp(App).mount('#app');
  if (document.querySelector('.app[data-platform="darwin"]')) {
    await import('@glass-sdk/liquid-glass/styles.css');
    await import('./platform/macos/liquid-glass.css');
    await import('./platform/macos/liquid-glass-details.css');
    await import('./platform/macos/progressive-titlebar.css');
    await import('./platform/macos/liquid-glass-feedback.css');
    await import('./platform/macos/glass-context-menu.css');
    await import('./platform/macos/liquid-glass-popovers.css');
    const { installLiquidGlass } = await import('./platform/macos/liquid-glass.mjs');
    const disposeGlass = installLiquidGlass();
    const { installGlassContextMenu } = await import('./platform/macos/glass-context-menu.mjs');
    const disposeMenu = installGlassContextMenu();
    window.addEventListener('pagehide', disposeMenu, { once: true });
    if (import.meta.hot) import.meta.hot.dispose(disposeMenu);
    window.addEventListener('pagehide', disposeGlass, { once: true });
    if (import.meta.hot) import.meta.hot.dispose(disposeGlass);
  }
}
