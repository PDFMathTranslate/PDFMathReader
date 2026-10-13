// Contact-sheet geometry for the page gallery. Pages fit a `tile`-wide box (portrait pages
// may grow up to `tile * MAX_ASPECT` tall), columns spread across the available width, and
// every row bottom-aligns its pages so the page numbers beneath them line up.
export const GALLERY_PADDING = 32;
const GAP_X = 48,
  LABEL_HEIGHT = 48,
  ROW_GAP = 24,
  MAX_ASPECT = 1.6;

export function buildGalleryLayout(pages, width, { tile = 150 } = {}) {
  const inner = Math.max(tile, width - GALLERY_PADDING * 2),
    columns = Math.max(1, Math.floor((inner + GAP_X) / (tile + GAP_X))),
    cell = inner / columns,
    frames = [],
    rows = [];
  let y = 0;
  for (let start = 0; start < pages.length; start += columns) {
    const end = Math.min(pages.length, start + columns),
      row = rows.length;
    let imageHeight = 0;
    for (let i = start; i < end; i++) {
      const p = pages[i],
        scale = Math.min(tile / p.width, (tile * MAX_ASPECT) / p.height),
        frame = {
          number: p.number ?? i + 1,
          row,
          column: i - start,
          scale,
          width: p.width * scale,
          height: p.height * scale,
          cellX: GALLERY_PADDING + (i - start) * cell,
          cellWidth: cell,
        };
      frame.x = frame.cellX + (cell - frame.width) / 2;
      imageHeight = Math.max(imageHeight, frame.height);
      frames.push(frame);
    }
    for (let i = start; i < end; i++) frames[i].y = y + imageHeight - frames[i].height;
    rows.push({ start, end, top: y, imageHeight, height: imageHeight + LABEL_HEIGHT });
    y += imageHeight + LABEL_HEIGHT + ROW_GAP;
  }
  return { columns, cell, frames, rows, height: rows.length ? y - ROW_GAP : 0 };
}

// Rows intersecting [top - buffer, top + height + buffer], in layout coordinates.
export function visibleGalleryRows(layout, top, height, buffer = height) {
  const rows = layout.rows;
  let low = 0,
    high = rows.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (rows[mid].top + rows[mid].height < top - buffer) low = mid + 1;
    else high = mid;
  }
  let last = low;
  while (last < rows.length && rows[last].top < top + height + buffer) last++;
  return { first: low, last: last - 1 };
}

// Keyboard movement through the grid; returns the next selected page number.
export function galleryStep(layout, number, key) {
  const count = layout.frames.length,
    step = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -layout.columns,
      ArrowDown: layout.columns,
    }[key];
  if (!count) return number;
  if (key === 'Home') return 1;
  if (key === 'End') return count;
  if (step === undefined) return number;
  const next = number + step;
  if (next < 1) return step === -1 ? 1 : number;
  // Moving down into a shorter last row lands on its final page.
  if (next > count)
    return Math.ceil(number / layout.columns) < Math.ceil(count / layout.columns) ? count : number;
  return next;
}
