import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  isCustomLanguageCode,
  isTranslationLanguageSupported,
  normalizeTranslationLanguage,
} from '../src/translation-languages.mjs';
import { createReaderPreferences } from '../electron/preferences.mjs';

const ENGINES = ['pdf_inspector', 'pdf_math_fast', 'pdf_math_precise'];
const CUSTOM_LANGUAGE_CODES = ['en', 'pt-BR', 'zh-Hant'];

test('reader preferences save and reload custom target and source language codes', async () => {
  const tooLong = `en-${Array.from({ length: 8 }, () => 'abcdefgh').join('-')}`;
  const invalidCodes = [' en', 'en ', 'en US', '', '--evil', '<script>', tooLong];

  for (const code of CUSTOM_LANGUAGE_CODES) {
    assert.equal(isCustomLanguageCode(code), true, `${code} should be accepted`);
    for (const engine of ENGINES) {
      assert.equal(isTranslationLanguageSupported(engine, code), true, `${engine} should support ${code}`);
      assert.equal(normalizeTranslationLanguage(engine, code, 'English'), code, `${engine} should preserve ${code}`);
      assert.equal(normalizeTranslationLanguage(engine, code, 'English', 'source'), code, `${engine} source should preserve ${code}`);
    }
  }
  for (const value of invalidCodes) {
    assert.equal(isCustomLanguageCode(value), false, `${JSON.stringify(value)} should be rejected`);
  }

  const directory = await mkdtemp(join(tmpdir(), 'translation-language-preferences-'));
  try {
    const path = join(directory, 'reader.json');
    const preferences = await createReaderPreferences(path);
    await preferences.save({ language: 'pt-BR', sourceLanguage: 'zh-Hant' });
    await preferences.flush();

    const saved = preferences.load();
    assert.equal(saved.language, 'pt-BR');
    assert.equal(saved.sourceLanguage, 'zh-Hant');
    for (const key of ['language', 'sourceLanguage']) {
      for (const value of invalidCodes) {
        assert.throws(() => preferences.save({ [key]: value }), /Invalid (?:source )?language preference/);
        assert.equal(preferences.load()[key], saved[key]);
      }
    }

    const reopened = await createReaderPreferences(path);
    assert.equal(reopened.load().language, 'pt-BR');
    assert.equal(reopened.load().sourceLanguage, 'zh-Hant');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
