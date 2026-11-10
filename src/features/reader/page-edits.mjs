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

  // Runs one document replacement: `request` returns the rewritten PDF, or no bytes when
  // nothing changed. `place` maps the current reading page to its page afterwards.
  async function replaceDocument(request, place) {
    if (
      pageEditing.value ||
      loading.value ||
      !pages.value.length ||
      !window.previewDocuments?.editPages
    )
      return null;
    pageEditing.value = true;
    const token = session.epoch;
    const name = title.value.replace(/^TEST — /, '');
    try {
      await flushAnnotations();
      await saveReadingView();
      if (token !== session.epoch) return null;
      const result = await request();
      if (token !== session.epoch || !result?.bytes) return result ?? null;
      let view = readingView();
      if (view) view = { ...view, page: place(view.page, result) };
      await importFile(
        new File([result.bytes], name, { type: 'application/pdf' }),
        result.ticket,
        null,
        { skipAutoAlign: true },
      );
      if (view && pages.value.length) {
        await restoreReadingView({
          ...view,
          page: Math.max(1, Math.min(pages.value.length, view.page)),
        });
        await renderPages();
        await saveReadingView();
      }
      return result;
    } catch (cause) {
      error.value = cause.message;
      return null;
    } finally {
      pageEditing.value = false;
    }
  }

  function annotationPayload() {
    return {
      key: annotationKey.value,
      annotations: JSON.parse(JSON.stringify(annotations.value)).map((annotation) => {
        delete annotation.animateUntil;
        return annotation;
      }),
      nativeRefs: [...annotationNativeRefs.value],
    };
  }

  // `order` is required by `arrange`: the source page of every position in the new document.
  // `insert` pastes the copied pages named by `clipboard` after position `at`; its `order`
  // (null for inserted positions) only places the reading page.
  async function editDocumentPages(action, { order, at, clipboard } = {}) {
    const result = await replaceDocument(
      () =>
        window.previewDocuments.editPages({
          ...annotationPayload(),
          action,
          page: active.value,
          ...(action === 'arrange' && order ? { order: [...order] } : {}),
          ...(action === 'insert' ? { at, clipboard } : {}),
        }),
      (page) => {
        if (!order) return page;
        const at = order.indexOf(page);
        return at >= 0 ? at + 1 : order.filter((source) => source && source < page).length + 1;
      },
    );
    if (!result?.bytes) return false;
    notifyCopy(menuLabel('Page Changes Saved', uiLanguage.value));
    return true;
  }

  // Puts `pages` on the page clipboard shared by every window. Resolves to its `{ id, count,
  // sizes }`, or null when copying failed.
  async function copyDocumentPages(pages) {
    if (loading.value || !pages.length || !window.previewDocuments?.copyPages) return null;
    try {
      return await window.previewDocuments.copyPages({ ...annotationPayload(), pages: [...pages] });
    } catch (cause) {
      error.value = cause.message;
      return null;
    }
  }

  // Reverts the latest page edit. Resolves to `{ order }` of the undone edit (null unless it
  // was an arrangement), or null when nothing was undone.
  async function undoDocumentPages() {
    if (!window.previewDocuments?.undoPageEdit) return null;
    const result = await replaceDocument(
      () => window.previewDocuments.undoPageEdit({ key: annotationKey.value }),
      (page, { order }) => order?.[page - 1] ?? page,
    );
    if (!result) return null;
    const label = result.undone
      ? 'Page Edit Undone'
      : result.stale
        ? 'Can’t Undo: Annotations Changed'
        : 'Nothing to Undo';
    notifyCopy(menuLabel(label, uiLanguage.value));
    return result.undone ? { order: result.order ?? null } : null;
  }

  return { pageEditing, editDocumentPages, undoDocumentPages, copyDocumentPages };
}
