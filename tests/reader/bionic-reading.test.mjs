import test from 'node:test';
import assert from 'node:assert/strict';
import { stemEnglish } from '../../src/features/translation/english-stem.mjs';
import {
  bionicReadingRanges,
  bionicRunRanges,
  normalizeBionicReading,
  withBionicSegments,
} from '../../src/features/translation/bionic-reading.mjs';
import { informationTextSegments } from '../../src/features/translation/information-emphasis.mjs';
import { bionicBands, emboldenPixels } from '../../src/features/reader/bionic-overlay.mjs';

const marked = (text, options) => {
  let out = '',
    at = 0;
  for (const r of bionicReadingRanges(text, options)) {
    out += text.slice(at, r.start) + '[' + text.slice(r.start, r.end) + ']';
    at = r.end;
  }
  return out + text.slice(at);
};

test('Porter2 stems match Snowball reference output', () => {
  for (const [word, stem] of Object.entries({
    consign: 'consign',
    consigned: 'consign',
    consignment: 'consign',
    consistently: 'consist',
    consolatory: 'consolatori',
    conspicuously: 'conspicu',
    knackeries: 'knackeri',
    knitting: 'knit',
    knives: 'knive',
    kneaded: 'knead',
    happiness: 'happi',
    relational: 'relat',
    generalization: 'general',
    communication: 'communic',
    hoping: 'hope',
    skies: 'sky',
    fluently: 'fluentli',
  }))
    assert.equal(stemEnglish(word), stem, word);
});

test('fixed mode bolds the same number of letters, always leaving one plain', () => {
  assert.equal(
    marked('A reader is guided quickly.', { mode: 'fixed', fixedLength: 3 }),
    '[A] [rea]der [i]s [gui]ded [qui]ckly.',
  );
  assert.equal(marked('Reading', { mode: 'fixed', fixedLength: 1 }), '[R]eading');
  assert.equal(marked('Reading', { mode: 'off' }), 'Reading');
  assert.deepEqual(normalizeBionicReading({ mode: 'bold', fixedLength: 9 }), {
    mode: 'off',
    fixedLength: 6,
  });
});

test('root mode bolds English words up to their stem', () => {
  assert.equal(
    marked('Relational happiness grows consistently in the kneaded dough.', { mode: 'root' }),
    '[Relat]ional [happi]ness [grow]s [consist]ently [i]n [t]he [knead]ed [do]ugh.',
  );
});

test('CJK words skip single characters and keep one plain character', () => {
  assert.equal(marked('我们发现结果。', { mode: 'root' }), '[我]们[发]现[结]果。');
  assert.equal(marked('研究', { mode: 'fixed', fixedLength: 3 }), '[研]究');
  assert.equal(marked('2024 年', { mode: 'root' }), '2024 年');
});

test('bionic ranges split shared text segments without losing emphasis', () => {
  const text = 'However results differ';
  const parts = withBionicSegments(
    informationTextSegments(text, { emphasizeInformation: true, topicEnd: 7 }),
    bionicReadingRanges(text, { mode: 'fixed', fixedLength: 2 }),
  );
  assert.equal(parts.map((p) => p.text).join(''), text);
  assert.deepEqual(
    parts.filter((p) => p.bionic).map((p) => [p.text, p.topic, p.important]),
    [
      ['Ho', true, true],
      ['re', false, true],
      ['di', false, false],
    ],
  );
});

test('PDF runs join hyphenated words before finding the root', () => {
  const runs = [
    { text: 'inter-', x: 0, y: 0, width: 30, height: 10 },
    { text: 'national trade', x: 0, y: 12, width: 70, height: 10 },
  ];
  assert.deepEqual(bionicRunRanges(runs, { mode: 'root' }), [
    { index: 0, start: 0, end: 6 },
    { index: 1, start: 0, end: 1 },
    { index: 1, start: 9, end: 11 },
  ]);
  assert.deepEqual(bionicRunRanges(runs, { mode: 'off' }), []);
});

test('faux bold adds only new ink beside dark glyphs', () => {
  // One black pixel on a white row of four.
  const row = new Uint8ClampedArray([
    255, 255, 255, 255, 0, 0, 0, 255, 255, 255, 255, 255, 255, 255, 255, 255,
  ]);
  const out = emboldenPixels(row, 4, 1, 2);
  assert.deepEqual([...out.slice(0, 8)], [0, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual([...out.slice(8)], [0, 0, 0, 255, 0, 0, 0, 255]);
  // Light ink on a dark page spreads the maximum instead.
  const dark = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 0, 0, 0, 255]);
  assert.deepEqual([...emboldenPixels(dark, 3, 1, 1).slice(4, 8)], [255, 255, 255, 255]);
});

test('overlay boxes group into bounded bands', () => {
  const bands = bionicBands(
    [
      { x: 0, y: 600, width: 5, height: 20 },
      { x: 0, y: 0, width: 5, height: 20 },
      { x: 9, y: 30, width: 5, height: 20 },
    ],
    512,
  );
  assert.deepEqual(
    bands.map((b) => [b.top, b.bottom, b.boxes.length]),
    [
      [0, 50, 2],
      [600, 620, 1],
    ],
  );
});
