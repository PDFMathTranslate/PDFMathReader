import { t } from '../../i18n/index.mjs';
import { reactive, nextTick, markRaw } from 'vue';
import {
  captureDocumentPage,
  animateDocumentPage,
  animateDocumentSidebar,
} from './document-motion.mjs';
import { loadPDFRuntime } from './pdf-runtime.mjs';
import { scheduleAfterPaint, scheduleTaskCleanup } from './document-scheduling.mjs';

export function createDocumentImport({
  session,
  motion,
  renderState,
  preferences,
  translationState,
  feedback,
  annotations,
  activity,
  library,
  shell,
  view,
  actions,
}) {
  async function recoverHighlightedText(document, items) {
    for (const number of new Set(
      items.filter((a) => a.nativeRef && a.kind === 'highlight' && !a.text).map((a) => a.page),
    )) {
      const page = await document.getPage(number),
        viewport = page.getViewport({ scale: 1 }),
        content = await page.getTextContent();
      for (const a of items.filter(
        (a) => a.page === number && a.nativeRef && a.kind === 'highlight' && !a.text,
      ))
        a.text = content.items
          .filter((item) => {
            if (!item.str) return false;
            const [ma, mb, mc, md, e, f] = item.transform,
              base = Math.hypot(ma, mb) || 1,
              vertical = Math.hypot(mc, md) || 1;
            const points = [
              [e, f],
              [e + (ma / base) * item.width, f + (mb / base) * item.width],
              [e + (mc / vertical) * item.height, f + (md / vertical) * item.height],
              [
                e + (ma / base) * item.width + (mc / vertical) * item.height,
                f + (mb / base) * item.width + (md / vertical) * item.height,
              ],
            ].map(([x, y]) => viewport.convertToViewportPoint(x, y));
            const left = Math.min(...points.map((p) => p[0])),
              right = Math.max(...points.map((p) => p[0])),
              top = Math.min(...points.map((p) => p[1])),
              bottom = Math.max(...points.map((p) => p[1]));
            return a.rects.some(
              (r) => right > r.x && left < r.x + r.width && bottom > r.y && top < r.y + r.height,
            );
          })
          .map((item) => item.str)
          .join(' ');
    }
  }

  async function importFile(file, ticket, origin, { skipAutoAlign = false } = {}) {
    if (
      file &&
      !ticket &&
      (session.pages.value.length || session.loading.value) &&
      window.previewDocuments?.open
    ) {
      try {
        await window.previewDocuments.open(file);
      } catch (e) {
        feedback.error.value = e.message;
      }
      return;
    }
    if (!file) return;
    actions.rootActions.invalidateRecentPreviews();
    actions.rootActions.closeSearch();
    if (
      shell.testMode &&
      !['A quieter way to read.pdf', 'Portrait and landscape.pdf'].includes(file.name)
    ) {
      feedback.error.value = t('error.testDocumentsDisabled');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      feedback.error.value = t('error.PDFTooLarge');
      return;
    }
    if (!ticket && window.previewDocuments?.claim) {
      try {
        if (!(await window.previewDocuments.claim(file))) return;
      } catch (e) {
        feedback.error.value = e.message;
        return;
      }
    }
    actions.kernelSettings.resetKernelIgnore();
    session.documentMotionController?.abort();
    session.documentOpening.value = !!origin && !actions.rootActions.documentMotionReduced();
    motion.referenceReturn.value = null;
    motion.referenceNavigation++;
    await Promise.all([
      actions.rootActions.flushAnnotations(),
      actions.readingPosition.saveReadingView(),
    ]);
    annotations.annotations.value = [];
    shell.showAnnotations.value = true;
    annotations.annotationKey.value = '';
    shell.sidebarMode.value = 'thumbnails';
    shell.documentOutline.value = [];
    shell.selectedAnnotation.value = null;
    activity.performanceRecorder.start(file.size);
    const runtimeReady = ensurePDF();
    session.currentRecentId = null;
    session.restoringView.value = true;
    shell.selectedParagraph.value = null;
    actions.documentLifecycle.cancel();
    const token = session.epoch;
    const release = actions.documentLifecycle.releaseDocument();
    actions.canvasRendering.resetBitmaps();
    renderState.renderMetrics.openedAt = performance.now();
    renderState.renderMetrics.firstPageMs = null;
    session.loading.value = true;
    feedback.error.value = '';
    const previousTasks = session.pages.value
      .map((page) => page.mathDocument?.loadingTask)
      .filter(Boolean);
    session.pages.value = [];
    renderState.pageEls.clear();
    renderState.canvasEls.clear();
    renderState.thumbEls.clear();
    void scheduleTaskCleanup(previousTasks, { afterCommit: nextTick }).catch(() => {});
    try {
      await scheduleAfterPaint(() => {}, { afterCommit: nextTick });
      if (token !== session.epoch) return;
      session.bytes = new Uint8Array(await file.arrayBuffer());
      let imported = { annotations: [], nativeRefs: [] };
      if (window.previewAnnotations?.prepare) {
        imported = await window.previewAnnotations.prepare(session.bytes);
        session.bytes = imported.bytes;
      } else if (window.previewAnnotations?.clean)
        session.bytes = await window.previewAnnotations.clean(session.bytes);
      activity.performanceRecorder.mark('fileRead');
      if (token !== session.epoch) return;
      await release;
      if (token !== session.epoch) return;
      await session.pdf?.loadingTask.destroy();
      if (token !== session.epoch) return;
      activity.performanceRecorder.beginTransport?.();
      const registered = await actions.backendRequests.api('/api/documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/pdf',
          'X-Document-Name': encodeURIComponent(file.name || ''),
        },
        body: session.bytes,
      });
      if (token !== session.epoch) {
        await actions.backendRequests.api('/api/documents/' + registered.id, { method: 'DELETE' });
        return;
      }
      session.documentId = registered.id;
      activity.performanceRecorder.mark('upload');
      await runtimeReady;
      const task = session.getDocument({ data: session.bytes });
      session.pendingPDFTask = task;
      const loaded = await task.promise;
      if (token !== session.epoch) {
        void task.destroy();
        return;
      }
      session.pdf = markRaw(loaded);
      const outlineReady = actions.referenceNavigation.loadOutline(session.pdf, token);
      activity.performanceRecorder.mark('pdfReady');
      activity.performanceRecorder.pages(session.pdf.numPages);
      session.bytes = undefined;
      if (session.pendingPDFTask === task) session.pendingPDFTask = undefined;
      view.showTranslations.value = preferences.documentOpenMode.value === 'translation';
      translationState.translationDeferred.value = preferences.documentOpenMode.value === 'manual';
      session.title.value = (shell.testMode ? 'TEST — ' : '') + file.name;
      view.active.value = 1;
      const list = [];
      for (let first = 1; first <= session.pdf.numPages; first += 16) {
        const numbers = Array.from(
            { length: Math.min(16, session.pdf.numPages - first + 1) },
            (_, i) => first + i,
          ),
          batch = await Promise.all(numbers.map((n) => session.pdf.getPage(n)));
        if (token !== session.epoch) return;
        for (let i = 0; i < batch.length; i++) {
          const v = batch[i].getViewport({ scale: 1 });
          list.push(
            reactive({
              number: numbers[i],
              width: v.width,
              height: v.height,
              status: 'idle',
              blocks: [],
              cached: false,
              translationModel: '',
              dwell: 0,
            }),
          );
        }
      }
      activity.performanceRecorder.mark('pageGeometry');
      let saved;
      if (window.previewRecents)
        try {
          const result = await window.previewRecents.remember(file, ticket);
          if (token !== session.epoch) return;
          library.recentDocuments.value = result.entries;
          session.currentRecentId = result.recentId;
          saved = result.view;
        } catch {
          if (token === session.epoch) feedback.error.value = t('error.saveRecentHistory');
        }
      annotations.annotationKey.value = session.currentRecentId || session.pdf.fingerprints[0];
      try {
        const stored = window.previewAnnotations?.loadState
          ? await window.previewAnnotations.loadState(annotations.annotationKey.value)
          : {
              annotations: window.previewAnnotations
                ? await window.previewAnnotations.load(annotations.annotationKey.value)
                : JSON.parse(
                    localStorage.getItem('annotations:' + annotations.annotationKey.value) || '[]',
                  ),
              nativeRefs: [],
            };
        annotations.annotationNativeRefs.value = [
          ...new Set([...stored.nativeRefs, ...imported.nativeRefs]),
        ];
        annotations.annotations.value = [
          ...stored.annotations,
          ...imported.annotations.filter(
            (a) =>
              !stored.annotations.some((b) => b.id === a.id) &&
              (!a.nativeRef || !stored.nativeRefs.includes(a.nativeRef)),
          ),
        ];
      } catch (e) {
        feedback.error.value = '无法读取批注：' + e.message;
      }
      if (token !== session.epoch) return;
      await recoverHighlightedText(session.pdf, annotations.annotations.value);
      if (token !== session.epoch) return;
      activity.performanceRecorder.mark('recentHistory');
      await outlineReady;
      if (token !== session.epoch) return;
      session.pages.value = list;
      await actions.readingPosition.restoreReadingView(
        saved && preferences.documentOpenMode.value === 'manual'
          ? { ...saved, showTranslations: false }
          : saved,
      );
      if (view.showTranslations.value) translationState.translationDeferred.value = false;
      activity.performanceRecorder.mark('restoreView');
      if (token !== session.epoch) return;
      actions.readerViewport.observe();
      actions.thumbnails.observeThumbnails();
      await actions.canvasRendering.renderPages();
      if (token !== session.epoch) return;
      session.restoringView.value = false;
      session.loading.value = false;
      actions.preferencePersistence.saveView();
      await nextTick();
      if (origin && !actions.rootActions.documentMotionReduced()) {
        const host = renderState.pageEls.get(view.active.value),
          capture = captureDocumentPage(host);
        if (capture) {
          const controller = new AbortController();
          session.documentMotionController = controller;
          const visibility = host.style.visibility;
          host.style.visibility = 'hidden';
          try {
            await Promise.all([
              animateDocumentPage(capture, origin.rect, capture.rect, {
                opening: true,
                thumbnail: origin.thumbnail,
                signal: controller.signal,
              }),
              animateDocumentSidebar(shell.workspace.value?.querySelector('.sidebar'), {
                opening: true,
                signal: controller.signal,
              }),
            ]);
          } finally {
            session.documentOpening.value = false;
            host.style.visibility = visibility;
            if (session.documentMotionController === controller)
              session.documentMotionController = null;
          }
        }
      }
      if (token !== session.epoch) return;
      session.documentOpening.value = false;
      // Reloads after manual edits bypass defaults; already aligned PDFs stay untouched.
      if (
        !skipAutoAlign &&
        preferences.autoAlignDocumentWidth.value &&
        window.previewDocuments?.editPages &&
        new Set(list.map((p) => Math.round((p.width + Number.EPSILON) * 10))).size > 1
      ) {
        await actions.rootActions.editDocumentPages('align-width');
        return;
      }
      actions.readerScroll.settle();
      if (session.currentRecentId)
        try {
          const id = session.currentRecentId,
            thumbnail = await actions.rootActions.pagePreview(session.pdf);
          if (token !== session.epoch) return;
          if (thumbnail) await window.previewRecents.setThumbnail(id, thumbnail);
        } catch {
          if (token === session.epoch) feedback.error.value = t('error.saveDocumentPreview');
        }
    } catch (e) {
      if (token === session.epoch) {
        feedback.error.value = e.message;
        await actions.documentLifecycle.releaseDocument();
        await window.previewDocuments?.closed();
      }
    } finally {
      if (token === session.epoch) {
        session.documentOpening.value = false;
        session.restoringView.value = false;
        session.loading.value = false;
        actions.readingPosition.scheduleReadingSave();
      }
    }
  }

  async function sample() {
    const token = session.epoch,
      r = await fetch('/sample.pdf'),
      data = await r.arrayBuffer();
    if (token !== session.epoch) return;
    await importFile(new File([data], 'A quieter way to read.pdf', { type: 'application/pdf' }));
  }

  async function ensurePDF() {
    if (!session.getDocument) {
      const runtime = await loadPDFRuntime();
      session.pdfWorker ??= new runtime.PDFWorker({ name: 'PDFMathReader' });
      session.getDocument = (source) =>
        runtime.getDocument({ ...source, worker: session.pdfWorker });
    }
  }
  return { recoverHighlightedText, importFile, sample, ensurePDF };
}
