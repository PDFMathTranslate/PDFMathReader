export function installGlassContextMenu() {
  const bridge = window.previewGlassMenu;
  if (!bridge) return () => {};
  let current, element, previousFocus, position;
  const locate = (event) => {
    position =
      event.clientX !== 0 || event.clientY !== 0
        ? { x: event.clientX, y: event.clientY }
        : undefined;
  };
  function cleanup() {
    element?.remove();
    element = null;
    current = null;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    previousFocus = null;
  }
  function close(item = null) {
    if (!current) return;
    const id = current;
    cleanup();
    void bridge.choose({ id, item }).catch(() => {});
  }
  function keydown(event) {
    if (!element) return;
    const buttons = [...element.querySelectorAll('button:not(:disabled)')];
    const index = buttons.indexOf(document.activeElement);
    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault();
      close();
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const next =
        event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? buttons.length - 1
            : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }
  }
  const outside = (event) => {
    if (element && !element.contains(event.target)) close();
  };
  const stopOpen = bridge.onOpen((menu) => {
    cleanup();
    previousFocus = document.activeElement;
    current = menu.id;
    element = document.createElement('div');
    element.className = 'reader-glass-menu';
    element.dataset.platform = 'darwin';
    element.setAttribute('role', 'menu');
    element.setAttribute('aria-label', 'Context menu');
    for (const item of menu.items) {
      const row = document.createElement(item.type === 'separator' ? 'hr' : 'button');
      row.setAttribute('role', item.type === 'separator' ? 'separator' : 'menuitem');
      if (item.type !== 'separator') {
        row.type = 'button';
        row.textContent = item.label;
        row.disabled = !item.enabled;
        row.addEventListener('click', () => close(item.id));
      }
      element.append(row);
    }
    (document.querySelector('.app') || document.body).append(element);
    const anchor = previousFocus?.getBoundingClientRect();
    const point = Number.isFinite(menu.x)
      ? menu
      : position || { x: anchor?.left || 12, y: anchor?.bottom || 12 };
    const bounds = element.getBoundingClientRect();
    element.style.left = `${Math.max(8, Math.min(point.x, innerWidth - bounds.width - 8))}px`;
    element.style.top = `${Math.max(8, Math.min(point.y, innerHeight - bounds.height - 8))}px`;
    element.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
  });
  const stopClose = bridge.onClose((id) => {
    if (id === current) cleanup();
  });
  const blur = () => close();
  const appearance = new MutationObserver(() => {
    if (document.documentElement.dataset.interfaceStyle !== 'liquid-glass') close();
  });
  appearance.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-interface-style'],
  });
  document.addEventListener('contextmenu', locate, true);
  document.addEventListener('pointerdown', outside, true);
  document.addEventListener('keydown', keydown, true);
  window.addEventListener('blur', blur);
  window.addEventListener('resize', blur);
  return () => {
    close();
    stopOpen();
    stopClose();
    appearance.disconnect();
    document.removeEventListener('contextmenu', locate, true);
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('keydown', keydown, true);
    window.removeEventListener('blur', blur);
    window.removeEventListener('resize', blur);
  };
}
