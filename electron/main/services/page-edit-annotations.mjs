// Annotations follow their page to its first position in `order`; each pasted copy of the
// page gets fresh copies of them, detached from any annotation already in the PDF. Pages
// left out of `order` take their annotations with them.
export function arrangePageAnnotations(annotations, order, newId) {
  const first = new Map(),
    copies = new Map();
  order.forEach((page, index) => {
    if (!first.has(page)) first.set(page, index + 1);
    else copies.set(page, [...(copies.get(page) || []), index + 1]);
  });
  const arranged = [];
  for (const annotation of annotations) {
    if (!first.has(annotation.page)) continue;
    arranged.push({ ...annotation, page: first.get(annotation.page) });
    for (const page of copies.get(annotation.page) || []) {
      const copy = structuredClone(annotation);
      delete copy.nativeRef;
      arranged.push({ ...copy, id: newId(), page });
    }
  }
  return arranged;
}

// The annotations of `pages`, renumbered from 1 in the copied order and detached from the PDF
// they came from.
export function copiedPageAnnotations(annotations, pages) {
  const copied = [];
  pages.forEach((page, index) => {
    for (const annotation of annotations)
      if (annotation.page === page) {
        const copy = structuredClone(annotation);
        delete copy.nativeRef;
        copied.push({ ...copy, page: index + 1 });
      }
  });
  return copied;
}

// Pages inserted after position `at` push later annotations back; `copied` (numbered from 1)
// land on the inserted pages with fresh ids.
export function insertPageAnnotations(annotations, at, count, copied, newId) {
  return [
    ...annotations.map((annotation) =>
      annotation.page > at ? { ...annotation, page: annotation.page + count } : { ...annotation },
    ),
    ...copied.map((annotation) => ({
      ...structuredClone(annotation),
      id: newId(),
      page: annotation.page + at,
    })),
  ];
}

export function transformPageAnnotations(annotations, transforms) {
  const byPage = new Map(transforms.map((value) => [value.page, value]));
  return annotations.map((annotation) => {
    const transform = byPage.get(annotation.page);
    if (!transform) return { ...annotation };
    const rect = (value) => {
      if (!value) return value;
      const scale = transform.scale || 1;
      const rotated =
        transform.rotate === 90
          ? {
              x: transform.height - value.y - value.height,
              y: value.x,
              width: value.height,
              height: value.width,
            }
          : value;
      return {
        ...value,
        x: rotated.x * scale,
        y: rotated.y * scale,
        width: rotated.width * scale,
        height: rotated.height * scale,
      };
    };
    return {
      ...annotation,
      rects: annotation.rects.map(rect),
      ...(annotation.sourceRect ? { sourceRect: rect(annotation.sourceRect) } : {}),
      ...(annotation.translationRect ? { translationRect: rect(annotation.translationRect) } : {}),
    };
  });
}
