/*
 * Finder-style tabs. Every tab remains its own BrowserWindow with its own
 * backend; a group only decides which member is visible. The renderer draws the
 * tab bar beneath its header because native macOS tabs would sit over the
 * hidden-inset title bar instead.
 */
const PAINT_TIMEOUT_MS = 220;
const CASCADE_OFFSET = 28;

export function createTabGroups({ registry, isTabMode, backgroundRenderSmoke = false }) {
  const groups = new Set();
  const groupOf = new Map();
  const live = (target) =>
    !!target &&
    !target.isDestroyed() &&
    !!registry.stateFor(target) &&
    !registry.stateFor(target).settingsOwner &&
    !registry.stateFor(target).closing;
  const activeFor = (target) => groupOf.get(target)?.active || target;
  const isInactiveTab = (target) => {
    const group = groupOf.get(target);
    return !!group && group.windows.length > 1 && group.active !== target;
  };
  const describe = (group) =>
    group.windows.length < 2
      ? []
      : group.windows.map((target) => ({
          id: target.id,
          title: target.isDestroyed() ? '' : target.getTitle(),
          active: target === group.active,
        }));
  const broadcast = (group) => {
    if (!group) return;
    const tabs = describe(group);
    for (const target of group.windows) {
      if (target.isDestroyed()) continue;
      target.excludedFromShownWindowsMenu = tabs.length > 1 && target !== group.active;
      if (!target.webContents.isDestroyed() && !target.webContents.isCrashed?.())
        target.webContents.send('tabs:changed', { tabs });
    }
  };
  const detach = (target) => {
    const group = groupOf.get(target);
    if (!group) return null;
    groupOf.delete(target);
    group.windows = group.windows.filter((member) => member !== target);
    if (group.active === target) group.active = group.windows[0] || null;
    if (!group.windows.length) groups.delete(group);
    if (!target.isDestroyed()) target.excludedFromShownWindowsMenu = false;
    return group;
  };
  const solo = (target) => {
    const group = { windows: [target], active: target };
    groups.add(group);
    groupOf.set(target, group);
    return group;
  };
  const painted = (target) =>
    Promise.race([
      target.webContents
        .executeJavaScript(
          'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))',
          true,
        )
        .catch(() => false),
      new Promise((resolve) => setTimeout(resolve, PAINT_TIMEOUT_MS).unref?.()),
    ]);
  const hideBehind = (previous) => {
    // A tab moved into its own window is active in its new group; keep it.
    if (!previous || previous.isDestroyed() || groupOf.get(previous)?.active === previous) return;
    if (previous.isFullScreen()) {
      previous.once('leave-full-screen', () => {
        if (!previous.isDestroyed() && groupOf.get(previous)?.active !== previous) previous.hide();
      });
      previous.setFullScreen(false);
      return;
    }
    previous.hide();
  };
  // Present the new tab exactly where the old one stood, then hide the old one
  // only after the new renderer has painted so switching never flashes blank.
  const reveal = async (target, previous, group, focus) => {
    if (backgroundRenderSmoke) return;
    const replacing = previous && previous !== target && !previous.isDestroyed();
    const fullscreen = replacing && previous.isFullScreen();
    if (replacing && !fullscreen) {
      if (target.isFullScreen()) target.setFullScreen(false);
      if (previous.isMaximized()) target.maximize();
      else target.setBounds(previous.getBounds());
    }
    if (target.isMinimized()) target.restore();
    const fade = replacing && previous.isVisible() && !fullscreen;
    if (fade) target.setOpacity(0);
    if (focus) target.show();
    else target.showInactive();
    if (fullscreen) target.setFullScreen(true);
    if (fade) {
      await painted(target);
      if (target.isDestroyed()) return;
      target.setOpacity(1);
    }
    if (group.active !== target) return;
    if (focus) target.focus();
    if (replacing) hideBehind(previous);
  };
  const select = async (target, { focus = true } = {}) => {
    const group = groupOf.get(target);
    if (!group || !live(target)) return target;
    const previous = group.active;
    group.active = target;
    broadcast(group);
    if (previous === target && (target.isVisible() || backgroundRenderSmoke)) {
      if (target.isMinimized()) target.restore();
      if (focus && !backgroundRenderSmoke) {
        target.show();
        target.focus();
      }
      return target;
    }
    await reveal(target, previous, group, focus);
    return target;
  };
  // Choose the visible tab of the window a new document should join.
  const anchorFor = (placement) => {
    if (placement === 'window' || !isTabMode()) return null;
    const anchor = activeFor(placement?.anchor || registry.focusedWindow());
    return live(anchor) ? anchor : null;
  };
  const adopt = (target, anchor) => {
    if (!isTabMode() || !live(target)) return;
    if (!anchor || !live(anchor)) {
      solo(target);
      return;
    }
    const group = groupOf.get(anchor) || solo(anchor);
    group.windows.splice(group.windows.indexOf(anchor) + 1, 0, target);
    groupOf.set(target, group);
    broadcast(group);
  };
  // Returns true when the tab group owns the first presentation of a window.
  const presentLoaded = (target, activate) => {
    const group = groupOf.get(target);
    if (!group || group.windows.length < 2) return false;
    if (activate) void select(target);
    else broadcast(group);
    return true;
  };
  const beforeClose = (target) => {
    const group = groupOf.get(target);
    if (!group) return false;
    let revealing = false;
    if (group.active === target && group.windows.length > 1) {
      const index = group.windows.indexOf(target);
      const neighbor = group.windows[index + 1] || group.windows[index - 1];
      // Show the neighbor before the closing window hides so the frame stays;
      // reveal() hides the closing window once the neighbor has painted.
      group.active = neighbor;
      revealing = !backgroundRenderSmoke && target.isVisible();
      void reveal(neighbor, target, group, target.isFocused());
    }
    detach(target);
    broadcast(group);
    return revealing;
  };
  const forget = (target) => {
    const group = detach(target);
    if (group && groups.has(group)) broadcast(group);
  };
  const step = (target, offset) => {
    const group = groupOf.get(activeFor(target));
    if (!group || group.windows.length < 2) return null;
    const index = group.windows.indexOf(group.active);
    const next = group.windows.at((index + offset) % group.windows.length);
    return select(next);
  };
  const moveToNewWindow = async (target) => {
    const group = groupOf.get(target);
    if (!group || group.windows.length < 2 || !live(target)) return target;
    const bounds = group.active.getBounds();
    if (group.active === target) beforeClose(target);
    else forget(target);
    solo(target);
    target.setBounds({ ...bounds, x: bounds.x + CASCADE_OFFSET, y: bounds.y + CASCADE_OFFSET });
    broadcast(groupOf.get(target));
    if (!backgroundRenderSmoke) {
      target.show();
      target.focus();
    }
    return target;
  };
  const mergeAll = (target) => {
    const owner = activeFor(target);
    if (!live(owner)) return;
    const group = groupOf.get(owner) || solo(owner);
    const others = [...registry.windows.keys()].filter(
      (other) => live(other) && !group.windows.includes(other),
    );
    // Keep each source window's own tab order.
    for (const other of others) {
      detach(other);
      group.windows.push(other);
      groupOf.set(other, group);
      if (!backgroundRenderSmoke && other.isVisible()) {
        if (other.isFullScreen()) {
          other.once('leave-full-screen', () => {
            if (!other.isDestroyed() && groupOf.get(other)?.active !== other) other.hide();
          });
          other.setFullScreen(false);
        } else other.hide();
      }
    }
    broadcast(group);
  };
  const reorder = (target, index) => {
    const group = groupOf.get(target);
    if (!group || !Number.isInteger(index)) return;
    const ordered = group.windows.filter((member) => member !== target);
    ordered.splice(Math.max(0, Math.min(index, ordered.length)), 0, target);
    group.windows = ordered;
    broadcast(group);
  };
  // Leaving tab mode turns every hidden tab back into a visible window.
  const ungroupAll = () => {
    for (const group of [...groups]) {
      const anchor = group.active;
      const bounds = anchor && !anchor.isDestroyed() ? anchor.getBounds() : null;
      let offset = 0;
      for (const target of group.windows) {
        groupOf.delete(target);
        if (target.isDestroyed()) continue;
        target.excludedFromShownWindowsMenu = false;
        if (
          target.webContents &&
          !target.webContents.isDestroyed() &&
          !target.webContents.isCrashed?.()
        )
          target.webContents.send('tabs:changed', { tabs: [] });
        if (target === anchor || !bounds) continue;
        offset += CASCADE_OFFSET;
        target.setBounds({ ...bounds, x: bounds.x + offset, y: bounds.y + offset });
        if (!backgroundRenderSmoke) target.showInactive();
      }
      groups.delete(group);
    }
  };
  const adoptExisting = () => {
    for (const target of registry.windows.keys())
      if (live(target) && !groupOf.has(target)) solo(target);
  };
  const setMode = (mode, focused) => {
    if (mode === 'tabs') {
      adoptExisting();
      if (focused) mergeAll(focused);
    } else ungroupAll();
  };
  const tabsFor = (target) => describe(groupOf.get(target) || { windows: [] });
  const windowById = (target, id) =>
    groupOf.get(target)?.windows.find((member) => member.id === id && !member.isDestroyed());
  const titleChanged = (target) => broadcast(groupOf.get(target));
  const tabCount = (target) => groupOf.get(activeFor(target))?.windows.length || 1;

  return {
    activeFor,
    isInactiveTab,
    anchorFor,
    adopt,
    presentLoaded,
    select,
    beforeClose,
    forget,
    next: (target) => step(target, 1),
    previous: (target) => step(target, -1),
    moveToNewWindow,
    mergeAll,
    reorder,
    setMode,
    tabsFor,
    windowById,
    titleChanged,
    tabCount,
  };
}
