import { UI_LANGUAGE_OPTIONS } from '../../../shared/i18n/ui-language.mjs';
import { computed, ref, watch, onBeforeUnmount } from 'vue';
import {
  isCustomLanguageCode,
  translationLanguagesForKernel,
  translationLanguageLabel,
  normalizeTranslationLanguage,
} from '../../../shared/translation/languages.mjs';
import { withSharedOpenAIKey } from '../../../shared/translation/provider-groups.mjs';
import { configuredMenuServices } from '../../../shared/commands/menu-options.mjs';
import { menuLabel } from '../../../shared/i18n/menu.mjs';
import { createTranslationServiceHistoryTracker } from '../../../shared/translation/provider-history.mjs';
import { glossaryEntries } from '../../../shared/translation/glossary.mjs';
import {
  isCustomServiceId,
  customSelectionValues,
  customServiceDescriptors,
  withCustomProfiles,
  withCustomCredentials,
} from '../../../shared/translation/custom-services.mjs';
import {
  loadTranslationServiceSchema,
  clearTranslationServiceSchemaCache,
} from '../translation/translation-services.mjs';
import { uiLanguage, uiLanguageChoice, t } from '../../i18n/index.mjs';

const parallelLevels = [1, 2, 4, 12];
const KERNELS = ['pdf_inspector', 'pdf_math_fast', 'pdf_math_precise'];

export function createProviderState({ preferences, engine, configured }) {
  const {
    language,
    sourceLanguage,
    glossaries,
    translationServices,
    customTranslationServices,
    translationServiceHistory,
  } = preferences;
  const serviceCredentialValues = ref({});
  const translationServiceRequest = ref({ engine: '', id: 'auto', values: {} });
  const translationServiceCatalogRevision = ref(0);
  const historyTracker = createTranslationServiceHistoryTracker();
  const activeGlossary = computed(() => glossaryEntries(glossaries.value));
  const languageOptions = computed(() => translationLanguagesForKernel(engine.value));
  const sourceLanguageOptions = computed(() =>
    translationLanguagesForKernel(engine.value, 'source'),
  );
  const menuLanguageOptions = (options, selected) =>
    isCustomLanguageCode(selected) && !options.includes(selected)
      ? [...options, selected]
      : options;

  function languageLabel(name) {
    const keys = [
      'simplifiedChinese',
      'traditionalChinese',
      'english',
      'japanese',
      'korean',
      'french',
      'german',
      'spanish',
    ];
    const names = [
      'Simplified Chinese',
      'Traditional Chinese',
      'English',
      'Japanese',
      'Korean',
      'French',
      'German',
      'Spanish',
    ];
    const index = names.indexOf(name);
    return index >= 0
      ? t('languages.' + keys[index])
      : translationLanguageLabel(name, uiLanguage.value);
  }

  // Resolves one kernel's service selection, with its saved profile and credentials.
  function translationServiceFor(kernel, requestedId) {
    const config = translationServices.value?.[kernel] || {};
    const id = typeof requestedId === 'string' ? requestedId : 'auto';
    // Custom services live once for the app; a deleted one falls back to automatic.
    if (isCustomServiceId(id)) {
      const values = customSelectionValues(
        id,
        customTranslationServices.value,
        serviceCredentialValues.value,
      );
      return values ? { id, values } : { id: 'auto', values: {} };
    }
    const profile = { ...(config.values || {}), ...(config.profiles?.[id]?.values || {}) };
    const secrets = serviceCredentialValues.value?.[kernel]?.[id] || {};
    return { id, values: { ...profile, ...secrets } };
  }
  function selectedServiceId(kernel) {
    const config = translationServices.value?.[kernel] || {};
    const requestMatches = translationServiceRequest.value?.engine === kernel;
    return typeof config.id === 'string'
      ? config.id
      : requestMatches && typeof translationServiceRequest.value?.id === 'string'
        ? translationServiceRequest.value.id
        : 'auto';
  }
  // The configured services a kernel can use, given that kernel's native catalog.
  function serviceOptionsFor(kernel, nativeServices) {
    return configuredMenuServices(
      {
        services: [
          ...nativeServices,
          ...customServiceDescriptors(kernel, nativeServices, customTranslationServices.value),
        ],
      },
      withCustomProfiles(translationServices.value[kernel], customTranslationServices.value),
      withSharedOpenAIKey(
        nativeServices,
        withCustomCredentials(serviceCredentialValues.value, kernel)[kernel],
        configured.value,
      ),
    ).map((item) => ({
      ...item,
      label: item.value === 'auto' ? menuLabel('Automatic', uiLanguage.value) : item.label,
    }));
  }
  const currentTranslationService = computed(() => {
    return translationServiceFor(engine.value, selectedServiceId(engine.value));
  });
  const translationServiceId = computed(() => currentTranslationService.value.id);
  const nativeMenuServices = ref([]);
  const effectiveTranslationSummary = computed(() => {
    const id = translationServiceId.value;
    const keys = {
      auto: 'settings.translationServiceAuto',
      openai: 'settings.translationServiceOpenAI',
      'apple-local': 'settings.translationServiceAppleLocal',
    };
    const service = keys[id]
      ? t(keys[id])
      : customTranslationServices.value.find((item) => item.id === id)?.name ||
        nativeMenuServices.value.find((item) => item.id === id)?.label ||
        id;
    const kernel = t(
      {
        pdf_inspector: 'engine.ultraFast',
        pdf_math_fast: 'engine.fast',
        pdf_math_precise: 'engine.precise',
      }[engine.value] || engine.value,
    );
    return `${kernel} · ${service} · ${languageLabel(language.value)}`;
  });
  const registeredMenuOptions = computed(() => ({
    engine: {
      selected: engine.value,
      options: [
        ['pdf_inspector', 'ultraFast'],
        ['pdf_math_fast', 'fast'],
        ['pdf_math_precise', 'precise'],
      ].map(([value, key]) => ({ value, label: t('engine.' + key) })),
    },
    sourceLanguage: {
      selected: sourceLanguage.value,
      options: menuLanguageOptions(sourceLanguageOptions.value, sourceLanguage.value).map(
        (value) => ({ value, label: languageLabel(value) }),
      ),
    },
    language: {
      selected: language.value,
      options: menuLanguageOptions(languageOptions.value, language.value).map((value) => ({
        value,
        label: languageLabel(value),
      })),
    },
    provider: {
      selected: translationServiceId.value,
      options: serviceOptionsFor(engine.value, nativeMenuServices.value),
    },
    uiLanguage: {
      selected: uiLanguageChoice.value,
      options: [
        { value: 'system', label: t('appearance.systemLanguage') },
        ...UI_LANGUAGE_OPTIONS.map(({ value, label }) => ({ value, label })),
      ],
    },
  }));
  const parallelLabels = computed(() => [
    t('parallel.off'),
    ' ',
    t('parallel.medium'),
    t('parallel.more'),
  ]);
  const parallelPagesStep = computed({
    get: () => parallelLevels.indexOf(preferences.pageConcurrency.value),
    set: (index) => {
      preferences.pageConcurrency.value = parallelLevels[index];
    },
  });
  const parallelTranslationsStep = computed({
    get: () => parallelLevels.indexOf(preferences.concurrency.value),
    set: (index) => {
      preferences.concurrency.value = parallelLevels[index];
    },
  });

  return {
    serviceCredentialValues,
    translationServiceRequest,
    translationServiceCatalogRevision,
    historyTracker,
    activeGlossary,
    languageOptions,
    sourceLanguageOptions,
    languageLabel,
    currentTranslationService,
    translationServiceFor,
    selectedServiceId,
    serviceOptionsFor,
    translationServiceId,
    nativeMenuServices,
    effectiveTranslationSummary,
    registeredMenuOptions,
    parallelLevels,
    parallelLabels,
    parallelPagesStep,
    parallelTranslationsStep,
    translationServiceHistory,
    installObservers({ preferences, engineState, serviceProfileSnapshot, resetServiceHistory }) {
      const unsubscribeSubscription = window.previewChatGPTSubscription?.onChanged(() => {
        for (const kernel of KERNELS) resetServiceHistory(kernel, 'chatgpt-subscription');
        clearTranslationServiceSchemaCache();
        translationServiceCatalogRevision.value++;
      });
      onBeforeUnmount(() => unsubscribeSubscription?.());
      if (!window.previewPreferences)
        try {
          translationServiceHistory.value = historyTracker.load(
            JSON.parse(localStorage.getItem('translationServiceHistory') || '{}'),
          );
        } catch {}

      // Project app-wide custom services into every kernel so edits reset their history.
      const projectedProfiles = () => {
        let credentials = serviceCredentialValues.value;
        for (const kernel of KERNELS) credentials = withCustomCredentials(credentials, kernel);
        return serviceProfileSnapshot(
          Object.fromEntries(
            KERNELS.map((kernel) => [
              kernel,
              withCustomProfiles(
                translationServices.value?.[kernel] || {},
                customTranslationServices.value,
              ),
            ]),
          ),
          credentials,
        );
      };
      watch(
        customTranslationServices,
        (services) => {
          if (preferences.loadingPreferences || preferences.applyingSavedSettings) return;
          const ids = new Set(services.map((service) => service.id));
          const stale = KERNELS.filter((kernel) => {
            const id = translationServices.value?.[kernel]?.id;
            return isCustomServiceId(id) && !ids.has(id);
          });
          if (!stale.length) return;
          const next = { ...translationServices.value };
          for (const kernel of stale) next[kernel] = { ...next[kernel], id: 'auto', values: {} };
          translationServices.value = next;
        },
        { deep: true },
      );
      watch(projectedProfiles, (next, previous) => {
        if (preferences.loadingPreferences || !previous) return;
        for (const kernel of Object.keys(next))
          for (const service of new Set([
            ...Object.keys(next[kernel]),
            ...Object.keys(previous[kernel] || {}),
          ])) {
            if ((next[kernel][service] || '[{},{}]') !== (previous[kernel]?.[service] || '[{},{}]'))
              resetServiceHistory(kernel, service);
          }
      });

      let menuCatalogGeneration = 0;
      watch(
        [engine, () => engineState.value?.version, translationServiceCatalogRevision],
        async () => {
          const generation = ++menuCatalogGeneration;
          const id = engine.value;
          nativeMenuServices.value = [];
          try {
            const schema = await loadTranslationServiceSchema(id, engineState.value?.version || '');
            if (generation === menuCatalogGeneration) nativeMenuServices.value = schema.services;
          } catch {}
        },
        { immediate: true },
      );
      watch(
        registeredMenuOptions,
        (value) => {
          void window.previewWindow?.registerOptions?.(value).catch(() => {});
        },
        { immediate: true },
      );
      watch(
        [engine, language, sourceLanguage],
        () => {
          language.value = normalizeTranslationLanguage(
            engine.value,
            language.value,
            'Simplified Chinese',
          );
          sourceLanguage.value = normalizeTranslationLanguage(
            engine.value,
            sourceLanguage.value,
            'English',
            'source',
          );
        },
        { immediate: true, flush: 'sync' },
      );
    },
  };
}
