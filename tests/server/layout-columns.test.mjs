import test from 'node:test';
import assert from 'node:assert/strict';
import { paragraphs } from '../../server/documents/layout.mjs';

const height = 790.866;

function run(text, { x, top, width, fontSize = 10, height: runHeight = fontSize, isBold = false }) {
  return {
    text,
    x,
    y: height - top - runHeight,
    width,
    height: runHeight,
    fontSize,
    isBold,
    rotation: 0,
    itemType: 'Text',
  };
}

function geometry(block) {
  return {
    text: block.text,
    x: Number(block.x.toFixed(2)),
    y: Number(block.y.toFixed(2)),
    width: Number(block.width.toFixed(2)),
  };
}

test('keeps a narrow two-column gutter out of one source line', () => {
  const items = [
    run('Left first line', { x: 51.02, top: 474.23, width: 242.06 }),
    run('Right first line', { x: 306.14, top: 474.23, width: 240.99 }),
    run('Left second line', { x: 51.02, top: 486.73, width: 242.05 }),
    run('Right second line', { x: 306.14, top: 486.73, width: 241.58 }),
  ];

  const blocks = paragraphs(items, height);

  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks.map(geometry), [
    { text: 'Left first line Left second line', x: 51.02, y: 474.23, width: 242.06 },
    { text: 'Right first line Right second line', x: 306.14, y: 474.23, width: 241.58 },
  ]);
});

test('retains adjacent small citation runs on one line', () => {
  const blocks = paragraphs(
    [
      run('1', { x: 51.02, top: 706.23, width: 2.98, fontSize: 5.95, height: 9.35 }),
      run('University of Groningen', {
        x: 65.2,
        top: 706.23,
        width: 199.75,
        fontSize: 5.95,
        height: 9.35,
      }),
    ],
    height,
  );

  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].text, '1 University of Groningen');
});

test('preserves spanning title and abstract in a mixed page region', () => {
  const items = [
    run('The disciplinary power of predictive algorithms', {
      x: 51.02,
      top: 102.58,
      width: 401.16,
      fontSize: 16,
      height: 16,
      isBold: true,
    }),
    run('A Foucauldian perspective', {
      x: 51.02,
      top: 120.58,
      width: 220,
      fontSize: 16,
      height: 16,
      isBold: true,
    }),
    run('Abstract', { x: 51.02, top: 224.23, width: 38.12, isBold: true }),
    run('A full-width abstract line', { x: 51.02, top: 236.73, width: 496.43 }),
    run('A second full-width abstract line', { x: 51.02, top: 249.23, width: 496.43 }),
    run('Introduction', {
      x: 51.02,
      top: 447.23,
      width: 67.64,
      fontSize: 12,
      height: 12,
      isBold: true,
    }),
    run('Left body line', { x: 51.02, top: 474.23, width: 242.06 }),
    run('Right body line', { x: 306.14, top: 474.23, width: 240.99 }),
  ];

  const blocks = paragraphs(items, height);

  assert.deepEqual(blocks.map(geometry), [
    {
      text: 'The disciplinary power of predictive algorithms A Foucauldian perspective',
      x: 51.02,
      y: 102.58,
      width: 401.16,
    },
    { text: 'Abstract', x: 51.02, y: 224.23, width: 38.12 },
    {
      text: 'A full-width abstract line A second full-width abstract line',
      x: 51.02,
      y: 236.73,
      width: 496.43,
    },
    { text: 'Introduction', x: 51.02, y: 447.23, width: 67.64 },
    { text: 'Left body line', x: 51.02, y: 474.23, width: 242.06 },
    { text: 'Right body line', x: 306.14, y: 474.23, width: 240.99 },
  ]);
});
