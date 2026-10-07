import { nextTick } from 'vue';

export function createReaderPopovers({ session, shell, runtime, feedback, kernel, actions }) {
  function dismissPopovers() {
    if (shell.settingsWindowMode) return;
    shell.windowsMenu.value?.close();
    shell.settings.value = false;
    shell.selectedParagraph.value = null;
    runtime.kernelFocusPending = false;
    feedback.error.value = '';
  }

  function outsidePopover(e) {
    if (e.type === 'focusin' && runtime.kernelFocusPending && kernel.engineBusy.value) return;
    if (
      e.target instanceof Element &&
      e.target.closest(
        '.document-search,[data-popover-trigger],.settings,.error-banner,.macvue-pop-up-button-content',
      )
    )
      return;
    dismissPopovers();
  }

  function popoverFocusOut(e) {
    if (runtime.kernelFocusPending && kernel.engineBusy.value) return;
    if (
      e.relatedTarget &&
      !e.currentTarget.contains(e.relatedTarget) &&
      !e.relatedTarget.closest?.('.macvue-pop-up-button-content')
    )
      dismissPopovers();
  }

  function editableTarget(target = document.activeElement) {
    return (
      !!target?.matches?.('input,textarea,select,[contenteditable="true"]') ||
      target?.isContentEditable === true
    );
  }

  function focusSidebarItem(e) {
    e.target
      .closest?.('.thumb,.sidebar-outline-item,.sidebar-outline-toggle,.sidebar-annotation-item')
      ?.focus({ preventScroll: true });
  }

  async function sidebarKeyboard(e) {
    if (
      e.defaultPrevented ||
      !['ArrowUp', 'ArrowDown'].includes(e.key) ||
      e.metaKey ||
      e.ctrlKey ||
      e.altKey ||
      e.shiftKey ||
      editableTarget(e.target)
    )
      return;
    const root = e.currentTarget,
      focused = e.target.closest?.(
        '.thumb,.sidebar-outline-item,.sidebar-outline-toggle,.sidebar-annotation-item',
      );
    if (!focused || !root.contains(focused)) return;
    e.preventDefault();
    e.stopPropagation();
    const step = e.key === 'ArrowDown' ? 1 : -1,
      token = session.epoch;
    let next;
    if (focused.matches('.thumb')) {
      const number = Number(focused.dataset.pageNumber),
        target = Math.max(1, Math.min(session.pages.value.length, number + step));
      if (target === number) return;
      // Scroll the full page list first so virtualized neighbours are mounted.
      actions.thumbnails.scrollThumbnailTo(target);
      await nextTick();
      if (token !== session.epoch || !root.contains(document.activeElement)) return;
      next = root.querySelector('.thumb[data-page-number="' + target + '"]');
    } else {
      const selector = focused.matches('.sidebar-annotation-item')
        ? '.sidebar-annotation-item'
        : '.sidebar-outline-item';
      const current = focused.matches('.sidebar-outline-toggle')
        ? focused.closest('.sidebar-outline-row')?.querySelector('.sidebar-outline-item')
        : focused;
      const items = [...root.querySelectorAll(selector)].filter((item) => !item.disabled),
        index = items.indexOf(current);
      if (index < 0) return;
      next = items[index + step];
    }
    if (!next) return;
    next.focus({ preventScroll: true });
    if (!next.matches('.thumb')) next.scrollIntoView({ block: 'nearest' });
    next.click();
  }
  return {
    dismissPopovers,
    outsidePopover,
    popoverFocusOut,
    editableTarget,
    focusSidebarItem,
    sidebarKeyboard,
  };
}
