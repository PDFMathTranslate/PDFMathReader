import { shell } from 'electron';

export function registerUpdatesIPC({
  handle,
  trustedWindow,
  appUpdates,
  preferences,
  registry,
  releaseLink,
}) {
  handle('updates:status', (event) => {
    trustedWindow(event);
    return appUpdates.status();
  });
  handle('updates:check', (event) => {
    trustedWindow(event);
    return appUpdates.check();
  });
  handle('updates:install', (event) => {
    trustedWindow(event);
    return appUpdates.install();
  });
  handle('updates:automatic', async (event, value) => {
    trustedWindow(event);
    if (typeof value !== 'boolean') throw Error('Invalid automatic update setting');
    await preferences.save({ autoCheckUpdates: value });
    for (const state of registry.windows.values()) state.preferences.autoCheckUpdates = value;
    return appUpdates.setAutomatic(value);
  });
  handle('updates:openRelease', async (event) => {
    trustedWindow(event);
    const state = appUpdates.status();
    const url = releaseLink(state.downloadUrl, { download: true }) || releaseLink(state.releaseUrl);
    if (!url) throw Error('No published update');
    await shell.openExternal(url);
  });
}
