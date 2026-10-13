import { bionicRunRanges, normalizeBionicReading } from '../translation/bionic-reading.mjs';

const identity = [1, 0, 0, 1, 0, 0];
const multiply = (a, b) => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];
const point = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** Glyph locations in page coordinates, before any zoom, crop, or rasterization. */
export function bionicGlyphRuns(list, OPS, fontFor, viewport) {
  const runs = [],
    stack = [];
  let s = {
    ctm: identity,
    tm: identity,
    x: 0,
    y: 0,
    lineX: 0,
    lineY: 0,
    leading: 0,
    rise: 0,
    charSpacing: 0,
    wordSpacing: 0,
    hScale: 1,
    size: 0,
    direction: 1,
    mode: 0,
    font: null,
  };
  const move = (x, y) => {
    s.x = s.lineX += x;
    s.y = s.lineY += y;
  };
  const font = (id, size) => {
    s.font = fontFor(id);
    s.size = Math.abs(size);
    s.direction = size < 0 ? -1 : 1;
  };
  for (let op = 0; op < list.fnArray.length; op++) {
    const args = list.argsArray[op] || [];
    switch (list.fnArray[op]) {
      case OPS.save:
        stack.push({ ...s });
        break;
      case OPS.restore:
        if (stack.length) s = stack.pop();
        break;
      case OPS.transform:
        s.ctm = multiply(s.ctm, args);
        break;
      case OPS.paintFormXObjectBegin:
        stack.push({ ...s });
        if (args[0]) s.ctm = multiply(s.ctm, args[0]);
        break;
      case OPS.paintFormXObjectEnd:
        if (stack.length) s = stack.pop();
        break;
      case OPS.beginText:
        s.tm = identity;
        s.x = s.y = s.lineX = s.lineY = 0;
        break;
      case OPS.setFont:
        font(...args);
        break;
      case OPS.setGState:
        for (const [key, value] of args[0] || []) if (key === 'Font') font(...value);
        break;
      case OPS.setTextMatrix:
        s.tm = args[0];
        s.x = s.y = s.lineX = s.lineY = 0;
        break;
      case OPS.moveText:
        move(...args);
        break;
      case OPS.setLeadingMoveText:
        s.leading = args[1];
        move(...args);
        break;
      case OPS.setLeading:
        s.leading = -args[0];
        break;
      case OPS.nextLine:
        move(0, s.leading);
        break;
      case OPS.setHScale:
        s.hScale = args[0] / 100;
        break;
      case OPS.setCharSpacing:
        s.charSpacing = args[0];
        break;
      case OPS.setWordSpacing:
        s.wordSpacing = args[0];
        break;
      case OPS.setTextRise:
        s.rise = args[0];
        break;
      case OPS.setTextRenderingMode:
        s.mode = args[0];
        break;
      case OPS.showText: {
        if (!s.font || !s.size) break;
        const vertical = s.font.vertical,
          matrix = multiply(viewport.transform, multiply(s.ctm, s.tm)),
          em = s.size * (s.font.fontMatrix?.[0] ?? 0.001),
          height = s.size * Math.hypot(matrix[2], matrix[3]),
          hScale = s.hScale * s.direction;
        let advance = 0;
        for (let index = 0; index < args[0].length; index++) {
          const glyph = args[0][index];
          if (typeof glyph === 'number') {
            advance += ((vertical ? 1 : -1) * glyph * s.size) / 1000;
            continue;
          }
          const spacing = (glyph.isSpace ? s.wordSpacing : 0) + s.charSpacing,
            v = glyph.vmetric || s.font.defaultVMetrics,
            width = vertical ? -(v?.[0] ?? glyph.width) : glyph.width,
            step = width * em + spacing * s.direction,
            [x, y] = point(matrix, s.x + advance * hScale, s.y + s.rise),
            text = (glyph.unicode || '').normalize('NFKC');
          // Invisible OCR, Type 3 procedures, and vertical writing retain their
          // native drawing. The runtime hook thickens ordinary filled glyphs.
          if (text && !vertical && !s.font.isType3Font && (s.mode & 3) === 0)
            runs.push({
              text,
              x,
              y: y - height * (s.font.ascent || 0.8),
              width: Math.abs(step * hScale * Math.hypot(matrix[0], matrix[1])),
              height,
              op,
              glyph: index,
            });
          advance += vertical ? width * em - spacing * s.direction : step;
        }
        if (vertical) s.y -= advance;
        else s.x += advance * hScale;
        break;
      }
    }
  }
  return runs;
}

/** Which original glyphs to stroke while pdf.js paints them. */
export function bionicGlyphPlan(runs, options) {
  const plan = new Map();
  for (const range of bionicRunRanges(runs, options)) {
    const run = runs[range.index];
    if (!/\p{L}/u.test(run.text)) continue;
    if (!plan.has(run.op)) plan.set(run.op, new Set());
    plan.get(run.op).add(run.glyph);
  }
  return plan;
}

const pages = new WeakMap();
export async function bionicRenderOptions(page, options) {
  const normalized = normalizeBionicReading(options);
  if (normalized.mode === 'off') return { key: '', render: {} };
  if (!pages.has(page)) {
    const pending = (async () => {
      const { loadPDFRuntime } = await import('./pdf-runtime.mjs');
      const { OPS } = await loadPDFRuntime();
      const list = await page.getOperatorList();
      return bionicGlyphRuns(
        list,
        OPS,
        (id) => page.commonObjs.get(id),
        page.getViewport({ scale: 1, rotation: 0 }),
      );
    })();
    pages.set(page, { runs: pending, plans: new Map() });
    pending.catch(() => pages.delete(page));
  }
  const entry = pages.get(page),
    key = `bionic:${normalized.mode}:${normalized.fixedLength}`;
  if (!entry.plans.has(key)) {
    // Keep only the current configuration; zoom reuses its glyph decisions.
    entry.plans.clear();
    entry.plans.set(
      key,
      entry.runs.then((runs) => ({
        key,
        render: { bionicGlyphs: bionicGlyphPlan(runs, normalized) },
      })),
    );
  }
  return entry.plans.get(key);
}
