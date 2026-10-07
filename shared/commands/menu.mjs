function menuItems(menu) {
  return Array.isArray(menu) ? menu : Array.isArray(menu?.items) ? menu.items : [];
}
function menuItemId(item, prefix, index) {
  const id = typeof item?.id === 'string' ? item.id.trim() : '';
  return id || `menu-${[...prefix, index].join('-')}`;
}

function serializeMenuItem(item, prefix, index) {
  if (item?.visible === false) return null;
  const id = menuItemId(item, prefix, index),
    children = menuItems(item?.submenu);
  const path = [...prefix, index];
  const serialized = {
    path,
    id,
    label: typeof item?.label === 'string' ? item.label : '',
    type:
      typeof item?.type === 'string' && item.type
        ? item.type
        : children.length
          ? 'submenu'
          : 'normal',
    enabled: item?.enabled !== false,
    checked: item?.checked === true,
    accelerator: typeof item?.accelerator === 'string' ? item.accelerator : null,
  };
  if (item?.submenu)
    serialized.submenu = children
      .map((child, childIndex) => serializeMenuItem(child, path, childIndex))
      .filter(Boolean);
  return serialized;
}

/*
 * Return the application menu in a renderer-safe data shape. MenuItem
 * instances and click callbacks never cross the context bridge; the result
 * carries numeric index paths so the renderer can return the exact entry it
 * displayed, while ids remain available for inspection and accessibility.
 */
export function serializeApplicationMenu(menu) {
  return menuItems(menu)
    .map((item, index) => serializeMenuItem(item, [], index))
    .filter(Boolean);
}

function findMenuItem(items, prefix, segment) {
  const key = String(segment);
  let index = items.findIndex((item, itemIndex) => menuItemId(item, prefix, itemIndex) === key);
  if (index < 0 && Number.isInteger(segment) && segment >= 0 && segment < items.length)
    index = segment;
  if (index < 0 && /^\d+$/.test(key)) {
    const candidate = Number(key);
    if (candidate < items.length) index = candidate;
  }
  return index < 0 ? null : { item: items[index], index };
}

/* Resolve only ids or numeric indices. Labels are deliberately not accepted
 * as selectors because a localized label is neither stable nor authoritative.
 */
export function menuPathItems(menu, path) {
  if (!Array.isArray(path) || path.length === 0) return null;
  let items = menuItems(menu),
    prefix = [],
    result = [];
  for (let depth = 0; depth < path.length; depth++) {
    const segment = path[depth];
    if (typeof segment !== 'string' && !Number.isInteger(segment)) return null;
    const found = findMenuItem(items, prefix, segment);
    if (!found) return null;
    result.push(found.item);
    if (depth === path.length - 1) return result;
    items = menuItems(found.item?.submenu);
    prefix = [...prefix, found.index];
  }
  return null;
}

export function menuItemAtPath(menu, path) {
  return menuPathItems(menu, path)?.at(-1) || null;
}
