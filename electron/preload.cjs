const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld(
  'previewChatGPTSubscription',
  Object.freeze({
    status: () => ipcRenderer.invoke('chatgptSubscription:status'),
    signIn: (value) => ipcRenderer.invoke('chatgptSubscription:signIn', value),
    cancel: () => ipcRenderer.invoke('chatgptSubscription:cancel'),
    select: (clientId) => ipcRenderer.invoke('chatgptSubscription:select', clientId),
    signOut: (clientId) => ipcRenderer.invoke('chatgptSubscription:signOut', clientId),
    models: () => ipcRenderer.invoke('chatgptSubscription:models'),
    onSignedIn: (callback) => {
      const listener = () => callback();
      ipcRenderer.on('chatgptSubscription:signedIn', listener);
      return () => ipcRenderer.removeListener('chatgptSubscription:signedIn', listener);
    },
    onChanged: (callback) => {
      const listener = () => callback();
      ipcRenderer.on('chatgptSubscription:changed', listener);
      return () => ipcRenderer.removeListener('chatgptSubscription:changed', listener);
    },
  }),
);
contextBridge.exposeInMainWorld(
  'previewSystemLocale',
  process.argv
    .find((arg) => arg.startsWith('--preview-system-locale='))
    ?.slice('--preview-system-locale='.length) || navigator.language,
);
contextBridge.exposeInMainWorld(
  'previewCredentials',
  Object.freeze({
    status: () => ipcRenderer.invoke('credentials:status'),
    onChange: (callback) => {
      const listener = () => callback();
      ipcRenderer.on('credentials:changed', listener);
      return () => ipcRenderer.removeListener('credentials:changed', listener);
    },
    save: (key) => ipcRenderer.invoke('credentials:save', key),
    clear: () => ipcRenderer.invoke('credentials:clear'),
  }),
);

contextBridge.exposeInMainWorld(
  'previewServiceCredentials',
  Object.freeze({
    status: () => ipcRenderer.invoke('serviceCredentials:status'),
    onChange: (callback) => {
      const listener = () => callback();
      ipcRenderer.on('serviceCredentials:changed', listener);
      return () => ipcRenderer.removeListener('serviceCredentials:changed', listener);
    },
    load: (selection) => ipcRenderer.invoke('serviceCredentials:load', selection),
    save: (value) => ipcRenderer.invoke('serviceCredentials:save', value),
    clear: (value) => ipcRenderer.invoke('serviceCredentials:clear', value),
  }),
);

contextBridge.exposeInMainWorld(
  'previewAppearance',
  Object.freeze({
    platform:
      process.argv.includes('--preview-test-mode') &&
      process.argv.includes('--preview-ui-platform=win32')
        ? 'win32'
        : process.platform,
    contentGlass: process.platform === 'darwin',
    windowsGlass: process.platform === 'win32' && process.argv.includes('--preview-windows-glass'),
    current: () => ipcRenderer.invoke('appearance:current'),
    onChange: (callback) => {
      const listener = (_event, value) => callback(value);
      ipcRenderer.on('appearance:changed', listener);
      return () => ipcRenderer.removeListener('appearance:changed', listener);
    },
  }),
);

contextBridge.exposeInMainWorld(
  'previewDocuments',
  Object.freeze({
    next: () => ipcRenderer.invoke('documents:next'),
    claim: (file) => ipcRenderer.invoke('documents:claim', webUtils.getPathForFile(file)),
    editPages: (value) => ipcRenderer.invoke('documents:editPages', value),
    closed: () => ipcRenderer.invoke('documents:closed'),
    saveView: (view) => ipcRenderer.invoke('documents:view', view),
    open: async (file) => {
      const path = webUtils.getPathForFile(file);
      return ipcRenderer.invoke(
        'documents:open',
        path ? { path } : { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) },
      );
    },
    onAvailable: (callback) => {
      const listener = () => callback();
      ipcRenderer.on('documents:available', listener);
      return () => ipcRenderer.removeListener('documents:available', listener);
    },
  }),
);

contextBridge.exposeInMainWorld('previewTestMode', process.argv.includes('--preview-test-mode'));

contextBridge.exposeInMainWorld(
  'previewAnnotations',
  Object.freeze({
    search: (provider, text) => ipcRenderer.invoke('previewAnnotations:search', { provider, text }),
    contextMenu: (kind) => ipcRenderer.invoke('previewAnnotations:contextMenu', kind),
    confirmDelete: (kind) => ipcRenderer.invoke('previewAnnotations:confirmDelete', kind),
    palette: () => ipcRenderer.invoke('previewAnnotations:palette'),
    markDeleteHint: () => ipcRenderer.invoke('previewAnnotations:markDeleteHint'),
    prepare: (bytes) => ipcRenderer.invoke('previewAnnotations:prepare', bytes),
    loadState: (key) => ipcRenderer.invoke('previewAnnotations:loadState', key),
    load: (key) => ipcRenderer.invoke('previewAnnotations:load', key),
    save: (value) => ipcRenderer.invoke('previewAnnotations:save', value),
    clean: (bytes) => ipcRenderer.invoke('previewAnnotations:clean', bytes),
    handover: (text) => ipcRenderer.invoke('previewAnnotations:handover', text),
    share: (text) => ipcRenderer.invoke('previewAnnotations:share', text),
  }),
);

contextBridge.exposeInMainWorld(
  'previewActions',
  Object.freeze({
    translatedFileReady: (ready) => ipcRenderer.invoke('window:translated-file-ready', ready),
    onAction: (callback) => {
      const listener = (_event, action, selectionText) => callback(action, selectionText);
      ipcRenderer.on('reader:action', listener);
      return () => ipcRenderer.removeListener('reader:action', listener);
    },
  }),
);

contextBridge.exposeInMainWorld(
  'previewPreferences',
  Object.freeze({
    load: () => ipcRenderer.invoke('preferences:load'),
    save: (value) => ipcRenderer.invoke('preferences:save', value),
    onChange: (callback) => {
      const listener = (_event, value) => callback(value);
      ipcRenderer.on('preferences:changed', listener);
      return () => ipcRenderer.removeListener('preferences:changed', listener);
    },
  }),
);

contextBridge.exposeInMainWorld(
  'previewShortcuts',
  Object.freeze({
    load: () => ipcRenderer.invoke('shortcuts:load'),
    save: (id, value) => ipcRenderer.invoke('shortcuts:save', id, value),
    reset: (id) => ipcRenderer.invoke('shortcuts:reset', id),
    recording: (active) => ipcRenderer.invoke('shortcuts:recording', active),
    onChange: (callback) => {
      const listener = (_event, value) => callback(value);
      ipcRenderer.on('shortcuts:changed', listener);
      return () => ipcRenderer.removeListener('shortcuts:changed', listener);
    },
  }),
);

contextBridge.exposeInMainWorld(
  'previewWindow',
  Object.freeze({
    new: () => ipcRenderer.invoke('window:new'),
    settings: (section) => ipcRenderer.invoke('window:settings', section),
    settingsInline: process.argv.includes('--preview-inline-settings'),
    onSettingsSection: (callback) => {
      const listener = (_event, section) => callback(section);
      ipcRenderer.on('settings:section', listener);
      return () => ipcRenderer.removeListener('settings:section', listener);
    },
    registerOptions: (value) => ipcRenderer.invoke('window:register-options', value),
    menu: () => ipcRenderer.invoke('window:menu'),
    menuAction: (path) => ipcRenderer.invoke('window:menu-action', path),
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    maximized: () => ipcRenderer.invoke('window:maximized'),
    onMaximized: (callback) => {
      const listener = (_event, value) => callback(value);
      ipcRenderer.on('window:maximized', listener);
      return () => ipcRenderer.removeListener('window:maximized', listener);
    },
    close: () => ipcRenderer.invoke('window:close'),
    closeStartPage: () => ipcRenderer.invoke('window:close-start-page'),
    fullscreen: () => ipcRenderer.invoke('window:fullscreen'),
    setHeaderHidden: (hidden) => ipcRenderer.invoke('window:header-hidden', hidden),
    onFullscreen: (callback) => {
      const listener = (_event, value) => callback(value);
      ipcRenderer.on('window:fullscreen', listener);
      return () => ipcRenderer.removeListener('window:fullscreen', listener);
    },
  }),
);

contextBridge.exposeInMainWorld(
  'previewRecents',
  Object.freeze({
    statusDialog: (value) => ipcRenderer.invoke('recents:statusDialog', value),
    list: () => ipcRenderer.invoke('recents:list'),
    clear: () => ipcRenderer.invoke('recents:clear'),
    open: (id) => ipcRenderer.invoke('recents:open', id),
    openWindow: (id) => ipcRenderer.invoke('recents:openWindow', id),
    preview: (id) => ipcRenderer.invoke('recents:preview', id),
    contextMenu: (id) => ipcRenderer.invoke('recents:contextMenu', id),
    setThumbnail: (id, thumbnail) => ipcRenderer.invoke('recents:setThumbnail', { id, thumbnail }),
    setView: (id, view) => ipcRenderer.invoke('recents:setView', { id, view }),
    setTranslationStatus: (id, status) =>
      ipcRenderer.invoke('recents:setTranslationStatus', { id, status }),
    remember: (file, ticket, thumbnail) =>
      ipcRenderer.invoke(
        'recents:remember',
        ticket ? { ticket, thumbnail } : { path: webUtils.getPathForFile(file), thumbnail },
      ),
  }),
);

contextBridge.exposeInMainWorld(
  'previewActivity',
  Object.freeze({
    current: () => ipcRenderer.invoke('window:activity'),
    onChange: (callback) => {
      const listener = (_event, value) => callback(value);
      ipcRenderer.on('activity:changed', listener);
      return () => ipcRenderer.removeListener('activity:changed', listener);
    },
  }),
);

contextBridge.exposeInMainWorld(
  'previewRenderInBackground',
  process.argv.includes('--preview-background-render'),
);

contextBridge.exposeInMainWorld(
  'previewPerformance',
  Object.freeze({
    sample: () => ipcRenderer.invoke('previewPerformance:sample'),
    reset: () => ipcRenderer.invoke('previewPerformance:reset'),
    end: () => ipcRenderer.invoke('previewPerformance:end'),
    save: (report) => ipcRenderer.invoke('previewPerformance:save', report),
  }),
);

contextBridge.exposeInMainWorld(
  'previewResize',
  Object.freeze({
    capture: (bounds) => ipcRenderer.invoke('previewResize:capture', bounds),
    onStart: (callback) => {
      const listener = () => callback();
      ipcRenderer.on('window:resize-start', listener);
      return () => ipcRenderer.removeListener('window:resize-start', listener);
    },
    onEnd: (callback) => {
      const listener = () => callback();
      ipcRenderer.on('window:resize-end', listener);
      return () => ipcRenderer.removeListener('window:resize-end', listener);
    },
  }),
);

contextBridge.exposeInMainWorld(
  'previewClipboard',
  Object.freeze({ writeText: (text) => ipcRenderer.invoke('clipboard:write-text', text) }),
);

contextBridge.exposeInMainWorld(
  'previewHaptics',
  Object.freeze({ tick: () => ipcRenderer.invoke('haptics:tick') }),
);

contextBridge.exposeInMainWorld(
  'previewQuickLinks',
  Object.freeze({
    load: (key) => ipcRenderer.invoke('quickLinks:load', key),
    save: (key, links) => ipcRenderer.invoke('quickLinks:save', { key, links }),
  }),
);

contextBridge.exposeInMainWorld(
  'previewDeveloper',
  Object.freeze({
    open: () => ipcRenderer.invoke('developer:open'),
    close: () => ipcRenderer.invoke('developer:close'),
    enabled: () => ipcRenderer.invoke('developer:enabled'),
    snapshot: () => ipcRenderer.invoke('developer:snapshot'),
    testContext: (windowId) => ipcRenderer.invoke('developer:test-context', windowId),
    runTest: (options) => ipcRenderer.invoke('developer:run-test', options),
    testStatus: () => ipcRenderer.invoke('developer:test-status'),
    cancelTest: () => ipcRenderer.invoke('developer:cancel-test'),
    copy: (text) => ipcRenderer.invoke('developer:copy', text),
    onChange: (callback) => {
      const listener = (_event, value) => callback(value);
      ipcRenderer.on('developer:changed', listener);
      return () => ipcRenderer.removeListener('developer:changed', listener);
    },
  }),
);

contextBridge.exposeInMainWorld(
  'previewCache',
  Object.freeze({
    clear: () => ipcRenderer.invoke('cache:clear'),
    openFolder: () => ipcRenderer.invoke('cache:openFolder'),
  }),
);

contextBridge.exposeInMainWorld(
  'previewUpdates',
  Object.freeze({
    status: () => ipcRenderer.invoke('updates:status'),
    check: () => ipcRenderer.invoke('updates:check'),
    install: () => ipcRenderer.invoke('updates:install'),
    setAutomatic: (value) => ipcRenderer.invoke('updates:automatic', value),
    openRelease: () => ipcRenderer.invoke('updates:openRelease'),
    onChange: (callback) => {
      const listener = (_event, value) => callback(value);
      ipcRenderer.on('updates:changed', listener);
      return () => ipcRenderer.removeListener('updates:changed', listener);
    },
  }),
);

contextBridge.exposeInMainWorld(
  'previewGlassMenu',
  Object.freeze({
    choose: (value) => ipcRenderer.invoke('glass-menu:choice', value),
    onOpen: (callback) => {
      const listener = (_event, value) => callback(value);
      ipcRenderer.on('glass-menu:open', listener);
      return () => ipcRenderer.removeListener('glass-menu:open', listener);
    },
    onClose: (callback) => {
      const listener = (_event, id) => callback(id);
      ipcRenderer.on('glass-menu:closed', listener);
      return () => ipcRenderer.removeListener('glass-menu:closed', listener);
    },
  }),
);
