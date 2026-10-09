import { t } from '../../i18n/index.mjs';
import {
  captureDocumentPage,
  releaseDocumentCapture,
  animateDocumentPage,
  animateDocumentSidebar,
} from './document-motion.mjs';
import { nextTick } from 'vue';
import { recentSurface } from '../library/useRecentDocuments.mjs';
import { scheduleTaskCleanup } from './document-scheduling.mjs';

export function createDocumentLifecycle({
  session,
  motion,
  translationState,
  renderState,
  feedback,
  annotations,
  activity,
  library,
  view,
  shell,
  actions,
}) {
  let pendingRelease = Promise.resolve();

  async function receiveDocuments() {
    if (session.receivingDocuments) return;
    session.receivingDocuments = true;
    try {
      let document;
      while ((document = await window.previewDocuments.next())) {
        if (document.error) {
          feedback.error.value = document.error;
          continue;
        }
        while (session.closingDocument) await new Promise((resolve) => setTimeout(resolve, 20));
        await actions.documentImport.importFile(
          new File([document.bytes], document.name, { type: 'application/pdf' }),
          document.ticket,
        );
      }
    } catch {
      feedback.error.value = t('error.receivePDFFromDesktop');
    } finally {
      session.receivingDocuments = false;
    }
  }

  function cancel() {
    ++motion.pageJumpGeneration;
    actions.pageNavigation.cancelPageScroll();
    motion.pageJumping = false;
    translationState.translationMoving = false;
    translationState.lastTranslationScroll = null;
    translationState.readingDirection = 1;
    actions.rootActions.cancelLayoutMotion();
    feedback.hoveredParagraph.value = null;
    actions.readerFit.cancelResize();
    clearTimeout(renderState.previewTimer);
    clearTimeout(motion.zoomRenderTimer);
    motion.zoomRenderTimer = 0;
    ++motion.zoomRenderGeneration;
    ++motion.zoomMotionGeneration;
    motion.zoomTargetPending = false;
    motion.zoomRequest = null;
    actions.readerZoom.finishZoomAnimation();
    renderState.previewScrolling = false;
    renderState.pendingPreview.clear();
    cancelAnimationFrame(motion.pinchFrame);
    clearTimeout(motion.pinchTimer);
    motion.pinchFrame = 0;
    motion.pinchDelta = 0;
    motion.pinching.value = false;
    renderState.revealControllers.forEach((c) => c.abort());
    renderState.revealControllers.clear();
    translationState.pageQueue.length = 0;
    session.epoch++;
    renderState.renderEpoch++;
    renderState.pageTasks.forEach((t) => t.cancel());
    renderState.pageTasks.clear();
    translationState.controllers.forEach((c) => c.abort());
    translationState.controllers.clear();
    translationState.queue.length = 0;
    for (const p of session.pages.value) {
      if (['queued', 'detecting'].includes(p.status)) p.status = 'idle';
      for (const b of p.blocks) if (['queued', 'translating'].includes(b.status)) b.status = 'idle';
    }
  }

  function releaseDocument() {
    const id = session.documentId;
    session.documentId = undefined;
    translationState.forceRetranslation = false;
    if (!id) return pendingRelease;
    const release = pendingRelease
      .catch(() => {})
      .then(() => actions.backendRequests.api('/api/documents/' + id, { method: 'DELETE' }))
      .catch(() => {});
    pendingRelease = release;
    return release;
  }

  async function closeDocument(closeStartPage = false) {
    if (
      closeStartPage &&
      !session.closingDocument &&
      !session.pages.value.length &&
      !session.loading.value
    ) {
      await window.previewWindow?.closeStartPage?.();
      return;
    }
    if (session.closingDocument) return;
    session.closingDocument = true;
    session.documentMotionController?.abort();
    const controller = new AbortController();
    session.documentMotionController = controller;
    session.documentOpening.value = false;
    session.documentClosing.value = true;
    const recentId = session.currentRecentId,
      capture = !actions.rootActions.documentMotionReduced()
        ? captureDocumentPage(renderState.pageEls.get(view.active.value))
        : null;
    const sidebarMotion = !actions.rootActions.documentMotionReduced()
      ? animateDocumentSidebar(shell.workspace.value?.querySelector('.sidebar'), {
          signal: controller.signal,
        })
      : Promise.resolve();
    let pageMotion = Promise.resolve();
    const releaseMotion = () =>
      Promise.allSettled([sidebarMotion, pageMotion]).then(() => {
        releaseDocumentCapture(capture);
        if (session.documentMotionController === controller)
          session.documentMotionController = null;
      });
    // Keep a frozen page above the start page while the document is released.
    if (capture) document.body.append(capture.element);
    try {
      const closeWindow = await closeDocumentNow();
      if (closeWindow) {
        await window.previewWindow?.close();
        return;
      }
      await nextTick();
      if (session.pages.value.length || controller.signal.aborted) return;
      const target = recentSurface(recentId);
      if (capture && target) {
        target
          .closest('button')
          .scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
        const visibility = target.style.visibility;
        target.style.visibility = 'hidden';
        pageMotion = animateDocumentPage(capture, capture.rect, target.getBoundingClientRect(), {
          thumbnail: target.getAttribute('src'),
          signal: controller.signal,
        }).finally(() => {
          target.style.visibility = visibility;
        });
      }
    } finally {
      session.documentClosing.value = false;
      session.closingDocument = false;
      void releaseMotion();
    }
  }

  async function closeDocumentNow() {
    motion.referenceReturn.value = null;
    motion.referenceNavigation++;
    const documentToken = session.epoch;
    await Promise.all([
      actions.rootActions.flushAnnotations(),
      actions.readingPosition.saveReadingView(),
    ]);
    if (documentToken !== session.epoch) return;
    annotations.annotations.value = [];
    shell.showAnnotations.value = true;
    annotations.annotationKey.value = '';
    shell.sidebarMode.value = 'thumbnails';
    shell.documentOutline.value = [];
    shell.selectedAnnotation.value = null;
    void activity.performanceRecorder.finish();
    let closed = Promise.resolve();
    try {
      closed = Promise.resolve(window.previewDocuments?.closed()).catch(() => {});
    } catch {}
    const closeResult = await closed;
    if (documentToken !== session.epoch) return;
    session.currentRecentId = null;
    cancel();
    actions.rootActions.closeSearch();
    void releaseDocument();
    clearTimeout(translationState.timer);
    clearTimeout(motion.navigatorTimer);
    cancelAnimationFrame(motion.fitFrame);
    motion.fitFrame = 0;
    clearTimeout(motion.fitResizeTimer);
    motion.fitResizing = false;
    actions.kernelSettings.resetKernelIgnore();
    actions.readerPopovers.dismissPopovers();
    actions.canvasRendering.resetBitmaps();
    const tasks = new Set(
      [
        session.pendingPDFTask,
        session.pdf?.loadingTask,
        ...session.pages.value.map((page) => page.mathDocument?.loadingTask),
      ].filter(Boolean),
    );
    session.pdf = undefined;
    session.pendingPDFTask = undefined;
    session.bytes = undefined;
    session.pages.value = [];
    renderState.pageEls.clear();
    renderState.canvasEls.clear();
    renderState.thumbEls.clear();
    renderState.pageTasks.clear();
    session.title.value = 'PDFMathReader';
    view.active.value = 1;
    view.pageEntry.value = 1;
    session.loading.value = false;
    feedback.reading.value = t('reading.ready');
    motion.navigatorVisible.value = false;
    if (view.reader.value) view.reader.value.scrollTop = view.reader.value.scrollLeft = 0;
    if (shell.fileInput.value) shell.fileInput.value.value = '';
    void scheduleTaskCleanup(tasks, { afterCommit: nextTick }).catch(() => {});
    const token = session.epoch;
    if (window.previewRecents) {
      void Promise.resolve()
        .then(() => window.previewRecents.list())
        .then((entries) => {
          if (token === session.epoch) {
            library.recentDocuments.value = entries;
            actions.rootActions.scheduleRecentPreviews();
          }
        })
        .catch(() => {});
    }
    return closeResult?.closeWindow === true;
  }
  return { receiveDocuments, cancel, releaseDocument, closeDocument, closeDocumentNow };
}
