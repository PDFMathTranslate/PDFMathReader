// Dock-style magnification for the Recents gallery. `items` are laid-out boxes
// ({ center, width }) in the gallery's scroll coordinates; the result gives each
// item a scale and a horizontal shift so neighbours make room and the point under
// the pointer stays where it is.
export const MAGIC_ZOOM_MAX_SCALE = 1.45;
export const MAGIC_ZOOM_RADIUS = 170;

export function magicZoomLayout(items, pointerX, options = {}) {
  const { maxScale = MAGIC_ZOOM_MAX_SCALE, radius = MAGIC_ZOOM_RADIUS } = options;
  const scales = items.map(({ center }) => {
    const u = Math.abs(pointerX - center) / radius;
    return u >= 1 ? 1 : 1 + (maxScale - 1) * Math.cos((u * Math.PI) / 2) ** 2;
  });
  // Shift measured from the row's left edge, then re-anchored on the pointer.
  let grown = 0;
  const fromLeft = items.map(({ width }, index) => {
    const extra = (scales[index] - 1) * width;
    const shift = grown + extra / 2;
    grown += extra;
    return shift;
  });
  const anchor = interpolate(items, fromLeft, pointerX);
  return items.map((_, index) => ({ scale: scales[index], shift: fromLeft[index] - anchor }));
}

function interpolate(items, values, x) {
  if (!items.length) return 0;
  if (x <= items[0].center) return values[0];
  const last = items.length - 1;
  if (x >= items[last].center) return values[last];
  let index = 0;
  while (items[index + 1].center < x) index += 1;
  const span = items[index + 1].center - items[index].center;
  const ratio = span ? (x - items[index].center) / span : 0;
  return values[index] + (values[index + 1] - values[index]) * ratio;
}
