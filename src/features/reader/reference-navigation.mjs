import { readOutline } from './sidebar-outline.mjs';
import { resolvePDFDestination, destinationPoint, destinationScale } from './pdf-navigation.mjs';
import { nextTick } from 'vue';

export function createReferenceNavigation({
  session,
  motion,
  renderState,
  preferences,
  shell,
  view,
  actions,
}) {
  async function loadOutline(document, token) {
    try {
      const items = await readOutline(document);
      if (token === session.epoch) shell.documentOutline.value = items;
    } catch {
      if (token === session.epoch) shell.documentOutline.value = [];
    }
  }

  async function followReference(destination) {
    const document = session.pdf,
      documentToken = session.epoch,
      request = ++motion.referenceNavigation;
    try {
      const target = await resolvePDFDestination(document, destination);
      if (!target || documentToken !== session.epoch || request !== motion.referenceNavigation)
        return;
      const origin = actions.readingPosition.readingView();
      if (!origin) return;
      const page = await document.getPage(target.pageNumber);
      if (documentToken !== session.epoch || request !== motion.referenceNavigation) return;
      motion.referenceJumping = true;
      motion.referenceReturn.value = null;
      const container = view.reader.value,
        style = getComputedStyle(container);
      if (view.fitMode.value === 'manual')
        view.zoom.value = destinationScale(
          page,
          target.dest,
          view.zoom.value,
          container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
          container.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom),
        );
      await actions.pageNavigation.go(target.pageNumber);
      if (documentToken !== session.epoch || request !== motion.referenceNavigation) return;
      const el = view.reader.value,
        host = renderState.pageEls.get(target.pageNumber);
      if (!el || !host) return;
      const point = destinationPoint(page, target.dest, view.zoom.value),
        rect = host.getBoundingClientRect(),
        bounds = el.getBoundingClientRect();
      el.scrollLeft += rect.left + point.x - bounds.left - el.clientLeft;
      el.scrollTop += rect.top + point.y - bounds.top - el.clientTop;
      motion.referenceReturn.value = { origin, targetPage: target.pageNumber };
      actions.readerViewport.viewportPages();
      actions.readerViewport.scheduleViewport();
      actions.readingPosition.scheduleReadingSave();
    } catch (e) {
      if (documentToken === session.epoch) actions.rootActions.annotationNotice(e.message);
    } finally {
      motion.referenceJumping = false;
    }
  }

  async function returnFromReference() {
    const entry = motion.referenceReturn.value;
    if (!entry) return;
    motion.referenceReturn.value = null;
    motion.referenceNavigation++;
    session.restoringView.value = true;
    try {
      await actions.readingPosition.restoreReadingView(entry.origin);
    } finally {
      session.restoringView.value = false;
    }
    actions.readerViewport.viewportPages();
    actions.readerViewport.scheduleViewport();
    actions.readingPosition.scheduleReadingSave();
  }

  async function navigateFromSidebar(target) {
    const page = typeof target === 'number' ? target : target?.page;
    if (!session.pages.value[page - 1]) return;
    const origin = actions.readingPosition.readingView();
    if (!origin) return;
    const documentToken = session.epoch,
      request = ++motion.referenceNavigation;
    motion.referenceJumping = true;
    motion.referenceReturn.value = null;
    try {
      if (typeof target === 'number') await actions.pageNavigation.go(page);
      else await locateAnnotation(target);
      await nextTick();
      if (documentToken !== session.epoch || request !== motion.referenceNavigation) return;
      motion.referenceReturn.value = { origin, targetPage: page };
      actions.readerViewport.viewportPages();
      actions.readerViewport.scheduleViewport();
      actions.readingPosition.scheduleReadingSave();
    } finally {
      motion.referenceJumping = false;
    }
  }

  async function locateAnnotation(a) {
    const token = session.epoch,
      p = session.pages.value[a.page - 1];
    if (!p) return;
    shell.selectedAnnotation.value = null;
    preferences.interactionMode.value = 'reading';
    shell.showAnnotations.value = true;
    view.showTranslations.value = a.origin === 'translation';
    for (const block of p.blocks) block.translated = a.origin === 'translation';
    await actions.pageNavigation.go(a.page);
    if (token !== session.epoch) return;
    const host = renderState.pageEls.get(a.page),
      el = view.reader.value,
      box = a.rects[0];
    if (host && el && box) {
      const bounds = el.getBoundingClientRect(),
        rect = host.getBoundingClientRect();
      el.scrollTop += rect.top + box.y * view.zoom.value - bounds.top - el.clientHeight * 0.35;
      el.scrollLeft += rect.left + box.x * view.zoom.value - bounds.left - el.clientWidth * 0.25;
      actions.readerViewport.scheduleViewport();
    }
    shell.selectedAnnotation.value = a.id;
  }
  return {
    loadOutline,
    followReference,
    returnFromReference,
    navigateFromSidebar,
    locateAnnotation,
  };
}
