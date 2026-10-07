import { ref, shallowRef } from 'vue';
import { cloneGlossaries } from '../../../shared/translation/glossary.mjs';

export function createPreferenceState() {
  const language = ref(localStorage.getItem('language') || 'Simplified Chinese');
  const sourceLanguage = ref('English');
  const concurrency = ref(2);
  const pageConcurrency = ref(2);
  const automatic = ref(true);
  const layoutVisible = ref(false);
  const reuseTranslations = ref(localStorage.getItem('reuseTranslations') !== 'false');
  const interactionMode = ref('reading');
  const formulaOcrEnabled = ref(localStorage.getItem('formulaOcrEnabled') === 'true');
  const restoreDocuments = ref(true);
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
  const showKernelToolbarShortcut = ref(
    localStorage.getItem('showKernelToolbarShortcut') === 'true',
  );
  const autoHideHeader = ref(true);
  const translationMode = ref(
    localStorage.getItem('translationMode') === 'full' ? 'full' : 'reading',
  );
  const engine = ref(localStorage.getItem('engine') || 'pdf_inspector');
  const kernelAdvancedOptions = ref({ pdf_math_fast: {}, pdf_math_precise: {} });
  const translationServices = ref({});
  const translationServiceHistory = ref({});
  const glossaries = ref(loadGlossaries());
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
    layoutVisible,
    reuseTranslations,
    interactionMode,
    formulaOcrEnabled,
    restoreDocuments,
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
    showKernelToolbarShortcut,
    autoHideHeader,
    translationMode,
    engine,
    kernelAdvancedOptions,
    translationServices,
    translationServiceHistory,
    glossaries,
    appearanceChoice,
    accentColor,
    reduceMotion,
    reduceTransparency,
    reducePadding,
    loadingPreferences,
    applyingSavedSettings,
  };
}
