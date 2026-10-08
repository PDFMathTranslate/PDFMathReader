import {
  createParagraphCompaction,
  mapCompactY,
} from '../features/reader/paragraph-compaction.mjs';
import { installRenderDiagnostics } from '../features/reader/render-diagnostics.mjs';
import { installReaderViewObservers } from '../features/reader/view-observers.mjs';
import { installReaderPreferenceObservers } from '../features/settings/preference-observers.mjs';
import { installWindowLifecycle } from './window-lifecycle.mjs';
import { platform } from '../platform/runtime.mjs';

import { createDocumentSessionState } from '../features/reader/document-session-state.mjs';
import { createRenderState } from '../features/reader/render-state.mjs';
import { createMotionState } from '../features/reader/motion-state.mjs';
import { createTranslationQueueState } from '../features/translation/queue-state.mjs';
import { createPreferenceState } from '../features/settings/preference-state.mjs';
import { createReaderFeatures } from './reader-features.mjs';

import { menuLabel } from '../../shared/i18n/menu.mjs';
import { ref, shallowRef, computed, watch, nextTick, markRaw, provide } from 'vue';
import { useFormulaOcr } from '../features/reader/useFormulaOcr.mjs';

import {
  buildReaderLayout,
  buildThumbnailLayout,
  visibleThumbnailWindow,
} from '../features/reader/reader-layout.mjs';

import { createPerformanceRecorder } from '../features/developer/performance-recorder.mjs';

import { formatPercentValue } from '../ui/inputs/scrub-input.mjs';

import { uiLanguage, t } from '../i18n/index.mjs';
import { createKernelState } from '../features/settings/kernel-state.mjs';
import { createProviderState } from '../features/settings/provider-state.mjs';
import { createImmersiveHeader } from '../features/reader/immersive-header.mjs';
import { createPageEdits } from '../features/reader/page-edits.mjs';
import { createReaderDocumentSurface } from '../features/reader/document-surface.mjs';
import { createLazyPort, createWritablePort } from './reader-ports.mjs';

export function useReaderWindow() {
  const session = createDocumentSessionState();
  const { pages, title, loading, documentOpening, documentClosing, restoringView } = session;
  const renderState = createRenderState();
  const {
    renderWindow,
    layoutElement,
    thumbnailList,
    thumbnailTop,
    thumbnailHeight,
    thumbnailHighlight,
  } = renderState;
  const motion = createMotionState();
  const { pinching, navigatorVisible, sidebarWidth, sidebarLeaving, referenceReturn } = motion;
  const translationState = createTranslationQueueState();
  const { translationDeferred } = translationState;
  const preferences = createPreferenceState();
  const {
    language,
    sourceLanguage,
    concurrency,
    pageConcurrency,
    automatic,
    layoutVisible,
    reuseTranslations,
    interactionMode,
    optimizeParagraphGaps,
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
    interfaceStyle,
    appearanceChoice,
    accentColor,
    reduceMotion,
    reduceTransparency,
    reducePadding,
  } = preferences;

  const configured = ref(false);
  const kernelState = createKernelState({ pages, engine });
  const providerState = createProviderState({ preferences, engine, configured });

  const featurePorts = {
    shell: createLazyPort({
      documentOutline: () => documentOutline,
      selectedAnnotation: () => selectedAnnotation,
      showAnnotations: () => showAnnotations,
      sidebarMode: () => sidebarMode,
      selectedParagraph: () => selectedParagraph,
      workspace: () => workspace,
      fileInput: () => fileInput,
      testMode: () => testMode,
      settingsWindowMode: () => settingsWindowMode,
      platform: () => platform,
      settingsSection: () => settingsSection,
      settings: () => settings,
      languageInput: () => languageInput,
      languageMenuOpen: () => languageMenuOpen,
      kernelInput: () => kernelInput,
      windowsMenu: () => windowsMenu,
      desktopWindow: () => desktopWindow,
      immersiveHeaderHidden: () => immersiveHeaderHidden,
      translationModes: () => translationModes,
      pageInput: () => pageInput,
      zoomInput: () => zoomInput,
      navigator: () => navigator,
      quickLinks: () => quickLinks,
    }),
    view: createLazyPort({
      reader: () => reader,
      fitMode: () => fitMode,
      zoom: () => zoom,
      showTranslations: () => showTranslations,
      active: () => active,
      pageEntry: () => pageEntry,
      pageLayout: () => pageLayout,
      currentPage: () => currentPage,
      direction: () => direction,
      columns: () => columns,
      sidebar: () => sidebar,
      thumbnailLayout: () => thumbnailLayout,
      zoomEntry: () => zoomEntry,
      pageCrop: () => pageCrop,
    }),
    activity: createLazyPort({
      foreground: () => foreground,
      performanceRecorder: () => performanceRecorder,
      activityActive: () => activityActive,
    }),
    search: createLazyPort({
      searchOpen: () => searchOpen,
      searchQuery: () => searchQuery,
      searchHit: () => searchHit,
    }),
    kernel: createLazyPort({
      engineState: () => kernelState.engineState,
      engineBusy: () => kernelState.engineBusy,
      kernelOptions: () => kernelState.kernelOptions,
      kernelFailure: () => kernelState.kernelFailure,
      kernelIgnored: () => kernelState.kernelIgnored,
      kernelDocumentIgnored: () => kernelState.kernelDocumentIgnored,
      kernelIgnoreUsed: () => kernelState.kernelIgnoreUsed,
      offerDocumentIgnore: () => kernelState.offerDocumentIgnore,
      kernelErrorVisible: () => kernelState.kernelErrorVisible,
      uvState: () => kernelState.uvState,
      discoveredEngines: () => kernelState.discoveredEngines,
    }),
    feedback: createLazyPort({
      reading: () => reading,
      error: () => error,
      hoveredParagraph: () => hoveredParagraph,
    }),
    provider: createLazyPort({
      activeGlossary: () => providerState.activeGlossary,
      currentTranslationService: () => providerState.currentTranslationService,
      historyTracker: () => providerState.historyTracker,
      translationServiceCatalogRevision: () => providerState.translationServiceCatalogRevision,
      registeredMenuOptions: () => providerState.registeredMenuOptions,
    }),
    annotations: createLazyPort({
      annotations: () => annotations,
      annotationKey: () => annotationKey,
      annotationNativeRefs: () => annotationNativeRefs,
    }),
    library: createLazyPort({
      recentDocuments: () => recentDocuments,
    }),
    runtime: createWritablePort({
      kernelFocusPending: [() => kernelFocusPending, (value) => (kernelFocusPending = value)],
      kernelIgnoreTimer: [
        () => kernelState.kernelIgnoreTimer,
        (value) => (kernelState.kernelIgnoreTimer = value),
      ],
      appearanceTarget: [() => appearanceTarget, (value) => (appearanceTarget = value)],
      appearanceTransition: [() => appearanceTransition, (value) => (appearanceTransition = value)],
      resourceReleaseTimer: [() => resourceReleaseTimer, (value) => (resourceReleaseTimer = value)],
    }),
    appearance: createLazyPort({
      systemDark: () => systemDark,
      systemAccentColor: () => systemAccentColor,
    }),
    credentials: createLazyPort({
      configured: () => configured,
      keySource: () => keySource,
      keyStorageAvailable: () => keyStorageAvailable,
      keyInvalid: () => keyInvalid,
      keyBusy: () => keyBusy,
      keyEntry: () => keyEntry,
      keyMessage: () => keyMessage,
      desktopCredentials: () => desktopCredentials,
    }),
    rootActions: createLazyPort({
      annotationNotice: () => annotationNotice,
      cancelLayoutMotion: () => cancelLayoutMotion,
      displayedPage: () => displayedPage,
      immersiveScroll: () => immersiveScroll,
      noteTranslationService: () => noteTranslationService,
      closeSearch: () => closeSearch,
      documentMotionReduced: () => documentMotionReduced,
      flushAnnotations: () => flushAnnotations,
      scheduleRecentPreviews: () => scheduleRecentPreviews,
      invalidateRecentPreviews: () => invalidateRecentPreviews,
      editDocumentPages: () => editDocumentPages,
      pagePreview: () => pagePreview,
      revealHeader: () => revealHeader,
      openSearch: () => openSearch,
      scheduleSearch: () => scheduleSearch,
      copyHoveredParagraph: () => copyHoveredParagraph,
      notifyCopy: () => notifyCopy,
      immersiveIntent: () => immersiveIntent,
      translationSnapshot: () => translationSnapshot,
      pageHidden: () => pageHidden,
      stopRecentPreviews: () => stopRecentPreviews,
    }),
  };

  const featureActions = createReaderFeatures({
    session,
    renderState,
    motion,
    translationState,
    preferences,
    ...featurePorts,
  });

  const settingsWindowMode = new URLSearchParams(location.search).get('settingsWindow') === '1';
  const settingsSection = ref(new URLSearchParams(location.search).get('section') || 'general'),
    legacySettings = ref(false);

  const sidebarMode = ref('thumbnails'),
    documentOutline = shallowRef([]),
    selectedAnnotation = ref(null);

  watch(sidebarMode, () => nextTick(() => featureActions.resizeFit()));

  function cancelLayoutMotion() {
    ++motion.layoutMotionGeneration;
    motion.layoutMotion?.cancel();
    motion.layoutMotion = null;
    reader.value?.classList.remove('layout-transitioning');
  }

  const documentMotionReduced = () =>
    reduceMotion.value || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const performanceRecorder = createPerformanceRecorder({
    fetchStats: () => featureActions.api('/api/performance'),
  });
  window.previewPerformanceReport = () => performanceRecorder.snapshot();

  function translationSnapshot() {
    let completedPages = 0,
      partialPages = 0,
      failedPages = 0;
    for (const page of pages.value) {
      if (page.status === 'error' || page.blocks.some((block) => block.status === 'error'))
        failedPages++;
      else if (
        page.mathDocument ||
        (page.blocks.length && page.blocks.every((block) => !!block.translation))
      )
        completedPages++;
      else if (page.blocks.some((block) => !!block.translation)) partialPages++;
    }
    return {
      totalPages: pages.value.length,
      completedPages,
      partialPages,
      failedPages,
      engine: engine.value,
      language: language.value,
      updatedAt: Date.now(),
    };
  }

  const fileInput = ref(),
    reader = ref(),
    active = ref(1),
    zoom = ref(1),
    sidebar = ref(true),
    settings = ref(false),
    error = ref(''),
    model = ref(''),
    reading = ref(t('reading.ready')),
    showTranslations = ref(true);
  const fullscreen = ref(false),
    maximized = ref(false);

  watch(fullscreen, () => {
    featureActions.dismissPopovers();
    nextTick(() => featureActions.resizeFit(true));
  });
  const testMode = window.previewTestMode === true;
  const pageHidden = () => document.hidden && !window.previewRenderInBackground;

  let resourceReleaseTimer;
  const activityActive = ref(true),
    foreground = ref(!pageHidden());

  const documentSurface = createReaderDocumentSurface({
    session,
    renderState,
    motion,
    pages,
    loading,
    restoringView,
    reader,
    settings,
    zoom,
    showTranslations,
    interactionMode,
    readingView: featureActions.readingView,
    renderPages: featureActions.renderPages,
    go: featureActions.go,
    viewportPages: featureActions.viewportPages,
    scheduleViewport: featureActions.scheduleViewport,
    scheduleReadingSave: featureActions.scheduleReadingSave,
    mapDisplayPage: (p) => displayedPage(p),
    importFile: featureActions.importFile,
    ensurePDF: featureActions.ensurePDF,
    active,
    documentOutline,
    title,
    foreground,
    error,
    pageHidden,
  });
  const {
    searchOpen,
    searchQuery,
    searchInput,
    searchResults,
    searchIndex,
    searchBusy,
    searchFailure,
    searchPages,
    searchPageCount,
    searchHit,
    displayedPage: searchedPage,
    openSearch,
    closeSearch,
    scheduleSearch,
    nextSearch,
    quickLinks,
    recentDocuments,
    recentStatusDocument,
    recentContextMenu,
    scheduleRecentPreviews,
    pagePreview,
    openRecent,
    clearRecent,
    invalidateRecentPreviews,
    stopRecentPreviews,
    showAnnotations,
    annotations,
    annotationKey,
    annotationNativeRefs,
    annotationToast,
    annotationNotice,
    saveAnnotations,
    flushAnnotations,
    readChapters,
    selectedParagraph,
    hoveredParagraph,
    copyToast,
    notifyCopy,
    noteTranslationService,
    copyHoveredParagraph,
  } = documentSurface;

  provide(
    'formulaOcr',
    useFormulaOcr({
      enabled: preferences.formulaOcrEnabled,
      request: featureActions.api,
      notify: notifyCopy,
      save: () => featureActions.saveView(),
    }),
  );

  const informationCategorySettings = [
    { key: 'emphasizeResearchFindings', value: emphasizeResearchFindings },
    { key: 'emphasizeOrdinals', value: emphasizeOrdinals },
    { key: 'emphasizeKeyVerbs', value: emphasizeKeyVerbs },
    { key: 'emphasizeLogicalConnectives', value: emphasizeLogicalConnectives },
  ];
  const informationCategories = computed(() => ({
    research: emphasizeResearchFindings.value,
    ordinals: emphasizeOrdinals.value,
    verbs: emphasizeKeyVerbs.value,
    logic: emphasizeLogicalConnectives.value,
  }));

  const windowsMenu = ref(),
    windowsMenuOpen = ref(false);
  const direction = ref('vertical'),
    columns = ref(1);
  const immersiveState = createImmersiveHeader({
    autoHideHeader,
    pages,
    loading,
    restoringView,
    motion,
    pinching,
    settings,
    searchOpen,
    windowsMenuOpen,
    selectedParagraph,
    direction,
    reader,
    resizeFit: featureActions.resizeFit,
  });
  const {
    immersiveHeaderHidden,
    revealHeader,
    immersiveIntent,
    immersiveScroll,
    immersivePointer,
  } = immersiveState;

  // Display-only, total fraction removed symmetrically from each axis.
  const pageCrop = ref({ x: 0, y: 0 });
  const compactParagraphPage = createParagraphCompaction({
    enabled: computed(
      () =>
        preferences.optimizeParagraphGaps.value &&
        direction.value === 'vertical' &&
        columns.value === 1 &&
        interactionMode.value === 'reading' &&
        showTranslations.value,
    ),
    pages,
    sourceDocument: () => session.pdf,
    getDocument: (options) => session.getDocument(options),
    changing: (page, result) => {
      const el = reader.value,
        number = active.value;
      const host = renderState.pageEls.get(number);
      if (!el || !host) return () => {};
      const top = el.getBoundingClientRect().top;
      const offset = top - host.getBoundingClientRect().top;
      const mapped =
        page.number === number
          ? mapCompactY(offset / zoom.value, result.cuts) * zoom.value
          : offset;
      return () => {
        const current = renderState.pageEls.get(number);
        if (current && reader.value === el)
          el.scrollTop += current.getBoundingClientRect().top + mapped - top;
      };
    },
    changed: (restore) =>
      nextTick(() => {
        restore?.();
        featureActions.renderPages(false, true);
      }),
  });
  function displayedPage(p) {
    return compactParagraphPage(searchedPage(p));
  }
  // Read geometry only: spreading a reactive page subscribes the full-document
  // layout to visibility, translation and annotation updates on every scroll.

  window.previewSaveReadingView = async () => {
    await flushAnnotations();
    await performanceRecorder.finish();
    await featureActions.saveReadingView();
  };

  const fitMode = ref(
    ['width', 'height', 'manual'].includes(localStorage.getItem('readerFit'))
      ? localStorage.getItem('readerFit')
      : 'width',
  );

  const {
    activeGlossary,
    languageOptions,
    sourceLanguageOptions,
    languageLabel,
    currentTranslationService,
    translationServiceId,
    nativeMenuServices,
    effectiveTranslationSummary,
    registeredMenuOptions,
    translationServiceCatalogRevision,
    historyTracker,
    serviceCredentialValues,
    translationServiceRequest,
    parallelLevels,
    parallelLabels,
    parallelPagesStep,
    parallelTranslationsStep,
  } = providerState;

  const languageMenuOpen = ref(false);
  const languageInput = ref(),
    kernelInput = ref(),
    navigator = ref(),
    pageInput = ref(),
    zoomInput = ref(),
    pageEntry = ref(1),
    zoomEntry = ref(formatPercentValue(zoom.value));

  const translationModes = [
    { id: 'full', labelKey: 'translation.full', descriptionKey: 'translation.fullDescription' },
    {
      id: 'reading',
      labelKey: 'translation.reading',
      descriptionKey: 'translation.readingDescription',
    },
    {
      id: 'reading-ahead',
      labelKey: 'translation.readingAhead',
      descriptionKey: 'translation.readingAheadDescription',
    },
  ];

  watch(translationMode, () => {
    localStorage.setItem('translationMode', translationMode.value);
    featureActions.saveView();
    featureActions.pruneTranslationQueue();
    featureActions.settle();
  });
  watch(active, featureActions.pruneTranslationQueue);
  const { kernelOptions } = kernelState;
  let kernelFocusPending = false;
  if (fitMode.value === 'manual') {
    zoom.value = Math.min(3, Math.max(0.25, Number(localStorage.getItem('readerZoom')) || 1));
    zoomEntry.value = formatPercentValue(zoom.value);
  }

  const workspace = ref();

  watch(
    [pageInput, zoomInput, () => pages.value.length, navigatorVisible],
    () => nextTick(featureActions.syncScrubInputs),
    { flush: 'post' },
  );
  let settingsDropdownObserver;

  watch(settings, async (visible) => {
    settingsDropdownObserver?.disconnect();
    await nextTick();
    if (!visible) return;
    featureActions.syncSettingsDropdownWidths();
    const panel = document.querySelector('.settings:not(.paragraph-detail)');
    if (panel) {
      settingsDropdownObserver = new MutationObserver(featureActions.syncSettingsDropdownWidths);
      settingsDropdownObserver.observe(panel, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }
  });

  const { pageEditing, editDocumentPages } = createPageEdits({
    session,
    pages,
    loading,
    title,
    active,
    readingView: featureActions.readingView,
    restoreReadingView: featureActions.restoreReadingView,
    renderPages: featureActions.renderPages,
    importFile: featureActions.importFile,
    flushAnnotations,
    saveReadingView: featureActions.saveReadingView,
    annotationKey,
    annotations,
    annotationNativeRefs,
    notifyCopy,
    error,
    uiLanguage,
    menuLabel,
  });

  watch([interactionMode, showTranslations], () => {
    if (!motion.referenceJumping) {
      motion.referenceNavigation++;
      referenceReturn.value = null;
    }
  });

  const keyEntry = ref(''),
    keyBusy = ref(false),
    keyMessage = ref(''),
    keySource = ref('none'),
    keyStorageAvailable = ref(false),
    keyInvalid = ref(false);
  const desktopCredentials = window.previewCredentials;
  const desktopServiceCredentials = window.previewServiceCredentials;
  const desktopWindow = window.previewWindow;
  // Windows drag regions handle native movement and double-click maximize.
  // Keep a DOM fallback for header events outside native hit testing.

  const contentGlass = window.previewAppearance?.contentGlass === true;
  const windowsGlass = window.previewAppearance?.windowsGlass === true;
  const {
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
  } = kernelState;
  kernelState.installObservers({
    settings,
    preferences,
    translationState,
    pageConcurrency,
    error,
    api: featureActions.api,
    reportKernelFailure: featureActions.reportKernelFailure,
    revealHeader,
    saveView: featureActions.saveView,
    resetTranslations: featureActions.resetTranslations,
    settle: featureActions.settle,
    checkEngine: featureActions.checkEngine,
    currentKernelAdvancedOptions: featureActions.currentKernelAdvancedOptions,
    currentTranslationService,
    pumpPages: featureActions.pumpPages,
  });
  providerState.installObservers({
    preferences,
    engineState,
    serviceProfileSnapshot: featureActions.serviceProfileSnapshot,
    resetServiceHistory: featureActions.resetServiceHistory,
  });

  const systemDark = ref(matchMedia('(prefers-color-scheme: dark)').matches),
    systemAccentColor = ref('#007aff');
  let appearanceTransition, appearanceTarget;

  watch(
    [
      interfaceStyle,
      appearanceChoice,
      accentColor,
      reduceMotion,
      reduceTransparency,
      reducePadding,
    ],
    () => {
      featureActions.renderAppearance();
      featureActions.saveView();
    },
  );

  const keyPlaceholder = computed(
    () =>
      keyMessage.value ||
      (keyInvalid.value
        ? t('key.invalidPlaceholder')
        : configured.value
          ? keySource.value === 'environment'
            ? t('key.environmentPlaceholder')
            : t('key.savedPlaceholder')
          : t('key.missingPlaceholder')),
  );
  watch(error, (message) => {
    if (
      /OpenAI rejected the configured API key|invalid.api.key|incorrect.api.key|authentication.*401/i.test(
        message,
      )
    )
      keyInvalid.value = true;
  });

  const currentPage = computed(() => pages.value[active.value - 1]);
  const currentPageStatus = computed(() => {
    const p = currentPage.value;
    if (!p) return t('pageStatus.openPDFToTranslate');
    if (p.status === 'queued') return t('pageStatus.queued');
    if (p.status === 'detecting')
      return engine.value === 'pdf_inspector'
        ? t('pageStatus.detectingLayout')
        : t('pageStatus.loadingTranslationPage');
    if (p.status === 'error') return p.message || t('pageStatus.translationFailed');
    if (p.mathDocument) return t('pageStatus.translatedPageReady');
    return p.message || t('pageStatus.readyToTranslate');
  });
  const progress = computed(() => {
    const all = pages.value.flatMap((p) => p.blocks);
    return {
      done: all.filter((b) => b.translation).length,
      total: all.length,
      pending: all.filter((b) => b.status === 'translating' || b.status === 'queued').length,
    };
  });
  const translationTaskProgress = computed(() => {
    let done = 0,
      pending = 0;
    for (const p of pages.value) {
      if (['queued', 'detecting'].includes(p.status)) pending++;
      if (p.mathDocument || p.status === 'error') done++;
      if (engine.value === 'pdf_inspector')
        for (const block of p.blocks) {
          if (['queued', 'translating'].includes(block.status)) pending++;
          else if (block.translation || block.status === 'error') done++;
        }
    }
    return {
      cacheOnly: !pages.value.some(
        (p) =>
          (p.translationActivity === 'translating' && p.status === 'detecting') ||
          p.blocks.some(
            (b) => b.status === 'translating' && b.translationActivity === 'translating',
          ),
      ),
      busy: pending > 0,
      percent: Math.round((done / Math.max(1, done + pending)) * 100),
    };
  });

  const pageLayout = computed(() =>
    markRaw(
      buildReaderLayout(
        pages.value.map(featureActions.croppedPage),
        zoom.value,
        direction.value,
        columns.value,
        reducePadding.value ? 0 : 24,
        reducePadding.value ? 0 : 2,
      ),
    ),
  );
  const thumbnailLayout = computed(() => markRaw(buildThumbnailLayout(pages.value)));
  const thumbnailItems = computed(() =>
    sidebar.value || sidebarLeaving.value
      ? visibleThumbnailWindow(thumbnailLayout.value, thumbnailTop.value, thumbnailHeight.value)
      : [],
  );
  const mountedPages = computed(() =>
    [...renderWindow.value]
      .sort((a, b) => a - b)
      .map((n) => pages.value[n - 1])
      .filter(Boolean)
      .map(displayedPage),
  );

  watch(
    [active, thumbnailItems, sidebar],
    async () => {
      await nextTick();
      const button = renderState.thumbEls.get(active.value)?.parentElement;
      thumbnailHighlight.value = button?.isConnected
        ? {
            transform: `translate(-50%, ${button.offsetTop}px)`,
            width: button.offsetWidth + 'px',
            height: button.offsetHeight + 'px',
          }
        : null;
    },
    { flush: 'post' },
  );

  watch(immersiveHeaderHidden, featureActions.updateThumbnailViewport, { flush: 'post' });

  watch(
    thumbnailItems,
    async (items) => {
      renderState.visibleThumbnails.clear();
      items.forEach((item) => renderState.visibleThumbnails.add(item.number));
      await nextTick();
      void featureActions.renderThumbnails();
    },
    { flush: 'post' },
  );

  installRenderDiagnostics({
    bindings: {
      session,
      pages,
      loading,
      renderState,
      renderWindow,
      motion,
      translationState,
      readingTranslationPages: featureActions.readingTranslationPages,
      readingView: featureActions.readingView,
      active,
      zoom,
      testMode,
      foreground,
      annotations,
      annotationKey,
      direction,
    },
  });

  // During scrolling, paint only visible pages cheaply; retain sharper cached frames.

  watch(pageLayout, () =>
    nextTick(() => {
      if (!motion.zoomTargetPending) featureActions.scheduleViewport();
    }),
  );

  function toggle(b) {
    if (b.math || b.translation) b.translated = !b.translated;
  }

  // Fit returned text inside the source box, retaining a scrollable minimum size.

  installReaderPreferenceObservers({
    bindings: {
      pages,
      restoringView,
      translationDeferred,
      preferences,
      language,
      sourceLanguage,
      concurrency,
      pageConcurrency,
      automatic,
      layoutVisible,
      reuseTranslations,
      interactionMode,
      restoreDocuments,
      documentOpenMode,
      defaultPageCropEnabled,
      defaultPageCropX,
      defaultPageCropY,
      autoAlignDocumentWidth,
      emphasizeInformation,
      emphasizeResearchFindings,
      emphasizeOrdinals,
      emphasizeKeyVerbs,
      emphasizeLogicalConnectives,
      emphasizeTopicSentences,
      showKernelToolbarShortcut,
      autoHideHeader,
      optimizeParagraphGaps,
      kernelAdvancedOptions,
      translationServices,
      glossaries,
      renderPages: featureActions.renderPages,
      settle: featureActions.settle,
      pruneTranslationQueue: featureActions.pruneTranslationQueue,
      resetTranslations: featureActions.resetTranslations,
      saveView: featureActions.saveView,
      settingsWindowMode,
      showTranslations,
      hoveredParagraph,
      selectedParagraph,
      informationCategorySettings,
      activeGlossary,
      currentTranslationService,
    },
  });

  installReaderViewObservers({
    bindings: {
      pages,
      title,
      restoringView,
      renderState,
      motion,
      pinching,
      translationDeferred,
      preferences,
      concurrency,
      automatic,
      reduceBackgroundFrameRate,
      reduceResourceUsage,
      engine,
      reducePadding,
      go: featureActions.go,
      applyFit: featureActions.applyFit,
      resizeFit: featureActions.resizeFit,
      reducedMotion: featureActions.reducedMotion,
      finishZoomAnimation: featureActions.finishZoomAnimation,
      applyRequestedZoom: featureActions.applyRequestedZoom,
      chooseFit: featureActions.chooseFit,
      renderPages: featureActions.renderPages,
      mountAroundPage: featureActions.mountAroundPage,
      observeThumbnails: featureActions.observeThumbnails,
      scrollThumbnailTo: featureActions.scrollThumbnailTo,
      settle: featureActions.settle,
      pump: featureActions.pump,
      saveView: featureActions.saveView,
      dismissPopovers: featureActions.dismissPopovers,
      nativeReaderInput: featureActions.nativeReaderInput,
      scheduleReadingSave: featureActions.scheduleReadingSave,
      visibility: featureActions.visibility,
      sidebarMode,
      cancelLayoutMotion,
      reader,
      active,
      zoom,
      sidebar,
      showTranslations,
      searchPages,
      direction,
      columns,
      fitMode,
      zoomInput,
      pageEntry,
      zoomEntry,
    },
  });

  installWindowLifecycle({
    bindings: {
      session,
      pages,
      renderState,
      motion,
      translationState,
      preferences,
      reduceResourceUsage,
      translationMode,
      engine,
      cancelResize: featureActions.cancelResize,
      resizeFit: featureActions.resizeFit,
      finishZoomAnimation: featureActions.finishZoomAnimation,
      pinchWheel: featureActions.pinchWheel,
      resetBitmaps: featureActions.resetBitmaps,
      settle: featureActions.settle,
      receiveDocuments: featureActions.receiveDocuments,
      cancel: featureActions.cancel,
      releaseDocument: featureActions.releaseDocument,
      applySavedSettings: featureActions.applySavedSettings,
      openSettings: featureActions.openSettings,
      checkEngine: featureActions.checkEngine,
      applyAppearance: featureActions.applyAppearance,
      applyConfig: featureActions.applyConfig,
      readerAction: featureActions.readerAction,
      keyboard: featureActions.keyboard,
      dismissPopovers: featureActions.dismissPopovers,
      outsidePopover: featureActions.outsidePopover,
      syncScrubInputs: featureActions.syncScrubInputs,
      saveReadingView: featureActions.saveReadingView,
      visibility: featureActions.visibility,
      resetServiceHistory: featureActions.resetServiceHistory,
      api: featureActions.api,
      settingsWindowMode,
      settingsSection,
      performanceRecorder,
      reader,
      zoom,
      error,
      model,
      closeSearch,
      fullscreen,
      maximized,
      testMode,
      pageHidden,
      activityActive,
      foreground,
      recentDocuments,
      scheduleRecentPreviews,
      invalidateRecentPreviews,
      stopRecentPreviews,
      direction,
      columns,
      fitMode,
      zoomEntry,
      serviceCredentialValues,
      desktopServiceCredentials,
    },
    lifecycle: {
      get resourceReleaseTimer() {
        return resourceReleaseTimer;
      },
      set resourceReleaseTimer(value) {
        resourceReleaseTimer = value;
      },
      get immersiveLightsTimer() {
        return immersiveState.immersiveLightsTimer;
      },
      set immersiveLightsTimer(value) {
        immersiveState.immersiveLightsTimer = value;
      },
      get settingsDropdownObserver() {
        return settingsDropdownObserver;
      },
      set settingsDropdownObserver(value) {
        settingsDropdownObserver = value;
      },
      get kernelIgnoreTimer() {
        return kernelState.kernelIgnoreTimer;
      },
      set kernelIgnoreTimer(value) {
        kernelState.kernelIgnoreTimer = value;
      },
    },
  });
  return {
    ...featureActions,
    accentColor,
    active,
    annotationNotice,
    annotationToast,
    annotations,
    interfaceStyle,
    appearanceChoice,
    autoAlignDocumentWidth,
    autoHideHeader,
    automatic,
    clearRecent,
    closeSearch,
    columns,
    concurrency,
    configured,
    contentGlass,
    copyToast,
    defaultPageCropEnabled,
    defaultPageCropX,
    defaultPageCropY,
    desktopCredentials,
    desktopWindow,
    direction,
    discoveredEngines,
    documentClosing,
    documentOpenMode,
    documentOpening,
    documentOutline,
    effectiveTranslationSummary,
    emphasizeInformation,
    emphasizeTopicSentences,
    engine,
    engineBusy,
    engineDiscoveryFailed,
    engineState,
    error,
    fileInput,
    fitMode,
    foreground,
    fullscreen,
    glossaries,
    hoveredParagraph,
    immersiveHeaderHidden,
    immersiveIntent,
    immersivePointer,
    informationCategories,
    informationCategorySettings,
    interactionMode,
    optimizeParagraphGaps,
    kernelAdvancedOptions,
    kernelErrorVisible,
    kernelFailure,
    kernelInput,
    kernelOptions,
    kernelStatus,
    kernelStatusLabel,
    keyBusy,
    keyEntry,
    keyInvalid,
    keyMessage,
    keyPlaceholder,
    language,
    languageInput,
    languageLabel,
    languageMenuOpen,
    languageOptions,
    layoutElement,
    layoutVisible,
    legacySettings,
    loading,
    maximized,
    motion,
    mountedPages,
    navigator,
    navigatorVisible,
    nextSearch,
    offerDocumentIgnore,
    openRecent,
    openSearch,
    pageConcurrency,
    pageCrop,
    pageEntry,
    pageInput,
    pageLayout,
    pages,
    parallelLabels,
    parallelLevels,
    parallelPagesStep,
    parallelTranslationsStep,
    pinching,
    platform,
    progress,
    readChapters,
    reader,
    reading,
    recentContextMenu,
    recentDocuments,
    recentStatusDocument,
    reduceBackgroundFrameRate,
    reduceMotion,
    reducePadding,
    reduceResourceUsage,
    reduceTransparency,
    referenceReturn,
    restoreDocuments,
    restoringView,
    reuseTranslations,
    revealHeader,
    saveAnnotations,
    searchBusy,
    searchFailure,
    searchHit,
    searchInput,
    searchOpen,
    searchPageCount,
    searchQuery,
    searchResults,
    selectedAnnotation,
    selectedParagraph,
    serviceCredentialValues,
    session,
    settings,
    settingsSection,
    settingsWindowMode,
    showAnnotations,
    showKernelToolbarShortcut,
    showTranslations,
    sidebar,
    sidebarLeaving,
    sidebarMode,
    sidebarWidth,
    sourceLanguage,
    sourceLanguageOptions,
    t,
    thumbnailHighlight,
    thumbnailItems,
    thumbnailLayout,
    thumbnailList,
    title,
    toggle,
    translationMode,
    translationModes,
    translationServiceCatalogRevision,
    translationServiceHistory,
    translationServiceId,
    translationServiceRequest,
    translationServices,
    translationTaskProgress,
    uvState,
    uvVersionLabel,
    windowsGlass,
    windowsMenu,
    windowsMenuOpen,
    workspace,
    zoom,
    zoomEntry,
    zoomInput,
  };
}
