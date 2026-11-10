import { Menu } from 'electron';
import { popupGlassMenu } from '../services/glass-menu.mjs';

const PAGE_MENU_ACTIONS = [
  'copy',
  'paste',
  'move-first',
  'move-earlier',
  'move-later',
  'move-last',
];

// The renderer describes the selection; the menu returns the chosen action name only.
export function registerPageMenuIPC({ handle, trustedWindow, registry, menuLabel, locale }) {
  handle('documents:pageMenu', (event, value) => {
    const target = trustedWindow(event);
    const count = value?.count,
      paste = value?.paste;
    if (!Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(paste) || paste < 0)
      throw Error('Invalid page menu.');
    const language = locale(target);
    return new Promise((resolve) => {
      let selected = null;
      const item = (action, label, options = {}) => ({
        label: menuLabel(label, language),
        click: () => {
          selected = action;
        },
        ...options,
      });
      const shortcut = (key) => ({ accelerator: `CmdOrCtrl+${key}`, registerAccelerator: false });
      const template = [
        item('copy', count > 1 ? 'Copy Pages' : 'Copy Page', shortcut('C')),
        item('paste', paste > 1 ? 'Paste Pages' : 'Paste Page', {
          ...shortcut('D'),
          enabled: paste > 0,
        }),
        { type: 'separator' },
        item('move-first', 'Move to Beginning', { enabled: !value.first }),
        item('move-earlier', 'Move Earlier', { enabled: !value.first }),
        item('move-later', 'Move Later', { enabled: !value.last }),
        item('move-last', 'Move to End', { enabled: !value.last }),
      ];
      const callback = () => resolve(PAGE_MENU_ACTIONS.includes(selected) ? selected : null);
      if (
        !popupGlassMenu({
          target,
          template,
          Menu,
          callback,
          enabled: registry.stateFor(target)?.preferences?.interfaceStyle === 'liquid-glass',
        })
      )
        Menu.buildFromTemplate(template).popup({ window: target, callback });
    });
  });
}
