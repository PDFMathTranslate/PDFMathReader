// Prioritize readable visible pages while bounding individual backing stores.
export function renderPixelRatio(width, height, screenRatio = 1, visible = true) {
  const bytes = (visible ? 64 : 16) * 1024 * 1024;
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
  const x = Math.max(0, Math.min(0.8, Number(crop.x) || 0));
  const y = Math.max(0, Math.min(0.8, Number(crop.y) || 0));
  return {
    x: (width * x) / 2,
    y: (height * y) / 2,
    width: width * (1 - x),
    height: height * (1 - y),
    fullWidth: width,
    fullHeight: height,
  };
}
