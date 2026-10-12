const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const listEntry = /^\s*(?:[•●▪◦]|\d+[.)、]\s|[（(]\d+[）)]\s)/u;
const caption = /^\s*(?:fig(?:ure)?\.?|table|图|表)\s*\d/iu;

function validGeometry(block) {
  return (
    [block.x, block.y, block.width, block.height, block.fontSize].every(Number.isFinite) &&
    block.width > 0 &&
    block.height > 0 &&
    block.fontSize > 0
  );
}
function bodyFont(page) {
  const weights = new Map();
  for (const block of page.blocks || []) {
    if (!validGeometry(block) || block.math || block.bold) continue;
    const size = Math.round(block.fontSize * 2) / 2;
    weights.set(size, (weights.get(size) || 0) + (block.text || '').length);
  }
  return [...weights].sort((a, b) => b[1] - a[1])[0]?.[0] || 12;
}
function columns(blocks) {
  const groups = [];
  for (const block of [...blocks].sort((a, b) => a.x - b.x || a.y - b.y)) {
    const group = groups.find((group) => {
      const overlap = Math.min(group.right, block.x + block.width) - Math.max(group.x, block.x);
      return (
        overlap > Math.min(group.right - group.x, block.width) * 0.35 ||
        Math.abs(group.x - block.x) < block.fontSize * 2
      );
    });
    if (group) {
      group.blocks.push(block);
      group.x = Math.min(group.x, block.x);
      group.right = Math.max(group.right, block.x + block.width);
    } else groups.push({ x: block.x, right: block.x + block.width, blocks: [block] });
  }
  return groups
    .sort((a, b) => a.x - b.x)
    .flatMap((group) => group.blocks.sort((a, b) => a.y - b.y || a.x - b.x));
}

/** Body reading order, preserving intentional headings and lists as barriers. */
export function orderedParagraphBlocks(page) {
  const size = bodyFont(page);
  const blocks = (page.blocks || []).filter((block) => {
    if (!validGeometry(block) || typeof block.text !== 'string' || !block.text.trim()) return false;
    // Running headers, page numbers and small apparatus are not prose neighbors.
    return (
      block.y >= page.height * 0.035 &&
      block.y + block.height <= page.height * 0.97 &&
      block.fontSize >= size * 0.85
    );
  });
  const spanning = blocks
    .filter((block) => block.width > page.width * 0.7)
    .sort((a, b) => a.y - b.y || a.x - b.x);
  const bands = Array.from({ length: spanning.length + 1 }, () => []);
  for (const block of blocks) {
    if (spanning.includes(block)) continue;
    const index = spanning.filter((wide) => wide.y <= block.y).length;
    bands[index].push(block);
  }
  return bands.flatMap((band, index) => [
    ...columns(band),
    ...(spanning[index] ? [spanning[index]] : []),
  ]);
}

/** Geometry narrows candidate coverage; Jev decides the semantic boundary. */
export function paragraphContinuationCandidate(before, after) {
  const a = before?.block,
    b = after?.block;
  if (
    !a ||
    !b ||
    a === b ||
    a.math ||
    b.math ||
    a.bold ||
    b.bold ||
    !validGeometry(a) ||
    !validGeometry(b) ||
    !a.text?.trim() ||
    !b.text?.trim() ||
    listEntry.test(a.text) ||
    listEntry.test(b.text) ||
    caption.test(a.text) ||
    caption.test(b.text)
  )
    return false;
  if (Math.abs(a.fontSize - b.fontSize) > Math.max(1, a.fontSize * 0.12)) return false;
  if (a.textAlign !== b.textAlign) return false;
  if (before.page.number !== after.page.number) {
    return after.page.number === before.page.number + 1;
  }
  const overlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const sameColumn =
    overlap > Math.min(a.width, b.width) * 0.35 || Math.abs(a.x - b.x) < a.fontSize * 2;
  if (sameColumn) {
    const gap = b.y - a.y - a.height;
    return gap >= -2 && gap <= a.fontSize * 12;
  }
  // Column continuation moves right and returns to the top of the next column.
  return b.x >= a.x + a.width - a.fontSize && b.y <= a.y;
}

/** Join verified fragments without introducing a word break at a wrap hyphen. */
export function combineParagraphText(texts) {
  let result = '';
  for (const value of texts) {
    const next = String(value || '').trim();
    if (!next) continue;
    if (!result) {
      result = next;
      continue;
    }
    if (/\p{Letter}[-\u00ad]$/u.test(result) && /^\p{Letter}/u.test(next))
      result = result.slice(0, -1) + next;
    else result += cjk.test(result.at(-1)) && cjk.test(next[0]) ? next : ' ' + next;
  }
  return result;
}

/** Keep the complete translation in source order across the original regions. */
export function splitParagraphTranslation(text, fragments) {
  if (fragments.length <= 1) return [text];
  const segments = [...new Intl.Segmenter(undefined, { granularity: 'word' }).segment(text)];
  const positions = [0, ...segments.map((segment) => segment.index + segment.segment.length)];
  const weights = fragments.map((fragment) => Math.max(1, Array.from(fragment.text.trim()).length));
  const total = weights.reduce((a, b) => a + b, 0);
  let consumed = 0,
    start = 0;
  return fragments.map((_fragment, index) => {
    consumed += weights[index];
    let end = text.length;
    if (index < fragments.length - 1) {
      const desired = (text.length * consumed) / total;
      end = positions
        .filter((position) => position >= start)
        .reduce(
          (best, position) =>
            Math.abs(position - desired) < Math.abs(best - desired) ? position : best,
          start,
        );
    }
    const part = text.slice(start, end);
    start = end;
    return part;
  });
}
