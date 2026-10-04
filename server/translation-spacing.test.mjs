import test from 'node:test';
import assert from 'node:assert/strict';
import {translationSpacing,kernelTranslationSpacing,paragraphDisplayText} from '../src/translation-spacing.mjs';

test('screenshot numeric references and percentage suffixes have both CJK boundaries',()=>{
 assert.equal(translationSpacing('压倒性的84%的受访者。如图4.5所示。增长１２％的人和3‰的比例。'), '压倒性的 84% 的受访者。如图 4.5 所示。增长 １２％ 的人和 3‰ 的比例。');
 assert.equal(translationSpacing('84% 的受访者'), '84% 的受访者');
});
test('kernel typesetting spaces plain and structured translations while preserving placeholders',()=>{
 assert.equal(kernelTranslationSpacing('如图4.5所示，84%的人使用{{v0}}。'), '如图 4.5 所示，84% 的人使用{{v0}}。');
 const input={中文Key:'图4.5中84%的人',formula:'{{v0}} x_2 = 3.14',count:84,items:['2010年',null]};
 assert.deepEqual(JSON.parse(kernelTranslationSpacing(JSON.stringify(input))), {...input,中文Key:'图 4.5 中 84% 的人',items:['2010 年',null]});
 assert.equal(kernelTranslationSpacing(undefined),undefined);
});

test('separates CJK from Latin letters and numbers in mixed translations',()=>{
 assert.equal(translationSpacing('使用VPN访问，在2010年成功率75%。'), '使用 VPN 访问，在 2010 年成功率 75%。');
 assert.equal(translationSpacing('中文English中文 日本語Latin 한국어ABC'), '中文 English 中文 日本語 Latin 한국어 ABC');
 assert.equal(translationSpacing('2015年对18岁以上覆盖24个省份的50个县，共3,513份，响应率63.6%。'), '2015 年对 18 岁以上覆盖 24 个省份的 50 个县，共 3,513 份，响应率 63.6%。');
 assert.equal(translationSpacing('２０１５年、１８歳、２４개'), '２０１５ 年、１８ 歳、２４ 개');
});
test('preserves punctuation, existing whitespace, formulas, and combining marks',()=>{
 const text='中文 VPN 中文\n（VPN）{{v0}} x_2 = 3.14，中文。';
 assert.equal(translationSpacing(text),text);
 assert.equal(translationSpacing('中文cafe\u0301中文'),'中文 cafe\u0301 中文');
 assert.equal(translationSpacing('中\u0301文A'),'中\u0301文 A');
 assert.equal(translationSpacing('中文ＡＢＣ中文'),'中文 ＡＢＣ 中文');
 assert.equal(translationSpacing('中文𠀀Latin'),'中文𠀀 Latin');
});
test('spacing cached or already spaced translations is idempotent',()=>{
 const text=translationSpacing('中文English2010年');
 assert.equal(translationSpacing(text),text);
 assert.equal(translationSpacing('English text 2010 75%'), 'English text 2010 75%');
 assert.equal(translationSpacing(), '');
});

test('Chinese paragraph display converts exactly two leading ASCII spaces only',()=>{
 assert.equal(paragraphDisplayText('  我发现，中文段落。\n  另一段。'), '\u3000\u3000我发现，中文段落。\n\u3000\u3000另一段。');
 assert.equal(paragraphDisplayText('  English paragraph.\n中文  正文\n   三个空格\n 一个空格'), '  English paragraph.\n中文  正文\n   三个空格\n 一个空格');
 assert.equal(paragraphDisplayText('\u3000\u3000中文'), '\u3000\u3000中文');
 assert.equal(kernelTranslationSpacing('  中文'), '  中文');
});
