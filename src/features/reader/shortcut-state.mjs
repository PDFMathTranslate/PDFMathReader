import { shallowRef } from 'vue';

export const shortcutOverrides = shallowRef({});
let initialized = false;
export function initializeShortcutState() {
  if (initialized || !window.previewShortcuts) return;
  initialized = true;
  // One subscription per renderer; its lifetime is the reader window.
  let revision = 0;
  window.previewShortcuts.onChange((snapshot) => {
    revision++;
    shortcutOverrides.value = snapshot.overrides;
  });
  const initialRevision = revision;
  void window.previewShortcuts
    .load()
    .then((snapshot) => {
      if (revision === initialRevision) shortcutOverrides.value = snapshot.overrides;
    })
    .catch(() => {});
}
