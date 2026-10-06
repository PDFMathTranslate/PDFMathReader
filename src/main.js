import { createApp } from 'vue';
import './style.css';
import '@macvue/core/style.css';
import './mac-controls.css';
import './continuous-corners.css';
import './experimental-typography.css';
// Enabled for the experimental test build; typography=original keeps the baseline.
if (new URLSearchParams(location.search).get('typography') !== 'original')
  document.documentElement.dataset.experimentalTypography = 'true';
if (new URLSearchParams(location.search).get('developer') === '1') {
  const { default: DeveloperWindow } = await import('./DeveloperWindow.vue');
  createApp(DeveloperWindow).mount('#app');
} else {
  const { default: App } = await import('./App.vue');
  createApp(App).mount('#app');
}
