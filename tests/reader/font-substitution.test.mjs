import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extendPDFRuntime } from '../../scripts/pdf-bionic-runtime.mjs';
import {
  createFontSubstitution,
  fontSubstitutionOptions,
  pdfFontRole,
  substitutableText,
  substituteKind,
} from '../../src/features/reader/font-substitution.mjs';

test('PDF fonts are sorted into serif, sans-serif, monospace and kept faces', () => {
  const role = (name, extra = {}) => pdfFontRole({ name, ...extra });
  assert.equal(role('ABCDEF+CMR10'), 'serif');
  assert.equal(role('CMBX12'), 'serif');
  assert.equal(role('TimesNewRomanPSMT'), 'serif');
  assert.equal(role('NimbusRomNo9L-Regu'), 'serif');
  assert.equal(role('CMSS10'), 'sans');
  assert.equal(role('Arial-BoldMT'), 'sans');
  assert.equal(role('Helvetica'), 'sans');
  assert.equal(role('ABCDEF+SimSun'), 'serif');
  assert.equal(role('STKaiti'), 'serif');
  assert.equal(role('SimHei'), 'sans');
  assert.equal(role('DengXian-Regular'), 'sans');
  for (const name of ['CMTT10', 'Courier', 'Menlo-Regular', 'Inconsolata'])
    assert.equal(role(name), 'mono', name);
  assert.equal(role('Unknown', { fallbackName: 'monospace' }), 'mono');
  // Math and symbol faces keep the document's glyphs.
  for (const name of ['CMMI10', 'CMSY10', 'CMEX10', 'MSBM10', 'Symbol'])
    assert.equal(role(name), '', name);
  assert.equal(role('Unknown', { fallbackName: 'serif' }), 'serif');
  assert.equal(role('Unknown', { fallbackName: 'sans-serif' }), 'sans');
  assert.equal(role('CMR10', { isType3Font: true }), '');
  assert.equal(role('CMR10', { vertical: true }), '');
});

test('only text characters are drawn with a local face', () => {
  for (const text of ['a', 'Ä', 'é', '7', ',', '—', ' ', '文']) assert.ok(substitutableText(text));
  for (const text of ['∑', '+', '=', '𝑥', '\u0000', '', null]) assert.ok(!substitutableText(text));
});

test('CJK characters, their punctuation and full-width forms take the CJK face', () => {
  for (const text of ['文', '語', 'か', 'カ', 'ー', '한', 'ㄅ', '。', '、', '「', '（', 'Ａ'])
    assert.equal(substituteKind(text), 'cjk', text);
  for (const text of ['a', 'é', '7', ',', '“', 'Я'])
    assert.equal(substituteKind(text), 'text', text);
  for (const text of ['∑', '𝑥', '']) assert.equal(substituteKind(text), '', text);
});

test('render options map PDF fonts to the chosen families with their weight and style', () => {
  assert.equal(fontSubstitutionOptions({ serif: ' ', sans: '', cjk: { serif: ' ' } }), null);
  const options = fontSubstitutionOptions({ serif: 'Iowan Old Style', sans: '' });
  assert.equal(options.key, 'font:Iowan Old Style|||||');
  const { face, kind } = options.render.fontSubstitution;
  assert.equal(kind, substituteKind);
  assert.deepEqual(face({ name: 'CMBX10' }), {
    text: '"Iowan Old Style", serif',
    cjk: '',
    style: 'normal',
    weight: 'bold',
  });
  assert.deepEqual(face({ name: 'Times-Italic' }).style, 'italic');
  assert.deepEqual(face({ name: 'Georgia', black: true }).weight, '900');
  assert.equal(face({ name: 'Helvetica' }), null, 'an empty sans field keeps the PDF font');
  assert.equal(face({ name: 'CMMI10' }), null);
  assert.equal(face({ name: 'CMTT10' }), null, 'an empty mono field keeps the PDF font');
  const sans = fontSubstitutionOptions({ sans: 'Avenir Next' });
  assert.equal(
    sans.render.fontSubstitution.face({ name: 'Arial-ItalicMT' }).text,
    '"Avenir Next", sans-serif',
  );
  const mono = fontSubstitutionOptions({ mono: 'Menlo' });
  assert.equal(mono.key, 'font:||Menlo|||');
  assert.equal(mono.render.fontSubstitution.face({ name: 'Courier' }).text, '"Menlo", monospace');
  assert.equal(
    fontSubstitutionOptions({ serif: 'Evil"; x' }).render.fontSubstitution.face({ name: 'CMR10' })
      .text,
    '"Evil x", serif',
    'family names cannot break out of the CSS font shorthand',
  );
});

test('CJK families are chosen per style, independently of the Latin ones', () => {
  const options = fontSubstitutionOptions({
    serif: 'Iowan Old Style',
    cjk: { serif: 'Songti SC' },
  });
  assert.equal(options.key, 'font:Iowan Old Style|||Songti SC||');
  const { face } = options.render.fontSubstitution;
  assert.deepEqual(face({ name: 'ABCDEF+SimSun' }), {
    text: '"Iowan Old Style", serif',
    cjk: '"Songti SC", serif',
    style: 'normal',
    weight: 'normal',
  });
  const cjkOnly = fontSubstitutionOptions({ cjk: { sans: 'PingFang SC' } }).render.fontSubstitution;
  assert.deepEqual(cjkOnly.face({ name: 'SimHei' }).text, '', 'Latin glyphs keep the PDF font');
  assert.deepEqual(cjkOnly.face({ name: 'SimHei' }).cjk, '"PingFang SC", sans-serif');
  assert.equal(cjkOnly.face({ name: 'SimSun' }), null);
});

test('original and translated documents keep separate font sets', async () => {
  const { ref, nextTick } = await import('vue');
  const preferences = Object.fromEntries(
    ['original', 'translated', 'originalCjk', 'translatedCjk'].flatMap((prefix) =>
      ['Serif', 'Sans', 'Mono'].map((role) => [`${prefix}${role}Font`, ref('')]),
    ),
  );
  preferences.originalSerifFont.value = 'Iowan Old Style';
  preferences.translatedSansFont.value = 'Avenir Next';
  preferences.translatedMonoFont.value = 'Menlo';
  preferences.translatedCjkSansFont.value = 'PingFang SC';
  let toggles = 0;
  const fonts = createFontSubstitution({ preferences, onToggle: () => toggles++ });
  assert.equal(fonts.renderOptions().key, 'font:Iowan Old Style|||||');
  assert.equal(fonts.renderOptions(true).key, 'font:|Avenir Next|Menlo||PingFang SC|');
  assert.equal(fonts.renderOptions(true), fonts.renderOptions(true), 'options are reused');
  preferences.translatedMonoFont.value = '';
  preferences.originalCjkSerifFont.value = 'Songti SC';
  await nextTick();
  assert.equal(fonts.renderOptions(true).key, 'font:|Avenir Next|||PingFang SC|');
  assert.equal(fonts.renderOptions().key, 'font:Iowan Old Style|||Songti SC||');
  await new Promise((resolve) => setTimeout(resolve, 450));
  assert.equal(toggles, 1);
});

test('PDF runtime extension wires font substitution into setFont and showText', async () => {
  const source = extendPDFRuntime(await readFile('node_modules/pdfjs-dist/build/pdf.mjs', 'utf8'));
  assert.match(source, /fontSubstitution = null,/);
  assert.match(source, /this\.gfx\.fontSubstitution = this\.params\.fontSubstitution;/);
  assert.match(source, /this\.fontSubstitution\?\.face\(fontObj\)/);
  assert.match(source, /substituteFonts\[this\.fontSubstitution\.kind\(glyph\.unicode\)\]/);
  assert.match(source, /const character = substituted \? glyph\.unicode : glyph\.fontChar;/);
});
