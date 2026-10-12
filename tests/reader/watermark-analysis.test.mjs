import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  buildModel,
  hiddenTextMatcher,
  scanOperatorList,
  watermarkItems,
  watermarkOperations,
} from '../../src/features/reader/watermark-analysis.mjs';

const fonts = fileURLToPath(
  new URL('../../node_modules/pdfjs-dist/standard_fonts/', import.meta.url),
);

function crc32(bytes) {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}
function png() {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]),
      out = Buffer.alloc(12 + data.length);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), 8 + data.length);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(2, 0);
  header.writeUInt32BE(2, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const rows = Buffer.concat([0, 1].map(() => Buffer.from([0, 200, 30, 30, 30, 30, 200]))); // filter byte + 2 RGB pixels
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

async function fixture(pages = 5) {
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica),
    image = await pdf.embedPng(png());
  for (let n = 1; n <= pages; n++) {
    const page = pdf.addPage([612, 792]);
    for (let i = 0; i < 20; i++)
      page.drawText(`Ordinary body sentence number ${n}.${i} of the paper.`, {
        x: 72,
        y: 700 - i * 14,
        size: 10,
        font,
      });
    page.drawText('Journal of Examples', { x: 72, y: 40, size: 10, font });
    if (n === 1) page.drawText('A Large Opaque Title', { x: 72, y: 740, size: 30, font });
    page.drawText('DRAFT COPY', {
      x: 150,
      y: 250,
      size: 72,
      font,
      rotate: degrees(45),
      color: rgb(0.8, 0.8, 0.8),
      opacity: 0.3,
    });
    page.drawImage(image, { x: 156, y: 296, width: 300, height: 200, opacity: 0.4 });
    page.drawText(`arXiv margin stamp ${n}`, { x: 20, y: 300, size: 9, font, rotate: degrees(90) });
  }
  return pdf.save();
}

async function scans(bytes) {
  const task = pdfjs.getDocument({
      data: new Uint8Array(bytes),
      standardFontDataUrl: fonts,
      verbosity: 0,
    }),
    document = await task.promise;
  const result = [];
  for (let n = 1; n <= document.numPages; n++) {
    const page = await document.getPage(n);
    result.push(scanOperatorList(await page.getOperatorList(), pdfjs.OPS, page.view));
  }
  await task.destroy();
  return result;
}

test('large translucent diagonal text and images are skipped while ordinary text stays', async () => {
  const pages = await scans(await fixture());
  const model = buildModel(pages);
  assert.ok(Math.abs(model.bodySize - 10) < 0.6, `body size ${model.bodySize}`);
  for (const [index, page] of pages.entries()) {
    const skipped = new Set(watermarkOperations(page, model)),
      kept = page.items.filter((item) => !item.ops.some((op) => skipped.has(op)));
    const removed = page.items.filter((item) => item.ops.some((op) => skipped.has(op)));
    assert.deepEqual(
      removed.map((item) => (item.kind === 'text' ? item.text.trim() : 'image')).sort(),
      ['DRAFT COPY', 'image'],
      `page ${index + 1}`,
    );
    assert.ok(kept.some((item) => item.text?.startsWith('Ordinary')));
    assert.ok(kept.some((item) => item.text?.trim() === 'Journal of Examples'));
    assert.ok(kept.some((item) => item.text?.startsWith('arXiv margin stamp')));
    if (index === 0) assert.ok(kept.some((item) => item.text?.trim() === 'A Large Opaque Title'));
  }
});

test('a page of ordinary content loses nothing', async () => {
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica),
    page = pdf.addPage([612, 792]);
  for (let i = 0; i < 20; i++)
    page.drawText(`Plain sentence ${i} with enough words to set the body size.`, {
      x: 72,
      y: 700 - i * 14,
      size: 10,
      font,
    });
  page.drawText('Opaque Big Heading', { x: 72, y: 740, size: 30, font });
  const [scan] = await scans(await pdf.save());
  assert.equal(watermarkOperations(scan, buildModel([scan])).size, 0);
});

test('without other signs, size alone does not mark text or a full-page image', () => {
  const OPS = { showText: 44, paintImageXObject: 85, setFont: 37, beginText: 31, endText: 32 };
  const glyphs = [{ unicode: 'Hello world' }];
  const scan = scanOperatorList(
    {
      fnArray: [OPS.beginText, OPS.setFont, OPS.showText, OPS.endText, OPS.paintImageXObject],
      argsArray: [[], ['f1', 60], [glyphs], [], ['img', 100, 100]],
    },
    OPS,
    [0, 0, 612, 792],
  );
  assert.equal(watermarkOperations(scan, buildModel([scan])).size, 0);
});

test('an opaque stamp is removed only when it recurs at the same place on many pages', async () => {
  const stamp = async (stampedPages) => {
    const pdf = await PDFDocument.create(),
      font = await pdf.embedFont(StandardFonts.Helvetica);
    for (let n = 1; n <= 5; n++) {
      const page = pdf.addPage([612, 792]);
      for (let i = 0; i < 20; i++)
        page.drawText(`Ordinary body sentence number ${n}.${i} of the paper.`, {
          x: 72,
          y: 700 - i * 14,
          size: 10,
          font,
        });
      if (n <= stampedPages) page.drawText('INTERNAL USE', { x: 150, y: 400, size: 40, font });
    }
    const pages = await scans(await pdf.save());
    return pages.map((page) => watermarkOperations(page, buildModel(pages)).size);
  };
  assert.ok((await stamp(5)).every((count) => count > 0));
  assert.ok((await stamp(1)).every((count) => count === 0));
});

test('the text of removed watermarks is matched, and ordinary text is not', async () => {
  const pages = await scans(await fixture()),
    model = buildModel(pages);
  const hidden = hiddenTextMatcher(watermarkItems(pages[0], model));
  assert.equal(hidden.length, 1);
  assert.ok(hidden.matches('DRAFT COPY'));
  assert.ok(hidden.matches(' draft  copy '));
  assert.ok(hidden.matches('DRAFT'));
  assert.ok(!hidden.matches('D'));
  assert.ok(!hidden.matches('Ordinary body sentence number 1.0 of the paper.'));
  assert.ok(!hidden.matches('A Large Opaque Title'));
  assert.ok(!hidden.matches(''));
  assert.equal(hiddenTextMatcher([]).matches('DRAFT COPY'), false);
});

test('an image larger than the page is removed only when it is see-through', () => {
  const OPS = {
    save: 10,
    restore: 11,
    transform: 12,
    setGState: 13,
    paintImageXObject: 85,
    setFont: 37,
    beginText: 31,
    endText: 32,
    showText: 44,
  };
  // A tiled stamp is drawn far larger than the page and only a part of it shows.
  const stamp = (alpha) =>
    scanOperatorList(
      {
        fnArray: [OPS.save, OPS.setGState, OPS.transform, OPS.paintImageXObject, OPS.restore],
        argsArray: [
          [],
          [[['ca', alpha]]],
          [3600, 0, 0, 2025, -1494, -616],
          ['img', 4800, 2700],
          [],
        ],
      },
      OPS,
      [0, 0, 612, 792],
    );
  const faded = stamp(0.25),
    opaque = stamp(1);
  assert.ok(faded.items[0].coverage > 10);
  assert.deepEqual([...watermarkOperations(faded, buildModel([faded]))], [3]);
  assert.equal(watermarkOperations(opaque, buildModel([opaque])).size, 0);
});
