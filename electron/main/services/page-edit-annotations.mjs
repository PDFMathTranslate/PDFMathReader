// Annotations follow their page to its first position in `order`; each pasted copy of the
// page gets fresh copies of them, detached from any annotation already in the PDF.
export function arrangePageAnnotations(annotations, order, newId) {
  const first = new Map(),
    copies = new Map();
  order.forEach((page, index) => {
    if (!first.has(page)) first.set(page, index + 1);
    else copies.set(page, [...(copies.get(page) || []), index + 1]);
  });
  const arranged = [];
  for (const annotation of annotations) {
    arranged.push({ ...annotation, page: first.get(annotation.page) ?? annotation.page });
    for (const page of copies.get(annotation.page) || []) {
      const copy = structuredClone(annotation);
      delete copy.nativeRef;
      arranged.push({ ...copy, id: newId(), page });
    }
  }
  return arranged;
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
