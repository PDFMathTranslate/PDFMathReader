import {
  hasRuntimeCapability,
  loadPlatformAdapter,
  platform,
  runtimeCapabilities,
  runtimeMode,
  visualPlatform,
} from '../platform/runtime.mjs';

const controls = await loadPlatformAdapter();

export { hasRuntimeCapability, platform, runtimeCapabilities, runtimeMode, visualPlatform };

export const AppButton = controls.AppButton;
export const AppSwitch = controls.AppSwitch;
export const AppSlider = controls.AppSlider;
export const AppPopUpButton = controls.AppPopUpButton;
export const AppPopUpButtonItem = controls.AppPopUpButtonItem;
export const AppSegmentedControl = controls.AppSegmentedControl;
export const AppSegment = controls.AppSegment;
export const AppSecureField = controls.AppSecureField;
export const AppTextField = controls.AppTextField;
export const AppSearchField = controls.AppSearchField;

export const ensureFluent = controls.ensureFluent;
