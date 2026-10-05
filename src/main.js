import { createApp } from 'vue';
import './style.css';
import '@macvue/core/style.css';
import './mac-controls.css';
import './continuous-corners.css';
if (new URLSearchParams(location.search).get('developer') === '1') {
  const { default: DeveloperWindow } = await import('./DeveloperWindow.vue');
  createApp(DeveloperWindow).mount('#app');
} else {
  const { default: App } = await import('./App.vue');
  createApp(App).mount('#app');
}
