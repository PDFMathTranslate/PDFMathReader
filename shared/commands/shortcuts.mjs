export function commandAccelerator(platform, key) {
  return `${platform === 'darwin' ? 'Command' : 'CommandOrControl'}+${key}`;
}
export function closeWindowAccelerator(platform) {
  return platform === 'darwin' ? 'Ctrl+W' : 'CommandOrControl+Shift+W';
}

const entries = [
  ['settings', 'Settings…', 'File', 'app-settings', ','],
  ['new-window', 'New Window', 'File', 'file-new-window', 'N'],
  ['open', 'Open PDF…', 'File', 'file-open', 'O'],
  ['close-document', 'Close Document', 'File', 'file-close-document', 'W'],
  ['close-window', 'Close Window', 'File', 'file-close-window'],
  ['preferences', 'Preference', 'Edit', 'edit-preferences'],
  ['page-edit:rotate', 'Rotate Current Page', 'Edit', 'edit-rotate-page'],
  ['page-edit:align-width', 'Align Page Widths', 'Edit', 'edit-align-width'],
  ['page-edit:align-height', 'Align Page Heights', 'Edit', 'edit-align-height'],
  ['search', 'Find…', 'View', 'view-search', 'F'],
  ['translation', 'Show Original / Translation', 'View', 'view-translation', 'R'],
  ['zoom-in', 'Zoom In', 'View', 'view-zoom-in', '='],
  ['zoom-out', 'Zoom Out', 'View', 'view-zoom-out', '-'],
  ['fit-width', 'Fit Width', 'View', 'view-fit-width', '0'],
  ['fit-height', 'Fit Height', 'View', 'view-fit-height', '9'],
  ['sidebar', 'Toggle Sidebar', 'View', 'view-sidebar', 'B'],
  ['crop:x:more', 'Crop More Horizontally', 'View', 'crop-x-more'],
  ['crop:x:less', 'Crop Less Horizontally', 'View', 'crop-x-less'],
  ['crop:y:more', 'Crop More Vertically', 'View', 'crop-y-more'],
  ['crop:y:less', 'Crop Less Vertically', 'View', 'crop-y-less'],
  ['crop:reset', 'Reset Crop', 'View', 'crop-reset'],
  ['layout:vertical', 'Vertical', 'View', 'layout-vertical'],
  ['layout:horizontal', 'Horizontal', 'View', 'layout-horizontal'],
  ...[1, 2, 4].map((n) => [
    `columns:${n}`,
    { 1: 'One Side', 2: 'Two Sides', 4: 'Quad Side' }[n],
    'View',
    `columns-${n}`,
    String(n === 4 ? 3 : n),
  ]),
  ['toggle-fullscreen', 'Toggle Full Screen', 'View', 'view-fullscreen'],
  ['page-previous', 'Previous Page', 'navigation', 'go-previous'],
  ['page-next', 'Next Page', 'navigation', 'go-next'],
  ['page-first', 'First Page', 'navigation', 'go-first'],
  ['page-last', 'Last Page', 'navigation', 'go-last'],
  ...Array.from({ length: 10 }, (_, i) => [
    `percent:${(i + 1) * 10}`,
    `Go to ${(i + 1) * 10}%`,
    'navigation',
    `go-percent-${(i + 1) * 10}`,
    `Shift+${(i + 1) % 10}`,
  ]),
  ['force-retranslate', 'Force Retranslate', 'Translation', 'translation-force-retranslate'],
  ['language', 'Choose Language…', 'Translation', 'translation-language', 'L'],
  ['kernel', 'Choose Kernel…', 'Translation', 'translation-kernel', 'K'],
];
export function shortcutCatalog(platform) {
  return entries.map(([id, label, group, menuId, key]) => {
    let defaults = key ? [commandAccelerator(platform, key)] : [];
    if (id === 'close-window') defaults = [closeWindowAccelerator(platform)];
    if (id === 'toggle-fullscreen')
      defaults = [platform === 'darwin' ? 'Command+Control+F' : 'F11'];
    if (id === 'page-previous') defaults = ['PageUp', 'Shift+Up', 'Shift+Left'];
    if (id === 'page-next') defaults = ['PageDown', 'Shift+Down', 'Shift+Right'];
    if (id === 'page-first') defaults = ['Home'];
    if (id === 'page-last') defaults = ['End'];
    if (id === 'zoom-in')
      defaults.push(
        commandAccelerator(platform, 'Plus'),
        commandAccelerator(platform, 'Shift+Plus'),
      );
    return { id, action: id, label, group, menuId, defaults };
  });
}
const keyAliases = {
  arrowup: 'Up',
  arrowdown: 'Down',
  arrowleft: 'Left',
  arrowright: 'Right',
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  home: 'Home',
  end: 'End',
  space: 'Space',
  ' ': 'Space',
  tab: 'Tab',
  enter: 'Enter',
  return: 'Enter',
  backspace: 'Backspace',
  delete: 'Delete',
  escape: 'Escape',
  esc: 'Escape',
  plus: 'Plus',
};
export function normalizeShortcutAccelerator(platform, value) {
  if (typeof value !== 'string' || !value || value.length > 100) throw Error('Invalid shortcut');
  const pieces = value.replace(/\+\+$/, '+Plus').split('+');
  const rawKey = pieces.pop();
  const key =
    keyAliases[rawKey.toLowerCase()] ||
    (/^[a-z0-9,.;/[\]\\='`-]$/i.test(rawKey)
      ? rawKey.toUpperCase()
      : /^f(?:[1-9]|1\d|2[0-4])$/i.test(rawKey)
        ? rawKey.toUpperCase()
        : null);
  if (!key) throw Error('Invalid shortcut key');
  const modifiers = new Set();
  for (const piece of pieces) {
    const token = piece.toLowerCase();
    const modifier = ['commandorcontrol', 'cmdorctrl'].includes(token)
      ? platform === 'darwin'
        ? 'Command'
        : 'Control'
      : ['command', 'cmd', 'meta', 'super'].includes(token)
        ? 'Command'
        : ['control', 'ctrl'].includes(token)
          ? 'Control'
          : ['alt', 'option'].includes(token)
            ? 'Alt'
            : token === 'shift'
              ? 'Shift'
              : null;
    if (!modifier || modifiers.has(modifier)) throw Error('Invalid shortcut modifier');
    modifiers.add(modifier);
  }
  return [...['Command', 'Control', 'Alt', 'Shift'].filter((m) => modifiers.has(m)), key].join('+');
}
export function effectiveShortcutBindings(platform, overrides = {}) {
  return Object.fromEntries(
    shortcutCatalog(platform).map((entry) => [
      entry.id,
      Object.hasOwn(overrides || {}, entry.id)
        ? overrides[entry.id] === null
          ? []
          : [overrides[entry.id]]
        : entry.defaults,
    ]),
  );
}
function reserved(platform, value) {
  const primary = platform === 'darwin' ? 'Command' : 'Control';
  return (
    ['C', 'X', 'V', 'A', 'Z', 'Shift+Z', 'Y', 'Q', 'H', 'M', 'Shift+H', 'Alt+I'].some(
      (key) => value === `${primary}+${key}`,
    ) || ['Escape', 'Tab', 'Shift+Tab', 'F10', 'Alt+F4', 'Command+Control+F'].includes(value)
  );
}
export function validateShortcutBinding(platform, overrides, id, value) {
  if (!shortcutCatalog(platform).some((entry) => entry.id === id))
    throw Error('Unknown shortcut action');
  const next = { ...overrides };
  if (value === undefined) delete next[id];
  else if (value === null) next[id] = null;
  else {
    const accelerator = normalizeShortcutAccelerator(platform, value);
    const parts = accelerator.split('+');
    const nativeFullscreen =
      platform === 'darwin' && id === 'toggle-fullscreen' && accelerator === 'Command+Control+F';
    if (reserved(platform, accelerator) && !nativeFullscreen)
      throw Error('Shortcut reserved by the system');
    if (
      !parts.some((p) => ['Command', 'Control', 'Alt'].includes(p)) &&
      !/^(?:F\d+|PageUp|PageDown|Up|Down|Left|Right|Home|End|Space)$/.test(parts.at(-1))
    )
      throw Error('Use a modifier for this shortcut');
    next[id] = accelerator;
  }
  const used = new Map();
  for (const [action, bindings] of Object.entries(effectiveShortcutBindings(platform, next))) {
    for (const binding of bindings) {
      const accelerator = normalizeShortcutAccelerator(platform, binding);
      if (used.has(accelerator) && used.get(accelerator) !== action)
        throw Error('Shortcut already in use: ' + used.get(accelerator));
      used.set(accelerator, action);
    }
  }
  return next;
}
export function validShortcutOverrides(platform, value) {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    return false;
  try {
    // Validate the final set, allowing two actions to exchange bindings.
    for (const [id, binding] of Object.entries(value)) {
      if (
        !entries.some((entry) => entry[0] === id) ||
        (binding !== null && normalizeShortcutAccelerator(platform, binding) !== binding)
      )
        return false;
      validateShortcutBinding(platform, value, id, binding);
    }
    return true;
  } catch {
    return false;
  }
}
export function shortcutAction(platform, input, overrides = {}) {
  if (!input || input.type !== 'keyDown' || input.isAutoRepeat) return null;
  let key = String(input.key || '');
  if (/^Digit\d$/.test(input.code || '')) key = input.code.slice(-1);
  // Electron reports '=' or '+' for zoom, depending on the keyboard layout.
  const modifiers = [
    ...(input.meta ? ['Command'] : []),
    ...(input.control ? ['Control'] : []),
    ...(input.alt ? ['Alt'] : []),
    ...(input.shift ? ['Shift'] : []),
  ];
  let accelerator;
  try {
    accelerator = normalizeShortcutAccelerator(
      platform,
      [...modifiers, key === '+' ? 'Plus' : key].join('+'),
    );
  } catch {
    return null;
  }
  for (const [action, bindings] of Object.entries(effectiveShortcutBindings(platform, overrides))) {
    if (bindings.some((binding) => normalizeShortcutAccelerator(platform, binding) === accelerator))
      return action;
  }
  return null;
}
