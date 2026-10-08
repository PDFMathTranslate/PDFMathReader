import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compactBands,
  mapCompactY,
  mapCompactRect,
} from '../../src/features/reader/paragraph-compaction.mjs';

test('large empty bands shrink to 1.5 line heights, normal leading remains', () => {
  const rows = Array(200).fill(false);
  for (const [a, b] of [
    [10, 30],
    [40, 60],
    [120, 140],
  ])
    for (let i = a; i < b; i++) rows[i] = true;
  assert.deepEqual(compactBands(rows, 1, 200, 12), [{ start: 78, end: 120 }]);
  assert.deepEqual(compactBands(Array(200).fill(false), 1, 200, 12), []);
});
test('content and annotation coordinates round-trip across compressed gaps', () => {
  const cuts = [
    { start: 78, end: 120 },
    { start: 160, end: 180 },
  ];
  for (const y of [0, 40, 75, 125, 150, 185, 200])
    assert.equal(mapCompactY(mapCompactY(y, cuts), cuts, true), y);
  const rect = { x: 20, y: 125, width: 50, height: 12 };
  assert.deepEqual(mapCompactRect(mapCompactRect(rect, cuts), cuts, true), rect);
  assert.equal(mapCompactY(200, cuts), 138);
});
test('an occupied image or rule prevents removal through that row', () => {
  const rows = Array(100).fill(true);
  rows.fill(false, 20, 40);
  rows.fill(false, 41, 60);
  assert.deepEqual(compactBands(rows, 1, 100, 14), []);
});

test('clipped PDF strips expose only their visible text to selection and search', async () => {
  const { compactTextDocument } =
    await import('../../src/features/reader/paragraph-compaction.mjs');
  const line = (str, baseline) => ({ str, transform: [12, 0, 0, 12, 20, 200 - baseline] });
  const doc = compactTextDocument(
    {
      getPage: async () => ({
        getTextContent: async () => ({
          styles: {},
          items: [
            { type: 'beginMarkedContent', tag: 'CompactBand0' },
            line('first', 20),
            line('hidden duplicate', 120),
            { type: 'endMarkedContent' },
            { type: 'beginMarkedContent', tag: 'CompactBand1' },
            line('hidden duplicate', 10),
            line('second', 120),
            { type: 'endMarkedContent' },
          ],
        }),
      }),
    },
    [
      { top: 0, bottom: 50 },
      { top: 80, bottom: 180 },
    ],
    200,
  );
  const page = await doc.getPage(1);
  assert.deepEqual(
    (await page.getTextContent()).items.map((i) => i.str),
    ['first', 'second'],
  );
  const stream = page.streamTextContent().getReader();
  assert.deepEqual(
    (await stream.read()).value.items.map((i) => i.str),
    ['first', 'second'],
  );
});
test('paragraph gap uses measured baseline leading rather than glyph height', async () => {
  const { typicalLineHeight } = await import('../../src/features/reader/paragraph-compaction.mjs');
  assert.equal(
    typicalLineHeight(
      [100, 84, 68, 20].map((y) => ({ str: 'line', transform: [12, 0, 0, 12, 0, y] })),
    ),
    16,
  );
});
