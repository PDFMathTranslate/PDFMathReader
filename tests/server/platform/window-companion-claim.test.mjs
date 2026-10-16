import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFile } from 'node:fs/promises';

// The controller imports Electron and other desktop-only modules at module load
// time. Load its real source with those imports replaced by small test doubles so
// the tests still exercise createWindow itself in the regular Node test runner.
const controllerSource = await readFile(
  new URL('../../../electron/main/windows/window-controller.mjs', import.meta.url),
  'utf8',
);
const controllerModule = [
  `import { createWindowServiceMode } from ${JSON.stringify(new URL('../../../electron/main/windows/window-service-mode.mjs', import.meta.url).href)};`,
  `
const popupGlassMenu = () => false;
const createTabGroups = () => ({
  anchorFor: () => null,
  adopt: () => {},
  presentLoaded: () => false,
  titleChanged: () => {},
  beforeClose: () => false,
  forget: () => {},
  isInactiveTab: () => false,
  select: async (target) => target,
});
const applicationPath = (...parts) => parts.join('/');
const activeAppIcon = (icon) => icon;
const appIconPath = () => '/tmp/test-icon.icns';
const detectEmails = () => [];
const detectLinks = () => [];
const linkLabel = (url) => url;
const app = {};
const BrowserWindow = class {};
const dialog = {};
const Menu = {};
const shell = {};
const randomBytes = (size) => ({ toString: () => 'a'.repeat(size * 2) });
const realpath = async (path) => path;
const stat = async () => ({ ino: 0n, dev: 0n });
const fileURLToPath = (url) => String(url);
`,
  controllerSource
    .replace(/^import [^\n]+;\n/gm, '')
    .replace('export function createWindowController', 'function createWindowController'),
  '\nexport { createWindowController };',
].join('\n');
const { createWindowController } = await import(
  `data:text/javascript;base64,${Buffer.from(controllerModule).toString('base64')}`
);

class FakeWebContents extends EventEmitter {
  constructor() {
    super();
    this.messages = [];
    this.session = {
      setPermissionRequestHandler: () => {},
      setPermissionCheckHandler: () => {},
      webRequest: { onBeforeSendHeaders: () => {} },
    };
  }

  isDestroyed() {
    return false;
  }

  send(...message) {
    this.messages.push(message);
  }

  setZoomFactor() {}

  setVisualZoomLevelLimits() {}

  setWindowOpenHandler() {}

  executeJavaScript() {
    return Promise.resolve();
  }
}

class FakeBrowserWindow extends EventEmitter {
  static nextId = 1;

  constructor(options) {
    super();
    this.id = FakeBrowserWindow.nextId++;
    this.options = options;
    this.webContents = new FakeWebContents();
    this.loadedURL = null;
    this.destroyed = false;
    this.visible = false;
  }

  isDestroyed() {
    return this.destroyed;
  }

  isFullScreen() {
    return false;
  }

  isMinimized() {
    return false;
  }

  isMaximized() {
    return false;
  }

  isVisible() {
    return this.visible;
  }

  isFocused() {
    return false;
  }

  show() {
    this.visible = true;
  }

  showInactive() {
    this.visible = true;
  }

  focus() {}

  restore() {}

  hide() {
    this.visible = false;
  }

  destroy() {
    this.destroyed = true;
  }

  close() {}

  loadURL(url) {
    this.loadedURL = url;
    return Promise.resolve();
  }

  setWindowButtonVisibility() {}

  setWindowButtonPosition() {}

  setAutoHideMenuBar() {}

  setMenuBarVisibility() {}
}

function fixture() {
  const backend = { origin: 'http://backend.test', close: async () => {} };
  const windows = new Map();
  const owner = new FakeBrowserWindow({ title: 'owner' });
  const preferences = {
    appIcon: 'preview',
    interactionMode: 'reading',
    interfaceStyle: 'system',
    reduceBackgroundFrameRate: false,
    reduceTransparency: false,
    shortcutBindings: {},
    windowMode: 'windows',
  };
  const stateFor = (target) => (target ? windows.get(target) : undefined);
  const registry = {
    windows,
    settingsWindows: new Map(),
    closingBackends: new Set(),
    openingDocuments: new Map(),
    stateFor,
    setActiveTabResolver: () => {},
    focusedWindow: () => owner,
    annotationSourceForDocument: () => null,
  };
  windows.set(owner, {
    backend,
    settingsOwner: null,
    preferences,
    documents: ['owner.pdf'],
    annotationSources: new Map(),
    performance: { hasDocument: true, peaks: new Map(), timer: null, samples: 0 },
  });
  const claimed = [];
  const controller = createWindowController({
    app: {
      getPreferredSystemLanguages: () => ['en-US'],
      getLocale: () => 'en-US',
    },
    BrowserWindow: FakeBrowserWindow,
    dialog: { showErrorBox: () => {} },
    Menu: { buildFromTemplate: () => ({ popup: () => {} }) },
    shell: { openExternal: () => {} },
    registry,
    windowPerformance: {
      windowActive: () => false,
      update: () => {},
      stop: () => {},
    },
    smoke: false,
    ciLaunchCheck: false,
    ciLaunchTimeoutMs: 100,
    windowsBuild: 0,
    backgroundRenderSmoke: false,
    token: 'test-token',
    getBackendOptions: () => ({}),
    getPreferences: () => ({ load: () => ({ ...preferences }) }),
    getDocumentSession: () => ({ close: async () => {} }),
    developerMonitor: { sync: () => Promise.resolve(), close: () => {} },
    startBackendService: () => Promise.resolve(backend),
    trackBackendCommunications: () => () => {},
    developerOperationMetrics: { fileOpen: () => {} },
    dependencyProjects: [],
    windowChromeOptions: () => ({}),
    shortcutAction: () => null,
    menuLabel: (label) => label,
    resolveUILanguage: (_preferred, fallback) => fallback,
    handleBackendFailure: () => {},
    getRebuildMenu: () => () => {},
    getUpdateMenu: () => () => {},
    updateAppearance: () => {},
    claimCompanionDocument: async (...args) => {
      claimed.push(args);
    },
    releaseCompanionDocument: async () => {},
    companionOwnership: () => null,
    flushCompanionPersistence: async () => {},
  });
  return { claimed, controller, owner };
}

test('blank and library windows do not claim companion documents', async () => {
  const { claimed, controller } = fixture();

  await controller.createWindow(undefined);
  await controller.createWindow(null);

  assert.equal(claimed.length, 0);
});

test('settings windows do not claim companion documents', async () => {
  const { claimed, controller, owner } = fixture();

  await controller.openSettingsWindow(owner, 'general');

  assert.equal(claimed.length, 0);
});

test('PDF windows claim their companion document', async () => {
  const { claimed, controller } = fixture();

  const target = await controller.createWindow('/tmp/example.pdf');

  assert.equal(claimed.length, 1);
  assert.equal(claimed[0][0], '/tmp/example.pdf');
  assert.equal(claimed[0][1], target);
  assert.equal(claimed[0][2], target);
});
