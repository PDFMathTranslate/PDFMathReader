import './reader.css';
import '@macvue/core/style.css';
import '../../ui/styles/controls.css';

// Linux intentionally retains the existing MacVue-compatible controls and
// self-drawn chrome. This adapter does not claim a native GTK implementation.
export * from '../macvue-controls.mjs';
