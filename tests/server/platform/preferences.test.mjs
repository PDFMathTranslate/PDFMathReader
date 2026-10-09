import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createReaderPreferences } from '../../../electron/main/services/preferences.mjs';

const DEFAULT_PREFERENCES = {
  engine: 'pdf_inspector',
  direction: 'vertical',
  columns: 1,
  fit: 'width',
  zoom: 1,
  translationMode: 'reading-ahead',
  autoCheckUpdates: true,
  cacheLimitMB: null,
  documentOpenMode: 'translation',
  interactionMode: 'reading',
  optimizeParagraphGaps: false,
  restoreDocuments: true,
  formulaOcrEnabled: false,
  translationErrorDismissals: [],
  reduceResourceUsage: true,
  reduceBackgroundFrameRate: true,
  reuseTranslations: true,
  emphasizeTopicSentences: false,
  emphasizeInformation: false,
  emphasizeResearchFindings: true,
  emphasizeOrdinals: true,
  emphasizeKeyVerbs: true,
  emphasizeLogicalConnectives: true,
  interfaceStyle: 'default',
  appearance: 'system',
  accentColor: 'system',
  reduceMotion: false,
  reduceTransparency: false,
  reducePadding: false,
  language: 'Simplified Chinese',
  sourceLanguage: 'English',
  concurrency: 2,
  pageConcurrency: 2,
  automatic: true,
  documentLanguageDetection: false,
  jevApiToken: '',
  layoutVisible: false,
  defaultPageCropEnabled: false,
  defaultPageCropX: 0,
  defaultPageCropY: 0,
  autoAlignDocumentWidth: false,
  kernelAdvancedOptions: {},
  showKernelToolbarShortcut: false,
  autoHideHeader: true,
  uiLanguage: 'system',
};

const withPreferences = (overrides = {}, unknown = {}) => ({
  ...DEFAULT_PREFERENCES,
  ...overrides,
  ...unknown,
});

test('partial saves keep every current setting and unknown key', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'partial-preferences-'));
  try {
    const path = join(dir, 'reader.json'),
      preferences = await createReaderPreferences(path);
    assert.equal(preferences.load().translationMode, 'reading-ahead');
    assert.equal(preferences.load().optimizeParagraphGaps, false);
    const initial = withPreferences(
      {
        engine: 'pdf_math_precise',
        direction: 'horizontal',
        columns: 4,
        fit: 'manual',
        zoom: 1.8,
        translationMode: 'full',
        documentOpenMode: 'manual',
        optimizeParagraphGaps: true,
        formulaOcrEnabled: true,
        translationErrorDismissals: ['translation-error-dismissed:document-a'],
        interfaceStyle: 'liquid-glass',
        appearance: 'dark',
        accentColor: '#a1B2c3',
        reduceMotion: true,
        reduceTransparency: true,
        language: 'Japanese',
        concurrency: 11,
        pageConcurrency: 8,
        automatic: false,
        documentLanguageDetection: true,
        jevApiToken: 'custom-test-token',
        layoutVisible: true,
      },
      { futureSetting: { revision: 3 } },
    );
    await preferences.save(initial);
    const beforeInvalid = preferences.load();
    assert.throws(() => preferences.save({ interfaceStyle: 'invalid' }));
    assert.throws(() => preferences.save({ language: 'Esperanto' }));
    assert.throws(() => preferences.save({ documentOpenMode: 'invalid' }));
    assert.throws(() => preferences.save({ formulaOcrEnabled: 'true' }));
    assert.throws(() => preferences.save({ documentLanguageDetection: 'true' }));
    assert.throws(() => preferences.save({ jevApiToken: 123 }));
    assert.throws(() => preferences.save({ optimizeParagraphGaps: 'true' }));
    assert.throws(() => preferences.save({ translationMode: 'invalid' }));
    assert.throws(() => preferences.save({ translationErrorDismissals: [null] }));
    assert.deepEqual(preferences.load(), beforeInvalid);
    assert.deepEqual((await createReaderPreferences(path)).load(), beforeInvalid);
    await preferences.save({ fit: 'width', zoom: 1 });
    assert.deepEqual(preferences.load(), { ...initial, fit: 'width', zoom: 1 });
    await preferences.save({ language: 'French', pageConcurrency: 3, translationMode: 'reading' });
    const expected = {
      ...initial,
      fit: 'width',
      zoom: 1,
      language: 'French',
      pageConcurrency: 3,
      translationMode: 'reading',
    };
    assert.deepEqual(preferences.load(), expected);
    await preferences.flush();
    assert.deepEqual((await createReaderPreferences(path)).load(), expected);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('missing translation mode upgrades to reading-ahead', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'missing-translation-mode-'));
  try {
    const path = join(dir, 'reader.json');
    await writeFile(path, JSON.stringify({ engine: 'pdf_inspector' }));
    const preferences = await createReaderPreferences(path);
    assert.equal(preferences.load().translationMode, 'reading-ahead');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
