import { BrowserWindow } from 'electron';

/*
 * The registry is the owner of desktop window identity. IPC handlers and menu
 * actions must resolve a sender through this registry instead of using the
 * focused window as an implicit target.
 */
export function createWindowRegistry() {
  const windows = new Map();
  const settingsWindows = new Map();
  const closingBackends = new Set();
  const openingDocuments = new Map();

  const stateFor = (target) => (target ? windows.get(target) : undefined);
  const focusedWindow = () => {
    const focused = BrowserWindow.getFocusedWindow();
    if (windows.has(focused)) return windows.get(focused).settingsOwner || focused;
    return [...windows.keys()].filter((target) => !windows.get(target)?.settingsOwner).at(-1);
  };
  const trustedWindow = (event) => {
    const target = BrowserWindow.fromWebContents(event.sender);
    const state = windows.get(target);
    if (
      !state ||
      event.senderFrame !== target.webContents.mainFrame ||
      new URL(event.senderFrame.url).origin !== state.backend.origin
    )
      throw Error('Window request rejected.');
    return target;
  };
  const annotationSourceForDocument = (document) => {
    if (typeof document === 'string')
      return { path: document, reliable: true, preserveWithoutPath: false };
    if (document?.bytes instanceof Uint8Array)
      return { bytes: Buffer.from(document.bytes), reliable: false, preserveWithoutPath: true };
    return null;
  };
  const annotationSourceForWindow = (state, key) =>
    state?.annotationSources?.get(key) || state?.unkeyedAnnotationSource;
  const findDocumentWindow = (identity) =>
    identity &&
    [...windows].find(
      ([target, state]) =>
        !state.settingsOwner &&
        !state.closing &&
        !target.isDestroyed() &&
        state.documentIdentity === identity,
    )?.[0];
  const isBlankStartPage = (target) => {
    const state = windows.get(target);
    return (
      !!state &&
      !state.settingsOwner &&
      !target.isDestroyed() &&
      !state.closing &&
      !state.performance.hasDocument &&
      !state.documents.length &&
      !state.documentIdentity
    );
  };

  return {
    windows,
    settingsWindows,
    closingBackends,
    openingDocuments,
    stateFor,
    focusedWindow,
    trustedWindow,
    annotationSourceForDocument,
    annotationSourceForWindow,
    findDocumentWindow,
    isBlankStartPage,
  };
}
