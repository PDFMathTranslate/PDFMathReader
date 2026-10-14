import { ref, shallowRef } from 'vue';
import { cloneGlossaries } from '../../../shared/translation/glossary.mjs';

export function createPreferenceState() {
  const language = ref(localStorage.getItem('language') || 'Simplified Chinese');
  const sourceLanguage = ref('English');
  const concurrency = ref(2);
  const pageConcurrency = ref(2);
  const automatic = ref(true);
  const documentLanguageDetection = ref(false);
  const topicSentenceDetection = ref(false);
  const tocGenerationEnabled = ref(false);
  const translationCompareEnabled = ref(false);
  const watermarkRemovalEnabled = ref(false);
  const recentMagicZoomEnabled = ref(false);
  const tfidfWeightingEnabled = ref(false);
  const forceSmoothScrolling = ref(false);
  const paragraphContinuationDetection = ref(false);
  const jevApiToken = ref('');
  const remoteKernelEnabled = ref(false);
  const remoteKernelUrl = ref('');
  const remoteKernelService = ref('');
  const layoutVisible = ref(false);
  const reuseTranslations = ref(localStorage.getItem('reuseTranslations') === 'true');
  const interactionMode = ref('reading');
  const optimizeParagraphGaps = ref(false);
  const formulaOcrEnabled = ref(localStorage.getItem('formulaOcrEnabled') === 'true');
  const epubEnabled = ref(localStorage.getItem('epubEnabled') !== 'false');
  const ultraFastSerif = ref(false);
  const ultraFastFont = ref('');
  const restoreDocuments = ref(true);
  const windowMode = ref('window');
  const documentOpenMode = ref(localStorage.getItem('documentOpenMode') || 'translation');
  const defaultPageCropEnabled = ref(false);
  const defaultPageCropX = ref(0);
  const defaultPageCropY = ref(0);
  const autoAlignDocumentWidth = ref(false);
  const reduceBackgroundFrameRate = ref(true);
  const reduceResourceUsage = ref(true);
  const emphasizeInformation = ref(localStorage.getItem('emphasizeInformation') === 'true');
  const emphasizeResearchFindings = ref(
    localStorage.getItem('emphasizeResearchFindings') !== 'false',
  );
  const emphasizeOrdinals = ref(localStorage.getItem('emphasizeOrdinals') !== 'false');
  const emphasizeKeyVerbs = ref(localStorage.getItem('emphasizeKeyVerbs') !== 'false');
  const emphasizeLogicalConnectives = ref(
    localStorage.getItem('emphasizeLogicalConnectives') !== 'false',
  );
  const emphasizeTopicSentences = ref(localStorage.getItem('emphasizeTopicSentences') === 'true');
  const bionicReading = ref(localStorage.getItem('bionicReading') || 'off');
  const bionicFixedLength = ref(Number(localStorage.getItem('bionicFixedLength')) || 3);
  const bionicOriginalOnly = ref(localStorage.getItem('bionicOriginalOnly') !== 'false');
  const showKernelToolbarShortcut = ref(
    localStorage.getItem('showKernelToolbarShortcut') === 'true',
  );
  const autoHideHeader = ref(true);
  const translationMode = ref(
    ['full', 'reading', 'reading-ahead'].includes(localStorage.getItem('translationMode'))
      ? localStorage.getItem('translationMode')
      : 'reading-ahead',
  );
  const engine = ref(localStorage.getItem('engine') || 'pdf_inspector');
  const kernelAdvancedOptions = ref({ pdf_math_fast: {}, pdf_math_precise: {} });
  const translationServices = ref({});
  const customTranslationServices = ref([]);
  const translationServiceHistory = ref({});
  const glossaries = ref(loadGlossaries());
  const interfaceStyle = ref('default');
  const appearanceChoice = ref('system');
  const accentColor = ref('system');
  const reduceMotion = ref(false);
  const reduceTransparency = ref(false);
  const reducePadding = ref(false);
  const loadingPreferences = true;
  const applyingSavedSettings = false;
  function loadGlossaries() {
    try {
      return cloneGlossaries(JSON.parse(localStorage.getItem('glossaries') || '[]'));
    } catch {
      return [];
    }
  }
  return {
    language,
    sourceLanguage,
    concurrency,
    pageConcurrency,
    automatic,
    documentLanguageDetection,
    topicSentenceDetection,
    tocGenerationEnabled,
    translationCompareEnabled,
    watermarkRemovalEnabled,
    recentMagicZoomEnabled,
    tfidfWeightingEnabled,
    forceSmoothScrolling,
    paragraphContinuationDetection,
    jevApiToken,
    remoteKernelEnabled,
    remoteKernelUrl,
    remoteKernelService,
    layoutVisible,
    reuseTranslations,
    interactionMode,
    optimizeParagraphGaps,
    formulaOcrEnabled,
    epubEnabled,
    ultraFastSerif,
    ultraFastFont,
    restoreDocuments,
    windowMode,
    documentOpenMode,
    defaultPageCropEnabled,
    defaultPageCropX,
    defaultPageCropY,
    autoAlignDocumentWidth,
    reduceBackgroundFrameRate,
    reduceResourceUsage,
    emphasizeInformation,
    emphasizeResearchFindings,
    emphasizeOrdinals,
    emphasizeKeyVerbs,
    emphasizeLogicalConnectives,
    emphasizeTopicSentences,
    bionicReading,
    bionicFixedLength,
    bionicOriginalOnly,
    showKernelToolbarShortcut,
    autoHideHeader,
    translationMode,
    engine,
    kernelAdvancedOptions,
    translationServices,
    customTranslationServices,
    translationServiceHistory,
    glossaries,
    interfaceStyle,
    appearanceChoice,
    accentColor,
    reduceMotion,
    reduceTransparency,
    reducePadding,
    loadingPreferences,
    applyingSavedSettings,
  };
}
