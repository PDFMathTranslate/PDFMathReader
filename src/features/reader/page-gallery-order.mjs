// Page arrangements for the gallery. Page numbers are 1-based; an `order` lists the source
// page of every position in the new document, so pasted copies repeat a number. A gap is the
// slot before position `gap + 1`: 0 is the start and `count` is the end.

function sequence(count) {
  return Array.from({ length: count }, (_, index) => index + 1);
}

// Moves `pages` as one block into `gap`; null when nothing would change.
export function movePages(count, pages, gap) {
  const moving = [...new Set(pages)].filter((page) => page >= 1 && page <= count);
  moving.sort((a, b) => a - b);
  if (!moving.length) return null;
  const rest = sequence(count).filter((page) => !moving.includes(page)),
    at = Math.max(0, Math.min(count, gap)) - moving.filter((page) => page <= gap).length,
    order = [...rest.slice(0, at), ...moving, ...rest.slice(at)];
  return order.every((page, index) => page === index + 1) ? null : order;
}

// Inserts copies of `pages`, in their copied order, after position `after`.
export function pastePages(count, pages, after) {
  if (!pages.length) return null;
  const order = sequence(count);
  order.splice(Math.max(0, Math.min(count, after)), 0, ...pages);
  return order;
}

export function menuGap(count, pages, action) {
  if (action === 'move-first') return 0;
  if (action === 'move-last') return count;
  if (action === 'move-earlier') return Math.max(0, Math.min(...pages) - 2);
  if (action === 'move-later') return Math.min(count, Math.max(...pages) + 1);
  return null;
}

// Where each source page first appears after an arrangement.
export function arrangedPositions(order) {
  const positions = new Map();
  order.forEach((page, index) => positions.has(page) || positions.set(page, index + 1));
  return positions;
}

// The gap nearest a point in sheet coordinates (`y` measured from the first row's top), and
// the caret that marks it: the left edge of the cell after the gap, or the right edge of the
// last cell in a row.
export function dropGap(layout, x, y) {
  const { rows, frames } = layout;
  if (!rows.length) return null;
  let row = rows.findIndex((value, index) => {
    const next = rows[index + 1];
    return !next || y < (value.top + value.height + next.top) / 2;
  });
  if (row < 0) row = rows.length - 1;
  const { start, end, top, imageHeight } = rows[row];
  let gap = end;
  for (let index = start; index < end; index++)
    if (x < frames[index].cellX + frames[index].cellWidth / 2) {
      gap = index;
      break;
    }
  const caret = gap < end ? frames[gap].cellX : frames[end - 1].cellX + frames[end - 1].cellWidth;
  return { gap, x: caret, top, height: imageHeight };
}
