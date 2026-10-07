import { app, dialog, ipcMain, nativeTheme, safeStorage, systemPreferences } from 'electron';
import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
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
import { createDocumentSession } from './main/services/document-session.mjs';
import { createRecents } from './main/services/recents.mjs';
import { createReaderPreferences } from './main/services/preferences.mjs';
import { readSystemPDF, validateSystemPDF, pdfLaunchPaths } from './main/services/documents.mjs';
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
  let backend;
  let window;
  let credentials;
  let serviceCredentialStore;
  let preferences;
  let recents;
  let annotations;
  let documentSession;
  let appUpdates;
  let backendOptions;
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
      if (!target.isDestroyed()) target.webContents.send('appearance:changed', appearance());
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
      if (process.platform === 'darwin' && !app.isPackaged && !smoke)
        app.dock.setIcon(fileURLToPath(new URL('../doc/icon.png', import.meta.url)));

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
      preferences = readerPreferences;
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
            if (!target.isDestroyed()) target.webContents.send('updates:changed', state);
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
          return status;
        },
        clear: async () => {
          const status = await credentialStore.clear();
          await Promise.all(
            [...windows.values()].map((state) =>
              state.backend.setCredentials(credentialStore.getKey(), status),
            ),
          );
          return status;
        },
      };
      const quickLinks = createQuickLinkStore(join(app.getPath('userData'), 'quick-links'));

      menuController = createApplicationMenu({
        app,
        platform: process.platform,
        smoke,
        registry,
        preferences,
        recents,
        validateSystemPDF,
        openDocumentWindow: windowController.openDocumentWindow,
        createWindow: windowController.createWindow,
        handleBackendFailure,
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
      registerUpdatesIPC({
        handle: handleMeasuredIPC,
        trustedWindow: registry.trustedWindow,
        appUpdates,
        preferences,
        registry,
        releaseLink,
      });
      registerPreferencesIPC({
        handle: handleMeasuredIPC,
        trustedWindow: registry.trustedWindow,
        registry,
        preferences,
        appUpdates,
        backendOptions,
        token,
        setWindowVibrancy: windowController.setWindowVibrancy,
        updateAppearance,
        rebuildMenu: menuController.rebuild,
        updateMenu: menuController.updateMenu,
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
        handle: handleMeasuredIPC,
        trustedWindow: registry.trustedWindow,
        registry,
        annotations,
        documentSession,
        readSystemPDF,
        validateSystemPDF,
        documentIdentity: windowController.documentIdentity,
        focusDocumentWindow: windowController.focusDocumentWindow,
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
        createWindow: windowController.createWindow,
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
      menuController.rebuild();

      let externalLaunch = false;
      const openLaunchFiles = async () => {
        if (ciLaunchCheck || !pendingFiles.length) return;
        externalLaunch = true;
        await deliverPendingFiles();
      };
      await openLaunchFiles();
      if (!smoke && !ciLaunchCheck && preferences.load().restoreDocuments) {
        for (const document of documentSession.restore()) {
          await openLaunchFiles();
          try {
            await validateSystemPDF(document.path);
          } catch {
            continue;
          }
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
    if (!backend || quitting) return;
    event.preventDefault();
    quitting = true;
    windowController.setRuntime({ quitting: true });
    void Promise.allSettled(
      [...windows.keys()].map(windowController.saveWindowReadingView),
    ).finally(() =>
      Promise.allSettled(
        [...windows.values()]
          .map((state) => state.backend.close())
          .concat([
            ...closingBackends,
            preferences?.flush(),
            serviceCredentialStore?.flush(),
            recents?.flush(),
            documentSession?.saveOnQuit(),
            annotations?.flush(),
          ]),
      ).finally(() => app.quit()),
    );
  });
}
