import { nativeImage, nativeTheme } from 'electron';
import { createPersistentAppIcon } from './persistent-app-icon.mjs';
import { applicationPath } from '../../../runtime/node/application-paths.mjs';
import {
  APP_ICON_IDS,
  DARK_APP_ICON,
  DEFAULT_APP_ICON,
  isValidAppIcon,
} from '../../../shared/app-icons.mjs';

export const appIconPath = (id) =>
  applicationPath('electron', 'app-icons', `${isValidAppIcon(id) ? id : DEFAULT_APP_ICON}.png`);

export const activeAppIcon = (selected, dark = nativeTheme.shouldUseDarkColors) =>
  dark ? DARK_APP_ICON : isValidAppIcon(selected) ? selected : DEFAULT_APP_ICON;

// Settings previews show only the icon body, like macOS Settings tiles: crop the
// transparent canvas and drop the soft shadow so the squircle edge stays crisp.
export function appIconPreview(image, size = 96) {
  const { width, height } = image.getSize();
  const pixels = Buffer.from(image.toBitmap());
  const alpha = (x, y) => pixels[(y * width + x) * 4 + 3];
  let left = width,
    top = height,
    right = 0,
    bottom = 0;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (alpha(x, y) >= 128) {
        left = Math.min(left, x);
        right = Math.max(right, x + 1);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y + 1);
      }
  if (right <= left) return image.resize({ width: size, height: size, quality: 'best' });
  // The shadow never exceeds ~1/3 opacity; the body edge is antialiased above it.
  for (let offset = 0; offset < pixels.length; offset += 4)
    if (pixels[offset + 3] < 96) pixels.fill(0, offset, offset + 4);
  const side = Math.max(right - left, bottom - top);
  return nativeImage
    .createFromBitmap(pixels, { width, height })
    .crop({ x: left, y: top, width: side, height: side })
    .resize({ width: size, height: size, quality: 'best' });
}

// The chosen icon is applied at runtime: the Dock tile on macOS and every window
// icon elsewhere, switching to the dark icon while Dark Mode is in effect. The
// selected icon is also saved as the bundle’s custom icon for when it is closed.
export function createAppIcon({
  app,
  preferences,
  windows,
  platform = process.platform,
  dark = () => nativeTheme.shouldUseDarkColors,
}) {
  let previews, applied;
  const persist = createPersistentAppIcon({ app, platform });
  const current = () => {
    const id = preferences.load().appIcon;
    return isValidAppIcon(id) ? id : DEFAULT_APP_ICON;
  };
  const path = () => appIconPath(activeAppIcon(current(), dark()));
  function apply() {
    void persist(appIconPath(current())).catch((error) => {
      console.warn('Cannot persist application icon:', error.message);
    });
    const target = path();
    if (target === applied) return;
    const image = nativeImage.createFromPath(target);
    if (image.isEmpty()) return;
    applied = target;
    if (platform === 'darwin') app.dock?.setIcon(image);
    else for (const window of windows()) if (!window.isDestroyed()) window.setIcon(image);
  }
  function options() {
    previews ||= APP_ICON_IDS.map((id) => ({
      id,
      preview: appIconPreview(nativeImage.createFromPath(appIconPath(id))).toDataURL(),
    }));
    return { selected: current(), options: previews };
  }
  async function select(id) {
    if (!isValidAppIcon(id)) throw Error('Invalid app icon');
    await preferences.save({ appIcon: id });
    apply();
    await persist(appIconPath(id));
    return options();
  }
  return { path, apply, options, select };
}
