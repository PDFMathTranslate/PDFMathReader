import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  TFIDF_LEVELS,
  inverseDocumentFrequency,
  samplePageNumbers,
  tfidfRanges,
  tfidfTerm,
  tfidfTermSet,
  tfidfTokens,
} from '../../src/features/translation/tfidf-weighting.mjs';
import { glyphPlan, mergeGlyphPlans } from '../../src/features/reader/bionic-rendering.mjs';

const corpus = (documents, frequencies = {}) => ({
  documents,
  frequency: (term) => frequencies[term] || 0,
});

test('terms are lowercase words of two or more characters that hold a letter', () => {
  assert.equal(tfidfTerm('Entropy'), 'entropy');
  assert.equal(tfidfTerm('a'), '');
  assert.equal(tfidfTerm('2024'), '');
  assert.equal(tfidfTerm('x'.repeat(128)), '');
  assert.deepEqual(
    tfidfTokens('The Gibbs entropy, 2024.').map(({ term, start, end }) => [term, start, end]),
    [
      ['the', 0, 3],
      ['gibbs', 4, 9],
      ['entropy', 10, 17],
    ],
  );
  assert.deepEqual(tfidfTermSet(['Entropy and entropy', 'and more']).sort(), [
    'and',
    'entropy',
    'more',
  ]);
});

test('idf follows fasttfidf and nothing is weighed before the corpus is large enough', () => {
  assert.equal(inverseDocumentFrequency(1, 1), 1);
  assert.ok(Math.abs(inverseDocumentFrequency(1, Math.E) - 2) < 1e-12);
  assert.deepEqual(tfidfRanges('entropy entropy', corpus(2)), []);
  assert.ok(tfidfRanges('entropy entropy', corpus(3)).length);
});

test('common terms stay regular and the top terms are banded by score', () => {
  // Ten documents besides the page's own: "the" is in all of them.
  const text = 'the alpha alpha alpha the beta beta the gamma the delta the epsilon';
  const ranges = tfidfRanges(text, corpus(10, { the: 10, delta: 3, epsilon: 3 }));
  const strength = (word) => ranges.find((r) => text.slice(r.start, r.end) === word)?.strength;
  assert.equal(strength('the'), undefined);
  // Six distinct terms, so ceil(6 * 0.3) = 2 are emphasized.
  assert.equal(strength('alpha'), TFIDF_LEVELS[0]);
  assert.equal(strength('beta'), TFIDF_LEVELS[1]);
  assert.equal(strength('gamma'), undefined);
  assert.equal(ranges.filter((r) => text.slice(r.start, r.end) === 'alpha').length, 3);
});

test('sampled pages are distinct, in range and reproducible', () => {
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const pages = samplePageNumbers(100, 12, random);
  assert.equal(pages.length, 12);
  assert.equal(new Set(pages).size, 12);
  assert.ok(pages.every((n, i) => n >= 1 && n <= 100 && (!i || n > pages[i - 1])));
  assert.deepEqual(samplePageNumbers(3, 12), [1, 2, 3]);
  assert.deepEqual(samplePageNumbers(0), []);
});

test('glyph plans carry strengths and merging keeps the strongest stroke', () => {
  const runs = [
    { op: 4, glyph: 0, text: 'a' },
    { op: 4, glyph: 1, text: 'b' },
    { op: 5, glyph: 0, text: '1' },
  ];
  const tfidf = glyphPlan(runs, [
    { index: 0, strength: 0.4 },
    { index: 1, strength: 0.7 },
    { index: 2, strength: 1 },
  ]);
  assert.deepEqual(
    [...tfidf.get(4)],
    [
      [0, 0.4],
      [1, 0.7],
    ],
  );
  assert.equal(tfidf.has(5), false);
  const bionic = glyphPlan(runs, [{ index: 0 }]);
  assert.equal(bionic.get(4).get(0), 1);
  const merged = mergeGlyphPlans(bionic, tfidf);
  assert.deepEqual(
    [...merged.get(4)],
    [
      [0, 1],
      [1, 0.7],
    ],
  );
  assert.equal(mergeGlyphPlans(null, new Map()), null);
  assert.equal(mergeGlyphPlans(tfidf, null), tfidf);
});
