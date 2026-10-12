// Rule-based watermark detection on a pdf.js operator list. A watermark is text or an
// image that is abnormally large for its page and also looks decorative: rotated off the
// page axes, translucent, pale, or repeated at the same place on many pages. Size alone
// is never enough, so titles and full-page scans stay.

export const WATERMARK_RULES = Object.freeze({
  // Text at least this many times the body size, and at least minTextSize points.
  textRatio: 2.5,
  minTextSize: 24,
  // Images covering this share of the page. Near full-page images are backgrounds or
  // scans and are never removed.
  minImageCoverage: 0.08,
  maxImageCoverage: 0.85,
  translucent: 0.75,
  pale: 0.65,
  // Degrees away from the nearest page axis that count as a diagonal placement.
  diagonalFrom: 10,
  diagonalTo: 80,
  fallbackBodySize: 10,
  // Fewer glyphs than this say nothing reliable about a page's body size.
  minBodyGlyphs: 40,
  repeatedPages: 3,
});

const identity = [1, 0, 0, 1, 0, 0];
const multiply = (a, b) => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const finite = (m) => Array.isArray(m) && m.length >= 6 && m.slice(0, 6).every(Number.isFinite);
const round = (value, step) => Math.round(value / step) * step;

// Smallest rotation from a page axis, in degrees (0-45).
export function axisDeviation(angle) {
  const turn = Math.abs(angle) % 90;
  return Math.min(turn, 90 - turn);
}
export function isDiagonal(angle, rules = WATERMARK_RULES) {
  const turn = Math.abs(angle) % 90;
  return turn >= rules.diagonalFrom && turn <= rules.diagonalTo;
}

function luminance(color) {
  if (typeof color !== 'string') return null;
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})/i.exec(color);
  if (!match) return null;
  const [r, g, b] = match.slice(1).map((v) => parseInt(v, 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function glyphText(glyphs) {
  let text = '';
  if (!Array.isArray(glyphs)) return text;
  for (const glyph of glyphs) {
    if (typeof glyph === 'string') text += glyph;
    else if (glyph && typeof glyph === 'object' && typeof glyph.unicode === 'string')
      text += glyph.unicode;
  }
  return text;
}

function weightedMedian(entries) {
  const total = entries.reduce((sum, e) => sum + e.weight, 0);
  if (!total) return 0;
  let seen = 0;
  for (const e of [...entries].sort((a, b) => a.size - b.size)) {
    seen += e.weight;
    if (seen * 2 >= total) return e.size;
  }
  return 0;
}

// Walks one page's operators once, tracking the transform, font size, alpha and fill
// colour, and returns every text run and image it paints with the operators to skip.
export function scanOperatorList({ fnArray, argsArray }, OPS, view = [0, 0, 612, 792]) {
  const pageWidth = Math.abs(view[2] - view[0]) || 1,
    pageHeight = Math.abs(view[3] - view[1]) || 1,
    pageArea = pageWidth * pageHeight;
  const place = ([x, y]) => [
    (x - Math.min(view[0], view[2])) / pageWidth,
    (y - Math.min(view[1], view[3])) / pageHeight,
  ];
  const imageOps = new Set([
    OPS.paintImageXObject,
    OPS.paintInlineImageXObject,
    OPS.paintImageMaskXObject,
  ]);
  const showOps = new Set([
    OPS.showText,
    OPS.showSpacedText,
    OPS.nextLineShowText,
    OPS.nextLineSetSpacingShowText,
  ]);
  let state = { ctm: identity, fillAlpha: 1, strokeAlpha: 1, fill: null, stroke: null };
  const stack = [];
  let tm = identity,
    fontSize = 0,
    mode = 0,
    run = null;
  const items = [],
    body = [];
  const finishRun = () => {
    if (run) items.push(run);
    run = null;
  };

  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i],
      args = argsArray[i];
    switch (fn) {
      case OPS.save:
        stack.push(state);
        state = { ...state };
        break;
      case OPS.restore:
        if (stack.length) state = stack.pop();
        break;
      case OPS.transform:
        if (finite(args)) state = { ...state, ctm: multiply(state.ctm, args) };
        break;
      case OPS.paintFormXObjectBegin:
        stack.push(state);
        state = { ...state, ctm: finite(args?.[0]) ? multiply(state.ctm, args[0]) : state.ctm };
        break;
      case OPS.paintFormXObjectEnd:
        if (stack.length) state = stack.pop();
        break;
      case OPS.setGState:
        if (Array.isArray(args?.[0])) {
          state = { ...state };
          for (const [key, value] of args[0]) {
            if (key === 'ca' && Number.isFinite(value)) state.fillAlpha = value;
            else if (key === 'CA' && Number.isFinite(value)) state.strokeAlpha = value;
          }
        }
        break;
      case OPS.setFillRGBColor:
        state = { ...state, fill: args?.[0] };
        break;
      case OPS.setStrokeRGBColor:
        state = { ...state, stroke: args?.[0] };
        break;
      case OPS.beginText:
        finishRun();
        tm = identity;
        break;
      case OPS.endText:
        finishRun();
        break;
      case OPS.setFont:
        fontSize = Number.isFinite(args?.[1]) ? args[1] : 0;
        break;
      case OPS.setTextRenderingMode:
        mode = args?.[0] ?? 0;
        break;
      case OPS.setTextMatrix:
        if (finite(args)) tm = args.slice(0, 6);
        break;
      case OPS.moveText:
      case OPS.setLeadingMoveText:
        if (Number.isFinite(args?.[0]) && Number.isFinite(args?.[1]))
          tm = [
            tm[0],
            tm[1],
            tm[2],
            tm[3],
            tm[4] + args[0] * tm[0] + args[1] * tm[2],
            tm[5] + args[0] * tm[1] + args[1] * tm[3],
          ];
        break;
      default:
        break;
    }
    if (showOps.has(fn)) {
      const text = glyphText(fn === OPS.nextLineSetSpacingShowText ? args?.[2] : args?.[0]);
      // Mode 3 is invisible (an OCR layer) and 7 only clips.
      if (mode === 3 || mode === 7 || !text.trim()) continue;
      const combined = multiply(state.ctm, tm),
        size = Math.abs(fontSize) * Math.hypot(combined[2], combined[3]),
        angle = (Math.atan2(combined[1], combined[0]) * 180) / Math.PI,
        stroked = mode === 1 || mode === 5,
        alpha = stroked ? state.strokeAlpha : state.fillAlpha,
        shade = luminance(stroked ? state.stroke : state.fill),
        style = [
          round(size, 0.5),
          round(angle, 1),
          alpha,
          shade === null ? '' : round(shade, 0.05),
        ].join('|'),
        [x, y] = place(apply(combined, 0, 0));
      body.push({ size, weight: [...text.replace(/\s+/g, '')].length, angle });
      if (run?.style !== style) {
        finishRun();
        run = { kind: 'text', style, ops: [], text: '', size, angle, alpha, shade, x, y };
      }
      run.ops.push(i);
      run.text += text;
      run.size = Math.max(run.size, size);
    } else if (imageOps.has(fn)) {
      const m = state.ctm,
        coverage = Math.abs(m[0] * m[3] - m[1] * m[2]) / pageArea;
      if (!Number.isFinite(coverage) || coverage <= 0) continue;
      const [x, y] = place(apply(m, 0.5, 0.5)),
        pixels =
          fn === OPS.paintImageXObject
            ? `${args?.[1]}x${args?.[2]}`
            : `${args?.[0]?.width}x${args?.[0]?.height}`;
      items.push({
        kind: 'image',
        ops: [i],
        coverage,
        angle: (Math.atan2(m[1], m[0]) * 180) / Math.PI,
        alpha: state.fillAlpha,
        x,
        y,
        pixels,
      });
    }
  }
  finishRun();
  const upright = body.filter((e) => axisDeviation(e.angle) < 5);
  return {
    items,
    bodyGlyphs: upright.reduce((sum, e) => sum + e.weight, 0),
    bodySize: weightedMedian(upright),
  };
}

// Where the same item recurs. Position is rounded to a tenth of the page so a small
// drift between pages still matches.
export function itemSignature(item) {
  const where = `${round(item.x, 0.1).toFixed(1)},${round(item.y, 0.1).toFixed(1)}`;
  return item.kind === 'text'
    ? `t|${item.text.replace(/\s+/g, '')}|${round(item.size, 1)}|${round(item.angle, 5)}|${where}`
    : `i|${item.pixels}|${round(item.coverage, 0.05).toFixed(2)}|${where}`;
}

// Learns what recurs across a sample of pages and the typical body size.
export function buildModel(pages, rules = WATERMARK_RULES) {
  const counts = new Map();
  for (const page of pages)
    for (const signature of new Set(page.items.map(itemSignature)))
      counts.set(signature, (counts.get(signature) || 0) + 1);
  const needed = Math.max(rules.repeatedPages, Math.ceil(pages.length / 2));
  const sized = pages.filter((page) => page.bodyGlyphs >= rules.minBodyGlyphs);
  return {
    repeated: new Set([...counts].filter(([, n]) => n >= needed).map(([key]) => key)),
    bodySize:
      weightedMedian(sized.map((page) => ({ size: page.bodySize, weight: page.bodyGlyphs }))) ||
      rules.fallbackBodySize,
  };
}

// Reasons an item reads as a watermark; empty when it is ordinary content.
export function watermarkTraits(item, page, model, rules = WATERMARK_RULES) {
  const body = page.bodyGlyphs >= rules.minBodyGlyphs ? page.bodySize : model.bodySize;
  const traits = [];
  if (isDiagonal(item.angle, rules)) traits.push('diagonal');
  if (item.alpha <= rules.translucent) traits.push('translucent');
  if (item.kind === 'text' && item.shade !== null && item.shade >= rules.pale) traits.push('pale');
  if (model.repeated.has(itemSignature(item))) traits.push('repeated');
  if (item.kind === 'image')
    return item.coverage >= rules.minImageCoverage && item.coverage < rules.maxImageCoverage
      ? traits
      : [];
  if (item.size >= Math.max(rules.minTextSize, body * rules.textRatio)) return traits;
  // Translucent diagonal text is a stamp even at a modest size.
  return traits.includes('diagonal') && traits.includes('translucent') && item.size >= body * 1.5
    ? traits
    : [];
}

// Operator indices to leave out when drawing this page.
export function watermarkOperations(page, model, rules = WATERMARK_RULES) {
  const skip = new Set();
  for (const item of page.items)
    if (watermarkTraits(item, page, model, rules).length) for (const op of item.ops) skip.add(op);
  return skip;
}
