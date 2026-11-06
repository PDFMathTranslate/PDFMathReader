import { normalizeCrop } from '../../../shared/reader/crop-geometry.mjs';

export {
  CROP_MAX,
  CROP_SIDES,
  cropFromView,
  cropIsActive,
  cropSidesValid,
  cropViewFields,
  normalizeCrop,
  setCropAxis,
} from '../../../shared/reader/crop-geometry.mjs';

// Prioritize readable visible pages while bounding individual backing stores.
// The smaller budget still fits a fit-width Retina page at full ratio, so its
// scroll preview or prefetch is not drawn a second time once it settles.
export function renderPixelRatio(width, height, screenRatio = 1, visible = true) {
  const bytes = (visible ? 64 : 24) * 1024 * 1024;
  return Math.min(
    Math.max(1, screenRatio),
    Math.sqrt(bytes / (width * height * 4)),
    16384 / Math.max(width, height),
  );
}

// Keep scrolling text sharp on Retina displays while bounding pixel work.
export function scrollPixelRatio(width, height, screenRatio = 1) {
  return renderPixelRatio(width, height, screenRatio, false);
}

// Render the retained area, rather than spending the bitmap budget on margins
// that the crop frame hides. Coordinates remain in the original page space.
export function renderFrame(width, height, crop = { x: 0, y: 0 }) {
  const normalized = normalizeCrop(crop),
    x = normalized.left,
    y = normalized.top,
    right = normalized.right,
    bottom = normalized.bottom;
  return {
    x: width * x,
    y: height * y,
    width: width * (1 - x - right),
    height: height * (1 - y - bottom),
    fullWidth: width,
    fullHeight: height,
  };
}
