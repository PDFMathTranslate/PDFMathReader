import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  effectiveShortcutBindings,
  normalizeShortcutAccelerator,
  shortcutAction,
  shortcutCatalog,
  validShortcutOverrides,
  validateShortcutBinding,
} from '../../../shared/commands/shortcuts.mjs';

function keyEvent(key, { code, meta = false, control = false, alt = false, shift = false } = {}) {
  return {
    type: 'keyDown',
    key,
    code: code || (/^[a-z]$/i.test(key) ? `Key${key.toUpperCase()}` : key),
    meta,
    control,
    alt,
    shift,
  };
}

function entry(platform, id) {
  const result = shortcutCatalog(platform).find((candidate) => candidate.id === id);
  assert.ok(result, `shortcut catalog is missing ${id}`);
  return result;
}

test('shortcut catalog exposes menu commands, navigation, and preserved aliases', () => {
  const catalog = shortcutCatalog('darwin');
  assert.ok(catalog.length >= 30);
  for (const id of [
    'settings',
    'new-window',
    'open',
    'close-document',
    'close-window',
    'preferences',
    'search',
    'translation',
    'zoom-in',
    'zoom-out',
    'fit-width',
    'fit-height',
    'sidebar',
    'page-previous',
    'page-next',
    'percent:50',
    'percent:100',
    'force-retranslate',
    'language',
    'kernel',
  ]) {
    const candidate = entry('darwin', id);
    assert.equal(candidate.id, candidate.action);
    assert.equal(typeof candidate.label, 'string');
    assert.ok(
      ['File', 'Edit', 'View', 'Go', 'Translation', 'navigation'].includes(candidate.group),
    );
    assert.ok(Array.isArray(candidate.defaults));
  }
  assert.ok(entry('darwin', 'zoom-in').defaults.includes('Command+='));
  assert.ok(
    entry('darwin', 'zoom-in').defaults.some(
      (binding) => binding === 'Command+Plus' || binding === 'Command+Shift+=',
    ),
  );
  assert.deepEqual(entry('darwin', 'page-previous').defaults, ['PageUp', 'Shift+Up', 'Shift+Left']);
  assert.deepEqual(entry('darwin', 'page-next').defaults, [
    'PageDown',
    'Shift+Down',
    'Shift+Right',
  ]);
  assert.equal(entry('darwin', 'toggle-fullscreen').defaults[0], 'Command+Control+F');
  assert.equal(entry('win32', 'toggle-fullscreen').defaults[0], 'F11');
  assert.equal(entry('linux', 'toggle-fullscreen').defaults[0], 'F11');
  assert.equal(entry('darwin', 'percent:50').defaults[0], 'Command+Shift+5');
});

test('effective bindings start at defaults and reset by removing an override', () => {
  const defaults = effectiveShortcutBindings('darwin', {});
  assert.ok(defaults['zoom-in'].includes('Command+='));
  assert.deepEqual(defaults['page-previous'], ['PageUp', 'Shift+Up', 'Shift+Left']);

  const overrides = { search: 'Command+G' };
  const remapped = effectiveShortcutBindings('darwin', overrides);
  assert.deepEqual(remapped.search, ['Command+G']);
  assert.deepEqual(overrides, { search: 'Command+G' });

  const reset = effectiveShortcutBindings('darwin', {});
  assert.deepEqual(reset.search, defaults.search);
});

test('accelerator normalization returns canonical platform tokens', () => {
  assert.equal(normalizeShortcutAccelerator('darwin', 'Cmd+shift+f'), 'Command+Shift+F');
  assert.equal(normalizeShortcutAccelerator('win32', 'Ctrl+Alt+PageUp'), 'Control+Alt+PageUp');
  assert.match(
    normalizeShortcutAccelerator('darwin', 'Command+Plus'),
    /^Command\+(?:Plus|Shift\+=)$/,
  );
  assert.equal(normalizeShortcutAccelerator('darwin', 'CommandOrControl+,'), 'Command+,');
  assert.throws(() => normalizeShortcutAccelerator('darwin', 'Command+Command+F'));
  assert.throws(() => normalizeShortcutAccelerator('darwin', 'Command'));
  assert.throws(() => normalizeShortcutAccelerator('darwin', 'Command+NotAKey'));
});

test('shortcutAction preserves default aliases on macOS and Windows', () => {
  assert.equal(shortcutAction('darwin', keyEvent('f', { meta: true })), 'search');
  assert.equal(shortcutAction('win32', keyEvent('f', { control: true })), 'search');
  assert.equal(shortcutAction('darwin', keyEvent('=', { meta: true })), 'zoom-in');
  assert.equal(shortcutAction('darwin', keyEvent('+', { meta: true, shift: true })), 'zoom-in');
  assert.equal(shortcutAction('darwin', keyEvent('PageUp')), 'page-previous');
  assert.equal(
    shortcutAction('darwin', keyEvent('ArrowLeft', { code: 'ArrowLeft', shift: true })),
    'page-previous',
  );
  assert.equal(shortcutAction('darwin', keyEvent('PageDown')), 'page-next');
  assert.equal(
    shortcutAction('win32', keyEvent('ArrowRight', { code: 'ArrowRight', shift: true })),
    'page-next',
  );
  assert.equal(shortcutAction('darwin', keyEvent('5', { meta: true, shift: true })), 'percent:50');
  assert.equal(
    shortcutAction('darwin', keyEvent('f', { meta: true, control: true })),
    'toggle-fullscreen',
  );
  assert.equal(shortcutAction('darwin', keyEvent('F11', { code: 'F11' })), null);
  assert.equal(shortcutAction('win32', keyEvent('F11', { code: 'F11' })), 'toggle-fullscreen');
});

test('remapping replaces the old binding and leaves other defaults intact', () => {
  const next = validateShortcutBinding('darwin', {}, 'search', 'Command+G');
  assert.deepEqual(next, { search: 'Command+G' });
  assert.equal(shortcutAction('darwin', keyEvent('f', { meta: true }), next), null);
  assert.equal(shortcutAction('darwin', keyEvent('g', { meta: true }), next), 'search');
  assert.equal(shortcutAction('darwin', keyEvent('r', { meta: true }), next), 'translation');
});

test('clear stores an empty override and disables every alias', () => {
  const next = validateShortcutBinding('darwin', { search: 'Command+G' }, 'search', null);
  assert.ok(next.search === null || Array.isArray(next.search));
  assert.deepEqual(effectiveShortcutBindings('darwin', next).search, []);
  assert.equal(shortcutAction('darwin', keyEvent('f', { meta: true }), next), null);
  assert.equal(shortcutAction('darwin', keyEvent('g', { meta: true }), next), null);
});

test('conflicts reject another action and native edit shortcuts without mutating overrides', () => {
  const overrides = { search: 'Command+G' };
  assert.throws(() => validateShortcutBinding('darwin', overrides, 'translation', 'Command+G'));
  assert.throws(() => validateShortcutBinding('darwin', {}, 'search', 'Command+W'));
  assert.throws(() => validateShortcutBinding('darwin', {}, 'search', 'Command+C'));
  assert.throws(() => validateShortcutBinding('win32', {}, 'search', 'Control+C'));
  assert.deepEqual(overrides, { search: 'Command+G' });
});

test('macOS native fullscreen binding can be saved only for fullscreen', () => {
  assert.deepEqual(validateShortcutBinding('darwin', {}, 'toggle-fullscreen', 'Ctrl+Cmd+F'), {
    'toggle-fullscreen': 'Command+Control+F',
  });
  assert.equal(
    validShortcutOverrides('darwin', { 'toggle-fullscreen': 'Command+Control+F' }),
    true,
  );
  assert.throws(() => validateShortcutBinding('darwin', {}, 'search', 'Command+Control+F'));
});

test('validation rejects unknown actions', () => {
  assert.throws(() => validateShortcutBinding('darwin', {}, 'missing-action', 'Command+G'));
});

test('validShortcutOverrides accepts canonical remaps and clear values only', () => {
  assert.equal(validShortcutOverrides('darwin', { search: 'Command+G' }), true);
  assert.equal(validShortcutOverrides('darwin', { search: null }), true);
  assert.equal(validShortcutOverrides('darwin', { missing: 'Command+G' }), false);
  assert.equal(validShortcutOverrides('darwin', { search: 'Cmd+g' }), false);
  assert.equal(validShortcutOverrides('darwin', { search: ['Command+G'] }), false);
  assert.equal(validShortcutOverrides('darwin', { search: 'Command+W' }), false);
});
