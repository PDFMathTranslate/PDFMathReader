import { quickLinkAnchor, quickLinkBox } from './quick-links.mjs';

export function createReaderQuickLinks({
  session,
  motion,
  renderState,
  shell,
  search,
  annotations,
  view,
  actions,
}) {
  function paragraphAnchor(anchorView, box) {
    const p = session.pages.value[anchorView.page - 1];
    if (!p) return null;
    return quickLinkAnchor(p, anchorView, box, anchorView.showTranslations);
  }

  function quickLinkButtons(page) {
    return shell.quickLinks.value.flatMap((link) =>
      ['origin', 'result']
        .filter((side) => link[side].page === page)
        .map((side) => ({ id: link.id + side, link, side, anchor: link[side] })),
    );
  }

  async function createQuickReturn() {
    const entry = motion.referenceReturn.value,
      hit = search.searchHit.value;
    if (!entry || !hit || !search.searchOpen.value) return;
    const origin = paragraphAnchor(entry.origin),
      result = paragraphAnchor(
        { ...actions.readingPosition.readingView(), page: hit.page },
        hit.boxes[0],
      );
    if (!origin || !result) return;
    const link = { id: crypto.randomUUID(), origin, result };
    const duplicate = shell.quickLinks.value.some(
      (l) =>
        JSON.stringify(l.origin) === JSON.stringify(origin) &&
        JSON.stringify(l.result) === JSON.stringify(result),
    );
    if (!duplicate) {
      shell.quickLinks.value = [...shell.quickLinks.value, link];
      try {
        if (window.previewQuickLinks)
          await window.previewQuickLinks.save(
            annotations.annotationKey.value,
            JSON.parse(JSON.stringify(shell.quickLinks.value)),
          );
        else
          localStorage.setItem(
            'quick-links:' + annotations.annotationKey.value,
            JSON.stringify(shell.quickLinks.value),
          );
      } catch {
        shell.quickLinks.value = shell.quickLinks.value.filter((l) => l.id !== link.id);
        actions.rootActions.notifyCopy('快捷链接保存失败');
        return;
      }
    }
    actions.rootActions.closeSearch();
    await actions.referenceNavigation.returnFromReference();
  }

  async function followQuickLink(button) {
    const anchor = button.link[button.side === 'origin' ? 'result' : 'origin'],
      token = session.epoch;
    actions.rootActions.closeSearch();
    motion.referenceReturn.value = null;
    ++motion.referenceNavigation;
    await actions.pageNavigation.go(anchor.page);
    if (token !== session.epoch) return;
    const p = session.pages.value[anchor.page - 1],
      block = p?.blocks.find((b) => b.id === anchor.blockId),
      box = quickLinkBox(block, view.showTranslations.value) || anchor.box,
      host = renderState.pageEls.get(anchor.page),
      el = view.reader.value;
    if (host && el) {
      const rect = host.getBoundingClientRect(),
        bounds = el.getBoundingClientRect();
      el.scrollTop += rect.top + box.y * view.zoom.value - bounds.top - el.clientHeight * 0.35;
      el.scrollLeft += rect.left + box.x * view.zoom.value - bounds.left - el.clientWidth * 0.25;
    }
    actions.readerViewport.viewportPages();
    actions.readerViewport.scheduleViewport();
    actions.readingPosition.scheduleReadingSave();
  }
  return { paragraphAnchor, quickLinkButtons, createQuickReturn, followQuickLink };
}
