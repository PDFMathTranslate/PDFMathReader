import { nextTick } from 'vue';
import { t } from '../../i18n/index.mjs';

export function createReadingPosition({
  session,
  renderState,
  preferences,
  view: readerView,
  shell,
  feedback,
  annotations,
  actions,
}) {
  function croppedPage(p) {
    return {
      number: p.number,
      width: p.width * (1 - readerView.pageCrop.value.x),
      height: p.height * (1 - readerView.pageCrop.value.y),
    };
  }

  function visiblePageHost(host) {
    return host?.closest('.page-wrap') || host;
  }

  async function changeCrop(action) {
    if (!session.pages.value.length) return;
    const view = readingView(),
      token = session.epoch;
    if (!view) return;
    if (action === 'crop:reset') readerView.pageCrop.value = { x: 0, y: 0 };
    else {
      const [, axis, step] = action.split(':');
      if (!['x', 'y'].includes(axis)) return;
      readerView.pageCrop.value = {
        ...readerView.pageCrop.value,
        [axis]: Math.max(
          0,
          Math.min(
            0.8,
            Math.round((readerView.pageCrop.value[axis] + (step === 'more' ? 0.05 : -0.05)) * 100) /
              100,
          ),
        ),
      };
    }
    await nextTick();
    if (token !== session.epoch) return;
    await restoreReadingView({
      ...view,
      cropX: readerView.pageCrop.value.x,
      cropY: readerView.pageCrop.value.y,
    });
    actions.readerViewport.viewportPages();
    actions.readerViewport.scheduleViewport();
    scheduleReadingSave();
  }

  function readingView() {
    const el = readerView.reader.value,
      p = session.pages.value[readerView.active.value - 1],
      host = p && renderState.pageEls.get(p.number);
    if (!el || !host) return null;
    const bounds = el.getBoundingClientRect(),
      box = visiblePageHost(host).getBoundingClientRect(),
      style = getComputedStyle(el);
    return {
      page: p.number,
      offsetX: Math.max(
        -16,
        Math.min(16, (bounds.left + parseFloat(style.paddingLeft) - box.left) / box.width),
      ),
      offsetY: Math.max(
        -16,
        Math.min(16, (bounds.top + parseFloat(style.paddingTop) - box.top) / box.height),
      ),
      zoom: readerView.zoom.value,
      fit: readerView.fitMode.value,
      direction: readerView.direction.value,
      columns: readerView.columns.value,
      sidebar: readerView.sidebar.value,
      sidebarMode: shell.sidebarMode.value,
      showTranslations: readerView.showTranslations.value,
      cropX: readerView.pageCrop.value.x,
      cropY: readerView.pageCrop.value.y,
    };
  }

  async function saveReadingView() {
    clearTimeout(session.readingSaveTimer);
    if (session.restoringView.value || session.loading.value) return;
    const view = readingView();
    if (view)
      try {
        if (session.currentRecentId) {
          const id = session.currentRecentId,
            status = actions.rootActions.translationSnapshot();
          await window.previewRecents?.setView(id, view);
          await window.previewRecents?.setTranslationStatus?.(id, status);
        }
        await window.previewDocuments?.saveView(view);
      } catch {
        feedback.error.value = t('error.saveReadingPosition');
      }
  }

  function scheduleReadingSave() {
    if (session.restoringView.value || session.loading.value || !session.currentRecentId) return;
    clearTimeout(session.readingSaveTimer);
    session.readingSaveTimer = setTimeout(saveReadingView, 180);
  }

  async function restoreReadingView(view) {
    readerView.pageCrop.value = {
      x:
        view?.cropX ??
        (preferences.defaultPageCropEnabled.value ? preferences.defaultPageCropX.value : 0),
      y:
        view?.cropY ??
        (preferences.defaultPageCropEnabled.value ? preferences.defaultPageCropY.value : 0),
    };
    shell.sidebarMode.value =
      view?.sidebarMode === 'outline' && shell.documentOutline.value.length
        ? 'outline'
        : view?.sidebarMode === 'annotations' && annotations.annotations.value.length
          ? 'annotations'
          : 'thumbnails';
    if (view) {
      readerView.direction.value = view.direction;
      readerView.columns.value = view.columns;
      readerView.sidebar.value = view.sidebar;
      readerView.showTranslations.value = view.showTranslations;
      readerView.fitMode.value = view.fit;
      readerView.zoom.value = view.zoom;
      readerView.active.value = Math.min(session.pages.value.length, Math.max(1, view.page));
      readerView.pageEntry.value = readerView.active.value;
    }
    actions.readerViewport.mountAroundPage(readerView.active.value);
    await nextTick();
    if (session.documentOpening.value)
      await new Promise((resolve) => requestAnimationFrame(resolve));
    actions.readerFit.applyFit();
    await nextTick();
    actions.readerFit.updateReaderInsets();
    actions.readerFit.applyFit();
    await nextTick();
    const el = readerView.reader.value,
      host = renderState.pageEls.get(readerView.active.value);
    if (!el || !host) return;
    // A page-relative anchor survives viewport, scrollbar and fit-size changes.
    const bounds = el.getBoundingClientRect(),
      box = visiblePageHost(host).getBoundingClientRect(),
      style = getComputedStyle(el);
    el.scrollLeft +=
      box.left - bounds.left - parseFloat(style.paddingLeft) + (view?.offsetX || 0) * box.width;
    el.scrollTop +=
      box.top - bounds.top - parseFloat(style.paddingTop) + (view?.offsetY || 0) * box.height;
  }
  return {
    croppedPage,
    visiblePageHost,
    changeCrop,
    readingView,
    saveReadingView,
    scheduleReadingSave,
    restoreReadingView,
  };
}
