import { nativeTheme, shell, dialog } from 'electron';
import { mkdir } from 'node:fs/promises';
import {
  shortcutCatalog,
  effectiveShortcutBindings,
  validateShortcutBinding,
} from '../../../shared/commands/shortcuts.mjs';
import { WINDOW_LOCAL_PREFERENCES, mergeWindowPreferences } from './window-preferences.mjs';

const SETTINGS_PREFERENCES = [
  'autoCheckUpdates',
  'reduceBackgroundFrameRate',
  'cacheLimitMB',
  'documentOpenMode',
  'reuseTranslations',
  'epubEnabled',
  'ultraFastSerif',
  'ultraFastFont',
  'originalSansFont',
  'originalSerifFont',
  'originalMonoFont',
  'translatedSansFont',
  'translatedSerifFont',
  'translatedMonoFont',
  'originalCjkSansFont',
  'originalCjkSerifFont',
  'originalCjkMonoFont',
  'translatedCjkSansFont',
  'translatedCjkSerifFont',
  'translatedCjkMonoFont',
  'recentDocumentFonts',
  'reduceResourceUsage',
  'restoreDocuments',
  'windowMode',
  'interactionMode',
  'optimizeParagraphGaps',
  'language',
  'sourceLanguage',
  'concurrency',
  'pageConcurrency',
  'automatic',
  'documentLanguageDetection',
  'topicSentenceDetection',
  'tocGenerationEnabled',
  'translationCompareEnabled',
  'watermarkRemovalEnabled',
  'recentMagicZoomEnabled',
  'tfidfWeightingEnabled',
  'forceSmoothScrolling',
  'paragraphContinuationDetection',
  'jevApiToken',
  'remoteKernelEnabled',
  'remoteKernelUrl',
  'remoteKernelService',
  'companionDiscoveryEnabled',
  'layoutVisible',
  'emphasizeTopicSentences',
  'emphasizeInformation',
  'emphasizeResearchFindings',
  'emphasizeOrdinals',
  'emphasizeKeyVerbs',
  'emphasizeLogicalConnectives',
  'bionicReading',
  'bionicFixedLength',
  'bionicOriginalOnly',
  'autoHideHeader',
  'uiLanguage',
  'kernelAdvancedOptions',
  'translationServices',
  'translationServiceHistory',
  'customTranslationServices',
];
const APPEARANCE_PREFERENCES = [
  'interfaceStyle',
  'appearance',
  'accentColor',
  'reduceMotion',
  'reduceTransparency',
  'reducePadding',
];

const preferenceSnapshot = (state) =>
  Object.fromEntries(APPEARANCE_PREFERENCES.map((key) => [key, state?.[key]]));
const samePreferences = (left, right) =>
  APPEARANCE_PREFERENCES.every((key) => left[key] === right[key]);
export function registerPreferencesIPC({
  handle,
  trustedWindow,
  registry,
  preferences,
  appUpdates,
  backendOptions,
  token,
  setWindowVibrancy,
  updateAppearance,
  rebuildMenu,
  updateMenu,
  setWindowMode,
  setCompanionDiscoveryEnabled,
}) {
  const shortcutSnapshot = () => {
    const overrides = preferences.load().shortcutBindings || {};
    return {
      catalog: shortcutCatalog(process.platform),
      bindings: effectiveShortcutBindings(process.platform, overrides),
      overrides,
    };
  };
  const syncShortcuts = () => {
    const snapshot = shortcutSnapshot();
    for (const [window, state] of registry.windows) {
      state.preferences.shortcutBindings = { ...snapshot.overrides };
      if (!window.webContents.isCrashed?.()) window.webContents.send('shortcuts:changed', snapshot);
    }
    rebuildMenu();
    return snapshot;
  };
  handle('preferences:choosePromptFile', async (event) => {
    const target = trustedWindow(event);
    const result = await dialog.showOpenDialog(target, {
      properties: ['openFile'],
      filters: [
        { name: 'Text files', extensions: ['txt', 'md', 'text', 'prompt'] },
        { name: 'All files', extensions: ['*'] },
      ],
    });
    return result.canceled ? null : result.filePaths[0] || null;
  });
  handle('shortcuts:load', (event) => {
    trustedWindow(event);
    return shortcutSnapshot();
  });
  handle('shortcuts:recording', (event, active) => {
    const target = trustedWindow(event);
    if (typeof active !== 'boolean') throw Error('Invalid shortcut recording state');
    registry.stateFor(target).shortcutRecording = active;
    target.webContents.setIgnoreMenuShortcuts(active);
    return active;
  });
  for (const action of ['save', 'reset'])
    handle(`shortcuts:${action}`, async (event, id, value) => {
      trustedWindow(event);
      const current = preferences.load().shortcutBindings || {};
      const next =
        action === 'reset' && id === undefined
          ? {}
          : validateShortcutBinding(
              process.platform,
              current,
              id,
              action === 'reset' ? undefined : value,
            );
      const write = preferences.save({ shortcutBindings: next });
      const snapshot = syncShortcuts();
      await write;
      return snapshot;
    });
  for (const action of ['load', 'save'])
    handle(`preferences:${action}`, async (event, value) => {
      const target = trustedWindow(event);
      if (action === 'load') return registry.stateFor(target).preferences;
      const senderBefore = { ...registry.stateFor(target).preferences };
      const previous = preferences.load();
      const write = preferences.save(value);
      const next = preferences.load();
      if (JSON.stringify(previous.shortcutBindings) !== JSON.stringify(next.shortcutBindings))
        syncShortcuts();
      if (previous.autoCheckUpdates !== next.autoCheckUpdates)
        appUpdates.setAutomatic(next.autoCheckUpdates);
      if (previous.companionDiscoveryEnabled !== next.companionDiscoveryEnabled)
        await setCompanionDiscoveryEnabled?.(next.companionDiscoveryEnabled);
      if (previous.cacheLimitMB !== next.cacheLimitMB) {
        backendOptions.cacheLimitMB = next.cacheLimitMB;
        await Promise.all(
          [...new Set([...registry.windows.values()].map((state) => state.backend))].map(
            (service) =>
              fetch(service.origin + '/api/cache/limit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Preview-Token': token },
                body: JSON.stringify({ limitMB: next.cacheLimitMB }),
              }),
          ),
        );
      }
      nativeTheme.themeSource = next.appearance;
      if (previous.uiLanguage !== next.uiLanguage) rebuildMenu();
      if (previous.windowMode !== next.windowMode) setWindowMode?.(next.windowMode, target);
      // A settings window edits the selections of the document that opened it.
      const owner = registry.stateFor(target).settingsOwner || target;
      for (const [window, state] of registry.windows) {
        state.preferences = mergeWindowPreferences(
          next,
          state.preferences,
          value,
          window === target,
          window === owner || state.settingsOwner === owner,
        );
        setWindowVibrancy(window, state.preferences.reduceTransparency);
        window.webContents.setBackgroundThrottling(state.preferences.reduceBackgroundFrameRate);
      }
      if (!samePreferences(preferenceSnapshot(previous), preferenceSnapshot(next)))
        updateAppearance();
      if (
        SETTINGS_PREFERENCES.some((key) =>
          [
            'kernelAdvancedOptions',
            'recentDocumentFonts',
            'translationServices',
            'translationServiceHistory',
            'customTranslationServices',
          ].includes(key)
            ? JSON.stringify(previous[key]) !== JSON.stringify(next[key])
            : previous[key] !== next[key],
        )
      )
        for (const other of registry.windows.keys())
          if (other !== target && !other.webContents.isCrashed?.())
            other.webContents.send(
              'preferences:changed',
              Object.fromEntries(
                SETTINGS_PREFERENCES.map((key) => [key, registry.stateFor(other).preferences[key]]),
              ),
            );
      const senderState = registry.stateFor(target);
      const localChanges = Object.fromEntries(
        WINDOW_LOCAL_PREFERENCES.filter(
          (key) =>
            Object.prototype.hasOwnProperty.call(value || {}, key) &&
            senderBefore[key] !== senderState.preferences[key],
        ).map((key) => [key, senderState.preferences[key]]),
      );
      if (Object.keys(localChanges).length)
        for (const [other, state] of registry.windows) {
          if (other !== target && (other === owner || state.settingsOwner === owner)) {
            Object.assign(state.preferences, localChanges);
            if (!other.webContents.isCrashed?.())
              other.webContents.send('preferences:changed', localChanges);
          }
        }
      if (target === registry.focusedWindow()) updateMenu(target);
      return write;
    });
  handle('cache:openFolder', async (event) => {
    trustedWindow(event);
    // The renderer never supplies a path. Open only the configured cache root.
    await mkdir(backendOptions.cacheDir, { recursive: true });
    const error = await shell.openPath(backendOptions.cacheDir);
    if (error) throw Error(error);
    return { opened: true };
  });
  handle('cache:clear', async (event) => {
    const target = trustedWindow(event);
    const services = [...new Set([...registry.windows.values()].map((state) => state.backend))];
    const statuses = await Promise.all(
      services.map(async (service) => {
        const response = await fetch(service.origin + '/api/cache', {
          headers: { 'X-Preview-Token': token },
        });
        if (!response.ok) throw Error('Unable to inspect cache.');
        return response.json();
      }),
    );
    if (statuses.some((status) => status.busy))
      throw Error('409: Cache is in use. Try again after translation finishes.');
    const response = await fetch(registry.stateFor(target).backend.origin + '/api/cache/clear', {
      method: 'POST',
      headers: { 'X-Preview-Token': token, 'Content-Type': 'application/json' },
      body: '{}',
    });
    if (!response.ok) throw Error(response.status + ': Unable to clear cache.');
    return response.json();
  });
}

export { APPEARANCE_PREFERENCES, SETTINGS_PREFERENCES, WINDOW_LOCAL_PREFERENCES };
