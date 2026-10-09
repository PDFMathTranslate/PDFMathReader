<script setup>
import ReaderToolbar from './features/reader/ReaderToolbar.vue';
import DocumentSearchBar from './features/search/DocumentSearchBar.vue';
import ReaderWorkspace from './features/reader/ReaderWorkspace.vue';
import ReaderFloatingTools from './features/reader/ReaderFloatingTools.vue';
import ParagraphDetails from './features/translation/ParagraphDetails.vue';
import { computed, defineAsyncComponent } from 'vue';
const NativeSettingsPanel = defineAsyncComponent(
  () => import('./features/settings/NativeSettingsPanel.vue'),
);
const LegacySettingsPanel = defineAsyncComponent(
  () => import('./features/settings/LegacySettingsPanel.vue'),
);
import RecentTranslationStatus from './features/translation/RecentTranslationStatus.vue';
import { useReaderWindow } from './app/useReaderWindow.mjs';
const {
  accentColor,
  active,
  annotationNotice,
  annotationToast,
  annotations,
  api,
  interfaceStyle,
  appearanceChoice,
  autoAlignDocumentWidth,
  autoHideHeader,
  automatic,
  bindCanvas,
  bindPage,
  bindThumbnail,
  changeZoom,
  chooseKernel,
  clearRecent,
  closeSearch,
  closeSettingsWindow,
  columns,
  concurrency,
  configured,
  contentGlass,
  copyToast,
  createQuickReturn,
  defaultPageCropEnabled,
  defaultPageCropX,
  defaultPageCropY,
  desktopCredentials,
  desktopWindow,
  direction,
  discoveredEngines,
  dismissKernelFailureFromDocument,
  dismissPopovers,
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
  finishKernelSetup,
  fitMode,
  focusSidebarItem,
  followQuickLink,
  followReference,
  foreground,
  fullscreen,
  glossaries,
  go,
  headerDoubleClick,
  hideNavigatorLater,
  holdNavigator,
  hoveredParagraph,
  ignoreKernelFailure,
  immersiveHeaderHidden,
  immersiveIntent,
  immersivePointer,
  importFile,
  informationCategories,
  informationCategorySettings,
  installEngine,
  interactionMode,
  interruptPageScroll,
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
  mathSource,
  maximized,
  motion,
  mountedPages,
  nativeSource,
  navigateFromSidebar,
  navigator,
  navigatorVisible,
  nextSearch,
  observeThumbnails,
  offerDocumentIgnore,
  openRecent,
  openSearch,
  openSettings,
  optimizeParagraphGaps,
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
  popoverFocusOut,
  processPage,
  progress,
  quickLinkButtons,
  readChapters,
  reader,
  readerAction,
  reading,
  recentContextMenu,
  recentDocuments,
  recentStatusDocument,
  recoverKernel,
  reduceBackgroundFrameRate,
  reduceMotion,
  reducePadding,
  reduceResourceUsage,
  reduceTransparency,
  referenceReturn,
  resizeFit,
  resizeSidebarEnd,
  resizeSidebarKey,
  resizeSidebarMove,
  resizeSidebarStart,
  restoreDocuments,
  restoringView,
  returnFromReference,
  reuseTranslations,
  revealHeader,
  sample,
  saveAnnotations,
  scrolling,
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
  showScrollbar,
  showTranslations,
  sidebar,
  sidebarKeyboard,
  sidebarLeaving,
  sidebarMode,
  sidebarReady,
  sidebarWidth,
  sourceLanguage,
  sourceLanguageOptions,
  submitPage,
  submitZoom,
  t,
  thumbnailHighlight,
  thumbnailItems,
  thumbnailLayout,
  thumbnailList,
  thumbnailScrolling,
  title,
  toggle,
  toggleSidebar,
  toolbarHint,
  translationMode,
  translationModes,
  translationServiceCatalogRevision,
  translationServiceHistory,
  translationServiceId,
  translationServiceRequest,
  translationServices,
  translationTaskProgress,
  updateKey,
  uvState,
  uvVersionLabel,
  windowsGlass,
  windowsMenu,
  windowsMenuOpen,
  workspace,
  zoom,
  zoomEntry,
  zoomEntryInput,
  zoomInput,
} = useReaderWindow();
const copyToastHeading = computed(() => copyToast.value.split('\n')[0]);
const copyToastDetail = computed(() =>
  copyToast.value.includes('\n')
    ? copyToast.value.slice(copyToast.value.indexOf('\n') + 1).trim()
    : '',
);
</script>

<template>
  <RecentTranslationStatus
    v-if="recentStatusDocument"
    :document="recentStatusDocument"
    @close="recentStatusDocument = null"
  />
  <div
    class="app"
    :data-platform="platform"
    :class="{
      desktop: desktopCredentials,
      'native-settings-host': settingsWindowMode,
      'content-glass': contentGlass && !settingsWindowMode,
      'windows-glass': windowsGlass,
      'startup-page': !pages.length,
      'is-fullscreen': fullscreen,
      'background-paused': !foreground,
      'immersive-header-hidden': immersiveHeaderHidden,
      'horizontal-immersive': pages.length && direction === 'horizontal' && autoHideHeader,
      'vertical-immersive': pages.length && direction === 'vertical' && autoHideHeader,
      'reading-interaction': interactionMode === 'reading',
    }"
    @pointermove="immersivePointer"
    @dragover.prevent
    @drop.prevent="importFile($event.dataTransfer.files[0])"
  >
    <template v-if="!settingsWindowMode">
      <div
        v-if="immersiveHeaderHidden"
        class="header-reveal-zone"
        @pointerenter="revealHeader"
        aria-hidden="true"
      ></div>
      <ReaderToolbar
        :pages="pages"
        :loading="loading"
        :immersive-header-hidden="immersiveHeaderHidden"
        :reveal-header="revealHeader"
        :header-double-click="headerDoubleClick"
        :platform="platform"
        :desktop-credentials="desktopCredentials"
        :desktop-window="desktopWindow"
        :maximized="maximized"
        :bind-windows-menu="(element) => (windowsMenu = element)"
        :dismiss-popovers="dismissPopovers"
        :toolbar-hint="toolbarHint"
        :sidebar="sidebar"
        :toggle-sidebar="toggleSidebar"
        :title="title"
        :active="active"
        :annotations="annotations"
        :show-kernel-toolbar-shortcut="showKernelToolbarShortcut"
        :kernel-error-visible="kernelErrorVisible"
        :engine="engine"
        :engine-busy="engineBusy"
        :choose-kernel="chooseKernel"
        :kernel-options="kernelOptions"
        :kernel-failure="kernelFailure"
        :offer-document-ignore="offerDocumentIgnore"
        :ignore-kernel-failure="ignoreKernelFailure"
        :recover-kernel="recoverKernel"
        :translation-task-progress="translationTaskProgress"
        :search-open="searchOpen"
        :close-search="closeSearch"
        :open-search="openSearch"
        :open-settings="openSettings"
        v-model:windows-menu-open="windowsMenuOpen"
        v-model:show-annotations="showAnnotations"
        v-model:show-translations="showTranslations"
        v-model:settings="settings"
      />
      <DocumentSearchBar
        :search-open="searchOpen"
        :pages="pages"
        :next-search="nextSearch"
        :bind-search-input="(element) => (searchInput = element)"
        :show-translations="showTranslations"
        :search-failure="searchFailure"
        :search-busy="searchBusy"
        :search-results="searchResults"
        :search-page-count="searchPageCount"
        :close-search="closeSearch"
        v-model:search-query="searchQuery"
      />
      <input
        ref="fileInput"
        type="file"
        accept="application/pdf,.pdf"
        hidden
        @change="
          importFile($event.target.files[0]);
          $event.target.value = '';
        "
      />
      <ReaderWorkspace
        :bind-workspace="(element) => (workspace = element)"
        :document-opening="documentOpening"
        :document-closing="documentClosing"
        :sidebar-width="sidebarWidth"
        :observe-thumbnails="observeThumbnails"
        :resize-fit="resizeFit"
        :sidebar="sidebar"
        :pages="pages"
        :restoring-view="restoringView"
        :sidebar-keyboard="sidebarKeyboard"
        :focus-sidebar-item="focusSidebarItem"
        :document-outline="documentOutline"
        :read-chapters="readChapters"
        :annotations="annotations"
        :selected-annotation="selectedAnnotation"
        :reduce-motion="reduceMotion"
        :sidebar-ready="sidebarReady"
        :navigate-from-sidebar="navigateFromSidebar"
        :show-scrollbar="showScrollbar"
        :bind-thumbnail-list="(element) => (thumbnailList = element)"
        :thumbnail-scrolling="thumbnailScrolling"
        :thumbnail-layout="thumbnailLayout"
        :desktop-credentials="desktopCredentials"
        :thumbnail-highlight="thumbnailHighlight"
        :thumbnail-items="thumbnailItems"
        :active="active"
        :bind-thumbnail="bindThumbnail"
        :resize-sidebar-start="resizeSidebarStart"
        :resize-sidebar-move="resizeSidebarMove"
        :resize-sidebar-end="resizeSidebarEnd"
        :resize-sidebar-key="resizeSidebarKey"
        :bind-reader="(element) => (reader = element)"
        :pinching="pinching"
        :fit-mode="fitMode"
        :scrolling="scrolling"
        :interrupt-page-scroll="interruptPageScroll"
        :immersive-intent="immersiveIntent"
        :dismiss-kernel-failure-from-document="dismissKernelFailureFromDocument"
        :recent-documents="recentDocuments"
        :file-input="fileInput"
        :sample="sample"
        :clear-recent="clearRecent"
        :open-recent="openRecent"
        :recent-context-menu="recentContextMenu"
        :bind-layout-element="(element) => (layoutElement = element)"
        :direction="direction"
        :columns="columns"
        :page-layout="pageLayout"
        :mounted-pages="mountedPages"
        :page-crop="pageCrop"
        :zoom="zoom"
        :show-translations="showTranslations"
        :layout-visible="layoutVisible"
        :engine="engine"
        :foreground="foreground"
        :interaction-mode="interactionMode"
        :emphasize-topic-sentences="emphasizeTopicSentences"
        :emphasize-information="emphasizeInformation"
        :information-categories="informationCategories"
        :pdf="session.pdf"
        :quick-link-buttons="quickLinkButtons"
        :follow-quick-link="followQuickLink"
        :show-annotations="showAnnotations"
        :follow-reference="followReference"
        :save-annotations="saveAnnotations"
        :annotation-notice="annotationNotice"
        :reader-action="readerAction"
        :bind-page="bindPage"
        :bind-canvas="bindCanvas"
        :native-source="nativeSource"
        :math-source="mathSource"
        :search-hit="searchHit"
        :toggle="toggle"
        :process-page="processPage"
        :reference-return="referenceReturn"
        :return-from-reference="returnFromReference"
        :search-open="searchOpen"
        :create-quick-return="createQuickReturn"
        v-model:sidebar-leaving="sidebarLeaving"
        v-model:sidebar-mode="sidebarMode"
        v-model:sidebar-drag="motion.sidebarDrag"
        v-model:hovered-paragraph="hoveredParagraph"
      />
      <ReaderFloatingTools
        :navigator-visible="navigatorVisible"
        :pages="pages"
        :bind-navigator="(element) => (navigator = element)"
        :hold-navigator="holdNavigator"
        :hide-navigator-later="hideNavigatorLater"
        :toolbar-hint="toolbarHint"
        :change-zoom="changeZoom"
        :platform="platform"
        :bind-zoom-input="(element) => (zoomInput = element)"
        :zoom="zoom"
        :submit-zoom="submitZoom"
        :zoom-entry-input="zoomEntryInput"
        :active="active"
        :go="go"
        :submit-page="submitPage"
        :bind-page-input="(element) => (pageInput = element)"
        v-model:zoom-entry="zoomEntry"
        v-model:page-entry="pageEntry"
      />
      <Transition name="copy-toast"
        ><div v-if="annotationToast" class="copy-toast" role="status">
          {{ annotationToast.text }}
        </div></Transition
      ><Transition name="copy-toast"
        ><div v-if="copyToast" class="copy-toast" role="status">
          <span>{{ copyToastHeading }}</span>
          <span v-if="copyToastDetail" class="copy-toast-detail" :title="copyToastDetail">{{
            copyToastDetail
          }}</span>
        </div></Transition
      >
      <footer v-if="!desktopCredentials" class="statusbar">
        <span
          ><i class="status-dot" :class="{ busy: progress.pending || loading }"></i
          >{{ loading ? t('status.openingPDF') : reading }}</span
        ><span v-if="progress.total">{{
          t('status.paragraphsTranslated', {
            done: progress.done,
            total: progress.total,
            cached: pages.flatMap((p) => p.blocks).filter((b) => b.cached).length,
          })
        }}</span
        ><span v-else>{{
          configured ? t('status.translationReady') : t('status.openAIKeyNotConfigured')
        }}</span
        ><span v-if="pages.length">{{
          t('status.pageOf', { current: active, total: pages.length })
        }}</span>
      </footer>
      <div
        v-if="
          error &&
          !pages.some(
            (page) =>
              (page.status === 'error' && page.message === error) ||
              page.blocks.some((block) => block.status === 'error' && block.error === error),
          )
        "
        class="error-banner"
        role="alert"
      >
        {{ error
        }}<button @click="error = ''" :aria-label="t('error.dismiss')">
          <span
            class="system-icon"
            aria-hidden="true"
            data-symbol="xmark"
            style="--symbol: url('/symbols/xmark.png')"
          ></span>
        </button>
      </div>
    </template>
    <ParagraphDetails
      :popover-focus-out="popoverFocusOut"
      v-model:selected-paragraph="selectedParagraph"
    />
    <NativeSettingsPanel
      :effective-translation-summary="effectiveTranslationSummary"
      :settings-window-mode="settingsWindowMode"
      :close-settings-window="closeSettingsWindow"
      :bind-kernel-input="(element) => (kernelInput = element)"
      :engine="engine"
      :choose-kernel="chooseKernel"
      :engine-state="engineState"
      :kernel-status-label="kernelStatusLabel"
      :kernel-status="kernelStatus"
      :kernel-options="kernelOptions"
      :uv-version-label="uvVersionLabel"
      :api="api"
      :finish-kernel-setup="finishKernelSetup"
      :information-category-settings="informationCategorySettings"
      :source-language-options="sourceLanguageOptions"
      :language-label="languageLabel"
      :bind-language-input="(element) => (languageInput = element)"
      :language-options="languageOptions"
      :translation-modes="translationModes"
      :parallel-levels="parallelLevels"
      :parallel-labels="parallelLabels"
      :parallel-pages-step="parallelPagesStep"
      :parallel-translations-step="parallelTranslationsStep"
      :configured="configured"
      :translation-service-history="translationServiceHistory"
      :translation-service-catalog-revision="translationServiceCatalogRevision"
      :desktop-credentials="desktopCredentials"
      :update-key="updateKey"
      :key-placeholder="keyPlaceholder"
      :key-invalid="keyInvalid"
      :key-message="keyMessage"
      :key-busy="keyBusy"
      :uv-state="uvState"
      :install-engine="installEngine"
      :discovered-engines="discoveredEngines"
      :engine-discovery-failed="engineDiscoveryFailed"
      v-model:settings-section="settingsSection"
      v-model:settings="settings"
      v-model:legacy-settings="legacySettings"
      v-model:engine-busy="engineBusy"
      v-model:error="error"
      v-model:document-open-mode="documentOpenMode"
      v-model:interaction-mode="interactionMode"
      v-model:optimize-paragraph-gaps="optimizeParagraphGaps"
      v-model:restore-documents="restoreDocuments"
      v-model:auto-hide-header="autoHideHeader"
      v-model:emphasize-topic-sentences="emphasizeTopicSentences"
      v-model:emphasize-information="emphasizeInformation"
      v-model:default-page-crop-enabled="defaultPageCropEnabled"
      v-model:default-page-crop-x="defaultPageCropX"
      v-model:default-page-crop-y="defaultPageCropY"
      v-model:auto-align-document-width="autoAlignDocumentWidth"
      v-model:reduce-resource-usage="reduceResourceUsage"
      v-model:reduce-background-frame-rate="reduceBackgroundFrameRate"
      v-model:reduce-motion="reduceMotion"
      v-model:reduce-transparency="reduceTransparency"
      v-model:reduce-padding="reducePadding"
      v-model:show-kernel-toolbar-shortcut="showKernelToolbarShortcut"
      v-model:interface-style="interfaceStyle"
      v-model:appearance-choice="appearanceChoice"
      v-model:accent-color="accentColor"
      v-model:glossaries="glossaries"
      v-model:source-language="sourceLanguage"
      v-model:language-menu-open="languageMenuOpen"
      v-model:language="language"
      v-model:reuse-translations="reuseTranslations"
      v-model:translation-mode="translationMode"
      v-model:page-concurrency="pageConcurrency"
      v-model:concurrency="concurrency"
      v-model:translation-services="translationServices"
      v-model:service-credential-values="serviceCredentialValues"
      v-model:translation-service-request="translationServiceRequest"
      v-model:kernel-advanced-options="kernelAdvancedOptions"
      v-model:key-entry="keyEntry"
    />
    <LegacySettingsPanel
      :popover-focus-out="popoverFocusOut"
      :settings-window-mode="settingsWindowMode"
      :close-settings-window="closeSettingsWindow"
      :bind-kernel-input="(element) => (kernelInput = element)"
      :engine="engine"
      :engine-busy="engineBusy"
      :choose-kernel="chooseKernel"
      :kernel-options="kernelOptions"
      :engine-state="engineState"
      :uv-state="uvState"
      :install-engine="installEngine"
      :kernel-status-label="kernelStatusLabel"
      :kernel-status="kernelStatus"
      :uv-version-label="uvVersionLabel"
      :source-language-options="sourceLanguageOptions"
      :language-label="languageLabel"
      :bind-language-input="(element) => (languageInput = element)"
      :language-options="languageOptions"
      :desktop-credentials="desktopCredentials"
      :translation-service-id="translationServiceId"
      :update-key="updateKey"
      :key-placeholder="keyPlaceholder"
      :key-invalid="keyInvalid"
      :key-message="keyMessage"
      :key-busy="keyBusy"
      :configured="configured"
      :translation-service-catalog-revision="translationServiceCatalogRevision"
      :translation-modes="translationModes"
      :parallel-levels="parallelLevels"
      :parallel-labels="parallelLabels"
      :parallel-pages-step="parallelPagesStep"
      :parallel-translations-step="parallelTranslationsStep"
      :information-category-settings="informationCategorySettings"
      v-model:legacy-settings="legacySettings"
      v-model:settings="settings"
      v-model:kernel-advanced-options="kernelAdvancedOptions"
      v-model:source-language="sourceLanguage"
      v-model:language-menu-open="languageMenuOpen"
      v-model:language="language"
      v-model:reuse-translations="reuseTranslations"
      v-model:key-entry="keyEntry"
      v-model:translation-services="translationServices"
      v-model:service-credential-values="serviceCredentialValues"
      v-model:translation-service-request="translationServiceRequest"
      v-model:translation-mode="translationMode"
      v-model:page-concurrency="pageConcurrency"
      v-model:concurrency="concurrency"
      v-model:automatic="automatic"
      v-model:layout-visible="layoutVisible"
      v-model:document-open-mode="documentOpenMode"
      v-model:interaction-mode="interactionMode"
      v-model:optimize-paragraph-gaps="optimizeParagraphGaps"
      v-model:emphasize-topic-sentences="emphasizeTopicSentences"
      v-model:emphasize-information="emphasizeInformation"
      v-model:restore-documents="restoreDocuments"
      v-model:auto-hide-header="autoHideHeader"
      v-model:reduce-resource-usage="reduceResourceUsage"
      v-model:show-kernel-toolbar-shortcut="showKernelToolbarShortcut"
      v-model:interface-style="interfaceStyle"
      v-model:appearance-choice="appearanceChoice"
      v-model:accent-color="accentColor"
      v-model:reduce-motion="reduceMotion"
      v-model:reduce-transparency="reduceTransparency"
      v-model:reduce-padding="reducePadding"
    />
  </div>
</template>
