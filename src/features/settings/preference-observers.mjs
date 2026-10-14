import { watch } from 'vue';
import { uiLanguageChoice } from '../../i18n/index.mjs';

// Registered in setup order; Vue disposes these observers with their window.
export function installReaderPreferenceObservers({ bindings }) {
  watch(bindings.interactionMode, () => {
    bindings.hoveredParagraph.value = null;
    bindings.selectedParagraph.value = null;
    window.getSelection()?.removeAllRanges();
    if (bindings.interactionMode.value === 'reading') {
      for (const p of bindings.pages.value)
        for (const b of p.blocks) b.translated = bindings.showTranslations.value;
    }
    void bindings.renderPages();
  });
  watch(bindings.documentOpenMode, (value) => {
    localStorage.setItem('documentOpenMode', value);
    if (
      value === 'manual' &&
      !bindings.preferences.loadingPreferences &&
      !bindings.preferences.applyingSavedSettings &&
      !bindings.restoringView.value
    ) {
      bindings.translationDeferred.value = true;
      bindings.showTranslations.value = false;
      bindings.pruneTranslationQueue();
    }
  });
  for (const setting of bindings.informationCategorySettings)
    watch(setting.value, (value) => localStorage.setItem(setting.key, String(value)));
  watch(bindings.preferences.epubEnabled, (value) =>
    localStorage.setItem('epubEnabled', String(value)),
  );
  watch(bindings.emphasizeInformation, (value) =>
    localStorage.setItem('emphasizeInformation', String(value)),
  );
  watch(bindings.emphasizeTopicSentences, (value) =>
    localStorage.setItem('emphasizeTopicSentences', String(value)),
  );
  watch(bindings.preferences.bionicReading, (value) =>
    localStorage.setItem('bionicReading', value),
  );
  watch(bindings.preferences.bionicFixedLength, (value) =>
    localStorage.setItem('bionicFixedLength', String(value)),
  );
  watch(bindings.preferences.bionicOriginalOnly, (value) =>
    localStorage.setItem('bionicOriginalOnly', String(value)),
  );
  watch(
    [
      bindings.preferences.bionicReading,
      bindings.preferences.bionicFixedLength,
      bindings.preferences.bionicOriginalOnly,
    ],
    () => {
      // The render key makes old frames harmless; repaint mounted pages without
      // clearing the bounded bitmap cache or resetting reader geometry.
      void bindings.renderPages(false, true);
    },
  );
  watch(
    [
      bindings.documentOpenMode,
      bindings.restoreDocuments,
      bindings.preferences.windowMode,
      bindings.preferences.formulaOcrEnabled,
      bindings.preferences.epubEnabled,
      bindings.preferences.ultraFastSerif,
      bindings.preferences.ultraFastFont,
      bindings.defaultPageCropEnabled,
      bindings.defaultPageCropX,
      bindings.defaultPageCropY,
      bindings.autoAlignDocumentWidth,
      bindings.reuseTranslations,
      bindings.interactionMode,
      bindings.language,
      bindings.sourceLanguage,
      bindings.concurrency,
      bindings.pageConcurrency,
      bindings.automatic,
      bindings.preferences.documentLanguageDetection,
      bindings.preferences.topicSentenceDetection,
      bindings.preferences.tocGenerationEnabled,
      bindings.preferences.translationCompareEnabled,
      bindings.preferences.watermarkRemovalEnabled,
      bindings.preferences.recentMagicZoomEnabled,
      bindings.preferences.paragraphContinuationDetection,
      bindings.preferences.jevApiToken,
      bindings.preferences.remoteKernelEnabled,
      bindings.preferences.remoteKernelUrl,
      bindings.preferences.remoteKernelService,
      bindings.layoutVisible,
      bindings.emphasizeTopicSentences,
      bindings.emphasizeInformation,
      bindings.emphasizeResearchFindings,
      bindings.emphasizeOrdinals,
      bindings.emphasizeKeyVerbs,
      bindings.emphasizeLogicalConnectives,
      bindings.preferences.bionicReading,
      bindings.preferences.bionicFixedLength,
      bindings.preferences.bionicOriginalOnly,
      bindings.autoHideHeader,
      bindings.optimizeParagraphGaps,
      bindings.showKernelToolbarShortcut,
      uiLanguageChoice,
    ],
    () => bindings.saveView(),
  );
  watch(
    [
      bindings.kernelAdvancedOptions,
      bindings.translationServices,
      bindings.preferences.customTranslationServices,
    ],
    () => bindings.saveView(),
    { deep: true },
  );
  // The kernel and service follow the open document, which reopens with them.
  watch(
    () => {
      const engine = bindings.preferences.engine.value;
      return [engine, bindings.translationServices.value?.[engine]?.id];
    },
    (next, previous) => {
      if (bindings.settingsWindowMode || (next[0] === previous[0] && next[1] === previous[1]))
        return;
      bindings.rememberDocumentTranslation();
    },
  );
  watch(
    () => JSON.stringify(bindings.currentTranslationService.value),
    () => {
      if (bindings.preferences.loadingPreferences || bindings.settingsWindowMode) return;
      if (bindings.reuseTranslations.value) bindings.cancelTranslations();
      else bindings.resetTranslations();
      bindings.settle();
    },
  );
  watch([bindings.preferences.documentLanguageDetection, bindings.preferences.jevApiToken], () => {
    if (!bindings.preferences.loadingPreferences && !bindings.settingsWindowMode) {
      bindings.pruneTranslationQueue();
      bindings.settle();
    }
  });
  watch(bindings.showKernelToolbarShortcut, (value) =>
    localStorage.setItem('showKernelToolbarShortcut', String(value)),
  );
  watch(
    bindings.glossaries,
    () => {
      if (bindings.preferences.loadingPreferences) return;
      localStorage.setItem('glossaries', JSON.stringify(bindings.glossaries.value));
      bindings.saveView();
    },
    { deep: true },
  );
  watch(
    () => JSON.stringify(bindings.activeGlossary.value),
    () => {
      if (bindings.preferences.loadingPreferences || bindings.settingsWindowMode) return;
      bindings.resetTranslations();
      bindings.settle();
    },
  );
  watch([bindings.language, bindings.sourceLanguage, bindings.reuseTranslations], () => {
    if (bindings.preferences.loadingPreferences) return;
    localStorage.setItem('language', bindings.language.value);
    localStorage.setItem('reuseTranslations', String(bindings.reuseTranslations.value));
    bindings.resetTranslations();
    bindings.settle();
  });
}
