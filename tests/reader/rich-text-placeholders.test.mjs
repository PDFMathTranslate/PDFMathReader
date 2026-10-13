import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasRichTextPlaceholders,
  hasUnparsedPlaceholders,
  stripRichTextPlaceholders,
} from '../../shared/translation/rich-text-placeholders.mjs';
import { restoreFormulaPlaceholders } from '../../src/features/translation/formula-placeholders.mjs';

test('translated BabelDOC style tags are detected and stripped', () => {
  const text = '<样式 id=\'1\'>谁</样式>: 将<style id="2">媒体干扰</ style>作为处理变量';
  assert.equal(hasRichTextPlaceholders(text), true);
  assert.equal(stripRichTextPlaceholders(text), '谁: 将媒体干扰作为处理变量');
});

test('ordinary angle-bracket prose is left alone', () => {
  for (const text of ['x < y and y > z', '<b>粗体</b>', 'a <= b </样式>'])
    assert.equal(stripRichTextPlaceholders(text), text);
});

test('cached translations lose leftover tags before formula restoration', () => {
  const block = restoreFormulaPlaceholders({
    text: 'Who: {v0}',
    sourceInput: 'Who: {v0}',
    formulaTexts: ['x'],
    translation: "<样式 id='1'>谁</样式>: {v0}",
  });
  assert.equal(block.translation, '谁: x');
});

test('only placeholder shapes upstream cannot parse mark a cached page stale', () => {
  for (const text of ["<样式 id='1'>谁</样式>", '<code id="2">x</code>', '见 {v*}', '见 {{v3}}'])
    assert.equal(hasUnparsedPlaceholders(text), true, text);
  for (const text of ["<style id='1'>谁</style>", '见 {v1}', '<code>x</code>', null])
    assert.equal(hasUnparsedPlaceholders(text), false, String(text));
});

test('formula tokens follow pdf2zh: doubled braces collapse and unknown IDs drop', () => {
  const block = restoreFormulaPlaceholders({
    text: 'Let {v0} hold',
    sourceInput: 'Let {v0} hold',
    formulaTexts: ['x'],
    translation: '令 {{v0}} 成立 {v 7}',
  });
  assert.equal(block.translation, '令 x 成立 ');
});

test('a wildcard formula token resolves only when the source has one formula', () => {
  const single = restoreFormulaPlaceholders({
    text: 'Let x hold',
    sourceInput: 'Let {v0} hold',
    formulaTexts: ['x'],
    translation: '令 {v*} 成立',
  });
  assert.equal(single.translation, '令 x 成立');
  const multiple = restoreFormulaPlaceholders({
    text: 'Let x and y hold',
    sourceInput: 'Let {v0} and {v1} hold',
    formulaTexts: ['x', 'y'],
    translation: '令 {v*} 成立',
  });
  assert.equal(multiple.translation, 'Let x and y hold');
});
