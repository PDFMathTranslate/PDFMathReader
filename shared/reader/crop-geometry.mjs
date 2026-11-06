// Crop fractions are measured against the original page.  The legacy x/y
// values describe the total amount removed from an axis and are therefore
// split equally between its two sides.
export const CROP_SIDES = ['left', 'right', 'top', 'bottom'];
export const CROP_MAX = 0.8;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, maximum = CROP_MAX) {
  return Math.max(0, Math.min(maximum, finite(value)));
}

function axisSides(input, first, second, legacy) {
  const hasFirst = Object.hasOwn(input, first),
    hasSecond = Object.hasOwn(input, second),
    total = Object.hasOwn(input, legacy) ? clamp(input[legacy]) : undefined;
  let start = hasFirst ? clamp(input[first]) : total === undefined ? 0 : total / 2,
    end = hasSecond ? clamp(input[second]) : total === undefined ? 0 : total / 2;
  // A caller may provide one side together with the old total.  Fill the
  // missing side from that total instead of silently discarding the alias.
  if (total !== undefined && hasFirst && !hasSecond) end = clamp(total - start);
  if (total !== undefined && hasSecond && !hasFirst) start = clamp(total - end);
  const sum = start + end;
  if (sum > CROP_MAX) {
    const scale = CROP_MAX / sum;
    start *= scale;
    end *= scale;
  }
  return [start, end];
}

/**
 * Return a canonical crop while retaining legacy x/y aliases.
 *
 * The function is deliberately forgiving because it is used for persisted
 * state and interactive input.  Invalid or missing numbers become zero, and
 * opposing sides are scaled together when their sum exceeds the supported
 * maximum so the retained page always has a positive size.
 */
export function normalizeCrop(crop = {}) {
  if (!crop || typeof crop !== 'object' || Array.isArray(crop)) crop = {};
  const flat = {};
  for (const side of CROP_SIDES) {
    const key = 'crop' + side[0].toUpperCase() + side.slice(1);
    if (Object.hasOwn(crop, side)) flat[side] = crop[side];
    else if (Object.hasOwn(crop, key)) flat[side] = crop[key];
  }
  crop = { ...crop, ...flat };
  const [left, right] = axisSides(crop, 'left', 'right', 'x'),
    [top, bottom] = axisSides(crop, 'top', 'bottom', 'y');
  const total = (first, second) => Math.round((first + second) * 1e12) / 1e12;
  return {
    left,
    right,
    top,
    bottom,
    x: total(left, right),
    y: total(top, bottom),
  };
}

/** Convert a stored reading view (or crop object) to the canonical shape. */
export function cropFromView(view = {}, defaults = {}) {
  const source = view?.crop && typeof view.crop === 'object' ? view.crop : view;
  const hasSides = CROP_SIDES.some((side) => Object.hasOwn(source || {}, side));
  if (hasSides) return normalizeCrop(source);
  const flatSides = CROP_SIDES.map((side) => 'crop' + side[0].toUpperCase() + side.slice(1)),
    hasFlatSides = flatSides.some((key) => Object.hasOwn(view || {}, key));
  if (hasFlatSides)
    return normalizeCrop({
      x: view?.cropX ?? source?.x ?? defaults.x,
      y: view?.cropY ?? source?.y ?? defaults.y,
      ...Object.fromEntries(
        CROP_SIDES.filter((side, index) => Object.hasOwn(view || {}, flatSides[index])).map(
          (side) => [side, view[flatSides[CROP_SIDES.indexOf(side)]]],
        ),
      ),
    });
  return normalizeCrop({
    x: view?.cropX ?? source?.x ?? defaults.x,
    y: view?.cropY ?? source?.y ?? defaults.y,
  });
}

/** Fields written to a reading view while keeping old cropX/cropY readers valid. */
export function cropViewFields(crop) {
  const normalized = normalizeCrop(crop);
  return {
    cropX: normalized.x,
    cropY: normalized.y,
    cropLeft: normalized.left,
    cropRight: normalized.right,
    cropTop: normalized.top,
    cropBottom: normalized.bottom,
  };
}

export function cropIsActive(crop) {
  const normalized = normalizeCrop(crop);
  return normalized.x > 0 || normalized.y > 0;
}

/**
 * Change a legacy axis total while preserving an existing asymmetric split.
 * A zero axis starts symmetrically, matching the old crop commands.
 */
export function setCropAxis(crop, axis, total) {
  const normalized = normalizeCrop(crop),
    next = clamp(total),
    [first, second] = axis === 'x' ? ['left', 'right'] : ['top', 'bottom'],
    current = normalized[first] + normalized[second];
  if (!['x', 'y'].includes(axis)) return normalized;
  if (!next) return { ...normalized, [first]: 0, [second]: 0, [axis]: 0 };
  const ratio = current > 0 ? normalized[first] / current : 0.5,
    start = Math.round(next * ratio * 1e12) / 1e12,
    end = Math.round((next - start) * 1e12) / 1e12;
  return {
    ...normalized,
    [first]: start,
    [second]: end,
    [axis]: next,
  };
}

export function cropSidesValid(crop) {
  if (!crop || typeof crop !== 'object' || Array.isArray(crop)) return false;
  for (const side of CROP_SIDES)
    if (!Number.isFinite(crop[side]) || crop[side] < 0 || crop[side] > CROP_MAX) return false;
  return crop.left + crop.right <= CROP_MAX && crop.top + crop.bottom <= CROP_MAX;
}
