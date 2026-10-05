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
