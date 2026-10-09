/* eslint-disable no-control-regex */

export function registerWindowIPC({
  handle,
  trustedWindow,
  registry,
  menu,
  windowActive,
  updateWindowButtons,
  validateSystemPDF,
  openDocumentWindow,
  openSettingsWindow,
  createWindow,
  app,
}) {
  handle('window:translated-file-ready', (event, ready) => {
    const target = trustedWindow(event);
    registry.stateFor(target).translatedFileReady = ready === true;
    menu.updateMenu(target);
    return true;
  });
  handle('window:register-options', (event, value) => {
    const target = trustedWindow(event);
    const options = {};
    for (const group of ['engine', 'sourceLanguage', 'language', 'provider', 'uiLanguage']) {
      const entry = value?.[group];
      if (!entry || !Array.isArray(entry.options) || entry.options.length > 100)
        throw Error('Invalid menu options.');
      if (typeof entry.selected !== 'string' || entry.selected.length > 128)
        throw Error('Invalid menu selection.');
      const seen = new Set();
      const choices = entry.options.map((option) => {
        if (
          !option ||
          typeof option.value !== 'string' ||
          !option.value ||
          option.value.length > 128 ||
          typeof option.label !== 'string' ||
          !option.label ||
          option.label.length > 200 ||
          /[\r\n\x00]/.test(option.label) ||
          seen.has(option.value)
        )
          throw Error('Invalid menu option.');
        seen.add(option.value);
        return { value: option.value, label: option.label };
      });
      options[group] = { selected: entry.selected, options: choices };
    }
    const state = registry.stateFor(target);
    const changed = JSON.stringify(state.menuOptions) !== JSON.stringify(options);
    state.menuOptions = options;
    if (changed && (target.isFocused() || target === registry.focusedWindow())) menu.rebuild();
    return true;
  });
  handle('window:menu', (event) => {
    const target = trustedWindow(event);
    menu.updateMenu(target);
    return menu.serialize();
  });
  handle('window:menu-action', (event, path) => {
    const target = trustedWindow(event);
    const items = menu.pathItems(menu.normalizeMenuPath(path));
    if (!items || items.some((item) => item.visible === false || item.enabled === false))
      throw Error('Menu item is disabled.');
    menu.activateMenuItem(items.at(-1), target);
    menu.updateMenu(target);
    return true;
  });
  handle('window:minimize', (event) => {
    const target = trustedWindow(event);
    target.minimize();
    return true;
  });
  handle('window:maximize', (event) => {
    const target = trustedWindow(event);
    if (target.isMaximized()) target.unmaximize();
    else target.maximize();
    return target.isMaximized();
  });
  handle('window:maximized', (event) => trustedWindow(event).isMaximized());
  handle('window:close', (event) => {
    const target = trustedWindow(event);
    target.close();
    return true;
  });
  handle('window:close-start-page', (event) => {
    const target = trustedWindow(event);
    target.close();
    if (
      ![...registry.windows].some(
        ([other, state]) =>
          other !== target && (state.performance.hasDocument || state.documents.length),
      )
    )
      app.quit();
    return true;
  });
  handle('window:header-hidden', (event, hidden) => {
    const target = trustedWindow(event);
    if (typeof hidden !== 'boolean') throw Error('Invalid header state');
    registry.stateFor(target).headerHidden = hidden;
    updateWindowButtons(target);
  });
  handle('window:fullscreen', (event) => trustedWindow(event).isFullScreen());
  handle('window:activity', (event) => {
    const target = trustedWindow(event);
    return windowActive(target);
  });
  handle('documents:open', async (event, value) => {
    const target = trustedWindow(event);
    if (typeof value?.path === 'string') {
      await validateSystemPDF(value.path);
      await openDocumentWindow(value.path, target);
    } else {
      if (
        !value ||
        typeof value.name !== 'string' ||
        !(value.bytes instanceof Uint8Array) ||
        value.bytes.byteLength > 50 * 1024 * 1024
      )
        throw Error('Invalid PDF.');
      await openDocumentWindow({ name: value.name, bytes: value.bytes }, target);
    }
    return true;
  });
  handle('window:settings', async (event, section) => {
    await openSettingsWindow(trustedWindow(event), section);
    return true;
  });
  handle('window:new', async (event) => {
    trustedWindow(event);
    await createWindow();
  });
}
