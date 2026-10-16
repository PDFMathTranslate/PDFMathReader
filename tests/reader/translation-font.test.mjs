import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isValidTranslationFont,
  stripTranslationFont,
  translationFontFamily,
} from '../../shared/reader/translation-font.mjs';

test('Ultra fast keeps the default font until a preference is set', () => {
  assert.equal(translationFontFamily(), '');
  assert.equal(translationFontFamily({ font: '   ' }), '');
});

test('serif stacks follow the target language', () => {
  const chinese = translationFontFamily({ serif: true, language: 'Simplified Chinese' });
  assert.match(chinese, /"Songti SC".*, serif$/);
  const japanese = translationFontFamily({ serif: true, language: 'Japanese' });
  assert.match(japanese, /"Hiragino Mincho ProN"/);
  assert.doesNotMatch(japanese, /Songti SC/);
});

test('a specified font leads the stack and falls back by serif choice', () => {
  assert.match(
    translationFontFamily({ font: ' Kaiti SC ' }),
    /^"Kaiti SC", -apple-system,.*sans-serif$/,
  );
  assert.match(translationFontFamily({ font: 'Kaiti SC', serif: true }), /^"Kaiti SC", .*serif$/);
});

test('a CJK font follows the Latin font', () => {
  assert.match(
    translationFontFamily({ font: 'Avenir Next', cjkFont: 'PingFang SC' }),
    /^"Avenir Next", "PingFang SC", -apple-system,/,
  );
  assert.match(translationFontFamily({ cjkFont: 'Songti SC', serif: true }), /^"Songti SC", /);
});

test('font names cannot escape the CSS declaration', () => {
  assert.equal(stripTranslationFont('A"; color: red}'), 'A color: red');
  assert.equal(stripTranslationFont('Songti '), 'Songti ');
  assert.equal(isValidTranslationFont('Songti SC'), true);
  assert.equal(isValidTranslationFont('A"B'), false);
  assert.equal(isValidTranslationFont('x'.repeat(101)), false);
  assert.equal(isValidTranslationFont(1), false);
});
