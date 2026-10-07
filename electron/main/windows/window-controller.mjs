import { applicationPath } from '../../../runtime/node/application-paths.mjs';
import { app, BrowserWindow, dialog, Menu, shell } from 'electron';
import { randomBytes } from 'node:crypto';
import { realpathSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function createWindowController({
  app: application = app,
  BrowserWindow: Window = BrowserWindow,
  dialog: dialogApi = dialog,
  Menu: MenuApi = Menu,
  shell: shellApi = shell,
  registry,
  windowPerformance,
  smoke,
  ciLaunchCheck,
  ciLaunchTimeoutMs,
  windowsBuild,
  backgroundRenderSmoke,
  token,
  getBackendOptions,
  getPreferences,
  getDocumentSession,
  developerMonitor,
  startBackendService,
  trackBackendCommunications,
  developerOperationMetrics,
  dependencyProjects,
  windowChromeOptions,
  shortcutAction,
  menuLabel,
  resolveUILanguage,
  handleBackendFailure,
  getRebuildMenu,
  getUpdateMenu,
  updateAppearance,
}) {
  const setWindowVibrancy = (target, reduceTransparency) => {
    if (process.platform === 'win32' && windowsBuild >= 22621) {
      target.setBackgroundMaterial(reduceTransparency ? 'none' : 'acrylic');
      target.setBackgroundColor(reduceTransparency ? '#f7f7f9' : '#00000000');
      return;
    }
    if (process.platform !== 'darwin' || typeof target?.setVibrancy !== 'function') return;
    try {
      target.setVibrancy(reduceTransparency ? null : windowChromeOptions('darwin').vibrancy);
    } catch {}
  };
  const chromeOptions = () => {
    const preferences = getPreferences();
    const options = windowChromeOptions(process.platform, {
      windowsBuild,
      reduceTransparency: !!preferences?.load?.().reduceTransparency,
    });
    if (process.platform === 'darwin' && preferences?.load?.().reduceTransparency)
      delete options.vibrancy;
    return options;
  };
  const updateWindowButtons = (target) => {
    if (process.platform !== 'darwin' || !target || target.isDestroyed()) return;
    const visible = !target.isFullScreen() && !registry.stateFor(target)?.headerHidden;
    target.setWindowButtonVisibility(visible);
    if (visible) target.setWindowButtonPosition(windowChromeOptions('darwin').trafficLightPosition);
  };
  const hideNativeMenuBar = (target) => {
    if (!['win32', 'linux'].includes(process.platform) || !target || target.isDestroyed()) return;
    target.setAutoHideMenuBar?.(true);
    target.setMenuBarVisibility?.(false);
  };
  const saveWindowReadingView = async (target) => {
    if (!target || target.isDestroyed()) return;
    try {
      await target.webContents.executeJavaScript('window.previewSaveReadingView?.()');
    } catch {}
  };
  const documentIdentity = (path) => {
    const canonical = realpathSync(path);
    const info = statSync(canonical, { bigint: true });
    return info.ino ? `${info.dev}:${info.ino}` : canonical;
  };
  const focusDocumentWindow = (target) => {
    if (target.isMinimized()) target.restore();
    if (!backgroundRenderSmoke) {
      target.show();
      target.focus();
    }
    return target;
  };
  const openExternalDocument = async (path) => {
    const target = await openDocumentWindow(path);
    for (const other of registry.windows.keys())
      if (other !== target && registry.isBlankStartPage(other)) other.close();
    return focusDocumentWindow(target);
  };
  const deliverDocumentWindow = async (document, preferredWindow, restoreView, activate) => {
    const identity = typeof document === 'string' ? documentIdentity(document) : null;
    const existing = registry.findDocumentWindow(identity);
    if (existing) return activate ? focusDocumentWindow(existing) : existing;
    if (identity && registry.openingDocuments.has(identity)) {
      const target = await registry.openingDocuments.get(identity);
      return activate ? focusDocumentWindow(target) : target;
    }
    const operation = (async () => {
      const candidates = [preferredWindow, registry.focusedWindow(), ...registry.windows.keys()];
      const target = candidates.find(registry.isBlankStartPage);
      if (!target) return createWindow(document, restoreView, null, 'general', activate);
      const state = registry.stateFor(target);
      state.documentIdentity = identity;
      state.restoreView = restoreView;
      state.documents.push(document);
      state.unkeyedAnnotationSource = registry.annotationSourceForDocument(document);
      state.performance.hasDocument = true;
      target.webContents.send('documents:available');
      return activate ? focusDocumentWindow(target) : target;
    })();
    if (identity) registry.openingDocuments.set(identity, operation);
    try {
      return await operation;
    } finally {
      if (identity) registry.openingDocuments.delete(identity);
    }
  };
  const openDocumentWindow = async (document, preferredWindow, restoreView, activate = true) => {
    const started = globalThis.performance.now();
    try {
      return await deliverDocumentWindow(document, preferredWindow, restoreView, activate);
    } finally {
      developerOperationMetrics.fileOpen(globalThis.performance.now() - started);
    }
  };
  const createWindow = async (
    document,
    restoreView,
    settingsOwner = null,
    settingsSection = 'general',
    activate = true,
  ) => {
    let target;
    const backend = settingsOwner
      ? registry.stateFor(settingsOwner).backend
      : await startBackendService({
          ...getBackendOptions(),
          onCrash: (error) => {
            if (getRuntime().quitting) return;
            if (smoke || ciLaunchCheck) {
              void handleBackendFailure(error);
              return;
            }
            dialogApi.showErrorBox(
              'PDFMathReader',
              'This window’s reader process stopped unexpectedly. Reopen its PDF in a new window.',
            );
            target?.close();
          },
        });
    const preferences = getPreferences();
    target = new Window({
      width: 1200,
      height: 850,
      minWidth: 720,
      minHeight: 500,
      title: settingsOwner ? 'PDFMathReader Settings' : 'PDFMathReader',
      ...(settingsOwner
        ? {
            width: 920,
            height: 780,
            minWidth: 680,
            minHeight: 500,
            parent: settingsOwner,
            modal: false,
          }
        : {}),
      icon: applicationPath('electron', 'AppIcon.png'),
      ...chromeOptions(),
      show: false,
      webPreferences: {
        partition: 'window-' + randomBytes(16).toString('hex'),
        backgroundThrottling:
          (Boolean(smoke) && process.argv.includes('--smoke-background-render')) ||
          ['resize', 'file-open'].includes(smoke)
            ? false
            : preferences.load().reduceBackgroundFrameRate,
        additionalArguments: [
          `--preview-system-locale=${application.getPreferredSystemLanguages()[0] || application.getLocale()}`,
          ...(process.platform === 'win32' && windowsBuild >= 22621
            ? ['--preview-windows-glass']
            : []),
          ...(smoke
            ? [
                '--preview-test-mode',
                ...(smoke === 'settings-native' ? [] : ['--preview-inline-settings']),
              ]
            : []),
          ...(smoke === 'fluent' ? ['--preview-ui-platform=win32'] : []),
          ...(backgroundRenderSmoke ? ['--preview-background-render'] : []),
        ],
        preload: applicationPath('electron', 'preload.cjs'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    if (ciLaunchCheck || smoke) {
      target.webContents.on('console-message', (details) => {
        if (details.level === 'error') console.error('Renderer error:', details.message);
      });
    }
    if (smoke)
      target.webContents.on('dom-ready', () => {
        void target.webContents
          .executeJavaScript(
            "window.addEventListener('unhandledrejection', event => console.error(event.reason?.stack || String(event.reason))); true",
          )
          .catch(() => {});
      });
    hideNativeMenuBar(target);
    registry.windows.set(target, {
      backend,
      settingsOwner,
      restoreView,
      documentIdentity: typeof document === 'string' ? documentIdentity(document) : null,
      documents: document ? [document] : [],
      tickets: new Map(),
      annotationSources: new Map(),
      unkeyedAnnotationSource: registry.annotationSourceForDocument(document),
      preferences: settingsOwner
        ? { ...registry.stateFor(settingsOwner).preferences }
        : preferences.load(),
      performance: { peaks: new Map(), timer: null, samples: 0, hasDocument: !!document },
    });
    const fullscreenChanged = () => {
      if (!target || target.isDestroyed()) return;
      const full = target.isFullScreen();
      updateWindowButtons(target);
      target.webContents.send('window:fullscreen', full);
    };
    const activityChanged = () => {
      if (!target || target.isDestroyed()) return;
      target.webContents.send('activity:changed', windowPerformance.windowActive(target));
      windowPerformance.update(target);
    };
    let resizing = false;
    const resizeStart = () => {
      if (resizing || !target || target.isDestroyed()) return;
      resizing = true;
      target.webContents.send('window:resize-start');
    };
    const resizeEnd = () => {
      if (!resizing || !target || target.isDestroyed()) return;
      resizing = false;
      target.webContents.send('window:resize-end');
    };
    if (process.platform === 'darwin') {
      target.on('will-resize', resizeStart);
      target.on('resized', resizeEnd);
    }
    target.on('show', () => updateWindowButtons(target));
    target.on('restore', () => updateWindowButtons(target));
    target.on('resized', () => updateWindowButtons(target));
    target.on('enter-full-screen', fullscreenChanged);
    target.on('leave-full-screen', fullscreenChanged);
    const maximizedChanged = () => {
      if (!target.isDestroyed()) target.webContents.send('window:maximized', target.isMaximized());
    };
    target.on('maximize', maximizedChanged);
    target.on('unmaximize', maximizedChanged);
    for (const event of ['minimize', 'restore', 'hide', 'show', 'focus', 'blur'])
      target.on(event, activityChanged);
    target.webContents.setZoomFactor(1);
    target.webContents.setVisualZoomLevelLimits(1, 1);
    target.webContents.on('before-input-event', (event, input) => {
      const state = registry.stateFor(target);
      if (
        state?.preferences?.interactionMode === 'reading' &&
        input.type === 'keyDown' &&
        (process.platform === 'darwin' ? input.meta : input.control) &&
        !input.alt &&
        !input.shift &&
        String(input.key).toLowerCase() === 'c'
      ) {
        event.preventDefault();
        target.webContents.copy();
        return;
      }
      if (
        state?.preferences?.interactionMode !== 'reading' &&
        input.type === 'keyDown' &&
        (process.platform === 'darwin' ? input.meta : input.control) &&
        !input.alt &&
        !input.shift &&
        String(input.key).toLowerCase() === 'c'
      ) {
        event.preventDefault();
        target.webContents.send('reader:action', 'copy-paragraph');
        return;
      }
      const action = shortcutAction(process.platform, input);
      if (action === 'page-previous' || action === 'page-next') return;
      if (action === 'new-window') {
        event.preventDefault();
        void createWindow().catch(handleBackendFailure);
        return;
      }
      if (action === 'toggle-fullscreen') {
        event.preventDefault();
        target.setFullScreen(!target.isFullScreen());
        return;
      }
      if (action === 'close-window') {
        event.preventDefault();
        target.close();
        return;
      }
      if (action) {
        event.preventDefault();
        target.webContents.send('reader:action', action);
      }
    });
    target.webContents.on('context-menu', (_event, params) => {
      if (
        registry.stateFor(target)?.preferences?.interactionMode !== 'reading' ||
        typeof params?.selectionText !== 'string' ||
        !params.selectionText.trim()
      )
        return;
      const template = [
        { role: 'copy' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: menuLabel(
            'Search in Document',
            resolveUILanguage(
              registry.stateFor(target)?.preferences?.uiLanguage || 'system',
              application.getPreferredSystemLanguages()[0] || application.getLocale(),
            ),
          ),
          click: () =>
            target.webContents.send('reader:action', 'search-selection', params.selectionText),
        },
      ];
      if (
        process.platform === 'darwin' &&
        typeof target.webContents.showDefinitionForSelection === 'function'
      ) {
        template.push(
          { type: 'separator' },
          {
            label: 'Look Up Selection',
            click: () => target.webContents.showDefinitionForSelection(),
          },
        );
      }
      const query = encodeURIComponent(params.selectionText.trim());
      template.push(
        { type: 'separator' },
        {
          label: 'Search on Google',
          click: () => void shellApi.openExternal(`https://www.google.com/search?q=${query}`),
        },
        {
          label: 'Search on Google Scholar',
          click: () => void shellApi.openExternal(`https://scholar.google.com/scholar?q=${query}`),
        },
      );
      MenuApi.buildFromTemplate(template).popup({ window: target });
    });
    const session = target.webContents.session;
    const stopCommunicationMetrics = trackBackendCommunications(
      session,
      backend.origin,
      developerOperationMetrics,
    );
    target.once('closed', stopCommunicationMetrics);
    session.setPermissionRequestHandler((_wc, _permission, reply) => reply(false));
    session.setPermissionCheckHandler(() => false);
    session.webRequest.onBeforeSendHeaders({ urls: [`${backend.origin}/*`] }, (details, reply) =>
      reply({ requestHeaders: { ...details.requestHeaders, 'X-Preview-Token': token } }),
    );
    target.webContents.setWindowOpenHandler(({ url }) => {
      if (
        url === 'https://siliconflow.cn/' ||
        url === 'https://github.com/PDFMathTranslate/PDFMathReader' ||
        dependencyProjects.some((project) => project.url === url)
      )
        void shellApi.openExternal(url);
      return { action: 'deny' };
    });
    target.webContents.on('will-navigate', (event, url) => {
      if (new URL(url).origin !== backend.origin) event.preventDefault();
    });
    const showLoadedWindow = () => {
      hideNativeMenuBar(target);
      if (!backgroundRenderSmoke && !target.isVisible()) {
        if (!activate || process.argv.includes('--background')) target.showInactive();
        else target.show();
      }
      windowPerformance.update(target);
    };
    target.once('ready-to-show', showLoadedWindow);
    if (process.platform === 'win32') target.webContents.once('did-finish-load', showLoadedWindow);
    target.on('focus', () => {
      updateAppearance();
      getRebuildMenu()();
      getUpdateMenu()(target);
    });
    let closing = false;
    target.on('close', (event) => {
      if (closing || getRuntime().quitting) return;
      event.preventDefault();
      closing = true;
      registry.stateFor(target).closing = true;
      void saveWindowReadingView(target)
        .then(() => getDocumentSession()?.close(target.id))
        .finally(() => {
          if (target && !target.isDestroyed()) target.close();
        });
    });
    target.on('closed', () => {
      windowPerformance.stop(target);
      registry.stateFor(target)?.performance.peaks.clear();
      registry.windows.delete(target);
      if (!settingsOwner) {
        const closingBackend = backend.close();
        registry.closingBackends.add(closingBackend);
        void closingBackend.finally(() => registry.closingBackends.delete(closingBackend));
      }
      if (!registry.windows.size) {
        developerMonitor.close();
        application.quit();
      }
    });
    await developerMonitor.sync(registry.stateFor(target));
    await target.loadURL(
      settingsOwner
        ? backend.origin + '/?settingsWindow=1&section=' + encodeURIComponent(settingsSection)
        : backend.origin,
    );
    if (settingsOwner) {
      const closeWithOwner = () => {
        if (!target.isDestroyed()) target.close();
      };
      settingsOwner.once('closed', closeWithOwner);
      target.once('closed', () => settingsOwner.removeListener('closed', closeWithOwner));
    }
    activityChanged();
    return target;
  };
  const waitForCILaunch = (target) =>
    new Promise((resolve, reject) => {
      let settled = false;
      let pollTimer;
      let lastProbe = {};
      const timeout = setTimeout(
        () =>
          finish(
            Error(
              `CI launch check timed out after ${ciLaunchTimeoutMs} ms: ${JSON.stringify(lastProbe)}`,
            ),
          ),
        ciLaunchTimeoutMs,
      );
      timeout.unref?.();
      const cleanup = () => {
        clearTimeout(timeout);
        clearTimeout(pollTimer);
        target.removeListener('closed', onClosed);
        target.webContents.removeListener('did-fail-load', onDidFailLoad);
        target.webContents.removeListener('render-process-gone', onRenderProcessGone);
      };
      const finish = (error, value) => {
        if (settled) return;
        settled = true;
        cleanup();
        error ? reject(error) : resolve(value);
      };
      const onClosed = () => finish(Error('Main window closed before the renderer became ready.'));
      const onDidFailLoad = (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        if (isMainFrame !== false)
          finish(
            Error(
              `did-fail-load ${errorCode}: ${errorDescription || 'unknown load error'}${validatedURL ? ` (${validatedURL})` : ''}`,
            ),
          );
      };
      const onRenderProcessGone = (_event, details) =>
        finish(Error(`render-process-gone: ${details?.reason || 'unknown reason'}`));
      const poll = async () => {
        if (settled) return;
        if (target.isDestroyed()) {
          finish(Error('Main window was destroyed before the renderer became ready.'));
          return;
        }
        try {
          const state = await target.webContents.executeJavaScript(
            '({ready:window.previewReady===true,state:document.readyState,title:document.title,text:document.body?.innerText.slice(0,300)})',
            true,
          );
          lastProbe = { ...state, visible: target.isVisible() };
          if (state.ready && lastProbe.visible) {
            finish(null, { previewReady: true, visible: true });
            return;
          }
        } catch (error) {
          finish(Error(`Renderer readiness probe failed: ${error?.message || error}`));
          return;
        }
        pollTimer = setTimeout(poll, 50);
        pollTimer.unref?.();
      };
      target.once('closed', onClosed);
      target.webContents.on('did-fail-load', onDidFailLoad);
      target.webContents.on('render-process-gone', onRenderProcessGone);
      void poll();
    });
  const openSettingsWindow = async (owner, section = 'general') => {
    if (
      ![
        'general',
        'performance',
        'appearance',
        'translation',
        'providers',
        'kernel',
        'about',
      ].includes(section)
    )
      throw Error('Invalid settings section.');
    owner = registry.stateFor(owner)?.settingsOwner || owner;
    let pending = registry.settingsWindows.get(owner);
    if (!pending) {
      pending = createWindow(null, null, owner, section);
      registry.settingsWindows.set(owner, pending);
      pending.then(
        (target) =>
          target.once('closed', () => {
            if (registry.settingsWindows.get(owner) === pending)
              registry.settingsWindows.delete(owner);
          }),
        () => {},
      );
      pending.catch(() => {
        if (registry.settingsWindows.get(owner) === pending) registry.settingsWindows.delete(owner);
      });
    }
    const target = await pending;
    if (target.isDestroyed()) {
      registry.settingsWindows.delete(owner);
      return openSettingsWindow(owner, section);
    }
    target.webContents.send('settings:section', section);
    if (target.isMinimized()) target.restore();
    target.show();
    target.focus();
    return target;
  };
  let runtime = { quitting: false };
  const getRuntime = () => runtime;
  const setRuntime = (next) => {
    runtime = next;
  };
  return {
    createWindow,
    openDocumentWindow,
    openExternalDocument,
    openSettingsWindow,
    saveWindowReadingView,
    documentIdentity,
    focusDocumentWindow,
    waitForCILaunch,
    updateWindowButtons,
    hideNativeMenuBar,
    setWindowVibrancy,
    setRuntime,
  };
}
