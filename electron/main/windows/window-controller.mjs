import { popupGlassMenu } from '../services/glass-menu.mjs';
import { createTabGroups } from './tab-groups.mjs';
import { createWindowServiceMode } from './window-service-mode.mjs';
import { applicationPath } from '../../../runtime/node/application-paths.mjs';
import { activeAppIcon, appIconPath } from '../services/app-icon.mjs';
import { detectEmails, detectLinks, linkLabel } from '../../../shared/reader/link-detection.mjs';
import { app, BrowserWindow, dialog, Menu, shell } from 'electron';
import { randomBytes } from 'node:crypto';
import { realpath, stat } from 'node:fs/promises';
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
  claimCompanionDocument,
  releaseCompanionDocument,
  companionOwnership,
  flushCompanionPersistence,
}) {
  const tabs = createTabGroups({
    registry,
    isTabMode: () => getPreferences()?.load?.().windowMode === 'tabs',
    backgroundRenderSmoke,
  });
  const closedTabs = [];
  const rememberClosedTab = async (target) => {
    const state = registry.stateFor(target);
    if (
      getPreferences()?.load?.().windowMode !== 'tabs' ||
      state?.settingsOwner ||
      state?.closedTabRemembered ||
      getRuntime().quitting
    )
      return;
    const saved = getDocumentSession()?.current?.(target.id);
    const source = state?.unkeyedAnnotationSource;
    let document =
      saved?.path ||
      source?.path ||
      state?.documents?.[0] ||
      (source?.bytes
        ? { bytes: Buffer.from(source.bytes), name: target.getTitle().replace(/^TEST — /, '') }
        : undefined);
    if (
      !saved?.path &&
      !source?.path &&
      !state?.documents?.length &&
      state?.serviceMode?.phase !== 'suspended'
    ) {
      const snapshot = await target.webContents.executeJavaScript(
        'window.previewClosedTabDocument?.()',
      );
      if (snapshot) document = snapshot;
    }
    closedTabs.push({ document, view: saved?.view });
    if (closedTabs.length > 20) closedTabs.shift();
    state.closedTabRemembered = true;
  };
  const reopenClosedTab = async (owner) => {
    if (getPreferences()?.load?.().windowMode !== 'tabs') return;
    const entry = closedTabs.pop();
    if (!entry) return;
    try {
      if (typeof entry.document === 'string') {
        const existing = registry.findDocumentWindow(await documentIdentity(entry.document));
        if (existing) return focusDocumentWindow(existing);
      }
      if (entry.document)
        return await createWindow(entry.document, entry.view, null, 'general', true, undefined, {
          anchor: registry.stateFor(owner)?.settingsOwner || owner || registry.focusedWindow(),
        });
      return await newTab(owner);
    } catch (error) {
      closedTabs.push(entry);
      throw error;
    }
  };
  registry.setActiveTabResolver?.(tabs.activeFor);
  const serviceMode = createWindowServiceMode({
    registry,
    activeFor: tabs.activeFor,
    enabled: (!smoke || smoke === 'service-mode') && !ciLaunchCheck && !backgroundRenderSmoke,
    prepare: (target, state) =>
      state.documents.length
        ? null
        : target.webContents.executeJavaScript('window.previewPrepareServiceMode?.()'),
    suspend: (target, snapshot, state) => {
      if (snapshot.document) {
        const document = snapshot.document;
        const path = state.unkeyedAnnotationSource?.path;
        if (path) {
          document.ticket = randomBytes(16).toString('hex');
          state.tickets.set(document.ticket, path);
        }
        state.documents.unshift(document);
      }
      windowPerformance.stop(target);
      // Each window has its own partition, so no other window shares this process.
      try {
        target.webContents.forcefullyCrashRenderer();
      } catch (error) {
        const index = state.documents.indexOf(snapshot.document);
        if (index >= 0) state.documents.splice(index, 1);
        if (snapshot.document?.ticket) state.tickets.delete(snapshot.document.ticket);
        throw error;
      }
    },
    resume: (target, snapshot) => {
      const url = new URL(target.webContents.getURL());
      if (snapshot.settingsSection) url.searchParams.set('section', snapshot.settingsSection);
      return target.loadURL(url.href);
    },
  });
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
    const fullscreen = target.isFullScreen();
    // Fullscreen's native titlebar reveals with the system menu bar, even
    // while the reader hides its own toolbar. Do not hide its standard buttons.
    const visible = fullscreen || !registry.stateFor(target)?.headerHidden;
    target.setWindowButtonVisibility(visible);
    if (visible && !fullscreen)
      target.setWindowButtonPosition(windowChromeOptions('darwin').trafficLightPosition);
  };
  const hideNativeMenuBar = (target) => {
    if (!['win32', 'linux'].includes(process.platform) || !target || target.isDestroyed()) return;
    target.setAutoHideMenuBar?.(true);
    target.setMenuBarVisibility?.(false);
  };
  const saveWindowReadingView = async (target) => {
    if (!target || target.isDestroyed()) return;
    const state = registry.stateFor(target);
    await state?.serviceMode?.pending;
    if (state?.serviceMode?.phase === 'suspended' || target.isDestroyed()) return;
    await target.webContents.executeJavaScript('window.previewSaveReadingView?.()');
  };
  const documentIdentity = async (path) => {
    const canonical = await realpath(path);
    const info = await stat(canonical, { bigint: true });
    return info.ino ? `${info.dev}:${info.ino}` : canonical;
  };
  const focusDocumentWindow = (target) => {
    if (tabs.isInactiveTab(target)) {
      void tabs.select(target);
      return target;
    }
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
  const deliverDocumentWindow = async (
    document,
    preferredWindow,
    restoreView,
    activate,
    claimOptions,
  ) => {
    const identity = typeof document === 'string' ? await documentIdentity(document) : null;
    const existing = registry.findDocumentWindow(identity);
    if (existing) return activate ? focusDocumentWindow(existing) : existing;
    if (identity && registry.openingDocuments.has(identity)) {
      const target = await registry.openingDocuments.get(identity);
      return activate ? focusDocumentWindow(target) : target;
    }
    const operation = (async () => {
      const candidates = [preferredWindow, registry.focusedWindow(), ...registry.windows.keys()];
      const target = candidates.find(registry.isBlankStartPage);
      if (!target)
        return createWindow(
          document,
          restoreView,
          null,
          'general',
          activate,
          identity,
          undefined,
          preferredWindow || registry.focusedWindow(),
          claimOptions,
        );
      await claimCompanionDocument?.(document, target, target, claimOptions);
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
  const openDocumentWindow = async (
    document,
    preferredWindow,
    restoreView,
    activate = true,
    claimOptions,
  ) => {
    const started = globalThis.performance.now();
    try {
      return await deliverDocumentWindow(
        document,
        preferredWindow,
        restoreView,
        activate,
        claimOptions,
      );
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
    knownIdentity,
    placement,
    lockNotificationTarget,
    claimOptions,
  ) => {
    const identity =
      typeof document === 'string' ? (knownIdentity ?? (await documentIdentity(document))) : null;
    let target;
    const backendReady = settingsOwner
      ? registry.stateFor(settingsOwner).backend
      : startBackendService({
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
    // In tab mode a new reader window opens as a hidden tab at its anchor's frame.
    const tabAnchor = settingsOwner ? null : tabs.anchorFor(placement);
    target = new Window({
      width: 1200,
      height: 850,
      minWidth: 720,
      minHeight: 500,
      ...(tabAnchor ? tabAnchor.getBounds() : {}),
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
      icon: appIconPath(activeAppIcon(getPreferences()?.load().appIcon)),
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
    // Creating the native window also starts Chromium. Overlap that work with
    // the backend process instead of starting the renderer only after it is ready.
    let backend;
    try {
      backend = await backendReady;
    } catch (error) {
      target.destroy();
      throw error;
    }
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
      documentIdentity: identity,
      documents: document ? [document] : [],
      tickets: new Map(),
      annotationSources: new Map(),
      unkeyedAnnotationSource: registry.annotationSourceForDocument(document),
      preferences: settingsOwner
        ? { ...registry.stateFor(settingsOwner).preferences }
        : preferences.load(),
      performance: { peaks: new Map(), timer: null, samples: 0, hasDocument: !!document },
    });
    try {
      if (document && !settingsOwner)
        await claimCompanionDocument?.(
          document,
          target,
          lockNotificationTarget || target,
          claimOptions,
        );
    } catch (error) {
      registry.windows.delete(target);
      target.destroy();
      await backend.close().catch(() => {});
      throw error;
    }
    if (!settingsOwner) tabs.adopt(target, tabAnchor);
    const fullscreenChanged = () => {
      if (!target || target.isDestroyed()) return;
      const full = target.isFullScreen();
      updateWindowButtons(target);
      target.webContents.send('window:fullscreen', full);
    };
    const activityChanged = () => {
      if (!target || target.isDestroyed()) return;
      serviceMode.update();
      if (
        registry.stateFor(target)?.serviceMode?.phase === 'suspended' ||
        target.webContents.isCrashed()
      )
        return;
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
    const cancelShortcutRecording = () => {
      const state = registry.stateFor(target);
      if (state) state.shortcutRecording = false;
      if (!target.webContents.isDestroyed()) target.webContents.setIgnoreMenuShortcuts(false);
    };
    target.on('blur', cancelShortcutRecording);
    target.webContents.on('did-start-loading', cancelShortcutRecording);
    target.webContents.on('render-process-gone', cancelShortcutRecording);
    target.webContents.on('before-input-event', (event, input) => {
      const state = registry.stateFor(target);
      if (state?.shortcutRecording) return;
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
      const action = shortcutAction(
        process.platform,
        input,
        state?.preferences?.shortcutBindings || {},
      );
      // Unmodified browsing keys are handled in the renderer so text fields
      // retain their normal caret and scrolling behavior.
      if (action === 'new-window') {
        event.preventDefault();
        void newWindow(target).catch(handleBackendFailure);
        return;
      }
      if (action === 'new-tab' && getPreferences()?.load?.().windowMode === 'tabs') {
        event.preventDefault();
        void newTab(target).catch(handleBackendFailure);
        return;
      }
      if (action === 'reopen-closed-tab' && getPreferences()?.load?.().windowMode === 'tabs') {
        event.preventDefault();
        void reopenClosedTab(target).catch(handleBackendFailure);
        return;
      }
      if (action === 'next-tab' || action === 'previous-tab') {
        event.preventDefault();
        void (action === 'next-tab' ? tabs.next(target) : tabs.previous(target));
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
      if (action && !input.meta && !input.control && !input.alt) return;
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
      const locale = resolveUILanguage(
        registry.stateFor(target)?.preferences?.uiLanguage || 'en',
        application.getPreferredSystemLanguages()[0] || application.getLocale(),
      );
      // Links come from the selected text itself; only http(s) URLs survive detection.
      const links = detectLinks(params.selectionText);
      const emails = detectEmails(params.selectionText);
      const openLabel = menuLabel('Open Link', locale);
      const copyEmailLabel = menuLabel('Copy Email', locale);
      const template = [
        ...links.map((url) => ({
          label: links.length === 1 ? openLabel : `${openLabel}: ${linkLabel(url)}`,
          click: () => void shellApi.openExternal(url),
        })),
        ...emails.map((email) => ({
          label: emails.length === 1 ? copyEmailLabel : `${copyEmailLabel}: ${email}`,
          // The renderer copies and confirms with its toast.
          click: () => target.webContents.send('reader:action', 'copy-email', email),
        })),
        ...(links.length || emails.length ? [{ type: 'separator' }] : []),
        { role: 'copy' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: menuLabel('Add to translation glossary...', locale),
          click: () =>
            target.webContents.send('reader:action', 'glossary-selection', params.selectionText),
        },
        {
          label: menuLabel('Search in Document', locale),
          click: () =>
            target.webContents.send('reader:action', 'search-selection', params.selectionText),
        },
      ];
      if (process.platform === 'darwin') {
        template.push({
          label: menuLabel('Paraphrase via AI chats...', locale),
          click: () =>
            target.webContents.send('reader:action', 'paraphrase-selection', params.selectionText),
        });
        template.push({
          label: 'AI Chat…',
          click: () =>
            target.webContents.send('reader:action', 'chat-selection', params.selectionText),
        });
      }
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
      if (
        popupGlassMenu({
          target,
          template,
          Menu: MenuApi,
          enabled: registry.stateFor(target)?.preferences?.interfaceStyle === 'liquid-glass',
          x: params.x,
          y: params.y,
        })
      )
        return;
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
      const destination = new URL(url);
      if (
        (destination.protocol === 'https:' &&
          ['doi.org', 'dx.doi.org'].includes(destination.hostname) &&
          /^\/10\.\d{4,9}\/.+/.test(destination.pathname)) ||
        url === 'https://siliconflow.cn/' ||
        url === 'https://chatgpt.com/settings/usage' ||
        url === 'https://developers.openai.com/siwc/token-sharing-open-source' ||
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
      const foreground = activate && !process.argv.includes('--background');
      if (
        !backgroundRenderSmoke &&
        !target.isVisible() &&
        !tabs.presentLoaded(target, foreground)
      ) {
        if (!foreground) target.showInactive();
        else target.show();
      }
      windowPerformance.update(target);
    };
    target.once('ready-to-show', showLoadedWindow);
    if (process.platform === 'win32') target.webContents.once('did-finish-load', showLoadedWindow);
    target.on('page-title-updated', () => setImmediate(() => tabs.titleChanged(target)));
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
      const state = registry.stateFor(target);
      const ownership = companionOwnership?.(target);
      state.closing = true;
      // A native close responds immediately; keep the renderer alive only long
      // enough to save its reading position and persist the document session.
      // A closing active tab stays up until its neighbor has painted over it.
      if (!tabs.beforeClose(target)) target.hide();
      void saveWindowReadingView(target)
        .then(async () => {
          await flushCompanionPersistence?.();
          await releaseCompanionDocument?.(target, ownership);
          await rememberClosedTab(target);
          await getDocumentSession()?.close(target.id);
          return true;
        })
        .catch((error) => {
          closing = false;
          state.closing = false;
          if (target && !target.isDestroyed()) {
            target.show();
            target.focus();
            try {
              target.webContents.send(
                'reader:action',
                'companion-save-failed',
                error?.message ||
                  'Could not save this document. It remains open here; try closing again.',
              );
            } catch {}
          }
          return false;
        })
        .then((closed) => {
          if (closed && target && !target.isDestroyed()) target.close();
        });
    });
    target.on('closed', () => {
      tabs.forget(target);
      windowPerformance.stop(target);
      registry.stateFor(target)?.performance.peaks.clear();
      registry.windows.delete(target);
      serviceMode.update();
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
    const monitorReady = developerMonitor.sync(registry.stateFor(target));
    // Monitoring is independent of navigation and must not hold up first paint.
    await Promise.all([
      monitorReady,
      target.loadURL(
        settingsOwner
          ? backend.origin + '/?settingsWindow=1&section=' + encodeURIComponent(settingsSection)
          : backend.origin,
      ),
    ]);
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
        'shortcuts',
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
    const suspended = registry.stateFor(target)?.serviceMode;
    if (suspended?.phase === 'suspended') suspended.snapshot.settingsSection = section;
    else target.webContents.send('settings:section', section);
    if (target.isMinimized()) target.restore();
    target.show();
    target.focus();
    return target;
  };
  const newTab = (owner) =>
    createWindow(undefined, undefined, null, 'general', true, undefined, {
      anchor: registry.stateFor(owner)?.settingsOwner || owner || registry.focusedWindow(),
    });
  // New Window (⌘N) opens its start page as a tab of the current group in tab mode.
  const newWindow = (owner) =>
    getPreferences()?.load?.().windowMode === 'tabs'
      ? newTab(owner)
      : createWindow(undefined, undefined, null, 'general', true, undefined, 'window');
  let runtime = { quitting: false };
  const getRuntime = () => runtime;
  const setRuntime = (next) => {
    runtime = next;
    if (next.quitting) serviceMode.stop();
    else serviceMode.start();
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
    tabs,
    newTab,
    reopenClosedTab,
    rememberClosedTab,
    newWindow,
  };
}
