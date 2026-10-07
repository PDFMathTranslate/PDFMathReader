import { computed, ref, watch } from 'vue';
import { t } from '../../i18n/index.mjs';

export function createKernelState({ pages, engine }) {
  const kernelOptions = [
    { id: 'pdf_inspector', labelKey: 'engine.ultraFast' },
    { id: 'pdf_math_fast', labelKey: 'engine.fast' },
    { id: 'pdf_math_precise', labelKey: 'engine.precise' },
  ];
  const engineState = ref(null);
  const uvState = ref(null);
  const engineBusy = ref(false);
  const kernelFailure = ref(null);
  const kernelIgnored = ref(false);
  const kernelIgnoreUsed = ref(false);
  const kernelDocumentIgnored = ref(false);
  let kernelIgnoreTimer;
  const offerDocumentIgnore = computed(() => kernelIgnoreUsed.value && pages.value.length > 0);
  const kernelErrorVisible = computed(
    () =>
      !!kernelFailure.value &&
      kernelFailure.value.id === engine.value &&
      !kernelIgnored.value &&
      !kernelDocumentIgnored.value,
  );
  const kernelStatus = computed(() =>
    engineBusy.value ||
    pages.value.some(
      (page) =>
        page.status === 'detecting' || page.blocks.some((block) => block.status === 'translating'),
    )
      ? 'busy'
      : engineState.value?.available
        ? 'ready'
        : engineState.value?.installed
          ? 'error'
          : 'missing',
  );
  const kernelStatusLabel = computed(
    () =>
      ({
        busy: t('engine.busy'),
        ready: t('engine.ready'),
        error: t('engine.error'),
        missing: t('engine.missing'),
      })[kernelStatus.value],
  );
  const uvVersionLabel = computed(() => {
    const version = uvState.value?.version;
    if (!version) return 'uv —';
    const match = version.match(/^(uv\s+\S+)\s+\(([0-9a-f]+)\b/i);
    return match ? `${match[1]} (${match[2].slice(-4)})` : version.split(' (')[0];
  });
  const discoveredEngines = ref([]);
  const engineDiscoveryFailed = ref(false);

  return {
    kernelOptions,
    engineState,
    uvState,
    engineBusy,
    kernelFailure,
    kernelIgnored,
    kernelIgnoreUsed,
    kernelDocumentIgnored,
    offerDocumentIgnore,
    kernelErrorVisible,
    kernelStatus,
    kernelStatusLabel,
    uvVersionLabel,
    discoveredEngines,
    engineDiscoveryFailed,
    get kernelIgnoreTimer() {
      return kernelIgnoreTimer;
    },
    set kernelIgnoreTimer(value) {
      kernelIgnoreTimer = value;
    },
    installObservers({
      settings,
      preferences,
      translationState,
      pageConcurrency,
      error,
      api,
      reportKernelFailure,
      revealHeader,
      saveView,
      resetTranslations,
      settle,
      checkEngine,
      currentKernelAdvancedOptions,
      currentTranslationService,
      pumpPages,
    }) {
      watch(engine, () => {
        kernelFailure.value = null;
        kernelIgnored.value = false;
        clearTimeout(kernelIgnoreTimer);
      });
      watch(kernelErrorVisible, (visible) => {
        if (visible) revealHeader();
      });
      watch(engineState, (state) => {
        if (state && !state.available)
          reportKernelFailure(state.reason || t('pageStatus.checkKernelAvailability'), state.id);
      });

      let engineDiscovery;
      watch(settings, (opened) => {
        if (!opened) return;
        engineDiscovery ??= api('/api/engines')
          .then((startup) => {
            engineDiscoveryFailed.value = false;
            discoveredEngines.value = startup.engines;
            uvState.value = startup.uv;
            const state = startup.engines.find((item) => item.id === engine.value);
            if (state && !engineBusy.value) engineState.value = state;
          })
          .catch((cause) => {
            engineDiscoveryFailed.value = true;
            error.value = cause.message;
          })
          .finally(() => {
            engineDiscovery = undefined;
          });
      });

      watch(engine, async () => {
        if (preferences.loadingPreferences) return;
        saveView(true);
        clearTimeout(translationState.timer);
        localStorage.setItem('engine', engine.value);
        resetTranslations();
        await checkEngine();
        if (engineState.value?.available) settle();
      });
      watch(
        () => [engine.value, JSON.stringify(currentKernelAdvancedOptions())],
        (next, previous) => {
          if (
            !previous ||
            next[0] !== previous[0] ||
            next[1] === previous[1] ||
            preferences.loadingPreferences ||
            !['pdf_math_fast', 'pdf_math_precise'].includes(next[0])
          )
            return;
          resetTranslations(true);
          settle();
        },
      );
      watch(
        () => JSON.stringify(currentTranslationService.value),
        (next, previous) => {
          if (!previous || next === previous || preferences.loadingPreferences) return;
          resetTranslations(true);
          settle();
        },
      );
      watch(pageConcurrency, pumpPages);
    },
  };
}
