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
  windowMode: 'window',
  formulaOcrEnabled: false,
  epubEnabled: true,
  ultraFastSerif: false,
  ultraFastFont: '',
  originalSansFont: '',
  originalSerifFont: '',
  originalMonoFont: '',
  translatedSansFont: '',
  translatedSerifFont: '',
  translatedMonoFont: '',
  originalCjkSansFont: '',
  originalCjkSerifFont: '',
  originalCjkMonoFont: '',
  translatedCjkSansFont: '',
  translatedCjkSerifFont: '',
  translatedCjkMonoFont: '',
  recentDocumentFonts: [],
  translationErrorDismissals: [],
  reduceResourceUsage: true,
  reduceBackgroundFrameRate: true,
  reuseTranslations: false,
  emphasizeTopicSentences: false,
  emphasizeInformation: false,
  emphasizeResearchFindings: true,
  emphasizeOrdinals: true,
  emphasizeKeyVerbs: true,
  emphasizeLogicalConnectives: true,
  bionicReading: 'off',
  bionicFixedLength: 3,
  bionicOriginalOnly: true,
  interfaceStyle: 'default',
  appearance: 'system',
  accentColor: 'system',
  appIcon: 'base',
  reduceMotion: false,
  reduceTransparency: false,
  reducePadding: false,
  language: 'Simplified Chinese',
  sourceLanguage: 'English',
  concurrency: 2,
  pageConcurrency: 2,
  automatic: true,
  documentLanguageDetection: false,
  topicSentenceDetection: false,
  tocGenerationEnabled: false,
  translationCompareEnabled: false,
  watermarkRemovalEnabled: false,
  recentMagicZoomEnabled: false,
  tfidfWeightingEnabled: false,
  forceSmoothScrolling: false,
  smoothScrollingMouseOnly: false,
  paragraphContinuationDetection: false,
  jevApiToken: '',
  remoteKernelEnabled: false,
  remoteKernelUrl: '',
  remoteKernelService: '',
  companionDiscoveryEnabled: false,
  layoutVisible: false,
  defaultPageCropEnabled: false,
  defaultPageCropX: 0,
  defaultPageCropY: 0,
  autoAlignDocumentWidth: false,
  kernelAdvancedOptions: {},
  customTranslationServices: [],
  showKernelToolbarShortcut: false,
  autoHideHeader: true,
  uiLanguage: 'en',
};

const withPreferences = (overrides = {}, unknown = {}) => ({
  ...DEFAULT_PREFERENCES,
  ...overrides,
  ...unknown,
});

test('original-only bionic reading defaults on for existing users and persists explicit opt-out', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'bionic-preferences-'));
  try {
    const path = join(dir, 'reader.json');
    await writeFile(path, JSON.stringify({ bionicReading: 'root' }));
    let preferences = await createReaderPreferences(path);
    assert.equal(preferences.load().bionicOriginalOnly, true);
    await preferences.save({ bionicOriginalOnly: false });
    preferences = await createReaderPreferences(path);
    assert.equal(preferences.load().bionicOriginalOnly, false);
    await preferences.save({ bionicReading: 'off' });
    assert.throws(
      () => preferences.save({ bionicReading: 'fixed', bionicOriginalOnly: 'true' }),
      /Invalid reader preferences/,
    );
    assert.equal(preferences.load().bionicOriginalOnly, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('partial saves keep every current setting and unknown key', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'partial-preferences-'));
  try {
    const path = join(dir, 'reader.json'),
      preferences = await createReaderPreferences(path);
    assert.equal(preferences.load().translationMode, 'reading-ahead');
    assert.equal(preferences.load().optimizeParagraphGaps, false);
    assert.equal(preferences.load().paragraphContinuationDetection, false);
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
        topicSentenceDetection: true,
        tocGenerationEnabled: true,
        translationCompareEnabled: true,
        watermarkRemovalEnabled: true,
        recentMagicZoomEnabled: true,
        tfidfWeightingEnabled: true,
        forceSmoothScrolling: true,
        smoothScrollingMouseOnly: true,
        paragraphContinuationDetection: true,
        jevApiToken: 'custom-test-token',
        remoteKernelEnabled: true,
        remoteKernelUrl: 'http://127.0.0.1:8890',
        remoteKernelService: 'siliconflowfree',
        layoutVisible: true,
        ultraFastSerif: true,
        ultraFastFont: 'Songti SC',
        originalSerifFont: 'Iowan Old Style',
        originalSansFont: 'Avenir Next',
        translatedMonoFont: 'Menlo',
        translatedCjkSerifFont: 'Songti SC',
        recentDocumentFonts: ['Menlo', 'Avenir Next'],
        customTranslationServices: [
          {
            id: 'custom-0a1b2c3d4e5f',
            name: 'Local LLM',
            base_url: 'http://127.0.0.1:1234/v1',
            model: 'qwen',
          },
        ],
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
    assert.throws(() => preferences.save({ topicSentenceDetection: 'true' }));
    assert.throws(() => preferences.save({ tocGenerationEnabled: 'true' }));
    assert.throws(() => preferences.save({ translationCompareEnabled: 'true' }));
    assert.throws(() => preferences.save({ watermarkRemovalEnabled: 'true' }));
    assert.throws(() => preferences.save({ recentMagicZoomEnabled: 'true' }));
    assert.throws(() => preferences.save({ tfidfWeightingEnabled: 'true' }));
    assert.throws(() => preferences.save({ forceSmoothScrolling: 'true' }));
    assert.throws(() => preferences.save({ paragraphContinuationDetection: 'true' }));
    assert.throws(() => preferences.save({ jevApiToken: 123 }));
    assert.throws(() => preferences.save({ remoteKernelEnabled: 'true' }));
    assert.throws(() => preferences.save({ remoteKernelUrl: 123 }));
    assert.throws(() => preferences.save({ remoteKernelService: 'x'.repeat(101) }));
    assert.throws(() => preferences.save({ optimizeParagraphGaps: 'true' }));
    assert.throws(() => preferences.save({ translationMode: 'invalid' }));
    assert.throws(() => preferences.save({ translationErrorDismissals: [null] }));
    assert.throws(() => preferences.save({ ultraFastSerif: 'true' }));
    assert.throws(() => preferences.save({ ultraFastFont: 'Evil"; color: red' }));
    assert.throws(() => preferences.save({ ultraFastFont: 'x'.repeat(101) }));
    assert.throws(() => preferences.save({ originalSerifFont: 'a"b' }));
    assert.throws(() => preferences.save({ originalCjkSansFont: 'a"b' }));
    assert.throws(() => preferences.save({ translatedSansFont: 'x'.repeat(101) }));
    assert.throws(() => preferences.save({ recentDocumentFonts: [''] }));
    assert.throws(() => preferences.save({ recentDocumentFonts: Array(9).fill('Menlo') }));
    assert.throws(() =>
      preferences.save({ customTranslationServices: [{ id: 'openai', name: 'x' }] }),
    );
    assert.throws(() =>
      preferences.save({
        customTranslationServices: [
          { id: 'custom-0a1b2c3d4e5f', name: 'A' },
          { id: 'custom-0a1b2c3d4e5f', name: 'B' },
        ],
      }),
    );
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
