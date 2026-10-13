export function registerTabsIPC({
  handle,
  trustedWindow,
  registry,
  tabs,
  newTab,
  handleBackendFailure,
  Menu,
  menuLabel,
  resolveUILanguage,
  app,
}) {
  const tabTarget = (event, id) => {
    const target = trustedWindow(event);
    if (!Number.isInteger(id)) throw Error('Invalid tab.');
    const tab = tabs.windowById(target, id);
    if (!tab) throw Error('Tab not found.');
    return { target, tab };
  };
  handle('tabs:list', (event) => tabs.tabsFor(trustedWindow(event)));
  handle('tabs:select', async (event, id) => {
    const { tab } = tabTarget(event, id);
    await tabs.select(tab);
    return true;
  });
  handle('tabs:close', (event, id) => {
    const { tab } = tabTarget(event, id);
    tab.close();
    return true;
  });
  handle('tabs:new', (event) => {
    const target = trustedWindow(event);
    void newTab(target).catch(handleBackendFailure);
    return true;
  });
  handle('tabs:move', (event, id, index) => {
    const { tab } = tabTarget(event, id);
    if (!Number.isInteger(index) || index < 0 || index > 1000) throw Error('Invalid tab position.');
    tabs.reorder(tab, index);
    return true;
  });
  handle('tabs:contextMenu', (event, id) => {
    const { target, tab } = tabTarget(event, id);
    const locale = resolveUILanguage(
      registry.stateFor(target)?.preferences?.uiLanguage || 'en',
      app.getPreferredSystemLanguages()[0] || app.getLocale(),
    );
    const siblings = () =>
      tabs.tabsFor(target).filter((entry) => entry.id !== id && entry.id !== target.id);
    const others = tabs.tabsFor(target).filter((entry) => entry.id !== id);
    Menu.buildFromTemplate([
      { label: menuLabel('Close Tab', locale), click: () => tab.close() },
      {
        label: menuLabel('Close Other Tabs', locale),
        enabled: others.length > 0,
        click: () => {
          // Close hidden tabs first so the kept tab never has to be revealed twice.
          for (const entry of siblings()) tabs.windowById(target, entry.id)?.close();
          if (target.id !== id) {
            void tabs.select(tab).then(() => {
              if (!target.isDestroyed()) target.close();
            });
          }
        },
      },
      { type: 'separator' },
      {
        label: menuLabel('Move Tab to New Window', locale),
        enabled: others.length > 0,
        click: () => void tabs.moveToNewWindow(tab),
      },
    ]).popup({ window: target });
    return true;
  });
}
