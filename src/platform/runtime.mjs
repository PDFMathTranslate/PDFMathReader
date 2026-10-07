/*
 * Renderer platform selection has two independent inputs:
 *
 *   - visualPlatform selects the control/chrome implementation used by this
 *     renderer, including the Windows UI test override;
 *   - runtimeCapabilities describe the bridge that is actually available.
 *
 * In particular, a Windows visual test launched on macOS keeps the macOS
 * preload capabilities. Do not derive bridge access from visualPlatform.
 */

const rendererWindow = globalThis.window;
const reportedPlatform = rendererWindow?.previewAppearance?.platform;

function selectVisualPlatform(value) {
  switch (value) {
    case 'darwin':
    case 'macos':
      return { id: 'macos', legacy: 'darwin' };
    case 'win32':
    case 'windows':
      return { id: 'windows', legacy: 'win32' };
    case 'linux':
      return { id: 'linux', legacy: 'linux' };
    case 'web':
    case 'browser':
    case undefined:
    case null:
      return { id: 'web', legacy: 'web' };
    default:
      // The browser fallback is the least surprising safe renderer when an
      // embedding host reports an unknown platform token.
      return { id: 'web', legacy: 'web' };
  }
}

const selectedVisualPlatform = selectVisualPlatform(reportedPlatform);

export const visualPlatform = selectedVisualPlatform.id;

// Keep the process-style values while existing feature callers migrate to the
// normalized visualPlatform names.
export const platform = selectedVisualPlatform.legacy;

const hasFunction = (object, property) => typeof object?.[property] === 'function';

/*
 * These flags deliberately inspect bridge capabilities, rather than the
 * visual platform. The --preview-ui-platform=win32 test flag changes only
 * previewAppearance.platform in preload and must not remove desktop APIs.
 */
export const runtimeCapabilities = Object.freeze({
  desktopBridge: Boolean(rendererWindow?.previewAppearance),
  appearance: hasFunction(rendererWindow?.previewAppearance, 'current'),
  preferences: hasFunction(rendererWindow?.previewPreferences, 'load'),
  files: hasFunction(rendererWindow?.previewDocuments, 'open'),
  filePaths: hasFunction(rendererWindow?.previewDocuments, 'claim'),
  nativeWindow: hasFunction(rendererWindow?.previewWindow, 'close'),
  credentials: hasFunction(rendererWindow?.previewCredentials, 'status'),
  serviceCredentials: hasFunction(rendererWindow?.previewServiceCredentials, 'status'),
  annotations: hasFunction(rendererWindow?.previewAnnotations, 'load'),
  nativeActions: hasFunction(rendererWindow?.previewActions, 'onAction'),
});

export const runtimeMode = runtimeCapabilities.desktopBridge ? 'desktop' : 'web';

export function hasRuntimeCapability(name) {
  return runtimeCapabilities[name] === true;
}

let adapterPromise;

export function loadPlatformAdapter() {
  if (!adapterPromise) {
    switch (visualPlatform) {
      case 'macos':
        adapterPromise = import('./macos/index.mjs');
        break;
      case 'windows':
        adapterPromise = import('./windows/index.mjs');
        break;
      case 'linux':
        adapterPromise = import('./linux/index.mjs');
        break;
      case 'web':
      default:
        adapterPromise = import('./web/index.mjs');
        break;
    }
  }
  return adapterPromise;
}

// main.js calls this before Vue is mounted so platform CSS and custom-element
// definitions are ready before the first control renders.
export const preparePlatform = loadPlatformAdapter;
