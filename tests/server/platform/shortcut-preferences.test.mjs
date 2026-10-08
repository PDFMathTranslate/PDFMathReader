import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createReaderPreferences } from '../../../electron/main/services/preferences.mjs';
import { shortcutAction, validateShortcutBinding } from '../../../shared/commands/shortcuts.mjs';

test('shortcut overrides persist, remain isolated from snapshots, and reject conflicting writes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'shortcut-preferences-'));
  try {
    const path = join(directory, 'preferences.json');
    const preferences = await createReaderPreferences(path);
    const primary = process.platform === 'darwin' ? 'Command' : 'Control';
    const bindings = validateShortcutBinding(process.platform, {}, 'search', `${primary}+G`);
    bindings['page-next'] = null;
    await preferences.save({ shortcutBindings: bindings });
    bindings.search = `${primary}+H`;
    const snapshot = preferences.load();
    snapshot.shortcutBindings.search = `${primary}+H`;
    const restored = await createReaderPreferences(path);
    assert.equal(restored.load().shortcutBindings.search, `${primary}+G`);
    assert.equal(restored.load().shortcutBindings['page-next'], null);
    const input = {
      type: 'keyDown',
      key: 'g',
      meta: process.platform === 'darwin',
      control: process.platform !== 'darwin',
    };
    assert.equal(
      shortcutAction(process.platform, input, restored.load().shortcutBindings),
      'search',
    );
    assert.throws(() => restored.save({ shortcutBindings: { search: `${primary}+C` } }));
    assert.throws(() => restored.save({ shortcutBindings: { search: `${primary}+R` } }));
    assert.equal(restored.load().shortcutBindings.search, `${primary}+G`);
    await restored.save({ shortcutBindings: {} });
    assert.deepEqual((await createReaderPreferences(path)).load().shortcutBindings, {});
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
