import { ref, onBeforeUnmount } from 'vue';
import { t } from '../../i18n/index.mjs';

export function recentSurface(id) {
  const button = [...document.querySelectorAll('[data-recent-id]')].find(
    (el) => el.dataset.recentId === id,
  );
  return button?.querySelector('img,.recent-placeholder');
}

export function useRecentDocuments({
  pages,
  loading,
  foreground,
  error,
  getEpoch,
  pageHidden,
  loadDocument,
  importFile,
  trackTask,
  untrackTask,
}) {
  const recentDocuments = ref([]);
  const recentStatusDocument = ref(null);
  async function recentContextMenu(id) {
    try {
      const action = await window.previewRecents?.contextMenu(id);
      if (action === 'open') await openRecent(id);
      else if (action === 'openWindow') await window.previewRecents.openWindow(id);
      else if (['hide', 'pin', 'clearCache'].includes(action)) {
        ++recentPreviewGeneration;
        recentDocuments.value = await window.previewRecents.list();
        scheduleRecentPreviews();
      } else if (action === 'status') {
        recentDocuments.value = await window.previewRecents.list();
        recentStatusDocument.value = recentDocuments.value.find((entry) => entry.id === id) || null;
      }
    } catch {
      error.value = t('error.thisPDFUnavailable');
    }
  }
  let recentPreviewGeneration = 0,
    recentPreviewTimer;
  function scheduleRecentPreviews() {
    clearTimeout(recentPreviewTimer);
    recentPreviewTimer = setTimeout(() => {
      if (!pages.value.length && !loading.value && foreground.value) void loadRecentPreviews();
    }, 500);
  }
  async function pagePreview(pdfDocument) {
    if (!foreground.value) return '';
    const page = await pdfDocument.getPage(1),
      bounds = page.getViewport({ scale: 1 });
    const canvas = window.document.createElement('canvas');
    try {
      for (const size of [360, 260, 180]) {
        const viewport = page.getViewport({ scale: size / Math.max(bounds.width, bounds.height) });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        if (!foreground.value) return '';
        const task = page.render({
          canvasContext: canvas.getContext('2d'),
          viewport,
          background: '#ffffff',
        });
        trackTask(canvas, task);
        try {
          await task.promise;
        } finally {
          untrackTask(canvas, task);
        }
        if (!foreground.value) return '';
        const image = canvas.toDataURL('image/png');
        if (image.length <= 200000) return image;
      }
      return '';
    } finally {
      canvas.width = canvas.height = 0;
    }
  }
  async function loadRecentPreviews() {
    const generation = ++recentPreviewGeneration;
    for (const entry of [...recentDocuments.value]) {
      if (pageHidden() || window.previewActivityActive === false) return;
      if (generation !== recentPreviewGeneration) return;
      if (entry.thumbnail) continue;
      let task;
      try {
        const { bytes } = await window.previewRecents.preview(entry.id);
        if (generation !== recentPreviewGeneration) return;
        task = await loadDocument(new Uint8Array(bytes));
        const image = await pagePreview(await task.promise);
        if (
          generation !== recentPreviewGeneration ||
          !recentDocuments.value.some((item) => item.id === entry.id)
        )
          return;
        if (image) {
          await window.previewRecents.setThumbnail(entry.id, image);
          const current = recentDocuments.value.find((item) => item.id === entry.id);
          if (current && generation === recentPreviewGeneration) current.thumbnail = image;
        }
      } catch {
        const current = recentDocuments.value.find((item) => item.id === entry.id);
        if (current && generation === recentPreviewGeneration) current.previewUnavailable = true;
      } finally {
        await task?.destroy();
      }
    }
  }
  async function openRecent(id) {
    ++recentPreviewGeneration;
    const token = getEpoch();
    try {
      if ((pages.value.length || loading.value) && window.previewRecents.openWindow) {
        await window.previewRecents.openWindow(id);
        return;
      }
      const surface = recentSurface(id),
        origin = surface
          ? { rect: surface.getBoundingClientRect(), thumbnail: surface.getAttribute('src') }
          : null;
      const document = await window.previewRecents.open(id);
      if (token !== getEpoch() || !document) return;
      await importFile(
        new File([document.bytes], document.name, { type: 'application/pdf' }),
        document.ticket,
        origin,
      );
    } catch {
      if (token === getEpoch()) error.value = t('error.thisPDFUnavailable');
    }
  }
  async function clearRecent() {
    ++recentPreviewGeneration;
    try {
      recentDocuments.value = await window.previewRecents.clear();
    } catch {
      error.value = t('error.clearDocumentHistory');
    }
  }

  function invalidateRecentPreviews() {
    ++recentPreviewGeneration;
  }
  function stopRecentPreviews() {
    clearTimeout(recentPreviewTimer);
  }
  onBeforeUnmount(() => {
    invalidateRecentPreviews();
    stopRecentPreviews();
  });
  return {
    recentDocuments,
    recentStatusDocument,
    recentContextMenu,
    scheduleRecentPreviews,
    pagePreview,
    openRecent,
    clearRecent,
    invalidateRecentPreviews,
    stopRecentPreviews,
  };
}
