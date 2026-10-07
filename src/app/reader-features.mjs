import { createLazyPort } from './reader-ports.mjs';
import { createReferenceNavigation } from '../features/reader/reference-navigation.mjs';
import { createSidebarInteraction } from '../features/reader/sidebar-interaction.mjs';
import { createPageNavigation } from '../features/reader/page-navigation.mjs';
import { createReaderFit } from '../features/reader/reader-fit.mjs';
import { createReaderZoom } from '../features/reader/reader-zoom.mjs';
import { createReaderPinch } from '../features/reader/reader-pinch.mjs';
import { createCanvasRendering } from '../features/reader/canvas-rendering.mjs';
import { createReaderViewport } from '../features/reader/reader-viewport.mjs';
import { createThumbnails } from '../features/reader/reader-thumbnails.mjs';
import { createReaderPreview } from '../features/reader/reader-preview.mjs';
import { createReaderScroll } from '../features/reader/reader-scroll.mjs';
import { createTranslationScope } from '../features/translation/translation-scope.mjs';
import { createTranslationQueue } from '../features/translation/translation-queue.mjs';
import { createMathTranslation } from '../features/translation/math-translation.mjs';
import { createDocumentLifecycle } from '../features/reader/document-lifecycle.mjs';
import { createDocumentImport } from '../features/reader/document-import.mjs';
import { createPreferencePersistence } from '../features/settings/preference-persistence.mjs';
import { createSettingsNavigation } from '../features/settings/settings-navigation.mjs';
import { createKernelSettings } from '../features/settings/kernel-settings.mjs';
import { createAppearanceSettings } from '../features/settings/appearance.mjs';
import { createCredentialSettings } from '../features/settings/credentials.mjs';
import { createReaderCommands } from '../features/reader/reader-commands.mjs';
import { createReaderPopovers } from '../features/reader/reader-popovers.mjs';
import { createReaderInputs } from '../features/reader/reader-inputs.mjs';
import { createReadingPosition } from '../features/reader/reading-position.mjs';
import { createReaderActivity } from '../features/reader/reader-activity.mjs';
import { createReaderQuickLinks } from '../features/reader/reader-quick-links.mjs';
import { createTranslationHistory } from '../features/translation/service-history.mjs';
import { createNativeMenuOptions } from '../features/settings/menu-options.mjs';
import { createBackendRequests } from '../bridge/api.mjs';

// Each factory receives only its domain inputs. Deferred command getters preserve
// independent async pipelines while the composition root resolves their cycles.
export function createReaderFeatures({
  session,
  renderState,
  motion,
  translationState,
  preferences,
  shell,
  view,
  activity,
  search,
  kernel,
  feedback,
  provider,
  annotations,
  library,
  runtime,
  appearance,
  credentials,
  rootActions,
}) {
  const referenceNavigation = createReferenceNavigation({
    session,
    motion,
    renderState,
    preferences,
    actions: createLazyPort({
      readingPosition: () => readingPosition,
      pageNavigation: () => pageNavigation,
      readerViewport: () => readerViewport,
      rootActions: () => rootActions,
    }),
    shell,
    view,
  });
  const sidebarInteraction = createSidebarInteraction({
    motion,
    actions: createLazyPort({ thumbnails: () => thumbnails }),
    shell,
    view,
  });
  const pageNavigation = createPageNavigation({
    motion,
    session,
    translationState,
    renderState,
    actions: createLazyPort({
      readerViewport: () => readerViewport,
      readerScroll: () => readerScroll,
      readerFit: () => readerFit,
      readerZoom: () => readerZoom,
    }),
    view,
  });
  const readerFit = createReaderFit({
    renderState,
    preferences,
    session,
    motion,
    actions: createLazyPort({
      readingPosition: () => readingPosition,
      readerViewport: () => readerViewport,
      canvasRendering: () => canvasRendering,
      thumbnails: () => thumbnails,
    }),
    view,
    activity,
  });
  const readerZoom = createReaderZoom({
    renderState,
    preferences,
    motion,
    session,
    actions: createLazyPort({
      canvasRendering: () => canvasRendering,
      rootActions: () => rootActions,
      readerFit: () => readerFit,
      preferencePersistence: () => preferencePersistence,
    }),
    view,
  });
  const readerPinch = createReaderPinch({
    session,
    motion,
    renderState,
    actions: createLazyPort({
      readerPreview: () => readerPreview,
      readerPopovers: () => readerPopovers,
      canvasRendering: () => canvasRendering,
      preferencePersistence: () => preferencePersistence,
      readerScroll: () => readerScroll,
    }),
    view,
  });
  const canvasRendering = createCanvasRendering({
    renderState,
    session,
    motion,
    preferences,
    actions: createLazyPort({
      rootActions: () => rootActions,
      readerViewport: () => readerViewport,
      readerFit: () => readerFit,
    }),
    view,
    activity,
  });
  const readerViewport = createReaderViewport({
    renderState,
    session,
    motion,
    actions: createLazyPort({ canvasRendering: () => canvasRendering }),
    view,
    activity,
  });
  const thumbnails = createThumbnails({
    renderState,
    motion,
    session,
    actions: createLazyPort({
      canvasRendering: () => canvasRendering,
      readerScroll: () => readerScroll,
    }),
    shell,
    activity,
    view,
  });
  const readerPreview = createReaderPreview({
    renderState,
    motion,
    session,
    preferences,
    actions: createLazyPort({
      canvasRendering: () => canvasRendering,
      thumbnails: () => thumbnails,
      rootActions: () => rootActions,
    }),
    search,
    activity,
    view,
  });
  const readerScroll = createReaderScroll({
    renderState,
    session,
    motion,
    translationState,
    preferences,
    actions: createLazyPort({
      rootActions: () => rootActions,
      readerViewport: () => readerViewport,
      translationQueue: () => translationQueue,
      readingPosition: () => readingPosition,
      readerPreview: () => readerPreview,
      readerInputs: () => readerInputs,
    }),
    activity,
    kernel,
    feedback,
    view,
  });
  const translationScope = createTranslationScope({
    translationState,
    renderState,
    preferences,
    session,
    view,
  });
  const translationQueue = createTranslationQueue({
    session,
    preferences,
    translationState,
    actions: createLazyPort({
      translationScope: () => translationScope,
      kernelSettings: () => kernelSettings,
      mathTranslation: () => mathTranslation,
      backendRequests: () => backendRequests,
    }),
    activity,
    kernel,
    feedback,
    provider,
    view,
  });
  const mathTranslation = createMathTranslation({
    translationState,
    preferences,
    session,
    actions: createLazyPort({
      preferencePersistence: () => preferencePersistence,
      rootActions: () => rootActions,
      translationHistory: () => translationHistory,
      backendRequests: () => backendRequests,
      readerPreview: () => readerPreview,
      kernelSettings: () => kernelSettings,
      documentLifecycle: () => documentLifecycle,
      canvasRendering: () => canvasRendering,
    }),
    feedback,
    provider,
    search,
    shell,
  });
  const documentLifecycle = createDocumentLifecycle({
    session,
    motion,
    translationState,
    renderState,
    actions: createLazyPort({
      documentImport: () => documentImport,
      pageNavigation: () => pageNavigation,
      rootActions: () => rootActions,
      readerFit: () => readerFit,
      readerZoom: () => readerZoom,
      backendRequests: () => backendRequests,
      readingPosition: () => readingPosition,
      kernelSettings: () => kernelSettings,
      readerPopovers: () => readerPopovers,
      canvasRendering: () => canvasRendering,
    }),
    feedback,
    annotations,
    activity,
    library,
    view,
    shell,
  });
  const documentImport = createDocumentImport({
    session,
    motion,
    renderState,
    preferences,
    translationState,
    actions: createLazyPort({
      rootActions: () => rootActions,
      kernelSettings: () => kernelSettings,
      readingPosition: () => readingPosition,
      documentLifecycle: () => documentLifecycle,
      canvasRendering: () => canvasRendering,
      backendRequests: () => backendRequests,
      referenceNavigation: () => referenceNavigation,
      readerViewport: () => readerViewport,
      thumbnails: () => thumbnails,
      preferencePersistence: () => preferencePersistence,
      readerScroll: () => readerScroll,
    }),
    feedback,
    annotations,
    activity,
    library,
    shell,
    view,
  });
  const preferencePersistence = createPreferencePersistence({
    preferences,
    session,
    view,
    provider,
    feedback,
  });
  const settingsNavigation = createSettingsNavigation({ preferences, shell, runtime, kernel });
  const kernelSettings = createKernelSettings({
    preferences,
    session,
    actions: createLazyPort({
      rootActions: () => rootActions,
      readerScroll: () => readerScroll,
      backendRequests: () => backendRequests,
    }),
    kernel,
    feedback,
    provider,
    runtime,
    shell,
  });
  const appearanceSettings = createAppearanceSettings({ preferences, appearance, runtime });
  const credentialSettings = createCredentialSettings({
    preferences,
    actions: createLazyPort({
      translationHistory: () => translationHistory,
      documentLifecycle: () => documentLifecycle,
      readerScroll: () => readerScroll,
      mathTranslation: () => mathTranslation,
    }),
    credentials,
  });
  const readerCommands = createReaderCommands({
    session,
    translationState,
    preferences,
    motion,
    actions: createLazyPort({
      mathTranslation: () => mathTranslation,
      readerScroll: () => readerScroll,
      nativeMenuOptions: () => nativeMenuOptions,
      rootActions: () => rootActions,
      readingPosition: () => readingPosition,
      settingsNavigation: () => settingsNavigation,
      documentLifecycle: () => documentLifecycle,
      readerZoom: () => readerZoom,
      pageNavigation: () => pageNavigation,
      readerFit: () => readerFit,
      readerPopovers: () => readerPopovers,
      referenceNavigation: () => referenceNavigation,
    }),
    shell,
    view,
    search,
  });
  const readerPopovers = createReaderPopovers({
    session,
    actions: createLazyPort({ thumbnails: () => thumbnails }),
    shell,
    runtime,
    feedback,
    kernel,
  });
  const readerInputs = createReaderInputs({
    session,
    motion,
    actions: createLazyPort({
      readerZoom: () => readerZoom,
      preferencePersistence: () => preferencePersistence,
      pageNavigation: () => pageNavigation,
    }),
    shell,
    view,
  });
  const readingPosition = createReadingPosition({
    session,
    renderState,
    preferences,
    actions: createLazyPort({
      readerViewport: () => readerViewport,
      rootActions: () => rootActions,
      readerFit: () => readerFit,
    }),
    view,
    shell,
    feedback,
    annotations,
  });
  const readerActivity = createReaderActivity({
    session,
    preferences,
    translationState,
    renderState,
    actions: createLazyPort({
      readingPosition: () => readingPosition,
      rootActions: () => rootActions,
      readerFit: () => readerFit,
      canvasRendering: () => canvasRendering,
      readerViewport: () => readerViewport,
      thumbnails: () => thumbnails,
      readerScroll: () => readerScroll,
      translationQueue: () => translationQueue,
    }),
    activity,
    feedback,
    runtime,
  });
  const readerQuickLinks = createReaderQuickLinks({
    session,
    motion,
    renderState,
    actions: createLazyPort({
      readingPosition: () => readingPosition,
      rootActions: () => rootActions,
      referenceNavigation: () => referenceNavigation,
      pageNavigation: () => pageNavigation,
      readerViewport: () => readerViewport,
    }),
    shell,
    search,
    annotations,
    view,
  });
  const translationHistory = createTranslationHistory({ preferences, session, provider });
  const nativeMenuOptions = createNativeMenuOptions({ preferences, provider });
  const backendRequests = createBackendRequests({
    session,
    translationState,
    actions: createLazyPort({
      rootActions: () => rootActions,
      translationHistory: () => translationHistory,
    }),
    provider,
  });

  return {
    ...referenceNavigation,
    ...sidebarInteraction,
    ...pageNavigation,
    ...readerFit,
    ...readerZoom,
    ...readerPinch,
    ...canvasRendering,
    ...readerViewport,
    ...thumbnails,
    ...readerPreview,
    ...readerScroll,
    ...translationScope,
    ...translationQueue,
    ...mathTranslation,
    ...documentLifecycle,
    ...documentImport,
    ...preferencePersistence,
    ...settingsNavigation,
    ...kernelSettings,
    ...appearanceSettings,
    ...credentialSettings,
    ...readerCommands,
    ...readerPopovers,
    ...readerInputs,
    ...readingPosition,
    ...readerActivity,
    ...readerQuickLinks,
    ...translationHistory,
    ...nativeMenuOptions,
    ...backendRequests,
  };
}
