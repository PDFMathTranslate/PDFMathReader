import test from 'node:test';
import assert from 'node:assert/strict';
import {translationSpacing,kernelTranslationSpacing,paragraphDisplayText} from '../src/translation-spacing.mjs';

test('Chinese paragraph display converts exactly two leading ASCII spaces only',()=>{
 assert.equal(paragraphDisplayText('  我发现，中文段落。\n  另一段。'), '\u3000\u3000我发现，中文段落。\n\u3000\u3000另一段。');
 assert.equal(paragraphDisplayText('  English paragraph.\n中文  正文\n   三个空格\n 一个空格'), '  English paragraph.\n中文  正文\n   三个空格\n 一个空格');
 assert.equal(paragraphDisplayText('\u3000\u3000中文'), '\u3000\u3000中文');
 assert.equal(kernelTranslationSpacing('  中文'), '  中文');
});
