export function registerCredentialsIPC({
  handle,
  trustedWindow,
  registry,
  credentials,
  serviceCredentialStore,
}) {
  for (const action of ['status', 'save', 'clear'])
    handle(`credentials:${action}`, async (event, value) => {
      trustedWindow(event);
      if (action === 'status') return credentials.status();
      const result = await (action === 'save' ? credentials.save(value) : credentials.clear());
      for (const target of registry.windows.keys())
        if (!target.isDestroyed()) target.webContents.send('credentials:changed');
      return result;
    });
  for (const action of ['status', 'load', 'save', 'clear'])
    handle(`serviceCredentials:${action}`, async (event, value) => {
      trustedWindow(event);
      if (action === 'status') return serviceCredentialStore.status();
      if (action === 'load') return serviceCredentialStore.load(value);
      const result = await (action === 'save'
        ? serviceCredentialStore.save(value)
        : serviceCredentialStore.clear(value));
      for (const target of registry.windows.keys())
        if (!target.isDestroyed()) target.webContents.send('serviceCredentials:changed');
      return result;
    });
}
