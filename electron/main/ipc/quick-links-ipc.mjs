export function registerQuickLinksIPC({ handle, trustedWindow, quickLinks }) {
  handle('quickLinks:load', (event, key) => {
    trustedWindow(event);
    return quickLinks.load(key);
  });
  handle('quickLinks:has', (event, key) => {
    trustedWindow(event);
    return quickLinks.has(key);
  });
  handle('quickLinks:save', (event, { key, links }) => {
    trustedWindow(event);
    return quickLinks.save(key, links);
  });
}
