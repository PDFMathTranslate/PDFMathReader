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

  async function editDocumentPages(action) {
    if (
      pageEditing.value ||
      loading.value ||
      !pages.value.length ||
      !window.previewDocuments?.editPages
    )
      return;
    pageEditing.value = true;
    const token = session.epoch;
    const view = readingView();
    const name = title.value.replace(/^TEST — /, '');
    try {
      await flushAnnotations();
      await saveReadingView();
      if (token !== session.epoch) return;
      const result = await window.previewDocuments.editPages({
        key: annotationKey.value,
        action,
        page: active.value,
        annotations: JSON.parse(JSON.stringify(annotations.value)).map((annotation) => {
          delete annotation.animateUntil;
          return annotation;
        }),
        nativeRefs: [...annotationNativeRefs.value],
      });
      if (token !== session.epoch) return;
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
    } catch (cause) {
      error.value = cause.message;
    } finally {
      pageEditing.value = false;
    }
  }

  return { pageEditing, editDocumentPages };
}
