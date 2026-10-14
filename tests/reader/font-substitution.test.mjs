import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { extendPDFRuntime } from '../../scripts/pdf-bionic-runtime.mjs';
import {
  fontSubstitutionOptions,
  pdfFontRole,
  substitutableText,
} from '../../src/features/reader/font-substitution.mjs';

test('PDF fonts are sorted into serif, sans-serif and kept faces', () => {
  const role = (name, extra = {}) => pdfFontRole({ name, ...extra });
  assert.equal(role('ABCDEF+CMR10'), 'serif');
  assert.equal(role('CMBX12'), 'serif');
  assert.equal(role('TimesNewRomanPSMT'), 'serif');
  assert.equal(role('NimbusRomNo9L-Regu'), 'serif');
  assert.equal(role('CMSS10'), 'sans');
  assert.equal(role('Arial-BoldMT'), 'sans');
  assert.equal(role('Helvetica'), 'sans');
  // Math, symbol and monospaced faces keep the document's glyphs.
  for (const name of ['CMMI10', 'CMSY10', 'CMEX10', 'MSBM10', 'Symbol', 'CMTT10', 'Courier'])
    assert.equal(role(name), '', name);
  assert.equal(role('Unknown', { fallbackName: 'monospace' }), '');
  assert.equal(role('Unknown', { fallbackName: 'serif' }), 'serif');
  assert.equal(role('Unknown', { fallbackName: 'sans-serif' }), 'sans');
  assert.equal(role('CMR10', { isType3Font: true }), '');
  assert.equal(role('CMR10', { vertical: true }), '');
});

test('only text characters are drawn with a local face', () => {
  for (const text of ['a', 'Ä', 'é', '7', ',', '—', ' ', '文']) assert.ok(substitutableText(text));
  for (const text of ['∑', '+', '=', '𝑥', '\u0000', '', null]) assert.ok(!substitutableText(text));
});

test('render options map PDF fonts to the chosen families with their weight and style', () => {
  assert.equal(fontSubstitutionOptions({ serif: ' ', sans: '' }), null);
  const options = fontSubstitutionOptions({ serif: 'Iowan Old Style', sans: '' });
  assert.equal(options.key, 'font:Iowan Old Style|');
  const { face, accepts } = options.render.fontSubstitution;
  assert.equal(accepts, substitutableText);
  assert.deepEqual(face({ name: 'CMBX10' }), {
    family: '"Iowan Old Style", serif',
    style: 'normal',
    weight: 'bold',
  });
  assert.deepEqual(face({ name: 'Times-Italic' }), {
    family: '"Iowan Old Style", serif',
    style: 'italic',
    weight: 'normal',
  });
  assert.deepEqual(face({ name: 'Georgia', black: true }).weight, '900');
  assert.equal(face({ name: 'Helvetica' }), null, 'an empty sans field keeps the PDF font');
  assert.equal(face({ name: 'CMMI10' }), null);
  const sans = fontSubstitutionOptions({ serif: '', sans: 'Avenir Next' });
  assert.equal(
    sans.render.fontSubstitution.face({ name: 'Arial-ItalicMT' }).family,
    '"Avenir Next", sans-serif',
  );
  assert.equal(
    fontSubstitutionOptions({ serif: 'Evil"; x', sans: '' }).render.fontSubstitution.face({
      name: 'CMR10',
    }).family,
    '"Evil x", serif',
    'family names cannot break out of the CSS font shorthand',
  );
});

test('PDF runtime extension wires font substitution into setFont and showText', async () => {
  const source = extendPDFRuntime(await readFile('node_modules/pdfjs-dist/build/pdf.mjs', 'utf8'));
  assert.match(source, /fontSubstitution = null,/);
  assert.match(source, /this\.gfx\.fontSubstitution = this\.params\.fontSubstitution;/);
  assert.match(source, /this\.fontSubstitution\?\.face\(fontObj\)/);
  assert.match(source, /const character = substituted \? glyph\.unicode : glyph\.fontChar;/);
});
