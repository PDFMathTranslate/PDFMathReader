const boundedUnique = (pages, total) => {
  const seen = new Set(),
    result = [];
  for (const page of pages) {
    if (!Number.isInteger(page) || page < 1 || page > total || seen.has(page)) continue;
    seen.add(page);
    result.push(page);
  }
  return result;
};

export function translationPages(mode, current, total, options) {
  const pageCount = Number.isInteger(total) && total > 0 ? total : 0;
  if (!pageCount) return [];
  const settings = options && typeof options === 'object' ? options : {};
  const visible = boundedUnique(Array.isArray(settings.visible) ? settings.visible : [], pageCount);
  const ahead = boundedUnique(Array.isArray(settings.ahead) ? settings.ahead : [], pageCount);
  const currentPage = boundedUnique([current], pageCount);

  if (mode === 'full')
    return boundedUnique(
      [
        ...currentPage,
        ...visible,
        ...ahead,
        ...Array.from({ length: pageCount }, (_, index) => index + 1),
      ],
      pageCount,
    );

  const hasViewportOptions =
    options &&
    typeof options === 'object' &&
    (Array.isArray(options.visible) ||
      Array.isArray(options.ahead) ||
      Object.hasOwn(options, 'direction') ||
      Object.hasOwn(options, 'moving'));
  if (!hasViewportOptions)
    return boundedUnique([current, current + 1, current - 1, current + 2, current - 2], pageCount);

  const direction = settings.direction === -1 ? -1 : 1;
  const orderedVisible = [current, ...visible];
  if (settings.moving === true) return boundedUnique(orderedVisible, pageCount);

  const directional = [current + direction, current + 2 * direction];
  const opposite = [current - direction, current - 2 * direction];
  return boundedUnique([...orderedVisible, ...ahead, ...directional, ...opposite], pageCount);
}
