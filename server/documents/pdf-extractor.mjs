import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function hasNativeInspector(platform = process.platform, arch = process.arch) {
  return platform === 'darwin'
    ? arch === 'arm64'
    : platform === 'win32'
      ? arch === 'x64'
      : platform === 'linux' && ['x64', 'arm64'].includes(arch);
}

let native, pdfjs, recoveryWarned;
export async function extractPdfJsPositions(bytes, pages) {
  pdfjs ??= (async () => {
    if (!globalThis.DOMMatrix) globalThis.DOMMatrix = (await import('@thednp/dommatrix')).default;
    const module = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const require = createRequire(import.meta.url),
      root = dirname(require.resolve('pdfjs-dist/package.json'));
    module.GlobalWorkerOptions.workerSrc = pathToFileURL(
      join(root, 'legacy/build/pdf.worker.mjs'),
    ).href;
    return { module, root };
  })();
  const { module, root } = await pdfjs;
  const task = module.getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
    standardFontDataUrl: join(root, 'standard_fonts') + '/',
    cMapUrl: join(root, 'cmaps') + '/',
    cMapPacked: true,
  });
  try {
    const document = await task.promise,
      items = [];
    for (const number of pages ||
      Array.from({ length: document.numPages }, (_, index) => index + 1)) {
      const page = await document.getPage(number),
        viewport = page.getViewport({ scale: 1 }),
        content = await page.getTextContent();
      for (const item of content.items) {
        if (!item.str?.trim()) continue;
        const transform = module.Util.transform(viewport.transform, item.transform),
          fontSize = Math.hypot(transform[2], transform[3]);
        const font = content.styles[item.fontName],
          angle = Math.atan2(transform[1], transform[0]);
        items.push({
          page: number,
          text: item.str,
          x: transform[4],
          y: viewport.height - transform[5],
          width: item.width,
          height: fontSize,
          fontSize,
          isBold: /bold|black|heavy/i.test(font?.fontFamily || ''),
          rotation: Math.abs(angle) < 0.001 ? 0 : (angle * 180) / Math.PI,
          itemType: 'Text',
        });
      }
    }
    return items;
  } finally {
    await task.destroy();
  }
}

const textLength = (items) =>
  items.reduce(
    (sum, item) => sum + (item.itemType === 'Image' ? 0 : item.text?.trim().length || 0),
    0,
  );

// OCR words jitter in baseline, size and spacing. Merge each baseline into runs and
// snap near-body sizes to the page's body size so layout grouping sees whole lines.
export function normalizeOcrItems(items) {
  const groups = [];
  for (const item of [...items].sort((a, b) => b.y - a.y)) {
    const group = groups.at(-1);
    if (group && Math.abs(group[0].y - item.y) < Math.min(group[0].fontSize, item.fontSize) * 0.3)
      group.push(item);
    else groups.push([item]);
  }
  const runs = groups.flatMap((group) => {
    const size = group.map((item) => item.fontSize).sort((a, b) => a - b)[group.length >> 1],
      merged = [];
    for (const item of group.sort((a, b) => a.x - b.x)) {
      const run = merged.at(-1);
      if (run && item.x - (run.x + run.width) < size * 1.6) {
        run.text += ' ' + item.text;
        run.width = Math.max(run.width, item.x + item.width - run.x);
        run.isBold ||= item.isBold;
      } else merged.push({ ...item, y: group[0].y, fontSize: size, height: size });
    }
    return merged;
  });
  const sizes = runs
      .flatMap((run) => Array(run.text.length).fill(run.fontSize))
      .sort((a, b) => a - b),
    body = sizes[sizes.length >> 1];
  for (const run of runs)
    if (run.fontSize >= body * 0.8 && run.fontSize <= body * 1.3) run.fontSize = run.height = body;
  return runs;
}

// The native inspector drops invisible OCR text layers on scanned pages, leaving only
// the page image plus any real overlay text (e.g. a JSTOR footer). Re-read those pages
// with pdf.js and keep its text when it finds substantially more.
export async function recoverScannedPages(bytes, items, pdfJs = extractPdfJsPositions) {
  const byPage = new Map();
  for (const item of items) {
    if (!byPage.has(item.page)) byPage.set(item.page, []);
    byPage.get(item.page).push(item);
  }
  const candidates = [...byPage]
    .filter(([, pageItems]) => pageItems.some((item) => item.itemType === 'Image'))
    .map(([page]) => page);
  if (!candidates.length) return items;
  const recovered = new Map();
  for (const item of await pdfJs(bytes, candidates)) {
    if (!recovered.has(item.page)) recovered.set(item.page, []);
    recovered.get(item.page).push(item);
  }
  for (const [page, pageItems] of recovered) recovered.set(page, normalizeOcrItems(pageItems));
  const replaced = new Set(
    candidates.filter((page) => {
      const before = textLength(byPage.get(page)),
        after = textLength(recovered.get(page) || []);
      return after >= 200 && after > before * 2;
    }),
  );
  if (!replaced.size) return items;
  const result = [];
  for (const [page, pageItems] of byPage)
    result.push(
      ...(replaced.has(page)
        ? [...pageItems.filter((item) => item.itemType === 'Image'), ...recovered.get(page)]
        : pageItems),
    );
  return result;
}

export async function extractTextWithPositionsAsync(bytes, ...args) {
  if (!hasNativeInspector()) return extractPdfJsPositions(bytes, ...args);
  native ??= import('@firecrawl/pdf-inspector');
  const items = await (await native).extractTextWithPositionsAsync(bytes, ...args);
  try {
    return await recoverScannedPages(bytes, items);
  } catch (error) {
    if (!recoveryWarned) console.warn('Scanned-page text recovery unavailable:', error?.message);
    recoveryWarned = true;
    return items;
  }
}
