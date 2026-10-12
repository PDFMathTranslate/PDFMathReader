import { buildLines } from './toc-generator.mjs';

// pdf.js Util.transform: m1 x m2.
const multiply = (a, b) => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];

// Positioned lines of one page (1-based), in top-down page coordinates.
export async function collectPageLines(pdf, number) {
  const page = await pdf.getPage(number);
  try {
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = [];
    for (const item of content.items) {
      if (typeof item.str !== 'string' || !item.str.trim()) continue;
      const m = multiply(viewport.transform, item.transform);
      const size = Math.hypot(m[2], m[3]);
      // Skip rotated text such as margin stamps.
      if (!(size > 0) || Math.abs(m[1]) > 0.1 * Math.abs(m[0])) continue;
      items.push({
        text: item.str,
        x: m[4],
        y: m[5],
        size,
        width: Math.abs(item.width * viewport.scale),
      });
    }
    return buildLines(items, { number, width: viewport.width, height: viewport.height });
  } finally {
    page.cleanup();
  }
}
