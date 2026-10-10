export function hasParagraphTranslation(page) {
  return page.blocks?.some((block) => !block.math && !!block.translation) === true;
}

function wrap(context, text, width) {
  const lines = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = '';
    for (const { segment } of new Intl.Segmenter(undefined, { granularity: 'word' }).segment(
      paragraph,
    )) {
      if (context.measureText(segment).width <= width) {
        if (line && context.measureText(line + segment).width > width) {
          lines.push(line.trimEnd());
          line = '';
        }
        line += line ? segment : segment.trimStart();
        continue;
      }
      for (const character of segment) {
        if (line && context.measureText(line + character).width > width) {
          lines.push(line);
          line = '';
        }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

export async function paragraphOverlay(page, viewport) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  const scale = Math.min(2, Math.sqrt((16 * 1024 * 1024) / (viewport.width * viewport.height)));
  canvas.width = Math.ceil(viewport.width * scale);
  canvas.height = Math.ceil(viewport.height * scale);
  const context = canvas.getContext('2d');
  context.scale(scale, scale);
  context.textBaseline = 'top';
  try {
    for (const block of page.blocks.filter((block) => !block.math && block.translation)) {
      const { x, y, width, height, fontSize = 12 } = block;
      if (
        ![x, y, width, height, fontSize].every(Number.isFinite) ||
        width <= 0 ||
        height <= 0 ||
        fontSize <= 0
      )
        throw Error('Invalid translated paragraph geometry.');
      let size = fontSize;
      let lines;
      do {
        context.font = `${block.bold ? 600 : 400} ${size}px sans-serif`;
        lines = wrap(context, block.translation, width);
        if (lines.length * size * 1.2 <= Math.max(height, fontSize * 1.1)) break;
        size -= 0.5;
      } while (size > 0.5);
      const padding = Math.max(3, fontSize * 0.28);
      context.fillStyle = 'white';
      context.fillRect(
        x - padding,
        y - padding,
        width + padding * 2,
        Math.max(height, fontSize * 1.1) + padding * 2,
      );
      context.fillStyle = 'black';
      lines.forEach((line, index) => {
        const measured = context.measureText(line).width;
        const offset =
          block.textAlign === 'center'
            ? (width - measured) / 2
            : block.textAlign === 'right'
              ? width - measured
              : 0;
        context.fillText(line, x + offset, y + index * size * 1.2);
      });
    }
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw Error('Could not render the translated PDF page.');
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    canvas.width = canvas.height = 0;
  }
}

// Keep the original PDF vectors and images. Only the translated text overlay
// is rasterized, so system fonts can cover every supported target language.
export async function createParagraphPDFPages(pdf, pages, overlay = paragraphOverlay) {
  const translated = pages.map(hasParagraphTranslation);
  if (!translated.some(Boolean)) return pages.map(() => null);
  const { PDFDocument, degrees } = await import('pdf-lib');
  const original = await PDFDocument.load(await pdf.getData());
  const result = [];
  for (const [index, page] of pages.entries()) {
    if (!translated[index]) {
      result.push(null);
      continue;
    }
    const sourcePage = await pdf.getPage(index + 1);
    const viewport = sourcePage.getViewport({ scale: 1 });
    const output = await PDFDocument.create();
    const [copied] = await output.copyPages(original, [index]);
    output.addPage(copied);
    const image = await output.embedPng(await overlay(page, viewport));
    const rotation = ((copied.getRotation().angle % 360) + 360) % 360;
    const crop = copied.getCropBox();
    const [left, bottom, right, top] = sourcePage.view || [
      crop.x,
      crop.y,
      crop.x + crop.width,
      crop.y + crop.height,
    ];
    copied.drawImage(image, {
      x: rotation === 90 || rotation === 180 ? right : left,
      y: rotation === 180 || rotation === 270 ? top : bottom,
      width: viewport.width,
      height: viewport.height,
      rotate: degrees(rotation),
    });
    result.push(Array.from(await output.save()));
  }
  return result;
}
