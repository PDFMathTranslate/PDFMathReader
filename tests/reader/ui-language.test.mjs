import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  UI_LANGUAGE_OPTIONS,
  SUPPORTED_UI_LANGUAGES,
  resolveUILanguage,
  uiLanguageDirection,
} from '../../shared/i18n/ui-language.mjs';
import {
  UI_MESSAGES,
  setUILanguage,
  uiLanguage,
  uiLanguageChoice,
  t,
} from '../../src/i18n/index.mjs';
import { menuLabel } from '../../shared/i18n/menu.mjs';
import { createReaderPreferences } from '../../electron/main/services/preferences.mjs';
const added = ['ar', 'hi', 'bn', 'ru', 'pt', 'ur', 'de', 'arz', 'pcm'];
function leaves(value, prefix = '') {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof child === 'string' ? [[path, child]] : leaves(child, path);
  });
}
const placeholders = (value) => (value.match(/\{[A-Za-z0-9_]+\}/g) || []).sort();
test('language choices use English language name order and default to English', () => {
  assert.equal(uiLanguageChoice.value, 'en');
  assert.equal(resolveUILanguage(), 'en');
  assert.equal(new Set(SUPPORTED_UI_LANGUAGES).size, 16);
  const names = UI_LANGUAGE_OPTIONS.map(({ englishName }) => englishName);
  assert.deepEqual(
    names,
    [...names].sort((a, b) => a.localeCompare(b, 'en')),
  );
  assert.deepEqual(SUPPORTED_UI_LANGUAGES, [
    'ar',
    'bn',
    'zh-CN',
    'zh-TW',
    'arz',
    'en',
    'fr',
    'de',
    'hi',
    'ja',
    'ko',
    'pcm',
    'pt',
    'ru',
    'es',
    'ur',
  ]);
  assert.equal(resolveUILanguage('system', 'ar_EG'), 'arz');
  assert.equal(resolveUILanguage('system', 'pt-BR'), 'pt');
  assert.equal(resolveUILanguage('system', 'zh-Hant-HK'), 'zh-TW');
});
test('new locales cover UI keys, preserve placeholders, and localize menus', () => {
  for (const locale of added) {
    const localized = new Map(leaves(UI_MESSAGES[locale]));
    for (const [key, english] of leaves(UI_MESSAGES.en)) {
      assert.equal(typeof localized.get(key), 'string', `${locale}: ${key}`);
      assert.deepEqual(
        placeholders(localized.get(key)),
        placeholders(english),
        `${locale}: ${key}`,
      );
    }
    setUILanguage(locale);
    assert.equal(uiLanguage.value, locale);
    if (locale !== 'pcm') {
      assert.notEqual(t('settings.title'), 'Settings');
      assert.notEqual(menuLabel('File', locale), 'File');
    }
    assert.notEqual(
      menuLabel('Continue Reading in Another App', locale),
      'Continue Reading in Another App',
    );
    assert.equal(uiLanguageDirection(locale), ['ar', 'arz', 'ur'].includes(locale) ? 'rtl' : 'ltr');
  }
  setUILanguage('en');
});
test('every new locale persists through a fresh preference store', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'ui-locales-'));
  try {
    const path = join(directory, 'preferences.json');
    const store = await createReaderPreferences(path);
    assert.equal(store.load().uiLanguage, 'en');
    for (const locale of added) {
      await store.save({ uiLanguage: locale });
      assert.equal((await createReaderPreferences(path)).load().uiLanguage, locale);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('switching RTL and LTR updates document metadata and keeps interpolation', () => {
  const previousDocument = globalThis.document;
  globalThis.document = { documentElement: {} };
  try {
    for (const locale of ['ar', 'arz', 'ur', 'en']) {
      setUILanguage(locale);
      assert.equal(globalThis.document.documentElement.lang, locale);
      assert.equal(globalThis.document.documentElement.dir, uiLanguageDirection(locale));
      assert.ok(t('toolbar.pageOf', { current: 2, total: 9 }).includes('2'));
      assert.ok(t('toolbar.pageOf', { current: 2, total: 9 }).includes('9'));
    }
    assert.equal(setUILanguage('unsupported'), 'en');
  } finally {
    globalThis.document = previousDocument;
    setUILanguage('en');
  }
});
