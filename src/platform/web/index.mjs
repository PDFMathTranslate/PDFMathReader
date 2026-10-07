import '@macvue/core/style.css';
import '../../ui/styles/controls.css';

// The browser path keeps the same MacVue-compatible controls as Linux while
// leaving all Electron bridge capabilities absent when no preload exists.
export * from '../macvue-controls.mjs';
