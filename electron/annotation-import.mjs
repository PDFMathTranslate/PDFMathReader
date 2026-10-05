import { validateAnnotation, embedAnnotationDocument } from './annotations.mjs';
import {
  PDFDocument,
  PDFDict,
  PDFName,
  PDFHexString,
  PDFString,
  PDFArray,
  PDFNumber,
} from 'pdf-lib';
function text(dict, key) {
  return dict.lookupMaybe(PDFName.of(key), PDFString, PDFHexString)?.decodeText() || '';
}
function numbers(dict, key) {
  const array = dict.lookupMaybe(PDFName.of(key), PDFArray);
  return array
    ? Array.from({ length: array.size() }, (_, i) => array.lookup(i, PDFNumber).asNumber())
    : [];
}
function date(value) {
  const match = /^D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?/.exec(value);
  if (!match) return new Date().toISOString();
  return new Date(
    Date.UTC(
      +match[1],
      +(match[2] || 1) - 1,
      +(match[3] || 1),
      +(match[4] || 0),
      +(match[5] || 0),
      +(match[6] || 0),
    ),
  ).toISOString();
}
function geometry(page) {
  const crop = page.getCropBox(),
    rotation = ((page.getRotation().angle % 360) + 360) % 360;
  return {
    crop,
    rotation,
    width: rotation % 180 ? crop.height : crop.width,
    height: rotation % 180 ? crop.width : crop.height,
  };
}
function viewport(x, y, g) {
  const c = g.crop;
  if (g.rotation === 90) return [y - c.y, x - c.x];
  if (g.rotation === 180) return [c.x + c.width - x, y - c.y];
  if (g.rotation === 270) return [c.y + c.height - y, c.x + c.width - x];
  return [x - c.x, c.y + c.height - y];
}
function bounds(points, g) {
  const converted = points.map(([x, y]) => viewport(x, y, g)),
    xs = converted.map((p) => p[0]),
    ys = converted.map((p) => p[1]);
  const x = Math.max(0, Math.min(...xs)),
    y = Math.max(0, Math.min(...ys)),
    right = Math.min(g.width, Math.max(...xs)),
    bottom = Math.min(g.height, Math.max(...ys));
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
}
export async function importPDFAnnotations(bytes, { prepare = false } = {}) {
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false }),
    annotations = [],
    nativeRefs = [];
  for (const [index, page] of pdf.getPages().entries()) {
    const array = page.node.Annots();
    if (!array) continue;
    const g = geometry(page);
    for (let i = 0; i < array.size(); i++) {
      const dict = array.lookupMaybe(i, PDFDict);
      if (!dict) continue;
      if (text(dict, 'NM').startsWith('PDFMathReader:')) {
        try {
          const a = JSON.parse(text(dict, 'PDFMathReader'));
          if (a?.id) annotations.push(validateAnnotation(a));
        } catch {}
        continue;
      }
      const kind = dict.lookupMaybe(PDFName.of('Subtype'), PDFName)?.toString();
      if (!['/Highlight', '/Text'].includes(kind)) continue;
      const rect = numbers(dict, 'Rect');
      if (rect.length !== 4) continue;
      const sourceRect = bounds(
        [
          [rect[0], rect[1]],
          [rect[2], rect[3]],
        ],
        g,
      );
      if (!sourceRect) continue;
      const quads = kind === '/Highlight' ? numbers(dict, 'QuadPoints') : [],
        rects = [];
      for (let q = 0; q + 7 < quads.length; q += 8) {
        const r = bounds(
          [
            [quads[q], quads[q + 1]],
            [quads[q + 2], quads[q + 3]],
            [quads[q + 4], quads[q + 5]],
            [quads[q + 6], quads[q + 7]],
          ],
          g,
        );
        if (r) rects.push(r);
      }
      if (!rects.length) rects.push(sourceRect);
      const nativeRef = array.get(i).toString();
      if (!/^\d+ \d+ R$/.test(nativeRef)) continue;
      const color = numbers(dict, 'C');
      const rgb =
        color.length === 3
          ? color
          : color.length === 1
            ? [color[0], color[0], color[0]]
            : color.length === 4
              ? color.slice(0, 3).map((c) => (1 - c) * (1 - color[3]))
              : [1, 0.95, 0.42];
      const hex =
        '#' +
        rgb
          .map((v) =>
            Math.round(Math.max(0, Math.min(1, v)) * 255)
              .toString(16)
              .padStart(2, '0'),
          )
          .join('');
      const contents = text(dict, 'Contents');
      annotations.push({
        id: `native:${nativeRef}`,
        nativeRef,
        page: index + 1,
        kind: kind === '/Highlight' ? 'highlight' : 'comment',
        origin: 'source',
        text: kind === '/Highlight' ? contents : '',
        comment: kind === '/Text' ? contents : '',
        color: hex,
        rects,
        sourceRect,
        createdAt: date(text(dict, 'M')),
        author: text(dict, 'T'),
        dateUnknown: !text(dict, 'M'),
      });
      nativeRefs.push(nativeRef);
    }
  }
  return {
    annotations,
    nativeRefs,
    ...(prepare
      ? { bytes: new Uint8Array(await embedAnnotationDocument(pdf, [], nativeRefs, bytes)) }
      : {}),
  };
}
