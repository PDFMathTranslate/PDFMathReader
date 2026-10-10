import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, degrees, StandardFonts } from 'pdf-lib';
import {
  createParagraphPDFPages,
  hasParagraphTranslation,
} from '../../src/features/translation/paragraph-pdf.mjs';

test('ultrafast export creates translated PDF pages and preserves untouched pages for assembly', async () => {
  const original = await PDFDocument.create();
  const font = await original.embedFont(StandardFonts.Helvetica);
  for (const rotation of [0, 90, 180, 270, 0]) {
    const page = original.addPage([200, 300]);
    page.setRotation(degrees(rotation));
    page.drawText('Original vector text', { font, x: 10, y: 200, size: 10 });
  }
  const bytes = await original.save();
  const pdf = {
    getData: async () => bytes,
    getPage: async (number) => ({
      getViewport: () =>
        number === 2 || number === 4 ? { width: 300, height: 200 } : { width: 200, height: 300 },
    }),
  };
  const pages = Array.from({ length: 5 }, (_, index) => ({
    blocks: index < 4 ? [{ translation: '中文译文', x: 10, y: 20, width: 100, height: 40 }] : [],
  }));
  const calls = [];
  const output = await createParagraphPDFPages(pdf, pages, async (page, viewport) => {
    calls.push(viewport);
    return Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',
      'base64',
    );
  });
  assert.equal(output[4], null);
  assert.equal(calls.length, 4);
  for (const [index, rotation] of [0, 90, 180, 270].entries()) {
    const result = await PDFDocument.load(Uint8Array.from(output[index]));
    assert.equal(result.getPageCount(), 1);
    assert.equal(result.getPage(0).getRotation().angle, rotation);
    assert.equal(result.getPage(0).getWidth(), 200);
    assert.equal(result.getPage(0).getHeight(), 300);
  }
});

test('untranslated or math-engine blocks do not create an ultrafast PDF overlay', async () => {
  assert.equal(hasParagraphTranslation({ blocks: [{ math: true, translation: 'Math' }] }), false);
  const output = await createParagraphPDFPages(
    {
      getData: () => {
        throw Error('Should not load PDF');
      },
    },
    [{ blocks: [{ translation: '' }] }],
  );
  assert.deepEqual(output, [null]);
});
