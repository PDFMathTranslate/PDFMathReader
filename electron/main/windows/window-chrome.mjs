export {
  commandAccelerator,
  closeWindowAccelerator,
  shortcutAction,
} from '../../../shared/commands/shortcuts.mjs';
export {
  serializeApplicationMenu,
  menuPathItems,
  menuItemAtPath,
} from '../../../shared/commands/menu.mjs';

const MACOS_WINDOW_CHROME = Object.freeze({
  titleBarStyle: 'hiddenInset',
  trafficLightPosition: { x: 18, y: 24 },
  vibrancy: 'sidebar',
  // Keep the behind-window material visible while another app has focus.
  visualEffectState: 'active',
  backgroundColor: '#00000000',
});
// Windows owns its titlebar in the renderer. Keeping this window frameless
// also means immersive header hiding cannot leave a native title overlay
// behind the hidden toolbar.
const WINDOWS_WINDOW_CHROME = Object.freeze({
  frame: false,
  autoHideMenuBar: true,
  backgroundColor: '#f7f7f9',
});
const NATIVE_WINDOW_CHROME = Object.freeze({ backgroundColor: '#f7f7f9' });
export function windowChromeOptions(
  platform,
  { windowsBuild = 0, reduceTransparency = false } = {},
) {
  if (platform === 'darwin')
    return {
      ...MACOS_WINDOW_CHROME,
      trafficLightPosition: { ...MACOS_WINDOW_CHROME.trafficLightPosition },
    };
  if (platform === 'win32' && windowsBuild >= 22621 && !reduceTransparency)
    return {
      ...WINDOWS_WINDOW_CHROME,
      backgroundMaterial: 'acrylic',
      backgroundColor: '#00000000',
    };
  return ['win32', 'linux'].includes(platform)
    ? { ...WINDOWS_WINDOW_CHROME }
    : { ...NATIVE_WINDOW_CHROME };
}
