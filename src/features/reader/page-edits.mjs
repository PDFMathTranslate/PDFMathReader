import { ref } from 'vue';

export function createPageEdits({
  session,
  pages,
  loading,
  title,
  active,
  readingView,
  restoreReadingView,
  renderPages,
  importFile,
  flushAnnotations,
  saveReadingView,
  annotationKey,
  annotations,
  annotationNativeRefs,
  notifyCopy,
  error,
  uiLanguage,
  menuLabel,
}) {
  const pageEditing = ref(false);

  // `order` is required by `arrange`: the source page of every position in the new document.
  async function editDocumentPages(action, { order } = {}) {
    if (
      pageEditing.value ||
      loading.value ||
      !pages.value.length ||
      !window.previewDocuments?.editPages
    )
      return false;
    pageEditing.value = true;
    const token = session.epoch;
    let view = readingView();
    if (view && order) view = { ...view, page: Math.max(1, order.indexOf(view.page) + 1) };
    const name = title.value.replace(/^TEST — /, '');
    try {
      await flushAnnotations();
      await saveReadingView();
      if (token !== session.epoch) return false;
      const result = await window.previewDocuments.editPages({
        key: annotationKey.value,
        action,
        page: active.value,
        ...(order ? { order: [...order] } : {}),
        annotations: JSON.parse(JSON.stringify(annotations.value)).map((annotation) => {
          delete annotation.animateUntil;
          return annotation;
        }),
        nativeRefs: [...annotationNativeRefs.value],
      });
      if (token !== session.epoch) return false;
      await importFile(
        new File([result.bytes], name, { type: 'application/pdf' }),
        result.ticket,
        null,
        { skipAutoAlign: true },
      );
      if (view && pages.value.length) {
        await restoreReadingView(view);
        await renderPages();
        await saveReadingView();
      }
      notifyCopy(menuLabel('Page Changes Saved', uiLanguage.value));
      return true;
    } catch (cause) {
      error.value = cause.message;
      return false;
    } finally {
      pageEditing.value = false;
    }
  }

  return { pageEditing, editDocumentPages };
}
