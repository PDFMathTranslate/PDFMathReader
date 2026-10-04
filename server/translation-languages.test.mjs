import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  LANGUAGE_CODES,
  isTranslationLanguageSupported,
  normalizeTranslationLanguage,
  translationLanguageLabel,
  translationLanguagesForKernel,
} from '../src/translation-languages.mjs';
import { createReaderPreferences } from '../electron/preferences.mjs';

const ENGINES = ['pdf_inspector', 'pdf_math_fast', 'pdf_math_precise'];
const UI_LOCALES = ['en', 'zh-CN', 'zh-TW', 'fr', 'es', 'ja', 'ko'];
const ORIGINAL_FAST_LANGUAGES = [
  'Simplified Chinese',
  'Traditional Chinese',
  'English',
  'Japanese',
  'Korean',
  'French',
  'German',
  'Spanish',
];

test('engine language catalogs distinguish fast, precise, inspector, and source support', () => {
  const fast = translationLanguagesForKernel('pdf_math_fast');
  const precise = translationLanguagesForKernel('pdf_math_precise');
  const inspector = translationLanguagesForKernel('pdf_inspector');

  for (const name of [...ORIGINAL_FAST_LANGUAGES, 'Russian', 'Italian']) {
    assert.ok(fast.includes(name), `Fast should support ${name}`);
    assert.equal(isTranslationLanguageSupported('pdf_math_fast', name), true);
  }
  assert.equal(isTranslationLanguageSupported('pdf_math_fast', 'Portuguese'), false);

  for (const name of ['Portuguese', 'Brazilian Portuguese', 'Polish', 'Dutch']) {
    assert.ok(precise.includes(name), `Precise should support ${name}`);
    assert.equal(isTranslationLanguageSupported('pdf_math_precise', name), true);
  }
  for (const name of ['Arabic', 'Hebrew', 'Hindi', 'Persian']) {
    assert.equal(isTranslationLanguageSupported('pdf_math_precise', name), false);
    assert.ok(inspector.includes(name), `Inspector should support ${name}`);
    assert.equal(isTranslationLanguageSupported('pdf_inspector', name), true);
  }

  for (const engine of ENGINES) {
    const source = translationLanguagesForKernel(engine, 'source');
    const target = translationLanguagesForKernel(engine);
    assert.ok(source.length >= target.length, `${engine} source catalog should cover target catalog`);
    for (const name of Object.keys(LANGUAGE_CODES)) {
      assert.ok(source.includes(name), `${engine} source catalog should include ${name}`);
    }
  }
});

test('every catalog language has a non-empty translation code', () => {
  for (const engine of ENGINES) {
    for (const direction of ['target', 'source']) {
      for (const name of translationLanguagesForKernel(engine, direction)) {
        assert.equal(typeof LANGUAGE_CODES[name], 'string', `${name} should have a code`);
        assert.ok(LANGUAGE_CODES[name].length > 0, `${name} should have a non-empty code`);
      }
    }
  }
});

test('added language labels use Intl.DisplayNames for every supported UI locale', () => {
  const name = 'Portuguese';
  const code = LANGUAGE_CODES[name];

  for (const locale of UI_LOCALES) {
    const expected = new Intl.DisplayNames([locale], { type: 'language' }).of(code);
    assert.equal(translationLanguageLabel(name, locale), expected, `${name} label in ${locale}`);
  }
});

test('normalization preserves supported languages and falls back within the engine catalog', () => {
  assert.equal(normalizeTranslationLanguage('pdf_math_precise', 'Portuguese', 'English'), 'Portuguese');
  assert.equal(normalizeTranslationLanguage('pdf_math_fast', 'Italian', 'English'), 'Italian');
  assert.equal(normalizeTranslationLanguage('pdf_math_fast', 'Portuguese', 'Italian'), 'Italian');
  assert.equal(normalizeTranslationLanguage('pdf_math_precise', 'Arabic', 'English'), 'English');
  assert.equal(normalizeTranslationLanguage('pdf_inspector', 'Arabic', 'English'), 'Arabic');
  assert.equal(normalizeTranslationLanguage('pdf_math_fast', 'Portuguese', 'Portuguese', 'source'), 'Portuguese');
});

test('reader preferences save and reload a newly cataloged language', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'translation-language-preferences-'));
  try {
    const path = join(directory, 'reader.json');
    const preferences = await createReaderPreferences(path);
    await preferences.save({ language: 'Portuguese' });
    await preferences.flush();

    const reopened = await createReaderPreferences(path);
    assert.equal(reopened.load().language, 'Portuguese');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
