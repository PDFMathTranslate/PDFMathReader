// Alternate application icons. Artwork lives in doc/icons/app-<id>.png and
// `bun run icons:mac` derives electron/app-icons/<id>.png from it.
export const APP_ICON_IDS = Object.freeze([
  'base',
  'warm',
  'spring',
  'hist',
  'tech',
  'moon',
  'modern',
]);
export const DEFAULT_APP_ICON = 'base';
// Dark Mode always shows this icon; the chosen icon returns in Light Mode.
export const DARK_APP_ICON = 'moon';
export const isValidAppIcon = (value) => APP_ICON_IDS.includes(value);
