import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib';
import {
  hasNativeInspector,
  extractPdfJsPositions,
  recoverScannedPages,
} from '../../../server/documents/pdf-extractor.mjs';
import { paragraphs } from '../../../server/documents/layout.mjs';

test('portable extraction preserves selected pages, display-frame positions and font sizes', async () => {
  const pdf = await PDFDocument.create(),
    font = await pdf.embedFont(StandardFonts.Helvetica);
  const first = pdf.addPage([400, 600]);
  first.drawText('Portable reader', { x: 40, y: 500, size: 20, font });
  const second = pdf.addPage([400, 600]);
  second.drawText('Second page', { x: 60, y: 400, size: 16, font });
  const bytes = await pdf.save(),
    items = await extractPdfJsPositions(bytes, [1]);
  assert.equal(items.length, 1);
  assert.equal(items[0].text, 'Portable reader');
  assert.equal(items[0].page, 1);
  assert.equal(items[0].fontSize, 20);
  assert.equal(items[0].x, 40);
  assert.equal(items[0].y, 500);
  assert.ok(items[0].width > 100);
  assert.equal((await extractPdfJsPositions(bytes, [2]))[0].text, 'Second page');
  first.setRotation(degrees(90));
  const rotated = await extractPdfJsPositions(await pdf.save(), [1]);
  assert.ok(Math.abs(rotated[0].rotation) === 90);
  await assert.rejects(extractPdfJsPositions(bytes, [3]));
});

test('scanned pages recover the hidden OCR layer the native inspector drops', async () => {
  const image = (page) => ({
      page,
      text: '[Image]',
      itemType: 'Image',
      x: 0,
      y: 0,
      width: 400,
      height: 600,
    }),
    footer = (page) => ({
      page,
      text: 'All use subject to terms',
      itemType: 'Text',
      x: 100,
      y: 10,
      width: 100,
      height: 6,
      fontSize: 6,
    }),
    native = [
      image(1),
      footer(1),
      {
        page: 2,
        text: 'Born digital page',
        itemType: 'Text',
        x: 40,
        y: 500,
        width: 120,
        height: 10,
        fontSize: 10,
      },
    ],
    word = (text, x, y, fontSize = 10) => ({
      page: 1,
      text,
      itemType: 'Text',
      x,
      y,
      width: text.length * 5,
      height: fontSize,
      fontSize,
      isBold: false,
      rotation: 0,
    });
  const ocr = [];
  // Words jitter in baseline and size and sit just over a 1.2-em gap apart.
  for (let line = 0; line < 8; line++)
    for (let column = 0; column < 4; column++)
      ocr.push(
        word(
          'sociology',
          60 + column * 57.5,
          500 - line * 12 + (column % 2) * 0.4,
          column === 1 ? 8 : 10,
        ),
      );
  ocr.push(footer(1));
  const requested = [];
  const items = await recoverScannedPages(new Uint8Array(), native, async (_bytes, pages) => {
    requested.push(...pages);
    return ocr;
  });
  assert.deepEqual(requested, [1]);
  assert.equal(items.filter((item) => item.page === 2).length, 1);
  assert.ok(items.some((item) => item.page === 1 && item.itemType === 'Image'));
  const result = paragraphs(
    items.filter((item) => item.page === 1),
    600,
  );
  assert.equal(result[0].text, Array(32).fill('sociology').join(' '));
  assert.equal(result.at(-1).text, 'All use subject to terms');
  assert.equal(
    await recoverScannedPages(new Uint8Array(), native, async () => [footer(1)]),
    native,
  );
});
