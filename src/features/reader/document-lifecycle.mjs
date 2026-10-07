import { t } from '../../i18n/index.mjs';
import {
  captureDocumentPage,
  releaseDocumentCapture,
  animateDocumentPage,
  animateDocumentSidebar,
} from './document-motion.mjs';
import { nextTick } from 'vue';
import { recentSurface } from '../library/useRecentDocuments.mjs';

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

  async function releaseDocument() {
    const id = session.documentId;
    session.documentId = undefined;
    translationState.forceRetranslation = false;
    if (id)
      try {
        await actions.backendRequests.api('/api/documents/' + id, { method: 'DELETE' });
      } catch {}
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
    // Keep a frozen page above the start page while the document is released.
    if (capture) document.body.append(capture.element);
    try {
      await closeDocumentNow();
      await nextTick();
      if (session.pages.value.length || controller.signal.aborted) return;
      const target = recentSurface(recentId);
      if (capture && target) {
        target
          .closest('button')
          .scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
        const visibility = target.style.visibility;
        target.style.visibility = 'hidden';
        try {
          await animateDocumentPage(capture, capture.rect, target.getBoundingClientRect(), {
            thumbnail: target.getAttribute('src'),
            signal: controller.signal,
          });
        } finally {
          target.style.visibility = visibility;
        }
      }
    } finally {
      await sidebarMotion;
      releaseDocumentCapture(capture);
      if (session.documentMotionController === controller) session.documentMotionController = null;
      session.documentClosing.value = false;
      session.closingDocument = false;
    }
  }

  async function closeDocumentNow() {
    motion.referenceReturn.value = null;
    motion.referenceNavigation++;
    const documentToken = session.epoch;
    await actions.rootActions.flushAnnotations();
    await actions.readingPosition.saveReadingView();
    annotations.annotations.value = [];
    shell.showAnnotations.value = true;
    annotations.annotationKey.value = '';
    shell.sidebarMode.value = 'thumbnails';
    shell.documentOutline.value = [];
    shell.selectedAnnotation.value = null;
    await activity.performanceRecorder.finish();
    await window.previewDocuments?.closed();
    if (documentToken !== session.epoch) return;
    session.currentRecentId = null;
    cancel();
    const closingToken = session.epoch;
    actions.rootActions.closeSearch();
    await releaseDocument();
    if (closingToken !== session.epoch) return;
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
    const token = session.epoch;
    await Promise.allSettled([...tasks].map((task) => task.destroy()));
    if (token !== session.epoch) return;
    if (window.previewRecents) {
      try {
        const entries = await window.previewRecents.list();
        if (token === session.epoch) {
          library.recentDocuments.value = entries;
          actions.rootActions.scheduleRecentPreviews();
        }
      } catch {}
    }
  }
  return { receiveDocuments, cancel, releaseDocument, closeDocument, closeDocumentNow };
}
