const SHORTCUT_ACTIONS = Object.freeze({
  f: 'search',
  w: 'close-document',
  o: 'open',
  n: 'new-window',
  r: 'translation',
  b: 'sidebar',
  ',': 'settings',
  l: 'language',
  k: 'kernel',
  '+': 'zoom-in',
  '=': 'zoom-in',
  '-': 'zoom-out',
});

export function commandAccelerator(platform, key) {
  return `${platform === 'darwin' ? 'Command' : 'CommandOrControl'}+${key}`;
}
export function closeWindowAccelerator(platform) {
  return platform === 'darwin' ? 'Ctrl+W' : 'CommandOrControl+Shift+W';
}

export function shortcutAction(platform, input) {
  if (!input || input.type !== 'keyDown') return null;
  const key = String(input.key || '').toLowerCase();
  if (!input.meta && !input.control && !input.alt) {
    if (key === 'pageup' || (input.shift && ['arrowup', 'arrowleft'].includes(key)))
      return 'page-previous';
    if (key === 'pagedown' || (input.shift && ['arrowdown', 'arrowright'].includes(key)))
      return 'page-next';
  }
  if (platform !== 'darwin' && key === 'f11' && !input.meta && !input.control && !input.alt)
    return 'toggle-fullscreen';
  if (
    platform === 'darwin' &&
    key === 'f' &&
    input.meta &&
    input.control &&
    !input.alt &&
    !input.shift
  )
    return 'toggle-fullscreen';
  if (platform === 'darwin') {
    if (key === 'w' && input.control && !input.meta && !input.alt && !input.shift)
      return 'close-window';
    if (!input.meta || input.control || input.alt) return null;
  } else {
    if (key === 'w' && input.control && !input.meta && !input.alt && input.shift)
      return 'close-window';
    if (!input.control || input.meta || input.alt) return null;
  }
  const digit = /^Digit[0-9]$/.test(input.code || '')
    ? input.code.slice(-1)
    : /^\d$/.test(key)
      ? key
      : null;
  if (digit !== null)
    return input.shift
      ? 'percent:' + (digit === '0' ? 100 : Number(digit) * 10)
      : {
          0: 'fit-width',
          9: 'fit-height',
          1: 'columns:1',
          2: 'columns:2',
          3: 'columns:4',
        }[digit] || null;
  return SHORTCUT_ACTIONS[key] || null;
}
