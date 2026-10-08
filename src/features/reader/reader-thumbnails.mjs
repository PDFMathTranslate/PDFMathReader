export function createThumbnails({ renderState, motion, session, shell, activity, view, actions }) {
  function bindThumbnail(number, el) {
    const old = renderState.thumbEls.get(number);
    if (old === el) return;
    if (old) actions.canvasRendering.releaseCanvas(old);
    if (el) {
      renderState.thumbEls.set(number, el);
      el.dataset.thumbnail = number;
    } else renderState.thumbEls.delete(number);
  }

  function thumbnailScrolling(event) {
    actions.readerScroll.showScrollbar(event);
    updateThumbnailViewport();
  }

  function updateThumbnailViewport() {
    const root = renderState.thumbnailList.value;
    if (!root || shell.sidebarMode.value !== 'thumbnails' || !root.clientHeight) return;
    renderState.thumbnailTop.value = root.scrollTop - parseFloat(getComputedStyle(root).paddingTop);
    renderState.thumbnailHeight.value = root.clientHeight;
  }

  function observeThumbnails() {
    updateThumbnailViewport();
    void renderThumbnails();
  }

  async function renderThumbnails() {
    if (!activity.foreground.value || motion.fitResizing || renderState.previewScrolling) return;
    const token = ++renderState.thumbnailEpoch,
      documentToken = session.epoch;
    for (const n of [...renderState.visibleThumbnails]) {
      if (
        token !== renderState.thumbnailEpoch ||
        documentToken !== session.epoch ||
        !session.pdf ||
        !activity.foreground.value ||
        renderState.previewScrolling
      )
        return;
      const p = session.pages.value[n - 1],
        page = await session.pdf.getPage(n);
      if (token !== renderState.thumbnailEpoch || documentToken !== session.epoch) return;
      if (renderState.visibleThumbnails.has(n))
        await actions.canvasRendering.draw(
          page,
          renderState.thumbEls.get(n),
          Math.min(128 / p.width, 160 / p.height),
        );
    }
  }

  function scrollThumbnailTo(number) {
    const root = renderState.thumbnailList.value,
      item = view.thumbnailLayout.value.frames[number - 1];
    if (!root || !item) return;
    const top = item.offset + parseFloat(getComputedStyle(root).paddingTop),
      bottom = top + item.height;
    if (top < root.scrollTop) root.scrollTop = top;
    else if (bottom > root.scrollTop + root.clientHeight)
      root.scrollTop = bottom - root.clientHeight;
    updateThumbnailViewport();
  }
  return {
    bindThumbnail,
    thumbnailScrolling,
    updateThumbnailViewport,
    observeThumbnails,
    renderThumbnails,
    scrollThumbnailTo,
  };
}
