import { thumbnailFactor, thumbnailScale } from './reader-layout.mjs';

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
    // While the sidebar is dragged the canvases stretch with CSS; the sharp
    // raster is drawn once the drag ends.
    if (!activity.foreground.value || motion.fitResizing || motion.sidebarDrag) return;
    const token = ++renderState.thumbnailEpoch,
      documentToken = session.epoch;
    const numbers = [...renderState.visibleThumbnails];
    let next = 0;
    const current = () =>
      token === renderState.thumbnailEpoch &&
      documentToken === session.epoch &&
      session.pdf &&
      activity.foreground.value;
    // Scanned pages may take much longer to decode than their neighbours.
    // Keep thumbnails independent of the reader's scroll preview and bound
    // parallel work so a slow image does not leave the whole sidebar blank.
    await Promise.all(
      Array.from({ length: Math.min(2, numbers.length) }, async () => {
        while (next < numbers.length && current()) {
          const n = numbers[next++],
            p = session.pages.value[n - 1],
            canvas = renderState.thumbEls.get(n);
          if (!p || !canvas) continue;
          const page = await session.pdf.getPage(n);
          if (!current()) return;
          if (renderState.visibleThumbnails.has(n) && renderState.thumbEls.get(n) === canvas)
            await actions.canvasRendering.draw(
              page,
              canvas,
              thumbnailScale(
                p,
                thumbnailFactor(motion.sidebarWidth?.value, motion.sidebarDefaultWidth),
              ),
            );
        }
      }),
    );
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

  // Keep the first visible thumbnail in place when the sidebar width rescales the list.
  function anchorThumbnails(layout, previous) {
    const root = renderState.thumbnailList.value;
    if (!root || !previous?.frames.length || layout.frames.length !== previous.frames.length)
      return;
    const top = root.scrollTop - parseFloat(getComputedStyle(root).paddingTop),
      index = previous.frames.findIndex((f) => f.offset + f.height + 14 > top);
    if (index < 0) return;
    const before = previous.frames[index],
      after = layout.frames[index],
      ratio = Math.max(0, top - before.offset) / (before.height + 14);
    root.scrollTop =
      after.offset + ratio * (after.height + 14) + parseFloat(getComputedStyle(root).paddingTop);
    updateThumbnailViewport();
  }
  return {
    bindThumbnail,
    thumbnailScrolling,
    updateThumbnailViewport,
    observeThumbnails,
    renderThumbnails,
    scrollThumbnailTo,
    anchorThumbnails,
  };
}
