// Dock-style magnification for the Recents gallery. `items` are laid-out boxes
// ({ center, width }) in the gallery's scroll coordinates; the result gives each
// item a scale and a horizontal shift so neighbours make room and the point under
// the pointer stays where it is.
export const MAGIC_ZOOM_MAX_SCALE = 2.4;
// Falloff width in item pitches (centre-to-centre spacing). Narrow enough that the
// direct neighbours of the focal cover only reach about 1.5x.
export const MAGIC_ZOOM_SPREAD = 0.7;
// Covers this many pitches from the pointer are back at their raw size.
export const MAGIC_ZOOM_REACH = 2;

// `leftRoom` / `rightRoom` (optional) are the visible space beyond the first and last
// covers. When an end cover is magnified, the anchor is pulled so it grows into the row
// instead of past the gallery edge; the pull fades with that cover's scale.
export function magicZoomLayout(items, pointerX, options = {}) {
  const {
    maxScale = MAGIC_ZOOM_MAX_SCALE,
    spread = MAGIC_ZOOM_SPREAD,
    reach = MAGIC_ZOOM_REACH,
    leftRoom = Infinity,
    rightRoom = Infinity,
  } = options;
  const sigma = spread * pitchOf(items);
  const cutoff = reach / spread;
  const tail = Math.exp(-(cutoff * cutoff) / 2);
  const scales = items.map(({ center }) => {
    const u = Math.abs(pointerX - center) / sigma;
    if (u >= cutoff) return 1;
    // Gaussian bump lowered by its tail so the curve reaches 1 without a step.
    return 1 + ((maxScale - 1) * (Math.exp(-(u * u) / 2) - tail)) / (1 - tail);
  });
  // Shift measured from the row's left edge, then re-anchored on the pointer.
  let grown = 0;
  const fromLeft = items.map(({ width }, index) => {
    const extra = (scales[index] - 1) * width;
    const shift = grown + extra / 2;
    grown += extra;
    return shift;
  });
  let anchor = interpolate(items, fromLeft, pointerX);
  if (items.length && maxScale > 1) {
    const weight = (scale) => 1 - (1 - (scale - 1) / (maxScale - 1)) ** 2;
    anchor -= weight(scales[0]) * Math.max(0, anchor - leftRoom);
    anchor += weight(scales.at(-1)) * Math.max(0, grown - rightRoom - anchor);
  }
  return items.map((_, index) => ({ scale: scales[index], shift: fromLeft[index] - anchor }));
}

function pitchOf(items) {
  if (items.length > 1) return (items.at(-1).center - items[0].center) / (items.length - 1);
  return (items[0]?.width ?? 140) + 18;
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

// Scroll position that brings a cover fully into view with `margin` to spare on the side
// it was cut off (room for its zoom). Returns null when it is already comfortably visible
// or the scroll range cannot improve on the current position.
export function revealScrollTarget({ left, width, scrollLeft, viewWidth, scrollWidth, margin }) {
  let target = scrollLeft;
  if (left - scrollLeft < margin) target = left - margin;
  else if (left + width - scrollLeft > viewWidth - margin)
    target = left + width - viewWidth + margin;
  target = Math.min(Math.max(scrollWidth - viewWidth, 0), Math.max(0, target));
  return Math.abs(target - scrollLeft) < 2 ? null : target;
}
