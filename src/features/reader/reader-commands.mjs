import { selectionSearchQuery } from '../search/document-search.mjs';
import { menuLabel } from '../../../shared/i18n/menu.mjs';
import { uiLanguage } from '../../i18n/index.mjs';
import { shortcutAction } from '../../../shared/commands/shortcuts.mjs';
import { nextTick } from 'vue';

export function createReaderCommands({
  session,
  translationState,
  preferences,
  motion,
  shell,
  view,
  search,
  actions,
}) {
  function readerAction(action, selectionText) {
    if (action === 'force-retranslate') {
      if (!session.pages.value.length || shell.settingsWindowMode) return;
      translationState.forceRetranslation = true;
      preferences.automatic.value = true;
      view.showTranslations.value = true;
      actions.mathTranslation.resetTranslations(true);
      actions.readerScroll.settle();
      return;
    }
    if (action === 'menu-option') {
      actions.nativeMenuOptions.applyMenuOption(selectionText);
      return;
    }
    if (action.startsWith('page-edit:')) {
      void actions.rootActions.editDocumentPages(action.slice(10));
      return;
    }
    if (action.startsWith('crop:')) {
      void actions.readingPosition.changeCrop(action);
      return;
    }
    if (action === 'search-selection') {
      const query = selectionSearchQuery(selectionText);
      if (query && session.pages.value.length) {
        search.searchQuery.value = query;
        void actions.rootActions.openSearch().then(actions.rootActions.scheduleSearch);
      }
      return;
    }
    if (action.startsWith('layout:')) view.direction.value = action.split(':')[1];
    else if (action.startsWith('columns:')) view.columns.value = Number(action.split(':')[1]);
    else if (action === 'close-document') {
      if (shell.settingsWindowMode) actions.settingsNavigation.closeSettingsWindow();
      else void actions.documentLifecycle.closeDocument(true);
    } else if (action === 'recents') {
      if ((session.pages.value.length || session.loading.value) && window.previewWindow?.new)
        void window.previewWindow.new();
      else void actions.documentLifecycle.closeDocument();
    } else if (action === 'preferences') actions.settingsNavigation.openSettings();
    else if (action === 'copy-paragraph') void actions.rootActions.copyHoveredParagraph();
    else if (action === 'search') void actions.rootActions.openSearch();
    else if (action === 'open') shell.fileInput.value?.click();
    else if (action === 'translation') {
      view.showTranslations.value = !view.showTranslations.value;
    } else if (action === 'zoom-in') actions.readerZoom.changeZoom(0.1);
    else if (action === 'zoom-out') actions.readerZoom.changeZoom(-0.1);
    else if (action === 'page-previous') {
      if (session.pages.value.length)
        actions.pageNavigation.go(view.active.value - 1, { animate: true });
    } else if (action === 'page-next') {
      if (session.pages.value.length)
        actions.pageNavigation.go(view.active.value + 1, { animate: true });
    } else if (action === 'sidebar') {
      if (session.pages.value.length) actions.readerFit.toggleSidebar();
    } else if (action === 'settings') {
      if (shell.settingsWindowMode) actions.settingsNavigation.openSettings();
      else
        shell.settings.value
          ? (shell.settings.value = false)
          : actions.settingsNavigation.openSettings();
    } else if (action === 'language' || action === 'kernel')
      actions.settingsNavigation.openSettings(action);
    else if (action === 'fit-width' || action === 'fit-height') {
      if (session.pages.value.length) {
        actions.readerZoom.chooseFit(action === 'fit-width' ? 'width' : 'height');
        actions.rootActions.notifyCopy(
          menuLabel(action === 'fit-width' ? 'Fit Width' : 'Fit Height', uiLanguage.value),
        );
      }
    } else if (action.startsWith('percent:'))
      actions.pageNavigation.go(
        Math.max(1, Math.ceil((session.pages.value.length * Number(action.split(':')[1])) / 100)),
      );
  }

  function keyboard(e) {
    if (e.defaultPrevented) return;
    if (['win32', 'linux'].includes(shell.platform) && e.key === 'F10') {
      e.preventDefault();
      actions.rootActions.revealHeader();
      void shell.windowsMenu.value?.toggle();
      return;
    }
    const editable =
      actions.readerPopovers.editableTarget(e.target) ||
      actions.readerPopovers.editableTarget(document.activeElement);
    if (
      motion.referenceReturn.value &&
      !editable &&
      e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      !e.shiftKey &&
      e.key === 'Backspace'
    ) {
      e.preventDefault();
      void actions.referenceNavigation.returnFromReference();
      return;
    }
    if (
      [
        'ArrowDown',
        'ArrowUp',
        'ArrowLeft',
        'ArrowRight',
        'PageDown',
        'PageUp',
        'Home',
        'End',
        ' ',
      ].includes(e.key) &&
      !editable
    )
      actions.rootActions.immersiveIntent(e);
    if (
      preferences.interactionMode.value === 'comparison' &&
      (shell.platform === 'darwin' ? e.metaKey : e.ctrlKey) &&
      !e.altKey &&
      !e.shiftKey &&
      e.key.toLowerCase() === 'c'
    ) {
      if (editable) return;
      e.preventDefault();
      void actions.rootActions.copyHoveredParagraph();
      return;
    }
    if (e.key === 'Escape') {
      actions.rootActions.closeSearch();
      actions.readerPopovers.dismissPopovers();
      return;
    }
    const nativePageAction =
      session.pages.value.length > 0 &&
      !editable &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      (e.key === 'PageUp' ||
        e.key === 'PageDown' ||
        (e.shiftKey && ['ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight'].includes(e.key)));
    if (nativePageAction) {
      e.preventDefault();
      readerAction(
        e.key === 'PageUp' || e.key === 'ArrowUp' || e.key === 'ArrowLeft'
          ? 'page-previous'
          : 'page-next',
      );
      return;
    }
    const action = shortcutAction(shell.platform, {
      type: 'keyDown',
      key: e.key,
      code: e.code,
      meta: e.metaKey,
      control: e.ctrlKey,
      alt: e.altKey,
      shift: e.shiftKey,
    });
    if (action && action !== 'close-window' && !editable) {
      e.preventDefault();
      readerAction(action);
    }
  }

  function headerDoubleClick(event) {
    if (
      !['win32', 'linux'].includes(shell.platform) ||
      !shell.desktopWindow ||
      shell.immersiveHeaderHidden.value
    )
      return;
    if (
      event.target.closest(
        'button,input,select,a,fluent-button,.windows-menu,.windows-window-controls,.toolbar-actions',
      )
    )
      return;
    void shell.desktopWindow.maximize();
  }

  function toolbarHint(description, key) {
    return key
      ? `${description} (${shell.platform === 'darwin' ? '⌘' + key : 'Ctrl+' + key})`
      : description;
  }

  function modeKeys(e) {
    let i = shell.translationModes.findIndex((m) => m.id === preferences.translationMode.value);
    if (e.key === 'ArrowLeft' || e.key === 'Home') i = 0;
    else if (e.key === 'ArrowRight' || e.key === 'End') i = 1;
    else return;
    e.preventDefault();
    const group = e.currentTarget;
    preferences.translationMode.value = shell.translationModes[i].id;
    nextTick(() => group?.querySelector('.macvue-segment[data-state="on"]')?.focus());
  }
  return { readerAction, keyboard, headerDoubleClick, toolbarHint, modeKeys };
}
