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
}
