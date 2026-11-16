import { watch } from 'vue';

// Operators that paint raster content: the scan behind an image document, or a figure.
const IMAGE_OPS = [
  'paintImageXObject',
  'paintInlineImageXObject',
  'paintImageMaskXObject',
  'paintImageMaskXObjectGroup',
  'paintInlineImageXObjectGroup',
  'paintImageXObjectRepeat',
  'paintImageMaskXObjectRepeat',
  'paintSolidColorImageMask',
];
// Brightness rank of the colour picked around a paragraph: text pixels in the ring are
// darker than the paper, so a light rank lands on the paper itself.
const PAPER_RANK = 0.75;
// Longest side of the reduced copy the paper colour is read from.
const SAMPLE_SIDE = 512;

// A PDF kernel keeps the page's own content, the scan included, and appends the
// translation after it. The cover goes in right before the first text object that
// follows the last image; a page without images has no original text left to hide.
// A page compacted around its paragraph gaps draws the whole page once per band, each
// clipped to its band, so every band gets its own cover.
export function coverIndexes(list, OPS) {
  const images = new Set(IMAGE_OPS.map((name) => OPS[name]).filter(Number.isInteger));
  const ops = list?.fnArray || [],
    args = list?.argsArray || [];
  const band = (i) => {
    if (ops[i] !== OPS.beginMarkedContent) return false;
    const tag = args[i]?.[0];
    return String(tag?.name ?? tag ?? '').startsWith('CompactBand');
  };
  const starts = [0];
  for (let i = 1; i < ops.length; i++) if (band(i)) starts.push(i);
  const indexes = [];
  starts.forEach((start, n) => {
    const end = starts[n + 1] ?? ops.length;
    let last = -1;
    for (let i = start; i < end; i++) if (images.has(ops[i])) last = i;
    if (last < 0) return;
    for (let i = last + 1; i < end; i++) if (ops[i] === OPS.beginText) return void indexes.push(i);
  });
  return indexes;
}

const usable = (box) =>
  box && [box.x, box.y, box.width, box.height].every(Number.isFinite) && box.width > 0;

// Page-space rectangles covering each translated paragraph where it was and where its
// translation is drawn. Unchanged paragraphs may not be drawn again, so they stay.
export function coverRects(blocks) {
  const rects = [];
  for (const block of blocks || []) {
    if (!block?.translation || block.translation === block.text) continue;
    const boxes = [block.sourceBox, block.translatedBox].filter(usable);
    if (!boxes.length) continue;
    const pad = Math.max(2, (Number(block.fontSize) || 10) * 0.28);
    const left = Math.min(...boxes.map((b) => b.x)) - pad,
      top = Math.min(...boxes.map((b) => b.y)) - pad,
      right = Math.max(...boxes.map((b) => b.x + b.width)) + pad,
      bottom = Math.max(...boxes.map((b) => b.y + Math.max(b.height, 0))) + pad;
    rects.push({ x: left, y: top, width: right - left, height: bottom - top });
  }
  return rects;
}

// The paper colour around a rectangle of RGBA pixels, as a CSS colour.
export function paperColor(data, width, height, rect) {
  const x0 = Math.max(0, Math.floor(rect.x) - 1),
    y0 = Math.max(0, Math.floor(rect.y) - 1),
    x1 = Math.min(width - 1, Math.ceil(rect.x + rect.width)),
    y1 = Math.min(height - 1, Math.ceil(rect.y + rect.height));
  const ring = [];
  const take = (x, y) => {
    const i = (y * width + x) * 4;
    if (data[i + 3] === 0) return;
    ring.push([data[i], data[i + 1], data[i + 2]]);
  };
  if (x0 <= x1 && y0 <= y1) {
    for (let x = x0; x <= x1; x++) {
      take(x, y0);
      if (y1 !== y0) take(x, y1);
    }
    for (let y = y0 + 1; y < y1; y++) {
      take(x0, y);
      if (x1 !== x0) take(x1, y);
    }
  }
  if (!ring.length) return '#fff';
  const light = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  ring.sort((a, b) => light(a) - light(b));
  const [r, g, b] = ring[Math.min(ring.length - 1, Math.floor(ring.length * PAPER_RANK))];
  return `rgb(${r}, ${g}, ${b})`;
}

function paperColors(canvas, rects) {
  try {
    const factor = Math.max(1, Math.max(canvas.width, canvas.height) / SAMPLE_SIDE),
      width = Math.max(1, Math.round(canvas.width / factor)),
      height = Math.max(1, Math.round(canvas.height / factor)),
      sample = document.createElement('canvas');
    sample.width = width;
    sample.height = height;
    const context = sample.getContext('2d', { willReadFrequently: true });
    context.drawImage(canvas, 0, 0, width, height);
    const { data } = context.getImageData(0, 0, width, height);
    sample.width = sample.height = 0;
    return rects.map((rect) =>
      paperColor(data, width, height, {
        x: rect.x / factor,
        y: rect.y / factor,
        width: rect.width / factor,
        height: rect.height / factor,
      }),
    );
  } catch {
    return rects.map(() => '#fff');
  }
}

// Paints the covers onto a frame while pdf.js draws it, after the scan and before the
// translation. `transform` maps page CSS pixels at the render scale to frame pixels.
export function paintCover(context, rects, scale, transform) {
  const [a, , , d, e, f] = transform;
  const device = rects.map((r) => ({
    x: r.x * scale * a + e,
    y: r.y * scale * d + f,
    width: r.width * scale * a,
    height: r.height * scale * d,
  }));
  const colors = paperColors(context.canvas, device);
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalAlpha = 1;
  context.globalCompositeOperation = 'source-over';
  context.filter = 'none';
  device.forEach((rect, i) => {
    context.fillStyle = colors[i];
    context.fillRect(rect.x, rect.y, rect.width, rect.height);
  });
  context.restore();
}

// Hides the original text that a translated PDF page still shows under its translation,
// as on scanned or OCR pages where that text is part of the page image. Applied when
// pages are drawn; the translated file is never changed.
export function createTranslationCover({ preferences, loadRuntime, onToggle }) {
  const indexes = new WeakMap();
  const enabled = () => !!preferences.coverOriginalText?.value;

  function indexFor(page) {
    if (!indexes.has(page))
      indexes.set(
        page,
        Promise.all([loadRuntime(), page.getOperatorList()])
          .then(([{ OPS }, list]) => coverIndexes(list, OPS))
          .catch(() => []),
      );
    return indexes.get(page);
  }

  // What to paint on a translated page, or null when it has nothing to hide.
  async function renderOptions(page, blocks) {
    if (!enabled()) return null;
    const rects = coverRects(blocks);
    if (!rects.length) return null;
    const at = await indexFor(page);
    if (!at.length || !enabled()) return null;
    return {
      key: `cover${at.join(',')}:${rects.length}`,
      at,
      rects,
      paint: (context, scale, transform) => paintCover(context, rects, scale, transform),
    };
  }

  watch(enabled, () => onToggle?.());
  return { enabled, renderOptions };
}
