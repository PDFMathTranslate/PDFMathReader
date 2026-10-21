import { registerGlassMenuIPC } from './main/services/glass-menu.mjs';
import {
  app,
  dialog,
  ipcMain,
  Menu,
  nativeTheme,
  safeStorage,
  shell,
  systemPreferences,
} from 'electron';
import { randomBytes, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { tmpdir, release } from 'node:os';
import { startBackendService } from './main/backend/backend-service.mjs';
import { createHaptics } from './platform/macos/haptics.mjs';
import { registerWindowsPDF } from './platform/windows/file-association.mjs';
import { createUpdateInstaller } from './main/services/update-installer.mjs';
import { createAppUpdates, releaseLink } from './main/services/app-updates.mjs';
import {
  createOperationMetrics,
  trackBackendCommunications,
} from './main/services/developer-operation-metrics.mjs';
import { createDeveloperMonitor } from './main/services/developer-monitor.mjs';
import { createQuickLinkStore } from './main/services/quick-links.mjs';
import { createCredentials } from './main/services/credentials.mjs';
import { createServiceCredentials } from './main/services/service-credentials.mjs';
import { createChatGPTSubscription } from './main/services/chatgpt-subscription.mjs';
import { createDocumentSession } from './main/services/document-session.mjs';
import { createRecents } from './main/services/recents.mjs';
import { createReaderPreferences } from './main/services/preferences.mjs';
import { createAppIcon } from './main/services/app-icon.mjs';
import { createCompanionServer } from './main/services/companion-server.mjs';
import {
  configureEPUBSupport,
  readSystemPDF,
  validateSystemPDF,
  pdfLaunchPaths,
} from './main/services/documents.mjs';
import { createEPUBConverter } from './main/services/epub-converter.mjs';
import {
  appendPerformanceReport,
  loadPerformanceReports,
  memoryMetricToBytes,
  MAX_PERFORMANCE_REPORTS,
  sumMemoryMetrics,
  validatePerformanceReport,
  writePerformanceReports,
} from './main/services/performance-tracker.mjs';
async function importPDFAnnotations(...args) {
  const module = await import('./main/services/annotation-import.mjs');
  return module.importPDFAnnotations(...args);
}
import { createAnnotationStore, stripManagedAnnotations } from './main/services/annotations.mjs';
import { resolveUILanguage } from '../shared/i18n/ui-language.mjs';
import { dependencyProjects } from '../shared/dependency-projects.mjs';
import { menuLabel } from '../shared/i18n/menu.mjs';
import {
  windowChromeOptions,
  commandAccelerator,
  closeWindowAccelerator,
  shortcutAction,
  serializeApplicationMenu,
  menuPathItems,
} from './main/windows/window-chrome.mjs';
import { createMeasuredIPC } from './main/ipc/handler.mjs';
import { createWindowRegistry } from './main/windows/window-registry.mjs';
import { createWindowPerformance } from './main/windows/window-performance.mjs';
import { createWindowController } from './main/windows/window-controller.mjs';
import { createApplicationMenu } from './main/menus/application-menu.mjs';
import { registerAnnotationIPC } from './main/ipc/annotation-ipc.mjs';
import { registerCredentialsIPC } from './main/ipc/credentials-ipc.mjs';
import { registerDocumentIPC } from './main/ipc/document-ipc.mjs';
import { registerPerformanceIPC } from './main/ipc/performance-ipc.mjs';
import { registerPreferencesIPC } from './main/ipc/preferences-ipc.mjs';
import { registerQuickLinksIPC } from './main/ipc/quick-links-ipc.mjs';
import { registerRecentsIPC } from './main/ipc/recents-ipc.mjs';
import { registerUpdatesIPC } from './main/ipc/updates-ipc.mjs';
import { registerWindowIPC } from './main/ipc/window-ipc.mjs';
import { registerTabsIPC } from './main/ipc/tabs-ipc.mjs';

const developerOperationMetrics = createOperationMetrics();
const runFile = promisify(execFile);
const windowsBuild = process.platform === 'win32' ? Number(release().split('.')[2]) : 0;
if (process.platform === 'darwin')
  systemPreferences.setUserDefault('NSFullScreenMenuItemEverywhere', 'boolean', false);
const smoke = process.argv.find((a) => a.startsWith('--smoke-test='))?.split('=')[1];
const ciLaunchCheck = process.argv.includes('--ci-launch-check');
const ciLaunchPassMarker = 'PDFMATHREADER_CI_LAUNCH_CHECK_PASS';
const ciLaunchTimeoutMs =
  Number(process.env.PDFMATHREADER_CI_LAUNCH_TIMEOUT_MS) > 0
    ? Number(process.env.PDFMATHREADER_CI_LAUNCH_TIMEOUT_MS)
    : 45000;
if (smoke && app.isPackaged && !process.execPath.includes('PDFMathReader Tests.app'))
  throw Error('Mock tests require the isolated test application.');
if (smoke || ciLaunchCheck)
  app.setPath(
    'userData',
    mkdtempSync(join(tmpdir(), smoke ? 'preview-smoke-' : 'preview-ci-launch-')),
  );

const haptics = createHaptics({ packaged: app.isPackaged });
app.on('will-quit', () => haptics.close());
const pendingFiles = [];
let notifyDocuments = () => {};
function enqueueFiles(paths) {
  for (const path of paths) if (!pendingFiles.includes(path)) pendingFiles.push(path);
  if (paths.length) notifyDocuments();
}
app.on('open-file', (event, path) => {
  event.preventDefault();
  if (smoke && smoke !== 'file-open' && smoke !== 'multi-window') return;
  enqueueFiles([path]);
});
app.setName(smoke ? 'PDFMathReader Tests' : 'PDFMathReader');
if (!smoke && !ciLaunchCheck)
  app.setPath('userData', join(app.getPath('appData'), 'PDFMathReader'));
if ((!smoke && !ciLaunchCheck) || smoke === 'file-open')
  enqueueFiles(pdfLaunchPaths(process.argv.slice(1), process.cwd()));
if (process.platform === 'darwin' && ['resize', 'file-open'].includes(smoke))
  app.setActivationPolicy('prohibited');

if (!app.requestSingleInstanceLock()) app.quit();
else {
  const registry = createWindowRegistry();
  const { windows, closingBackends } = registry;
  const handleMeasuredIPC = createMeasuredIPC({
    ipcMain,
    operationMetrics: developerOperationMetrics,
  });
  registerGlassMenuIPC({ handle: handleMeasuredIPC });
  let backend;
  let window;
  let credentials;
  let chatGPTSubscription;
  let subscriptionClosing;
  let serviceCredentialStore;
  let preferences;
  let recents;
  let annotations;
  let quickLinks;
  let documentSession;
  let appUpdates;
  let backendOptions;
  let companion;
  let documentsReady = false;
  let quitting = false;
  let backendFailureHandled = false;
  const performanceReports = { items: [], write: Promise.resolve() };
  const backgroundRenderSmoke =
    (Boolean(smoke) && process.argv.includes('--smoke-background-render')) ||
    ['resize', 'file-open', 'crop', 'crop-status', 'information-categories'].includes(smoke) ||
    (process.platform === 'win32' && ['fit-width', 'windows-settings'].includes(smoke));
  const token = randomBytes(32).toString('hex');
  const systemAccent = () => {
    try {
      const value = String(systemPreferences.getAccentColor?.() || '').replace(/^#/, '');
      if (/^[\da-f]{6}$/i.test(value)) return value + 'ff';
      if (/^[\da-f]{8}$/i.test(value)) return value;
    } catch {}
    return '007affff';
  };
  const appearance = () => {
    const state = preferences?.load?.() || {};
    return {
      platform: process.platform,
      accent: '#' + systemAccent(),
      interfaceStyle: state.interfaceStyle || 'default',
      appearance: state.appearance || 'system',
      accentColor: state.accentColor || 'system',
      reduceMotion: !!state.reduceMotion,
      reduceTransparency: !!state.reduceTransparency,
      reducePadding: !!state.reducePadding,
      dark: !!nativeTheme.shouldUseDarkColors,
    };
  };
  const updateAppearance = () => {
    for (const target of windows.keys())
      if (!target.isDestroyed() && !target.webContents.isCrashed())
        target.webContents.send('appearance:changed', appearance());
  };
  const handleBackendFailure = async (error) => {
    if (quitting || backendFailureHandled) return;
    backendFailureHandled = true;
    const key = credentials?.getKey?.();
    const detail =
      error?.message && key ? error.message.replaceAll(key, '[redacted]') : error?.message;
    if (smoke || ciLaunchCheck) {
      console.error(
        ciLaunchCheck ? 'PDFMATHREADER_CI_LAUNCH_CHECK_FAIL' : 'Desktop smoke backend failed:',
        detail || 'The backend utility process stopped unexpectedly.',
      );
      app.exit(1);
      return;
    }
    dialog.showErrorBox(
      'PDFMathReader',
      `The local reader backend stopped unexpectedly.${detail ? `\n\n${detail}` : ''}\n\nQuit and reopen PDFMathReader.`,
    );
    app.quit();
  };
  const windowPerformance = createWindowPerformance({
    app,
    registry,
    memoryMetricToBytes,
    sumMemoryMetrics,
    smoke,
    backgroundRenderSmoke,
  });
  const developerMonitor = createDeveloperMonitor({
    windows,
    token,
    operationMetrics: developerOperationMetrics,
    loadServiceCredentials: () => serviceCredentialStore?.load?.() || {},
  });
  const desktopSessionID = () => `desktop-${randomUUID()}`;
  const desktopClaimsInFlight = new Map();
  const recentIDForPath = (path) => {
    const entries = recents?.list?.();
    return typeof path === 'string' && Array.isArray(entries)
      ? entries.find((entry) => recents.path(entry.id) === path)?.id
      : undefined;
  };
  const notifyCompanionLock = (target, error) => {
    if (!target || target.isDestroyed?.()) return;
    const device =
      typeof error?.deviceName === 'string' && error.deviceName.trim()
        ? error.deviceName.trim()
        : 'another device';
    try {
      target.webContents.send(
        'reader:action',
        'companion-lock',
        `This document is open on ${device}. Close it there before opening it here.`,
      );
    } catch {}
  };
  const companionLockError = (message, deviceName) => {
    const error = Error(message || 'This document is open on another device.');
    error.code = 'DOCUMENT_LOCKED';
    if (deviceName) error.deviceName = deviceName;
    return error;
  };
  const claimCompanionID = async (id, target, notificationTarget = target) => {
    if (!id || !companion?.claimDesktopDocument) return { available: false };
    const state = registry.stateFor(target);
    if (state?.companionDocumentId === id && state.companionSessionID)
      return { claimed: true, resumed: true, sessionID: state.companionSessionID };
    for (const [other, otherState] of windows) {
      if (
        other !== target &&
        !other.isDestroyed?.() &&
        otherState?.companionDocumentId === id &&
        otherState.companionSessionID
      ) {
        const error = companionLockError(
          'This document is already open in another desktop window.',
          'This Mac',
        );
        notifyCompanionLock(notificationTarget, error);
        throw error;
      }
    }
    const existing = desktopClaimsInFlight.get(id);
    if (existing) {
      if (existing.target === target) return existing.promise;
      const error = companionLockError(
        'This document is already opening in another desktop window.',
        'This Mac',
      );
      notifyCompanionLock(notificationTarget, error);
      throw error;
    }
    const sessionID = desktopSessionID();
    const promise = (async () => {
      try {
        const result = await companion.claimDesktopDocument(id, sessionID, 'This Mac');
        if (result?.available === false) return result;
        const current = registry.stateFor(target);
        if (current) {
          current.companionDocumentId = id;
          current.companionSessionID = sessionID;
        }
        return result;
      } catch (error) {
        error.companionLock = true;
        notifyCompanionLock(notificationTarget, error);
        throw error;
      }
    })();
    desktopClaimsInFlight.set(id, { target, promise });
    try {
      return await promise;
    } finally {
      if (desktopClaimsInFlight.get(id)?.promise === promise) desktopClaimsInFlight.delete(id);
    }
  };
  const claimCompanionPath = async (path, target, notificationTarget = target) => {
    if (typeof path !== 'string' || !path) return { available: false };
    let id = recentIDForPath(path);
    let prepared;
    if (!id && companion?.claimDesktopDocument && recents?.prepare) {
      prepared = recents.prepare(path);
      id = prepared.id;
    }
    if (!id) return { available: false };
    try {
      if (prepared?.created) await recents.persistPrepared?.(id);
      const result = await claimCompanionID(id, target, notificationTarget);
      if (result?.available === false && prepared?.created)
        await recents.discardPreparedAndPersist?.(id);
      return result;
    } catch (error) {
      if (prepared?.created) await recents.discardPreparedAndPersist?.(id).catch(() => {});
      throw error;
    }
  };
  const companionOwnership = (target) => {
    const state = registry.stateFor(target);
    return state?.companionDocumentId && state?.companionSessionID
      ? { id: state.companionDocumentId, sessionID: state.companionSessionID }
      : undefined;
  };
  const releaseCompanionDocument = async (target, expected) => {
    const state = registry.stateFor(target);
    const ownership = companionOwnership(target);
    if (expected && (ownership?.id !== expected.id || ownership?.sessionID !== expected.sessionID))
      return { available: false, stale: true };
    const id = ownership?.id;
    const sessionID = ownership?.sessionID;
    if (!id || !sessionID || !companion?.releaseDesktopDocument) return { available: false };
    const result = await companion.releaseDesktopDocument(id, sessionID);
    if (
      result?.available !== false &&
      state?.companionDocumentId === id &&
      state.companionSessionID === sessionID
    ) {
      delete state.companionDocumentId;
      delete state.companionSessionID;
    }
    return result;
  };
  const desktopClaims = () => {
    const claims = new Map();
    for (const [target, state] of windows) {
      if (state?.settingsOwner || target.isDestroyed?.()) continue;
      const queuedPath = state.documents?.find((document) => typeof document === 'string');
      const active =
        state.companionDocumentId ||
        state.documentIdentity ||
        state.performance?.hasDocument ||
        queuedPath;
      if (!active) continue;
      const path = state.unkeyedAnnotationSource?.path || queuedPath;
      const id = state.companionDocumentId || recentIDForPath(path);
      if (id) {
        const sessionID =
          state.companionDocumentId === id && state.companionSessionID
            ? state.companionSessionID
            : desktopSessionID();
        state.companionDocumentId ||= id;
        state.companionSessionID ||= sessionID;
        claims.set(id, { id, sessionID, deviceName: 'This Mac' });
      }
    }
    return [...claims.values()];
  };
  let menuController;
  const windowController = createWindowController({
    app,
    registry,
    windowPerformance,
    smoke,
    ciLaunchCheck,
    ciLaunchTimeoutMs,
    windowsBuild,
    backgroundRenderSmoke,
    token,
    getBackendOptions: () => backendOptions,
    getPreferences: () => preferences,
    getDocumentSession: () => documentSession,
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
    getRebuildMenu: () => menuController?.rebuild || (() => {}),
    getUpdateMenu: () => menuController?.updateMenu || (() => {}),
    updateAppearance,
    claimCompanionDocument: claimCompanionPath,
    releaseCompanionDocument,
    companionOwnership,
    flushCompanionPersistence: () =>
      Promise.all([annotations?.flush?.(), quickLinks?.flush?.(), recents?.flush?.()]),
  });
  const deliverPendingFiles = async () => {
    while (pendingFiles.length) await windowController.openExternalDocument(pendingFiles.shift());
  };
  notifyDocuments = () => {
    if (!documentsReady) return;
    void deliverPendingFiles().catch(handleBackendFailure);
  };
  app.on('second-instance', (_event, args, cwd) => {
    const paths = pdfLaunchPaths(args.slice(1), cwd);
    if ((!smoke || ['file-open', 'multi-window'].includes(smoke)) && paths.length)
      enqueueFiles(paths);
    else {
      registry.focusedWindow()?.show();
      registry.focusedWindow()?.focus();
    }
  });
  app
    .whenReady()
    .then(async () => {
      // Explorer registration can launch several reg.exe processes; it is not
      // required for this window or an already delivered external document.
      void registerWindowsPDF({ packaged: app.isPackaged, smoke: !!smoke || ciLaunchCheck }).catch(
        (error) => console.error('Windows PDF menu registration failed:', error.message),
      );

      const credentialOptions = {
        path: join(app.getPath('userData'), 'openai-key.enc'),
        safeStorage,
      };
      if (
        [
          'present',
          'kernels',
          'ux',
          'animation',
          'coverage',
          'search',
          'advanced',
          'advanced-cache',
          'developer',
          'service-mode',
        ].includes(smoke)
      )
        credentialOptions.environment = () => 'local-smoke-placeholder';
      // These stores are independent; disk reads and Keychain unlocks should
      // overlap rather than accumulate before the first window can load.
      const [
        credentialStore,
        serviceCredentials,
        readerPreferences,
        annotationStore,
        savedPerformanceReports,
        savedDocumentSession,
        recentStore,
      ] = await Promise.all([
        createCredentials(credentialOptions),
        createServiceCredentials({
          path: join(app.getPath('userData'), 'translation-service-credentials.enc'),
          safeStorage,
        }),
        createReaderPreferences(join(app.getPath('userData'), 'reader-preferences.json')),
        createAnnotationStore(join(app.getPath('userData'), 'annotations')),
        loadPerformanceReports(join(app.getPath('userData'), 'performance.json')),
        createDocumentSession(join(app.getPath('userData'), 'document-session.json')),
        createRecents(join(app.getPath('userData'), 'recent-documents.json')),
      ]);
      serviceCredentialStore = serviceCredentials;
      chatGPTSubscription = await createChatGPTSubscription({
        path: join(app.getPath('userData'), 'chatgpt-subscription.enc'),
        safeStorage,
        openExternal: (url) => shell.openExternal(url),
        onChange: () => {
          for (const target of windows.keys())
            if (!target.isDestroyed() && !target.webContents.isCrashed())
              target.webContents.send('chatgptSubscription:changed');
        },
      });
      preferences = readerPreferences;
      const appIcon = createAppIcon({ app, preferences, windows: () => windows.keys() });
      if (!smoke) {
        appIcon.apply();
        // Covers both the system switching modes and the in-app Light/Dark/Auto choice.
        nativeTheme.on('updated', appIcon.apply);
      }
      handleMeasuredIPC('appIcon:load', (event) => {
        registry.trustedWindow(event);
        return appIcon.options();
      });
      handleMeasuredIPC('appIcon:select', (event, id) => {
        registry.trustedWindow(event);
        return appIcon.select(id);
      });
      configureEPUBSupport({
        enabled: () => preferences.load().epubEnabled !== false,
        convert: createEPUBConverter({ directory: join(app.getPath('userData'), 'epub-documents') })
          .convert,
      });
      annotations = annotationStore;
      performanceReports.items = savedPerformanceReports;
      documentSession = savedDocumentSession;
      recents = recentStore;
      appUpdates = await createAppUpdates({
        ...(smoke === 'app-updates'
          ? {
              fetchImpl: (await import('../tests/desktop/app-updates-smoke.mjs'))
                .updateFetchFixture,
            }
          : {}),
        currentVersion: app.getVersion(),
        installer:
          app.isPackaged && !smoke && !ciLaunchCheck ? createUpdateInstaller({ app }) : null,
        automatic: preferences.load().autoCheckUpdates,
        path: join(app.getPath('userData'), 'app-updates.json'),
        onChange: (state) => {
          for (const target of windows.keys())
            if (!target.isDestroyed() && !target.webContents.isCrashed())
              target.webContents.send('updates:changed', state);
        },
      });
      app.on('will-quit', () => {
        try {
          appUpdates.installOnQuit();
        } catch (error) {
          console.error('Unable to apply downloaded update:', error.message);
        }
      });
      backendOptions = {
        port: 0,
        development: false,
        appVersion: app.getVersion(),
        pythonResourcesPath: process.resourcesPath,
        cacheDir: join(app.getPath('userData'), 'translations'),
        cacheLimitMB: preferences.load().cacheLimitMB,
        token,
        smoke,
        diagnostics: !!smoke,
        credentials: { getKey: credentialStore.getKey, status: credentialStore.status },
        getCompanionTranslationSettings: async () => ({
          preferences: preferences.load(),
          credentials: await serviceCredentialStore.load(),
        }),
        chatGPTSubscription,
        onCrash: handleBackendFailure,
        ...([
          'kernels',
          'animation',
          'layout-region',
          'advanced',
          'advanced-cache',
          'kernel-settings',
          'about',
        ].includes(smoke)
          ? {
              enginesRoot: join(app.getPath('appData'), 'PDFMathReader', 'engines'),
              runtimeHomeRoot: join(tmpdir(), 'preview-kernel-test-homes'),
            }
          : {}),
      };
      credentials = {
        getKey: credentialStore.getKey,
        status: credentialStore.status,
        save: async (key) => {
          const status = await credentialStore.save(key);
          await Promise.all(
            [...windows.values()].map((state) =>
              state.backend.setCredentials(credentialStore.getKey(), status),
            ),
          );
          await companion?.setCredentials(credentialStore.getKey(), status);
          return status;
        },
        clear: async () => {
          const status = await credentialStore.clear();
          await Promise.all(
            [...windows.values()].map((state) =>
              state.backend.setCredentials(credentialStore.getKey(), status),
            ),
          );
          await companion?.setCredentials(credentialStore.getKey(), status);
          return status;
        },
      };
      if (!smoke && !ciLaunchCheck) {
        companion = await createCompanionServer({
          path: join(app.getPath('userData'), 'companion.json'),
          startBackend: startBackendService,
          backendOptions: () => backendOptions,
          documents: {
            recentsPath: join(app.getPath('userData'), 'recent-documents.json'),
            annotationsRoot: join(app.getPath('userData'), 'annotations'),
            quickLinksRoot: join(app.getPath('userData'), 'quick-links'),
            statePath: join(app.getPath('userData'), 'companion-documents.json'),
          },
          dialog,
          discoveryEnabled: preferences.load().companionDiscoveryEnabled,
          getDesktopClaims: desktopClaims,
          label: (text) =>
            menuLabel(
              text,
              resolveUILanguage(
                preferences.load().uiLanguage || 'en',
                app.getPreferredSystemLanguages()[0] || app.getLocale(),
              ),
            ),
        });
        void companion.launch();
      }
      quickLinks = createQuickLinkStore(join(app.getPath('userData'), 'quick-links'));

      menuController = createApplicationMenu({
        app,
        platform: process.platform,
        smoke,
        registry,
        preferences,
        recents,
        validateSystemPDF,
        openDocumentWindow: windowController.openDocumentWindow,
        newWindow: windowController.newWindow,
        tabs: windowController.tabs,
        newTab: windowController.newTab,
        reopenClosedTab: windowController.reopenClosedTab,
        handleBackendFailure,
        shareKernels: companion ? (target) => companion.showDialog(target) : undefined,
        hideNativeMenuBar: windowController.hideNativeMenuBar,
        resolveUILanguage,
        menuLabel,
        commandAccelerator,
        closeWindowAccelerator,
        serializeApplicationMenu,
        menuPathItems,
      });
      registerRecentsIPC({
        handle: handleMeasuredIPC,
        trustedWindow: registry.trustedWindow,
        registry,
        recents,
        preferences,
        readSystemPDF,
        validateSystemPDF,
        documentSession,
        documentIdentity: windowController.documentIdentity,
        focusDocumentWindow: windowController.focusDocumentWindow,
        openDocumentWindow: windowController.openDocumentWindow,
        resolveUILanguage,
        token,
        smoke,
        rebuildMenu: menuController.rebuild,
        claimCompanionDocument: claimCompanionID,
        notifyCompanionLock,
        releaseCompanionDocument,
      });
      registerAnnotationIPC({
        handle: handleMeasuredIPC,
        trustedWindow: registry.trustedWindow,
        registry,
        annotations,
        importPDFAnnotations,
        stripManagedAnnotations,
        menuLabel,
        resolveUILanguage,
        app,
        runFile,
      });
      registerQuickLinksIPC({
        handle: handleMeasuredIPC,
        trustedWindow: registry.trustedWindow,
        quickLinks,
      });
      registerCredentialsIPC({
        handle: handleMeasuredIPC,
        trustedWindow: registry.trustedWindow,
        registry,
        credentials,
        serviceCredentialStore,
      });
      for (const action of ['status', 'signIn', 'cancel', 'select', 'signOut', 'models'])
        handleMeasuredIPC(`chatgptSubscription:${action}`, async (event, value) => {
          registry.trustedWindow(event);
          if (
            ['select', 'signOut'].includes(action) &&
            (typeof value !== 'string' || value.length > 256)
          )
            throw Error('Invalid ChatGPT account.');
          if (
            action === 'signIn' &&
            value !== undefined &&
            (!value ||
              typeof value !== 'object' ||
              (value.clientId !== undefined &&
                (typeof value.clientId !== 'string' || value.clientId.length > 256)))
          )
            throw Error('Invalid ChatGPT sign-in request.');
          const result = await chatGPTSubscription[action](value);
          if (action === 'signIn' && result?.signedIn)
            for (const window of windows.keys())
              if (!window.isDestroyed() && !window.webContents.isCrashed())
                window.webContents.send('chatgptSubscription:signedIn');
          return result;
        });
      registerUpdatesIPC({
        handle: handleMeasuredIPC,
        trustedWindow: registry.trustedWindow,
        appUpdates,
        preferences,
        registry,
        releaseLink,
      });
      handleMeasuredIPC('companion:connections', (event) => {
        registry.trustedWindow(event);
        return companion?.connections() || [];
      });
      registerPreferencesIPC({
        handle: handleMeasuredIPC,
        trustedWindow: registry.trustedWindow,
        registry,
        preferences,
        appUpdates,
        backendOptions,
        token,
        setCompanionDiscoveryEnabled: (enabled) => companion?.setDiscoveryEnabled(enabled),
        setWindowVibrancy: windowController.setWindowVibrancy,
        updateAppearance,
        rebuildMenu: menuController.rebuild,
        updateMenu: menuController.updateMenu,
        setWindowMode: (mode, target) => {
          windowController.tabs.setMode(mode, registry.stateFor(target)?.settingsOwner || target);
          menuController.rebuild();
        },
      });
      registerPerformanceIPC({
        handle: handleMeasuredIPC,
        trustedWindow: registry.trustedWindow,
        registry,
        windowPerformance,
        updateMenu: menuController.updateMenu,
        performanceReports,
        performanceReportPath: join(app.getPath('userData'), 'performance.json'),
        appendPerformanceReport,
        validatePerformanceReport,
        writePerformanceReports,
        maxPerformanceReports: MAX_PERFORMANCE_REPORTS,
        haptics,
        appearance,
      });
      registerDocumentIPC({
        rememberClosedTab: windowController.rememberClosedTab,
        handle: handleMeasuredIPC,
        trustedWindow: registry.trustedWindow,
        registry,
        annotations,
        documentSession,
        readSystemPDF,
        validateSystemPDF,
        documentIdentity: windowController.documentIdentity,
        focusDocumentWindow: windowController.focusDocumentWindow,
        claimCompanionDocument: claimCompanionID,
        claimCompanionPath: claimCompanionPath,
        notifyCompanionLock,
        releaseCompanionDocument,
        companionOwnership,
        flushCompanionPersistence: () =>
          Promise.all([annotations?.flush?.(), quickLinks?.flush?.(), recents?.flush?.()]),
      });
      registerWindowIPC({
        handle: handleMeasuredIPC,
        trustedWindow: registry.trustedWindow,
        registry,
        menu: menuController,
        windowActive: windowPerformance.windowActive,
        updateWindowButtons: windowController.updateWindowButtons,
        validateSystemPDF,
        openDocumentWindow: windowController.openDocumentWindow,
        openSettingsWindow: windowController.openSettingsWindow,
        newWindow: windowController.newWindow,
        app,
      });
      registerTabsIPC({
        handle: handleMeasuredIPC,
        trustedWindow: registry.trustedWindow,
        registry,
        tabs: windowController.tabs,
        newTab: windowController.newTab,
        handleBackendFailure,
        Menu,
        menuLabel,
        resolveUILanguage,
        app,
      });
      nativeTheme.on('updated', updateAppearance);
      if (process.platform === 'darwin') {
        for (const notification of [
          'AppleColorPreferencesChangedNotification',
          'AppleAquaColorVariantChanged',
        ])
          systemPreferences.subscribeNotification(notification, updateAppearance);
        systemPreferences.subscribeLocalNotification(
          'NSSystemColorsDidChangeNotification',
          updateAppearance,
        );
      }
      nativeTheme.themeSource = preferences.load().appearance;
      if (!smoke) appIcon.apply();
      menuController.rebuild();

      let externalLaunch = false;
      const openLaunchFiles = async () => {
        if (ciLaunchCheck || !pendingFiles.length) return;
        externalLaunch = true;
        await deliverPendingFiles();
      };
      await openLaunchFiles();
      if (!smoke && !ciLaunchCheck && preferences.load().restoreDocuments) {
        let savedDocuments = [];
        try {
          savedDocuments = documentSession.restore();
        } catch (error) {
          console.warn('Could not restore document session:', error);
        }
        for (const document of savedDocuments) {
          await openLaunchFiles();
          try {
            await validateSystemPDF(document.path);
            await openLaunchFiles();
            const firstRestore = windows.size === 0;
            const restored = await windowController.openDocumentWindow(
              document.path,
              null,
              document.view,
              false,
            );
            await openLaunchFiles();
            if (firstRestore && !externalLaunch) windowController.focusDocumentWindow(restored);
          } catch (error) {
            // A stale, locked, or otherwise unavailable document must not prevent
            // startup from reaching the blank start-page fallback below.
            console.warn('Could not restore document:', document.path, error);
          }
        }
      }
      await openLaunchFiles();
      window = [...windows.keys()][0] || (await windowController.createWindow());
      backend = windows.get(window).backend;
      documentsReady = true;
      if (!ciLaunchCheck) await deliverPendingFiles();
      if (app.isPackaged && !smoke && !ciLaunchCheck) appUpdates.start();
      if (ciLaunchCheck) {
        const ready = await windowController.waitForCILaunch(window);
        console.log(
          ciLaunchPassMarker,
          JSON.stringify({ ...ready, platform: process.platform, version: app.getVersion() }),
        );
        app.quit();
        return;
      }
      if (smoke) {
        const { runDesktopSmoke } = await import('../tests/desktop/run-smoke.mjs');
        await runDesktopSmoke({
          smoke,
          window,
          backend,
          token,
          recents,
          windows,
          createWindow: windowController.createWindow,
          credentials,
        });
      }
    })
    .catch(async (error) => {
      if (smoke || ciLaunchCheck) {
        await backend?.close();
        console.error(
          ciLaunchCheck ? 'PDFMATHREADER_CI_LAUNCH_CHECK_FAIL' : 'Desktop smoke failed:',
          error.stack || error.message,
        );
        if (smoke === 'file-open')
          await writeFile(
            '/tmp/preview-system-open-result.json',
            JSON.stringify({ passed: false, error: error.message }),
          );
        app.exit(1);
        return;
      }
      dialog.showErrorBox(
        'PDFMathReader',
        `The local reader could not start.\n\n${error?.message || 'The backend utility process did not become ready.'}\n\nQuit and reopen PDFMathReader.`,
      );
      app.quit();
    });
  app.on('before-quit', (event) => {
    appUpdates?.stop();
    subscriptionClosing ??= chatGPTSubscription?.close();
    void subscriptionClosing?.catch(() => {});
    if (!backend || quitting) return;
    event.preventDefault();
    quitting = true;
    windowController.setRuntime({ quitting: true });
    const quittingWindows = [...windows.keys()];
    void Promise.all(
      quittingWindows.map((target) => windowController.saveWindowReadingView(target)),
    )
      .then(() => Promise.all([documentSession?.saveOnQuit(), annotations?.flush()]))
      .then(() => Promise.all([quickLinks?.flush?.(), recents?.flush?.()]))
      .then(() => Promise.all(quittingWindows.map((target) => releaseCompanionDocument(target))))
      .then(() =>
        Promise.all(
          [...windows.values()]
            .map((state) => state.backend.close())
            .concat([
              ...closingBackends,
              companion?.close(),
              subscriptionClosing,
              preferences?.flush(),
              serviceCredentialStore?.flush(),
            ]),
        ),
      )
      .then(() => app.quit())
      .catch((error) => {
        quitting = false;
        windowController.setRuntime({ quitting: false });
        for (const target of quittingWindows) {
          if (!target || target.isDestroyed?.()) continue;
          try {
            target.show();
            target.focus();
            target.webContents.send(
              'reader:action',
              'companion-save-failed',
              error?.message || 'Could not save this document. It remains open here; try again.',
            );
          } catch {}
        }
      });
  });
}
