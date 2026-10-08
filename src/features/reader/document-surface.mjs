import { ref, watch } from 'vue';
import { chaptersAtPage } from './sidebar-outline.mjs';
import { useAnnotationPersistence } from '../annotations/useAnnotationPersistence.mjs';
import { useReaderFeedback } from './useReaderFeedback.mjs';
import { useDocumentSearch } from '../search/useDocumentSearch.mjs';
import { useRecentDocuments } from '../library/useRecentDocuments.mjs';

export function createReaderDocumentSurface({
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
  readingView,
  renderPages,
  go,
  viewportPages,
  scheduleViewport,
  scheduleReadingSave,
  mapDisplayPage,
  importFile,
  ensurePDF,
  active,
  documentOutline,
  title,
  foreground,
  error,
  pageHidden,
}) {
  const feedback = useReaderFeedback(interactionMode);
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
    displayedPage,
    openSearch,
    closeSearch,
    scheduleSearch,
    nextSearch,
  } = useDocumentSearch({
    pages,
    reader,
    settings,
    zoom,
    showTranslations,
    getDocument: () => session.pdf,
    getEpoch: () => session.epoch,
    getPageHost: (number) => renderState.pageEls.get(number),
    readingView,
    renderPages,
    go,
    viewportPages,
    scheduleViewport,
    scheduleReadingSave,
    mapDisplayPage,
    navigation: {
      begin() {
        motion.referenceJumping = true;
        motion.referenceReturn.value = null;
        return ++motion.referenceNavigation;
      },
      isCurrent: (request) => request === motion.referenceNavigation,
      record(origin, targetPage) {
        motion.referenceReturn.value = { origin, targetPage };
      },
      finish(request) {
        if (request === motion.referenceNavigation) motion.referenceJumping = false;
      },
    },
  });

  const quickLinks = ref([]);
  const {
    recentDocuments,
    recentStatusDocument,
    recentContextMenu,
    scheduleRecentPreviews,
    pagePreview,
    openRecent,
    clearRecent,
    invalidateRecentPreviews,
    stopRecentPreviews,
  } = useRecentDocuments({
    pages,
    loading,
    foreground,
    error,
    getEpoch: () => session.epoch,
    pageHidden,
    importFile,
    loadDocument: async (data) => {
      await ensurePDF();
      return session.getDocument({ data });
    },
    trackTask: (canvas, task) => renderState.pageTasks.set(canvas, task),
    untrackTask: (canvas, task) => {
      if (renderState.pageTasks.get(canvas) === task) renderState.pageTasks.delete(canvas);
    },
  });

  const showAnnotations = ref(true);
  const {
    annotations,
    annotationKey,
    annotationNativeRefs,
    annotationToast,
    annotationNotice,
    saveAnnotations,
    flushAnnotations,
  } = useAnnotationPersistence((...args) => feedback.notifyCopy(...args));
  const readChapters = ref(new Set());
  watch(
    annotationKey,
    (key) => {
      readChapters.value = new Set();
      if (!key) return;
      try {
        const stored = JSON.parse(localStorage.getItem('read-chapters:' + key) || '[]');
        if (Array.isArray(stored))
          readChapters.value = new Set(stored.filter((id) => typeof id === 'string'));
      } catch {}
    },
    { flush: 'sync' },
  );
  watch(annotationKey, async (key) => {
    quickLinks.value = [];
    if (!key) return;
    try {
      const stored = window.previewQuickLinks
        ? await window.previewQuickLinks.load(key)
        : JSON.parse(localStorage.getItem('quick-links:' + key) || '[]');
      if (key === annotationKey.value) quickLinks.value = Array.isArray(stored) ? stored : [];
    } catch {
      feedback.notifyCopy('快捷链接读取失败');
    }
  });

  const selectedParagraph = ref(null);
  watch([active, documentOutline, loading, restoringView, annotationKey], () => {
    if (loading.value || restoringView.value || !annotationKey.value || !pages.value.length) return;
    const visited = chaptersAtPage(documentOutline.value, active.value);
    if (visited.every((id) => readChapters.value.has(id))) return;
    readChapters.value = new Set([...readChapters.value, ...visited]);
    try {
      localStorage.setItem(
        'read-chapters:' + annotationKey.value,
        JSON.stringify([...readChapters.value]),
      );
    } catch {}
  });

  return {
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
    displayedPage,
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
    ...feedback,
  };
}
