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

let native, pdfjs;
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

export async function extractTextWithPositionsAsync(...args) {
  if (!hasNativeInspector()) return extractPdfJsPositions(...args);
  native ??= import('@firecrawl/pdf-inspector');
  return (await native).extractTextWithPositionsAsync(...args);
}
