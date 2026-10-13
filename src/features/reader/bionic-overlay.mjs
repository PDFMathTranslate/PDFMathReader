// PDF glyphs are raster, so bionic fixations are thickened from canvas pixels.
const BAND_HEIGHT = 512;

/**
 * Faux-bold RGBA pixels by smearing ink rightwards by about three fifths of
 * the box's typical stroke width, at most `spread` pixels. Measuring strokes
 * keeps small text inside a tall box (a drop cap's line box) from being
 * smeared like the large glyph. Pixels flagged in `skip` (other lines'
 * text inside the box) are neither measured, smeared, nor inked. Returns a
 * same-sized buffer holding only the added ink; all other pixels transparent.
 */
export function emboldenPixels(rgba, width, height, spread = 1, skip = null) {
  const out = new Uint8ClampedArray(width * height * 4);
  const lum = new Float32Array(width * height);
  let luminance = 0,
    counted = 0,
    low = 255,
    high = 0;
  for (let i = 0; i < lum.length; i++) {
    if (skip?.[i]) continue;
    const at = i * 4,
      l = 0.2126 * rgba[at] + 0.7152 * rgba[at + 1] + 0.0722 * rgba[at + 2];
    lum[i] = l;
    luminance += l;
    counted++;
    low = Math.min(low, l);
    high = Math.max(high, l);
  }
  if (high - low < 30) return out;
  // Dark ink on light paper takes the minimum, light ink on dark the maximum.
  const darkInk = luminance / Math.max(1, counted) >= 128,
    pick = darkInk ? Math.min : Math.max,
    middle = (low + high) / 2;
  const runs = [];
  for (let y = 0; y < height; y++) {
    let run = 0;
    for (let x = 0; x <= width; x++) {
      const l = x < width && !skip?.[y * width + x] ? lum[y * width + x] : middle;
      if (darkInk ? l < middle : l > middle) run++;
      else if (run) {
        runs.push(run);
        run = 0;
      }
    }
  }
  if (!runs.length) return out;
  runs.sort((a, b) => a - b);
  const reach = Math.min(spread, Math.ceil(runs[runs.length >> 1] * 0.6));
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (skip?.[y * width + x]) continue;
      const at = (y * width + x) * 4;
      let r = rgba[at],
        g = rgba[at + 1],
        b = rgba[at + 2];
      for (let k = 1; k <= reach && x - k >= 0; k++) {
        if (skip?.[y * width + x - k]) continue;
        const from = at - k * 4;
        r = pick(r, rgba[from]);
        g = pick(g, rgba[from + 1]);
        b = pick(b, rgba[from + 2]);
      }
      const change = Math.max(
        Math.abs(r - rgba[at]),
        Math.abs(g - rgba[at + 1]),
        Math.abs(b - rgba[at + 2]),
      );
      if (change <= 10) continue;
      out[at] = r;
      out[at + 1] = g;
      out[at + 2] = b;
      out[at + 3] = 255;
    }
  return out;
}

/** Group boxes into horizontal bands so each band needs one pixel read. */
export function bionicBands(boxes, maxHeight = BAND_HEIGHT) {
  const bands = [];
  for (const box of [...boxes].sort((a, b) => a.y - b.y)) {
    const band = bands.at(-1);
    if (band && Math.max(band.bottom, box.y + box.height) - band.top <= maxHeight) {
      band.bottom = Math.max(band.bottom, box.y + box.height);
      band.boxes.push(box);
    } else bands.push({ top: box.y, bottom: box.y + box.height, boxes: [box] });
  }
  return bands;
}

/**
 * Draw thickened fixations for `marks` above `canvas`, inside `host`. Returns
 * the overlay element, or null when there is nothing to draw.
 */
export function drawBionicOverlay(host, canvas, marks) {
  if (!host || !canvas?.width || !canvas.height || !marks.length) return null;
  const canvasRect = canvas.getBoundingClientRect(),
    hostRect = host.getBoundingClientRect();
  if (!canvasRect.width || !canvasRect.height) return null;
  const sx = canvas.width / canvasRect.width,
    sy = canvas.height / canvasRect.height;
  // Text spans as device-pixel rects, for keeping other lines out of tall boxes.
  const spans = [...host.querySelectorAll('span')]
    .filter((span) => !span.querySelector('span'))
    .map((span) => {
      const r = span.getBoundingClientRect();
      return {
        span,
        x: (r.left - canvasRect.left) * sx,
        y: (r.top - canvasRect.top) * sy,
        right: (r.right - canvasRect.left) * sx,
        bottom: (r.bottom - canvasRect.top) * sy,
      };
    });
  const boxes = [];
  for (const mark of marks) {
    const range = window.document.createRange();
    range.selectNodeContents(mark);
    const own = mark.closest('span');
    for (const r of range.getClientRects()) {
      // Device pixels, padded right for the smear and clipped to the bitmap.
      const spread = Math.max(1, Math.round(r.height * sy * 0.04)),
        x = Math.max(0, Math.floor((r.left - canvasRect.left) * sx)),
        y = Math.max(0, Math.floor((r.top - canvasRect.top) * sy)),
        right = Math.min(canvas.width, Math.ceil((r.right - canvasRect.left) * sx) + spread),
        bottom = Math.min(canvas.height, Math.ceil((r.bottom - canvasRect.top) * sy));
      if (right <= x || bottom <= y) continue;
      const box = { x, y, width: right - x, height: bottom - y, spread, skip: null };
      // A drop cap's box spans several lines; their smaller text stays untouched.
      for (const other of spans) {
        if (other.span === own || other.bottom - other.y >= box.height * 0.6) continue;
        const x0 = Math.max(x, Math.floor(other.x)) - x,
          x1 = Math.min(right, Math.ceil(other.right)) - x,
          y0 = Math.max(y, Math.floor(other.y)) - y,
          y1 = Math.min(bottom, Math.ceil(other.bottom)) - y;
        if (x1 <= x0 || y1 <= y0) continue;
        box.skip ??= new Uint8Array(box.width * box.height);
        for (let row = y0; row < y1; row++)
          box.skip.fill(1, row * box.width + x0, row * box.width + x1);
      }
      boxes.push(box);
    }
  }
  if (!boxes.length) return null;
  const overlay = window.document.createElement('div');
  overlay.className = 'bionic-ink';
  overlay.setAttribute('aria-hidden', 'true');
  const filter = getComputedStyle(canvas).filter;
  const scratch = window.document.createElement('canvas'),
    context = scratch.getContext('2d', { willReadFrequently: true });
  for (const band of bionicBands(boxes)) {
    const left = Math.min(...band.boxes.map((b) => b.x)),
      right = Math.max(...band.boxes.map((b) => b.x + b.width)),
      width = right - left,
      height = band.bottom - band.top;
    scratch.width = width;
    scratch.height = height;
    context.clearRect(0, 0, width, height);
    context.drawImage(canvas, left, band.top, width, height, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height).data;
    for (const box of band.boxes) {
      const source = new Uint8ClampedArray(box.width * box.height * 4);
      for (let row = 0; row < box.height; row++) {
        const from = ((box.y - band.top + row) * width + (box.x - left)) * 4;
        source.set(pixels.subarray(from, from + box.width * 4), row * box.width * 4);
      }
      const ink = window.document.createElement('canvas');
      ink.width = box.width;
      ink.height = box.height;
      ink
        .getContext('2d')
        .putImageData(
          new ImageData(
            emboldenPixels(source, box.width, box.height, box.spread, box.skip),
            box.width,
          ),
          0,
          0,
        );
      Object.assign(ink.style, {
        left: canvasRect.left - hostRect.left + box.x / sx + 'px',
        top: canvasRect.top - hostRect.top + box.y / sy + 'px',
        width: box.width / sx + 'px',
        height: box.height / sy + 'px',
        filter: filter && filter !== 'none' ? filter : '',
      });
      overlay.append(ink);
    }
  }
  scratch.width = 0;
  scratch.height = 0;
  host.append(overlay);
  return overlay;
}
