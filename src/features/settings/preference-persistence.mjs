import { formatPercentValue } from '../../ui/inputs/scrub-input.mjs';
import { cloneGlossaries } from '../../../shared/translation/glossary.mjs';
import { uiLanguageChoice, t, setUILanguage } from '../../i18n/index.mjs';
import { cloneTranslationServices } from '../translation/translation-services.mjs';
import { nextTick } from 'vue';

export function createPreferencePersistence({ preferences, session, view, provider, feedback }) {
  function cloneKernelAdvancedOptions(value) {
    const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const clone = (entry) =>
      entry && typeof entry === 'object' && !Array.isArray(entry) ? { ...entry } : {};
    return {
      pdf_math_fast: clone(source.pdf_math_fast),
      pdf_math_precise: clone(source.pdf_math_precise),
    };
  }

  function currentKernelAdvancedOptions() {
    return (
      cloneKernelAdvancedOptions(preferences.kernelAdvancedOptions.value)[
        preferences.engine.value
      ] || {}
    );
  }

  function applySavedSettings(saved) {
    preferences.applyingSavedSettings = true;
    if (typeof saved.documentLanguageDetection === 'boolean')
      preferences.documentLanguageDetection.value = saved.documentLanguageDetection;
    if (typeof saved.jevApiToken === 'string') preferences.jevApiToken.value = saved.jevApiToken;
    for (const [key, target] of Object.entries({
      defaultPageCropEnabled: preferences.defaultPageCropEnabled,
      defaultPageCropX: preferences.defaultPageCropX,
      defaultPageCropY: preferences.defaultPageCropY,
      autoAlignDocumentWidth: preferences.autoAlignDocumentWidth,
    }))
      if (saved[key] !== undefined) target.value = saved[key];
    if (typeof saved.formulaOcrEnabled === 'boolean')
      preferences.formulaOcrEnabled.value = saved.formulaOcrEnabled;
    if (['default', 'liquid-glass'].includes(saved.interfaceStyle))
      preferences.interfaceStyle.value = saved.interfaceStyle;
    if (saved.engine) preferences.engine.value = saved.engine;
    if (['full', 'reading', 'reading-ahead'].includes(saved.translationMode))
      preferences.translationMode.value = saved.translationMode;
    if (saved.direction) view.direction.value = saved.direction;
    if (saved.columns !== undefined) view.columns.value = saved.columns;
    if (saved.fit) view.fitMode.value = saved.fit;
    if (saved.zoom !== undefined && saved.fit === 'manual') {
      view.zoom.value = saved.zoom;
      view.zoomEntry.value = formatPercentValue(view.zoom.value);
    }
    if (saved.reduceBackgroundFrameRate !== undefined)
      preferences.reduceBackgroundFrameRate.value = !!saved.reduceBackgroundFrameRate;
    if (saved.reduceResourceUsage !== undefined)
      preferences.reduceResourceUsage.value = !!saved.reduceResourceUsage;
    if (saved.emphasizeResearchFindings !== undefined)
      preferences.emphasizeResearchFindings.value = !!saved.emphasizeResearchFindings;
    if (saved.emphasizeOrdinals !== undefined)
      preferences.emphasizeOrdinals.value = !!saved.emphasizeOrdinals;
    if (saved.emphasizeKeyVerbs !== undefined)
      preferences.emphasizeKeyVerbs.value = !!saved.emphasizeKeyVerbs;
    if (saved.emphasizeLogicalConnectives !== undefined)
      preferences.emphasizeLogicalConnectives.value = !!saved.emphasizeLogicalConnectives;
    if (saved.emphasizeInformation !== undefined)
      preferences.emphasizeInformation.value = !!saved.emphasizeInformation;
    if (saved.emphasizeTopicSentences !== undefined)
      preferences.emphasizeTopicSentences.value = !!saved.emphasizeTopicSentences;
    if (saved.documentOpenMode) preferences.documentOpenMode.value = saved.documentOpenMode;
    if (saved.restoreDocuments !== undefined)
      preferences.restoreDocuments.value = saved.restoreDocuments;
    if (saved.reuseTranslations !== undefined)
      preferences.reuseTranslations.value = !!saved.reuseTranslations;
    if (saved.interactionMode) preferences.interactionMode.value = saved.interactionMode;
    if (saved.optimizeParagraphGaps !== undefined)
      preferences.optimizeParagraphGaps.value = !!saved.optimizeParagraphGaps;
    if (saved.language) preferences.language.value = saved.language;
    if (saved.glossaries !== undefined)
      preferences.glossaries.value = cloneGlossaries(saved.glossaries);
    if (saved.sourceLanguage) preferences.sourceLanguage.value = saved.sourceLanguage;
    if (saved.uiLanguage) setUILanguage(saved.uiLanguage);
    if (saved.showKernelToolbarShortcut !== undefined)
      preferences.showKernelToolbarShortcut.value = !!saved.showKernelToolbarShortcut;
    if (saved.autoHideHeader !== undefined)
      preferences.autoHideHeader.value = !!saved.autoHideHeader;
    if (saved.concurrency !== undefined) preferences.concurrency.value = saved.concurrency;
    if (saved.pageConcurrency !== undefined)
      preferences.pageConcurrency.value = saved.pageConcurrency;
    if (saved.automatic !== undefined) preferences.automatic.value = saved.automatic;
    if (saved.layoutVisible !== undefined) preferences.layoutVisible.value = saved.layoutVisible;
    if (saved.kernelAdvancedOptions !== undefined)
      preferences.kernelAdvancedOptions.value = cloneKernelAdvancedOptions(
        saved.kernelAdvancedOptions,
      );
    if (saved.translationServices !== undefined)
      preferences.translationServices.value = cloneTranslationServices(saved.translationServices);
    if (saved.translationServiceHistory !== undefined) {
      preferences.translationServiceHistory.value = provider.historyTracker.load(
        saved.translationServiceHistory,
      );
    }
    nextTick(() => {
      preferences.applyingSavedSettings = false;
    });
  }

  function saveView(force = false) {
    if (
      preferences.loadingPreferences ||
      preferences.applyingSavedSettings ||
      (session.restoringView.value && !force)
    )
      return;
    window.previewPreferences
      ?.save({
        ...(force ? { engine: preferences.engine.value } : {}),
        documentOpenMode: preferences.documentOpenMode.value,
        restoreDocuments: preferences.restoreDocuments.value,
        formulaOcrEnabled: preferences.formulaOcrEnabled.value,
        defaultPageCropEnabled: preferences.defaultPageCropEnabled.value,
        defaultPageCropX: preferences.defaultPageCropX.value,
        defaultPageCropY: preferences.defaultPageCropY.value,
        autoAlignDocumentWidth: preferences.autoAlignDocumentWidth.value,
        reduceBackgroundFrameRate: preferences.reduceBackgroundFrameRate.value,
        reduceResourceUsage: preferences.reduceResourceUsage.value,
        reuseTranslations: preferences.reuseTranslations.value,
        emphasizeTopicSentences: preferences.emphasizeTopicSentences.value,
        emphasizeInformation: preferences.emphasizeInformation.value,
        emphasizeResearchFindings: preferences.emphasizeResearchFindings.value,
        emphasizeOrdinals: preferences.emphasizeOrdinals.value,
        emphasizeKeyVerbs: preferences.emphasizeKeyVerbs.value,
        emphasizeLogicalConnectives: preferences.emphasizeLogicalConnectives.value,
        interactionMode: preferences.interactionMode.value,
        optimizeParagraphGaps: preferences.optimizeParagraphGaps.value,
        language: preferences.language.value,
        glossaries: cloneGlossaries(preferences.glossaries.value),
        sourceLanguage: preferences.sourceLanguage.value,
        uiLanguage: uiLanguageChoice.value,
        showKernelToolbarShortcut: preferences.showKernelToolbarShortcut.value,
        autoHideHeader: preferences.autoHideHeader.value,
        concurrency: preferences.concurrency.value,
        pageConcurrency: preferences.pageConcurrency.value,
        automatic: preferences.automatic.value,
        documentLanguageDetection: preferences.documentLanguageDetection.value,
        jevApiToken: preferences.jevApiToken.value,
        layoutVisible: preferences.layoutVisible.value,
        kernelAdvancedOptions: cloneKernelAdvancedOptions(preferences.kernelAdvancedOptions.value),
        translationServices: cloneTranslationServices(preferences.translationServices.value),
        interfaceStyle: preferences.interfaceStyle.value,
        appearance: preferences.appearanceChoice.value,
        accentColor: preferences.accentColor.value,
        reduceMotion: preferences.reduceMotion.value,
        reduceTransparency: preferences.reduceTransparency.value,
        reducePadding: preferences.reducePadding.value,
        fit: view.fitMode.value,
        zoom: view.zoom.value,
        translationMode: preferences.translationMode.value,
        direction: view.direction.value,
        columns: view.columns.value,
      })
      .catch(() => {
        feedback.error.value = t('error.requestFailed');
      });
  }
  return { cloneKernelAdvancedOptions, currentKernelAdvancedOptions, applySavedSettings, saveView };
}
