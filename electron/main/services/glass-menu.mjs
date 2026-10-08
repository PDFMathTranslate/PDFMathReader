import { randomUUID } from 'node:crypto';

const pending = new Map();
export function registerGlassMenuIPC({ handle }) {
  handle('glass-menu:choice', (event, value) => {
    const entry = pending.get(event.sender.id);
    if (!entry || event.senderFrame !== event.sender.mainFrame || value?.id !== entry.id)
      return false;
    const item = value.item === null ? null : entry.items.get(value.item);
    if (value.item !== null && (!item || item.enabled === false || item.type === 'separator'))
      return false;
    try {
      if (item?.role === 'copy') event.sender.copy();
      else if (item?.role === 'selectAll') event.sender.selectAll();
      else item?.click?.(item, entry.target);
    } finally {
      entry.finish();
    }
    return true;
  });
}

// Keep commands and file paths in the main process. The renderer receives only
// presentation data and can choose one item from its own outstanding menu.
export function popupGlassMenu({ target, template, enabled, Menu, callback, x, y }) {
  if (!enabled || process.platform !== 'darwin') return false;
  const wc = target.webContents;
  pending.get(wc.id)?.finish();
  const nativeItems = Menu.buildFromTemplate(template).items;
  const id = randomUUID();
  const items = new Map(template.map((item, index) => [String(index), item]));
  const finish = () => {
    if (pending.get(wc.id)?.id !== id) return;
    pending.delete(wc.id);
    wc.removeListener('destroyed', finish);
    wc.removeListener('did-start-navigation', finish);
    if (!wc.isDestroyed()) wc.send('glass-menu:closed', id);
    callback?.();
  };
  pending.set(wc.id, { id, items, target, finish });
  wc.once('destroyed', finish);
  wc.once('did-start-navigation', finish);
  wc.send('glass-menu:open', {
    id,
    x,
    y,
    items: template.map((item, index) => ({
      id: String(index),
      label: nativeItems[index]?.label || item.label || item.role,
      type: item.type || 'normal',
      enabled: item.enabled !== false,
    })),
  });
  return true;
}
