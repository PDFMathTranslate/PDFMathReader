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
  watch(bindings.emphasizeInformation, (value) =>
    localStorage.setItem('emphasizeInformation', String(value)),
  );
  watch(bindings.emphasizeTopicSentences, (value) =>
    localStorage.setItem('emphasizeTopicSentences', String(value)),
  );
  watch(
    [
      bindings.documentOpenMode,
      bindings.restoreDocuments,
      bindings.preferences.formulaOcrEnabled,
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
      bindings.preferences.jevApiToken,
      bindings.layoutVisible,
      bindings.emphasizeTopicSentences,
      bindings.emphasizeInformation,
      bindings.emphasizeResearchFindings,
      bindings.emphasizeOrdinals,
      bindings.emphasizeKeyVerbs,
      bindings.emphasizeLogicalConnectives,
      bindings.autoHideHeader,
      bindings.optimizeParagraphGaps,
      bindings.showKernelToolbarShortcut,
      uiLanguageChoice,
    ],
    () => bindings.saveView(),
  );
  watch([bindings.kernelAdvancedOptions, bindings.translationServices], () => bindings.saveView(), {
    deep: true,
  });
  watch(
    () => JSON.stringify(bindings.currentTranslationService.value),
    () => {
      if (bindings.preferences.loadingPreferences || bindings.settingsWindowMode) return;
      bindings.resetTranslations();
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
