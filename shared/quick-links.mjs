export function validateQuickLinks(links) {
  if (
    !Array.isArray(links) ||
    links.length > 10000 ||
    links.some(
      (link) =>
        !link ||
        typeof link !== 'object' ||
        typeof link.id !== 'string' ||
        ['origin', 'result'].some(
          (side) =>
            !Number.isInteger(link[side]?.page) ||
            link[side].page < 1 ||
            !['x', 'y', 'width', 'height'].every((key) => Number.isFinite(link[side].box?.[key])),
        ),
    )
  )
    throw Error('Invalid quick links');
  return links;
}
