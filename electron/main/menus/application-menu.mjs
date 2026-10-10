import { BrowserWindow as ElectronBrowserWindow, Menu as ElectronMenu, dialog } from 'electron';
import { createPDFApplicationService } from '../services/pdf-applications.mjs';
import { aboutPanelOptions } from '../services/about-panel.mjs';
import { createDocumentFileActions } from '../services/document-file-actions.mjs';
import { shortcutCatalog, effectiveShortcutBindings } from '../../../shared/commands/shortcuts.mjs';

export function createApplicationMenu({
  app,
  BrowserWindow = ElectronBrowserWindow,
  Menu = ElectronMenu,
  platform,
  smoke,
  registry,
  preferences,
  recents,
  validateSystemPDF,
  openDocumentWindow,
  createWindow,
  handleBackendFailure,
  hideNativeMenuBar,
  resolveUILanguage,
  menuLabel,
  commandAccelerator,
  closeWindowAccelerator,
  serializeApplicationMenu,
  menuPathItems,
  pdfApplications = createPDFApplicationService({ platform, app }),
  fileActions: suppliedFileActions,
}) {
  const fileActions =
    suppliedFileActions ||
    createDocumentFileActions({
      app,
      platform,
      registry,
      documentPath: (target) => documentPath(target),
      validateSystemPDF,
    });
  let applicationMenu = null;
  let menuActions = new Map();
  const applicationCache = new Map();
  const applicationRequests = new Set();
  const documentPath = (target) => {
    const state = registry.stateFor(target);
    const source = state?.unkeyedAnnotationSource;
    return state?.performance.hasDocument && source?.reliable && typeof source.path === 'string'
      ? source.path
      : null;
  };
  const refreshApplications = (target) => {
    const path = documentPath(target);
    if (!path || applicationRequests.has(path)) return;
    const cached = applicationCache.get(path);
    if (cached && Date.now() - cached.time < 30000) return;
    applicationRequests.add(path);
    void pdfApplications
      .list(path)
      .catch(() => [])
      .then((items) => {
        applicationCache.set(path, { items, time: Date.now() });
        if (applicationCache.size > 16)
          applicationCache.delete(applicationCache.keys().next().value);
        applicationRequests.delete(path);
        // A query may finish after its document or window has closed.
        if (documentPath(focusedWindow()) === path) rebuild();
      });
  };
  const externalApplicationItems = () => {
    const path = documentPath(focusedWindow());
    const choices = applicationCache.get(path)?.items || [];
    if (!choices.length)
      return [
        { id: 'file-other-app-empty', label: 'No PDF Applications Available', enabled: false },
      ];
    return choices.map((choice, index) => ({
      id: `file-other-app-${index}`,
      label: choice.name,
      click: async (_item, target) => {
        const receiver = target || focusedWindow();
        const currentPath = documentPath(receiver);
        if (!currentPath) return;
        const source = registry.stateFor(receiver)?.unkeyedAnnotationSource;
        const stillCurrent = () =>
          !receiver.isDestroyed() &&
          documentPath(receiver) === currentPath &&
          registry.stateFor(receiver)?.unkeyedAnnotationSource === source;
        try {
          await validateSystemPDF(currentPath);
          if (!stillCurrent()) return;
          await receiver.webContents.executeJavaScript('window.previewSaveReadingView?.()');
          if (!stillCurrent()) return;
          const kind = await receiver.webContents.executeJavaScript(
            'window.previewCurrentFileKind?.()',
          );
          if (!stillCurrent()) return;
          const path = await fileActions.resolvePath(
            receiver,
            kind === 'translated' ? 'translated' : 'original',
          );
          if (!path || !stillCurrent()) return;
          await pdfApplications.open(choice, path);
        } catch (error) {
          dialog.showErrorBox('PDFMathReader', error.message);
        }
      },
    }));
  };

  const focusedWindow = () => registry.focusedWindow();
  const updateMenu = (target) => {
    refreshApplications(target);
    const external = (applicationMenu || Menu.getApplicationMenu())?.getMenuItemById(
      'file-other-app',
    );
    if (external) external.enabled = !!documentPath(target);
    const currentMenu = applicationMenu || Menu.getApplicationMenu();
    for (const kind of ['original', 'translated']) {
      const enabled =
        !!documentPath(target) &&
        (kind === 'original' || registry.stateFor(target)?.translatedFileReady === true);
      for (const action of ['reveal', 'airdrop']) {
        const entry = currentMenu?.getMenuItemById(`file-${action}-${kind}`);
        if (entry) entry.enabled = enabled;
      }
    }
    const state = registry.stateFor(target)?.preferences;
    if (!state) return;
    const menu = applicationMenu || Menu.getApplicationMenu();
    if (!menu) return;
    const item = (id) => menu.getMenuItemById(id);
    const layout = item('layout-' + (state.direction || 'vertical'));
    const columns = item('columns-' + (state.columns || 1));
    if (layout) layout.checked = true;
    for (const count of [1, 2, 4]) {
      const choice = item('columns-' + count);
      if (choice) choice.enabled = state.direction !== 'horizontal';
    }
    if (columns) columns.checked = true;
    for (const id of ['edit-rotate-page', 'edit-align-width', 'edit-align-height']) {
      const choice = item(id);
      if (choice) choice.enabled = !!registry.stateFor(target)?.performance.hasDocument;
    }
  };
  const normalizeMenuPath = (value) => {
    const path = Array.isArray(value) ? value : typeof value === 'string' ? [value] : null;
    if (
      !path ||
      path.length === 0 ||
      path.length > 32 ||
      !path.every(
        (segment) =>
          (Number.isSafeInteger(segment) && segment >= 0 && segment <= 10000) ||
          (typeof segment === 'string' && /^[\da-z][\da-z:._-]{0,127}$/i.test(segment)),
      )
    )
      throw Error('Invalid menu path.');
    return path;
  };
  const activateMenuItem = (item, target) => {
    if (!item || item.visible === false) throw Error('Menu item not found.');
    if (item.type === 'separator' || item.enabled === false)
      throw Error('Menu item is not actionable.');
    if (item.submenu?.items?.length && !item.click) throw Error('Menu item opens a submenu.');
    const authoredAction = menuActions.get(item.id);
    if (authoredAction) {
      authoredAction(item, target, undefined);
      return true;
    }
    const role = String(item.role || '');
    const contents = target?.webContents;
    const normalizedRole = role.toLowerCase();
    if (normalizedRole === 'about') {
      app.showAboutPanel?.();
      return true;
    }
    if (normalizedRole === 'quit') {
      app.quit();
      return true;
    }
    if (normalizedRole === 'close') {
      target.close();
      return true;
    }
    if (normalizedRole === 'minimize') {
      target.minimize();
      return true;
    }
    if (normalizedRole === 'maximize') {
      target.isMaximized() ? target.unmaximize() : target.maximize();
      return true;
    }
    if (normalizedRole === 'togglefullscreen') {
      target.setFullScreen(!target.isFullScreen());
      return true;
    }
    const roleMethod = {
      copy: 'copy',
      cut: 'cut',
      paste: 'paste',
      selectall: 'selectAll',
      undo: 'undo',
      redo: 'redo',
      reload: 'reload',
      forcereload: 'reloadIgnoringCache',
    }[normalizedRole];
    if (contents && roleMethod && typeof contents[roleMethod] === 'function') {
      contents[roleMethod]();
      return true;
    }
    throw Error('Menu item is not actionable.');
  };

  const commandId = (action) =>
    `action-${String(action)
      .replace(/[^a-z\d]+/gi, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase()}`;
  const command = (label, accelerator, action, id = commandId(action)) => ({
    id,
    label,
    accelerator,
    click: (_item, target) => {
      const receiver = target || focusedWindow();
      receiver?.webContents.send('reader:action', action);
    },
  });
  const accelerator = (key) => commandAccelerator(platform, key);
  const recentDocumentItems = () => {
    const entries = recents?.list() || [];
    if (!entries.length)
      return [{ id: 'file-recents-empty', label: 'No Recent Documents', enabled: false }];
    return entries.map((entry) => ({
      id: 'recent-document-' + entry.id,
      label: entry.name,
      click: async (_item, target) => {
        try {
          const path = recents.path(entry.id);
          if (!path) throw Error('Document no longer in history.');
          await validateSystemPDF(path);
          await openDocumentWindow(path, target || focusedWindow());
        } catch (error) {
          dialog.showErrorBox('PDFMathReader', error.message);
        }
      },
    }));
  };
  const optionMenu = () => {
    const focused = BrowserWindow.getFocusedWindow();
    const target = registry.windows.has(focused) ? focused : focusedWindow();
    const registryOptions = registry.stateFor(target)?.menuOptions || {};
    return Object.entries({
      engine: 'Kernel',
      sourceLanguage: 'Source Language',
      language: 'Target Language',
      provider: 'Service Provider',
      uiLanguage: 'Interface Language',
    }).map(([group, label]) => ({
      id: 'translation-options-' + group,
      label,
      enabled: !!registryOptions[group]?.options.length,
      submenu: (registryOptions[group]?.options || []).map((choice, index) => ({
        id: `translation-choice-${group}-${index}`,
        label: choice.label,
        type: 'radio',
        checked: choice.value === registryOptions[group].selected,
        click: (_item, targetWindow) => {
          const receiver =
            targetWindow && registry.windows.has(targetWindow) ? targetWindow : target;
          if (!receiver || receiver.isDestroyed()) return;
          if (
            !registry
              .stateFor(receiver)
              ?.menuOptions?.[group]?.options.some((item) => item.value === choice.value)
          )
            return;
          receiver.webContents.send('reader:action', 'menu-option', {
            group,
            value: choice.value,
          });
        },
      })),
    }));
  };

  const rebuild = () => {
    const template = [
      {
        id: 'app-menu',
        label: smoke ? app.name : 'PDFMathReader',
        submenu: [
          { id: 'app-about', role: 'about' },
          command('Settings…', accelerator(','), 'settings', 'app-settings'),
          { type: 'separator' },
          { id: 'app-quit', role: 'quit' },
        ],
      },
      {
        id: 'file-menu',
        label: 'File',
        submenu: [
          {
            id: 'file-new-window',
            label: 'New Window',
            accelerator: accelerator('N'),
            click: () => {
              void createWindow().catch(handleBackendFailure);
            },
          },
          command('Open PDF…', accelerator('O'), 'open', 'file-open'),
          { type: 'separator' },
          { id: 'file-recents', label: 'Recent Documents', enabled: false },
          ...recentDocumentItems(),
          { type: 'separator' },
          {
            id: 'file-other-app',
            label: 'Continue Reading in Another App',
            enabled: !!documentPath(focusedWindow()),
            submenu: externalApplicationItems(),
          },
          ...(platform === 'darwin'
            ? [
                { type: 'separator' },
                ...['reveal', 'airdrop'].flatMap((action) =>
                  ['original', 'translated'].map((kind) => ({
                    id: `file-${action}-${kind}`,
                    label:
                      action === 'reveal'
                        ? `View ${kind === 'original' ? 'Original' : 'Translated'} File in Finder`
                        : `AirDrop ${kind === 'original' ? 'Original' : 'Translated'} File`,
                    enabled: false,
                    click: async (_item, target) => {
                      try {
                        await fileActions.perform(target || focusedWindow(), kind, action);
                      } catch (error) {
                        dialog.showErrorBox('PDFMathReader', error.message);
                      }
                    },
                  })),
                ),
                { type: 'separator' },
              ]
            : []),
          command('Close Document', accelerator('W'), 'close-document', 'file-close-document'),
          {
            id: 'file-close-window',
            label: 'Close Window',
            accelerator: closeWindowAccelerator(platform),
            click: (_item, target) => (target || focusedWindow())?.close(),
          },
        ],
      },
      {
        id: 'edit-menu',
        label: 'Edit',
        submenu: [
          command('Preference', undefined, 'preferences', 'edit-preferences'),
          { type: 'separator' },
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            ...command('Rotate Current Page', undefined, 'page-edit:rotate', 'edit-rotate-page'),
            enabled: false,
          },
          {
            ...command('Align Page Widths', undefined, 'page-edit:align-width', 'edit-align-width'),
            enabled: false,
          },
          {
            ...command(
              'Align Page Heights',
              undefined,
              'page-edit:align-height',
              'edit-align-height',
            ),
            enabled: false,
          },
        ],
      },
      {
        id: 'view-menu',
        label: 'View',
        submenu: [
          command('Find…', accelerator('F'), 'search', 'view-search'),
          command(
            'Show Original / Translation',
            accelerator('R'),
            'translation',
            'view-translation',
          ),
          command('Zoom In', accelerator('='), 'zoom-in', 'view-zoom-in'),
          command('Zoom Out', accelerator('-'), 'zoom-out', 'view-zoom-out'),
          command('Fit Width', accelerator('0'), 'fit-width', 'view-fit-width'),
          command('Fit Height', accelerator('9'), 'fit-height', 'view-fit-height'),
          command('Toggle Sidebar', accelerator('B'), 'sidebar', 'view-sidebar'),
          { type: 'separator' },
          { id: 'view-crop', label: 'Page Crop', enabled: false },
          command('Crop More Horizontally', undefined, 'crop:x:more', 'crop-x-more'),
          command('Crop Less Horizontally', undefined, 'crop:x:less', 'crop-x-less'),
          command('Crop More Vertically', undefined, 'crop:y:more', 'crop-y-more'),
          command('Crop Less Vertically', undefined, 'crop:y:less', 'crop-y-less'),
          command('Reset Crop', undefined, 'crop:reset', 'crop-reset'),
          { type: 'separator' },
          { id: 'view-layout', label: 'Layout', enabled: false },
          ...['vertical', 'horizontal'].map((direction) => ({
            id: 'layout-' + direction,
            label: direction === 'vertical' ? 'Vertical' : 'Horizontal',
            type: 'radio',
            checked: direction === 'vertical',
            click: (_item, target) =>
              (target || focusedWindow())?.webContents.send('reader:action', 'layout:' + direction),
          })),
          { type: 'separator' },
          { label: 'Pages per Row', id: 'layout-columns', enabled: false },
          ...[1, 2, 4].map((columns) => ({
            id: 'columns-' + columns,
            label: { 1: 'One Side', 2: 'Two Sides', 4: 'Quad Side' }[columns],
            accelerator: accelerator(columns === 4 ? 3 : columns),
            type: 'radio',
            checked: columns === 1,
            click: (_item, target) =>
              (target || focusedWindow())?.webContents.send('reader:action', 'columns:' + columns),
          })),
          { type: 'separator' },
          { id: 'view-fullscreen', role: 'togglefullscreen' },
        ],
      },
      {
        id: 'go-menu',
        label: 'Go',
        submenu: [
          command('Previous Page', undefined, 'page-previous', 'go-previous'),
          command('Next Page', undefined, 'page-next', 'go-next'),
          command('First Page', undefined, 'page-first', 'go-first'),
          command('Last Page', undefined, 'page-last', 'go-last'),
          { type: 'separator' },
          ...Array.from({ length: 9 }, (_, i) =>
            command(
              `Go to ${(i + 1) * 10}%`,
              accelerator('Shift+' + (i + 1)),
              `percent:${(i + 1) * 10}`,
              `go-percent-${(i + 1) * 10}`,
            ),
          ),
          command('Go to 100%', accelerator('Shift+0'), 'percent:100', 'go-percent-100'),
        ],
      },
      {
        id: 'translation-menu',
        label: 'Translation',
        submenu: [
          ...optionMenu(),
          { type: 'separator' },
          command(
            'Force Retranslate',
            undefined,
            'force-retranslate',
            'translation-force-retranslate',
          ),
          command('Choose Language…', accelerator('L'), 'language', 'translation-language'),
          command('Choose Kernel…', accelerator('K'), 'kernel', 'translation-kernel'),
        ],
      },
      ...(platform === 'win32' ? [] : [{ id: 'window-menu', role: 'windowMenu' }]),
    ];
    const locale = resolveUILanguage(
      preferences?.load?.().uiLanguage || 'en',
      app.getPreferredSystemLanguages()[0] || app.getLocale(),
    );
    app.setAboutPanelOptions?.(aboutPanelOptions(app.getVersion?.() || '', locale));
    const localize = (items) =>
      items.map((item) => ({
        ...item,
        ...(item.label
          ? {
              label:
                item.id?.startsWith('recent-document-') ||
                (item.id?.startsWith('file-other-app-') && item.id !== 'file-other-app-empty') ||
                item.id?.startsWith('translation-choice-')
                  ? item.label
                  : menuLabel(item.label, locale),
            }
          : {}),
        ...(Array.isArray(item.submenu) ? { submenu: localize(item.submenu) } : {}),
      }));
    let platformTemplate = template;
    if (['win32', 'linux'].includes(platform)) {
      const appItems = template.find((item) => item.id === 'app-menu').submenu;
      const fileItems = template.find((item) => item.id === 'file-menu').submenu;
      const promotedIds = ['file-open', 'app-settings'];
      const promoted = promotedIds.map((id) =>
        [...fileItems, ...appItems].find((item) => item.id === id),
      );
      platformTemplate = [
        ...promoted,
        { type: 'separator' },
        ...template
          .filter((item) => item.id !== 'app-menu')
          .map((item) =>
            item.id === 'file-menu'
              ? { ...item, submenu: fileItems.filter((entry) => !promotedIds.includes(entry.id)) }
              : item,
          ),
        { type: 'separator' },
        ...appItems.filter((item) => item.type !== 'separator' && !promotedIds.includes(item.id)),
      ];
    }
    const bindings = effectiveShortcutBindings(
      platform,
      preferences?.load?.().shortcutBindings || {},
    );
    const catalog = shortcutCatalog(platform);
    const bind = (items) =>
      items.map((item) => {
        const entry = catalog.find((entry) => entry.menuId === item.id);
        // Display every binding, but route keyboard input through our shared
        // dispatcher so editable fields and shortcut recording retain focus.
        const binding = entry ? bindings[entry.id][0] : undefined;
        const accelerator = binding;
        return {
          ...item,
          ...(entry
            ? {
                accelerator,
                registerAccelerator: false,
                ...(item.role === 'togglefullscreen'
                  ? {
                      role: undefined,
                      label: 'Toggle Full Screen',
                      click: (_item, target) => {
                        const receiver = target || focusedWindow();
                        receiver?.setFullScreen(!receiver.isFullScreen());
                      },
                    }
                  : {}),
              }
            : {}),
          ...(Array.isArray(item.submenu) ? { submenu: bind(item.submenu) } : {}),
        };
      });
    const localized = localize(bind(platformTemplate));
    const actions = new Map();
    const indexActions = (items) => {
      for (const item of items) {
        if (item.id && typeof item.click === 'function') actions.set(item.id, item.click);
        if (Array.isArray(item.submenu)) indexActions(item.submenu);
      }
    };
    indexActions(localized);
    menuActions = actions;
    applicationMenu = Menu.buildFromTemplate(localized);
    Menu.setApplicationMenu(platform === 'win32' || platform === 'linux' ? null : applicationMenu);
    if (platform === 'win32' || platform === 'linux')
      for (const target of registry.windows.keys()) hideNativeMenuBar(target);
    updateMenu(focusedWindow());
  };

  return {
    rebuild,
    updateMenu,
    normalizeMenuPath,
    activateMenuItem,
    pathItems: (path) => menuPathItems(applicationMenu, path),
    serialize: () => serializeApplicationMenu(applicationMenu),
    getApplicationMenu: () => applicationMenu,
  };
}
