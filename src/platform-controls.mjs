/*
 * The desktop preload exposes the platform before Vue starts. Keep the
 * platform branch here so a macOS/Linux page never fetches the Windows
 * Fluent chunk, and a Windows page never imports MacVue at runtime.
 */
const detectedPlatform = globalThis.window?.previewAppearance?.platform;
export const platform = detectedPlatform || 'darwin';

const controls =
  platform === 'win32'
    ? await import('./platform-controls/fluent-windows.mjs')
    : await import('@macvue/core');

// The Windows renderer must not create an unupgraded Fluent host. In
// particular, a boolean `disabled="false"` attribute is still truthy when a
// custom element upgrades later. Wait for definitions before Vue mounts its
// first control; this branch is never evaluated for MacVue on macOS/Linux.
if (platform === 'win32' && typeof document !== 'undefined') {
  await controls.ensureFluent();
}

export const MacButton = controls.MacButton;
export const MacSwitch = controls.MacSwitch;
export const MacSlider = controls.MacSlider;
export const MacPopUpButton = controls.MacPopUpButton;
export const MacPopUpButtonItem = controls.MacPopUpButtonItem;
export const MacSegmentedControl = controls.MacSegmentedControl;
export const MacSegment = controls.MacSegment;
export const MacSecureField = controls.MacSecureField;
export const MacTextField = controls.MacTextField;
export const MacSearchField = controls.MacSearchField;
