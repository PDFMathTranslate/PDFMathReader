import { watch } from 'vue';

// Allow for a small difference between the OCR box and the scan's edges.
const SOURCE_IMAGE_OVERLAP = 0.8;
// Brightness rank of the colour picked around a paragraph: text pixels in the ring are
// darker than the paper, so a light rank lands on the paper itself.
const PAPER_RANK = 0.75;
// Longest side of the reduced copy the paper colour is read from.
const SAMPLE_SIDE = 512;

// Track image placement in page coordinates. Compacted pages embed one shifted,
// clipped copy of the page per band, with a separate transform for each copy.
export function coverImages({ fnArray, argsArray }, { OPS, Util }, viewport) {
  const images = [],
    stack = [],
    lastText = fnArray.lastIndexOf(OPS.showText);
  let matrix = viewport.transform;
  const record = (index, placement) => {
    const bounds = [Infinity, Infinity, -Infinity, -Infinity];
    const transform = placement ? Util.transform(matrix, placement) : matrix;
    Util.axialAlignedBoundingBox([0, 0, 1, 1], transform, bounds);
    images.push({ index, bounds });
  };
  const recordRepeated = (index, scaleX, skewX, skewY, scaleY, positions) => {
    for (let i = 0; i < positions.length; i += 2)
      record(index, [scaleX, skewX, skewY, scaleY, positions[i], positions[i + 1]]);
  };
  for (let i = 0; i < lastText; i++) {
    const args = argsArray[i];
    switch (fnArray[i]) {
      case OPS.save:
        stack.push(matrix);
        break;
      case OPS.paintFormXObjectBegin:
        stack.push(matrix);
        if (args?.[0]) matrix = Util.transform(matrix, args[0]);
        break;
      case OPS.restore:
      case OPS.paintFormXObjectEnd:
        matrix = stack.pop() ?? viewport.transform;
        break;
      case OPS.transform:
        matrix = Util.transform(matrix, args);
        break;
      case OPS.paintImageXObject:
      case OPS.paintInlineImageXObject:
      case OPS.paintImageMaskXObject:
        record(i);
        break;
      case OPS.paintImageXObjectRepeat: {
        const [, scaleX, scaleY, positions] = args;
        recordRepeated(i, scaleX, 0, 0, scaleY, positions);
        break;
      }
      case OPS.paintImageMaskXObjectRepeat:
        recordRepeated(i, ...args.slice(1));
        break;
      case OPS.paintInlineImageXObjectGroup:
        for (const image of args[1]) record(i, image.transform);
        break;
      case OPS.paintImageMaskXObjectGroup:
        for (const image of args[0]) record(i, image.transform);
        break;
    }
  }
  return images;
}

const usable = (box) =>
  box &&
  [box.x, box.y, box.width, box.height].every(Number.isFinite) &&
  box.width > 0 &&
  box.height > 0;

// Page-space rectangles covering each translated paragraph where it was and where its
// translation is drawn. Unchanged paragraphs may not be drawn again, so they stay.
function coverRects(blocks) {
  const rects = [];
  for (const block of blocks || []) {
    if (!block?.translation || block.translation === block.text) continue;
    const boxes = [block.sourceBox, block.translatedBox].filter(usable);
    if (!boxes.length) continue;
    const pad = Math.max(2, (Number(block.fontSize) || 10) * 0.28);
    const left = Math.min(...boxes.map((b) => b.x)) - pad,
      top = Math.min(...boxes.map((b) => b.y)) - pad,
      right = Math.max(...boxes.map((b) => b.x + b.width)) + pad,
      bottom = Math.max(...boxes.map((b) => b.y + b.height)) + pad;
    rects.push({ source: boxes[0], bounds: [left, top, right, bottom] });
  }
  return rects;
}

// Place paper under a paragraph just after the image that contains its original
// text. A figure later in the stream must not cover text already painted elsewhere.
export function coverPlan(images, blocks) {
  const rects = coverRects(blocks),
    plan = new Map();
  for (const { index, bounds: image } of images) {
    for (const { source, bounds } of rects) {
      const { x, y, width, height } = source;
      const overlapWidth = Math.min(x + width, image[2]) - Math.max(x, image[0]),
        overlapHeight = Math.min(y + height, image[3]) - Math.max(y, image[1]);
      if (
        overlapWidth <= 0 ||
        overlapHeight <= 0 ||
        overlapWidth * overlapHeight < SOURCE_IMAGE_OVERLAP * width * height
      )
        continue;
      const left = Math.max(bounds[0], image[0]),
        top = Math.max(bounds[1], image[1]),
        right = Math.min(bounds[2], image[2]),
        bottom = Math.min(bounds[3], image[3]);
      // operationsFilter runs before the indexed operator. The next operator
      // still has the scan's graphics state and any paragraph band clip.
      const afterImage = index + 1;
      if (!plan.has(afterImage)) plan.set(afterImage, []);
      plan.get(afterImage).push({ x: left, y: top, width: right - left, height: bottom - top });
    }
  }
  return plan;
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
  const placements = new WeakMap();
  const enabled = () => !!preferences.coverOriginalText?.value;

  function imagesFor(page) {
    if (!placements.has(page))
      placements.set(
        page,
        Promise.all([loadRuntime(), page.getOperatorList()])
          .then(([runtime, list]) => coverImages(list, runtime, page.getViewport({ scale: 1 })))
          .catch(() => []),
      );
    return placements.get(page);
  }

  // What to paint on a translated page, or null when it has nothing to hide.
  async function renderOptions(page, blocks) {
    if (!enabled() || !blocks?.some((b) => b?.translation && b.translation !== b.text)) return null;
    const plan = coverPlan(await imagesFor(page), blocks);
    if (!plan.size || !enabled()) return null;
    return {
      key: `cover${JSON.stringify([...plan])}`,
      plan,
      paint: paintCover,
    };
  }

  watch(enabled, () => onToggle?.());
  return { enabled, renderOptions };
}
