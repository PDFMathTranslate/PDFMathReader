import { shallowRef, watch, markRaw, onBeforeUnmount } from 'vue';

export function compactBands(occupied, rowScale, pageHeight, lineHeight) {
  const first = occupied.findIndex(Boolean),
    last = occupied.findLastIndex(Boolean);
  if (first < 0) return [];
  const target = 1.5 * lineHeight,
    cuts = [];
  for (let row = first; row < last;) {
    if (occupied[row]) {
      row++;
      continue;
    }
    const start = row;
    while (row < last && !occupied[row]) row++;
    const gap = (row - start) / rowScale;
    if (gap > target + 2) cuts.push({ start: start / rowScale + target, end: row / rowScale });
  }
  return cuts.filter((c) => c.start >= 0 && c.end <= pageHeight && c.end > c.start);
}
export function mapCompactY(y, cuts, inverse = false) {
  let removed = 0;
  for (const cut of cuts) {
    const edge = inverse ? cut.start - removed : cut.start;
    if (y <= edge) break;
    if (inverse) removed += cut.end - cut.start;
    else removed += Math.min(y, cut.end) - cut.start;
  }
  return y + (inverse ? removed : -removed);
}
export function mapCompactRect(rect, cuts, inverse = false) {
  if (!rect || !Number.isFinite(rect.y)) return rect;
  const y = mapCompactY(rect.y, cuts, inverse);
  return {
    ...rect,
    y,
    ...(Number.isFinite(rect.height)
      ? { height: mapCompactY(rect.y + rect.height, cuts, inverse) - y }
      : {}),
  };
}

// PDF text extraction does not honor vector clipping. Mark each retained band
// and filter its text stream so selection/search never see hidden duplicate runs.
export function compactTextDocument(document, bands, height) {
  const pages = new Map();
  return markRaw(
    new Proxy(document, {
      get(target, key) {
        if (key === 'getPage')
          return async (number) => {
            if (pages.has(number)) return pages.get(number);
            const page = await target.getPage(number);
            const text = async (options = {}) => {
              const content = await page.getTextContent({ ...options, includeMarkedContent: true });
              const stack = [],
                items = [];
              let band;
              for (const item of content.items) {
                if (item.type === 'beginMarkedContent' || item.type === 'beginMarkedContentProps') {
                  stack.push(band);
                  if (item.tag?.startsWith('CompactBand')) band = bands[Number(item.tag.slice(11))];
                } else if (item.type === 'endMarkedContent') band = stack.pop();
                else if (item.transform) {
                  const baseline = height - item.transform[5];
                  if (!band || (baseline >= band.top - 1 && baseline <= band.bottom + 1))
                    items.push(item);
                }
              }
              return { ...content, items };
            };
            const wrapped = new Proxy(page, {
              get(p, name) {
                if (name === 'getTextContent') return text;
                if (name === 'streamTextContent')
                  return (options) =>
                    new ReadableStream({
                      async start(controller) {
                        try {
                          controller.enqueue(await text(options));
                          controller.close();
                        } catch (error) {
                          controller.error(error);
                        }
                      },
                    });
                const value = Reflect.get(p, name);
                return typeof value === 'function' ? value.bind(p) : value;
              },
            });
            pages.set(number, wrapped);
            return wrapped;
          };
        const value = Reflect.get(target, key);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }),
  );
}

export function typicalLineHeight(items) {
  const runs = items.filter((t) => t.str?.trim() && t.transform);
  const sizes = runs
    .map((t) => Math.hypot(t.transform[2], t.transform[3]))
    .filter((n) => n > 4 && n < 60)
    .sort((a, b) => a - b);
  if (!sizes.length) return null;
  const font = sizes[Math.floor(sizes.length / 2)];
  const ys = runs.map((t) => t.transform[5]).sort((a, b) => a - b);
  const advances = ys
    .slice(1)
    .map((y, i) => y - ys[i])
    .filter((gap) => gap >= font * 0.8 && gap <= font * 2)
    .sort((a, b) => a - b);
  return advances.length ? advances[Math.floor(advances.length / 2)] : font * 1.2;
}

// Produce a temporary vector PDF, leaving the source and translation cache intact.
export async function compactPDF(document, number, getDocument, blocks) {
  const page = await document.getPage(number);
  if (page.rotate) return null;
  const viewport = page.getViewport({ scale: 1 });
  const scale = Math.min(1, 768 / viewport.width);
  const raster = window.document.createElement('canvas');
  const view = page.getViewport({ scale });
  raster.width = Math.ceil(view.width);
  raster.height = Math.ceil(view.height);
  try {
    await page.render({ canvasContext: raster.getContext('2d'), viewport: view }).promise;
    const context = raster.getContext('2d', { willReadFrequently: true });
    // Inspector translations live in DOM overlays. Compose their occupied area
    // into the analysis image so hidden source lines do not reserve whitespace.
    for (const b of blocks.filter((b) => !b.math && b.translation)) {
      context.fillStyle = 'white';
      context.fillRect(b.x * scale, b.y * scale, b.width * scale, b.height * scale);
      const font = b.fontSize || 12;
      context.font = `${b.bold ? '600 ' : ''}${font * scale}px serif`;
      let lines = 1,
        width = 0;
      for (const c of b.translation) {
        if (c === '\n') {
          lines++;
          width = 0;
          continue;
        }
        const advance = context.measureText(c).width;
        if (width + advance > b.width * scale && width > 0) {
          lines++;
          width = 0;
        }
        width += advance;
      }
      context.fillStyle = 'black';
      context.fillRect(
        b.x * scale,
        b.y * scale,
        b.width * scale,
        Math.min(b.height, lines * font * 1.2) * scale,
      );
    }
    const pixels = context.getImageData(0, 0, raster.width, raster.height).data;
    const occupied = Array(raster.height).fill(false);
    for (let y = 0; y < raster.height; y++)
      for (let x = 0; x < raster.width; x++) {
        const i = (y * raster.width + x) * 4;
        if (pixels[i + 3] > 32 && Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) < 238) {
          occupied[y] = true;
          break;
        }
      }
    const content = await page.getTextContent();
    const lineHeight = typicalLineHeight(content.items);
    if (!lineHeight) return null;
    const cuts = compactBands(occupied, scale, viewport.height, lineHeight);
    if (!cuts.length) return null;
    const {
      PDFDocument,
      pushGraphicsState,
      popGraphicsState,
      rectangle,
      clip,
      endPath,
      beginMarkedContent,
      endMarkedContent,
      PDFName,
    } = await import('pdf-lib');
    const original = await PDFDocument.load(await document.getData());
    const output = await PDFDocument.create();
    const embedded = await output.embedPage(original.getPage(number - 1), {
      left: page.view[0],
      bottom: page.view[1],
      right: page.view[2],
      top: page.view[3],
    });
    const height = mapCompactY(viewport.height, cuts);
    const target = output.addPage([viewport.width, height]);
    const bands = [];
    let start = 0;
    for (const end of [...cuts.map((c) => c.start), viewport.height]) {
      const mapped = mapCompactY(start, cuts),
        h = end - start;
      if (h > 0) {
        bands.push({ top: mapped, bottom: mapped + h });
        target.pushOperators(
          beginMarkedContent(PDFName.of('CompactBand' + (bands.length - 1))),
          pushGraphicsState(),
          rectangle(0, height - mapped - h, viewport.width, h),
          clip(),
          endPath(),
        );
        target.drawPage(embedded, {
          x: 0,
          y: height - mapped + start - viewport.height,
          width: viewport.width,
          height: viewport.height,
        });
        target.pushOperators(popGraphicsState(), endMarkedContent());
      }
      const cut = cuts.find((c) => c.start === end);
      start = cut?.end ?? end;
    }
    const compactDocument = markRaw(await getDocument({ data: await output.save() }).promise);
    return { cuts, height, document: compactTextDocument(compactDocument, bands, height) };
  } finally {
    raster.width = raster.height = 0;
  }
}

function releaseCompactDocument(document) {
  const task = document?.loadingTask;
  const promise = task?.destroy?.() ?? document?.destroy?.();
  void promise?.catch(() => {});
}

export function createParagraphCompaction({
  enabled,
  pages,
  sourceDocument,
  getDocument,
  changed,
  changing = () => () => {},
}) {
  const results = shallowRef(new Map());
  let epoch = 0,
    disposed = false;
  const cache = new Map();
  const clear = () => {
    for (const value of cache.values()) releaseCompactDocument(value?.document);
    cache.clear();
    results.value = new Map();
  };
  let source;
  watch(
    () => [
      enabled.value,
      sourceDocument(),
      ...pages.value.map((p) => [
        p,
        p.status,
        p.mathDocument,
        ...p.blocks.map((b) => b.status + ':' + b.translation),
      ]),
    ],
    async () => {
      const id = ++epoch;
      if (source !== sourceDocument()) {
        clear();
        source = sourceDocument();
      }
      if (!enabled.value || !source) return;
      for (const p of pages.value) {
        if (id !== epoch || disposed) return;
        if (
          p.status !== 'ready' ||
          (!p.mathDocument &&
            (!p.blocks.length || p.blocks.some((b) => !b.translation || b.status !== 'ready')))
        )
          continue;
        const document = p.mathDocument || source;
        const key =
          p.number +
          ':' +
          (document.fingerprints?.[0] || '') +
          ':' +
          p.blocks.map((b) => b.translation).join('\n');
        if (cache.has(key)) {
          if (cache.get(key)) results.value = new Map(results.value).set(p.number, cache.get(key));
          continue;
        }
        try {
          const result = await compactPDF(
            document,
            p.mathDocument ? 1 : p.number,
            getDocument,
            p.blocks,
          );
          if (id !== epoch || disposed) {
            releaseCompactDocument(result?.document);
            return;
          }
          if (result) {
            result.inputDocument = document;
            result.inputText = p.blocks.map((b) => b.translation).join('\n');
          }
          cache.set(key, result);
          if (result) {
            const restore = changing(p, result);
            results.value = new Map(results.value).set(p.number, result);
            changed(restore);
          }
        } catch {
          /* Keep the original layout if a page cannot be safely compacted. */
        }
      }
    },
    { immediate: true },
  );
  onBeforeUnmount(() => {
    disposed = true;
    ++epoch;
    clear();
  });
  return (p) => {
    const result = enabled.value && results.value.get(p.number);
    if (
      !result ||
      p.status !== 'ready' ||
      result.inputDocument !== (p.mathDocument || source) ||
      result.inputText !== p.blocks.map((b) => b.translation).join('\n')
    )
      return p;
    const blocks = p.blocks.map((b) => ({
      ...mapCompactRect(b, result.cuts),
      sourceBox: mapCompactRect(b.sourceBox, result.cuts),
      translatedBox: mapCompactRect(b.translatedBox, result.cuts),
    }));
    return {
      ...p,
      height: result.height,
      mathDocument: result.document,
      blocks,
      paragraphCompaction: result.cuts,
    };
  };
}
