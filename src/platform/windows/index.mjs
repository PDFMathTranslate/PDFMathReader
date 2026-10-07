import './reader.css';
import '../../ui/styles/controls.css';
import './controls.css';
import * as controls from './fluent-controls.mjs';

// Fluent is the only control implementation imported by the Windows visual
// adapter. In particular, this module has no MacVue JavaScript dependency.
await controls.ensureFluent();

export * from './fluent-controls.mjs';
