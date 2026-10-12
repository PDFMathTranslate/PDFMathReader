// Rule-based table-of-contents generation from positioned text. No model, no OCR:
// 1. parse a printed contents page ("Title ..... 12") and map printed to physical pages;
// 2. otherwise infer headings from font sizes, numbering and vertical spacing.

const MAX_TOC_SCAN_PAGES = 40;
const OFFSET_SCAN_PAGES = 100;
const MIN_ENTRIES = 3;
const DOT = '.·•‧…⋯';
const PAGE_NUMBER = /^(?:\d{1,4}|[ivxlc]{1,7})$/i;
const LEADER_LINE = new RegExp(
  `^(.*?\\S)\\s*(?:(?:\\.\\s*){3,}|(?:[${DOT}]\\s*)+)(\\d{1,4}|[ivxlc]{1,7})$`,
  'i',
);
const TRAILING_LEADER = new RegExp(`(?:[${DOT}]\\s*){2,}$`);
const TOC_HEADING =
  /^(?:[ivxlc\d]{1,6}\s+)?(?:table\s+of\s+contents|contents|目\s*录|目\s*次|inhalt(?:sverzeichnis)?|sommaire|table\s+des\s+mati[eè]res|[ií]ndice|contenido|inhaltsübersicht|목차)(?:\s+[ivxlc\d]{1,6})?$/i;
// A wrapped contents title ends mid-phrase or continues on an indented line.
const CONNECTOR = /(?:[:,;–—-]|\b(?:and|or|of|the|for|in|on|to|a|an|with|from|at|by|as|via))$/i;
const LIST_HEADING =
  /^(?:list\s+of\s+(?:figures|tables|illustrations)|图表目录|图目录|表目录|圖目錄|表目錄)/i;
const CAPTION =
  /^(?:fig(?:ure)?\.?|table|algorithm|listing|图|表|圖)\s*[\dA-Z一二三四五六七八九十]/i;

export function abortError() {
  const error = Error('Contents generation was cancelled.');
  error.name = 'AbortError';
  return error;
}

const clean = (value) =>
  String(value ?? '')
    .replaceAll('\u0000', '')
    .replace(/\s+/g, ' ')
    .trim();
const isRoman = (value) => /^[ivxlc]+$/i.test(value);
const letters = (value) => (value.match(/[\p{L}\p{N}]/gu) || []).length;

// Items of a two-column page, as [full-width above, left, right, full-width below]; a
// single group otherwise. A gutter is a vertical band no item crosses.
function splitColumns(items, width) {
  if (!width || items.length < 20) return [items];
  const lower = width / 2 - 8;
  const upper = width / 2 + 8;
  const left = [];
  const right = [];
  const across = [];
  for (const item of items) {
    const end = item.x + (item.width || 0);
    if (item.x >= lower) right.push(item);
    else if (end <= upper) left.push(item);
    else across.push(item);
  }
  // Measured in characters: a contents page has titles on the left and only page
  // numbers on the right, which is not a second column.
  const size = (group) => group.reduce((sum, item) => sum + item.text.length, 0);
  const share = (group) => size(group) / size(items);
  if (share(across) > 0.1 || share(left) < 0.25 || share(right) < 0.25) return [items];
  const top = Math.min(...[...left, ...right].map((item) => item.y));
  return [
    across.filter((item) => item.y < top),
    left,
    right,
    across.filter((item) => item.y >= top),
  ];
}

// Group positioned text items (page-space, y grows downward) into reading-order lines.
export function buildLines(items, { number = 1, width = 0, height = 0 } = {}) {
  const usable = items.filter((item) => item && typeof item.text === 'string' && item.text.trim());
  return splitColumns(usable, width).flatMap((group) => rowLines(group, { number, width, height }));
}

function rowLines(items, { number, width, height }) {
  const rows = [];
  for (const item of [...items].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const row = rows.at(-1);
    const tolerance = 0.45 * Math.min(item.size, row?.size || item.size);
    if (row && Math.abs(item.y - row.y) <= tolerance) {
      row.items.push(item);
      if (item.text.length > row.weight) {
        row.weight = item.text.length;
        row.size = item.size;
      }
    } else rows.push({ y: item.y, size: item.size, weight: item.text.length, items: [item] });
  }
  return rows.map((row) => {
    const parts = row.items.sort((a, b) => a.x - b.x);
    let text = '';
    let end = null;
    for (const part of parts) {
      if (end !== null && part.x - end > 0.15 * row.size && !/\s$/.test(text)) text += ' ';
      text += part.text;
      end = part.x + (part.width || 0);
    }
    // A right-aligned page number separated from the title by a wide gap (no dot leader).
    let body = null;
    let printed = null;
    const last = parts.at(-1);
    const before = parts.at(-2);
    if (
      before &&
      PAGE_NUMBER.test(last.text.trim()) &&
      last.x - (before.x + (before.width || 0)) >= 2.5 * row.size
    ) {
      printed = last.text.trim();
      body = clean(
        parts
          .slice(0, -1)
          .map((part) => part.text)
          .join(' '),
      );
    }
    return {
      page: number,
      pageWidth: width,
      pageHeight: height,
      text: clean(text),
      body,
      printed,
      x: parts[0].x,
      right: Math.max(...parts.map((part) => part.x + (part.width || 0))),
      y: row.y,
      size: row.size,
      bold: parts.every((part) => part.bold === true),
      chars: parts.reduce((sum, part) => sum + part.text.length, 0),
    };
  });
}

// Depth implied by the title's own numbering, or null.
export function numberingDepth(title) {
  if (/^第\s*[\d一二三四五六七八九十百零〇]+\s*[章部篇]/.test(title)) return 0;
  if (/^第\s*[\d一二三四五六七八九十百零〇]+\s*节/.test(title)) return 1;
  if (/^(?:chapter|part|appendix|book)\b/i.test(title)) return 0;
  const match = /^(\d{1,2}(?:\.\d{1,2}){0,4})\.?(?=\s|[)、:：])/.exec(title);
  return match ? match[1].split('.').length - 1 : null;
}

// Comparison key: numbering prefix and punctuation removed.
export function titleKey(title) {
  return clean(title)
    .toLowerCase()
    .replace(/^第\s*[\d一二三四五六七八九十百零〇]+\s*[章节部篇]/, '')
    .replace(/^(?:chapter|part|appendix|section)\s+[\divxlc]+\b/, '')
    .replace(/^\d{1,2}(?:\.\d{1,2}){0,4}\.?\s/, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function keysMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 6 && short.length / long.length >= 0.7 && long.includes(short);
}

function tocEntry(line) {
  let title;
  let printed;
  if (line.printed && line.body) {
    title = line.body;
    printed = line.printed;
  } else {
    const match = LEADER_LINE.exec(line.text);
    if (!match) return null;
    title = match[1];
    printed = match[2];
  }
  title = clean(title.replace(TRAILING_LEADER, ''));
  if (!letters(title)) return null;
  return {
    title,
    printed: isRoman(printed) ? null : Number(printed),
    x: line.x,
    line,
  };
}

function indentDepths(entries) {
  const starts = [...new Set(entries.map((entry) => Math.round(entry.x)))].sort((a, b) => a - b);
  const clusters = [];
  for (const start of starts)
    if (!clusters.length || start - clusters.at(-1) > 4) clusters.push(start);
  const byIndent = (entry) => {
    let index = 0;
    clusters.forEach((start, position) => {
      if (entry.x >= start - 4) index = position;
    });
    return index;
  };
  if (clusters.length > 1) return entries.map((entry) => Math.min(byIndent(entry), 3));
  return entries.map((entry) => numberingDepth(entry.title) ?? 0);
}

function parseTocPages(pageLines) {
  const entries = [];
  // Number-less lines directly above the next entry: the start of a wrapped title.
  let pending = [];
  for (const lines of pageLines) {
    for (const line of lines) {
      if (TOC_HEADING.test(line.text) || /^\d{1,4}$/.test(line.text)) {
        pending = [];
        continue;
      }
      if (LIST_HEADING.test(line.text)) return entries;
      const entry = tocEntry(line);
      if (!entry) {
        if (letters(line.text) >= 3 && line.text.length <= 100 && !CAPTION.test(line.text)) {
          const last = pending.at(-1);
          if (last && line.y - last.y > 2.2 * line.size) pending = [];
          pending = [...pending, line].slice(-3);
        } else pending = [];
        continue;
      }
      // Join upward while lines are adjacent and the next is indented or the last is unfinished.
      const chain = [...pending, entry.line];
      let first = chain.length - 1;
      for (let i = chain.length - 1; i > 0; i--) {
        const [above, below] = [chain[i - 1], chain[i]];
        const adjacent = below.y - above.y <= 2.2 * below.size;
        if (adjacent && (below.x > above.x + 2 || CONNECTOR.test(above.text))) first = i - 1;
        else break;
      }
      if (first < chain.length - 1) {
        const head = chain.slice(first, -1).map((above) => above.text);
        entry.title = clean(`${head.join(' ')} ${entry.title}`);
        entry.x = chain[first].x;
      }
      pending = [];
      entries.push(entry);
    }
  }
  return entries;
}

async function findTocPages(numPages, page, report) {
  const limit = Math.min(numPages, MAX_TOC_SCAN_PAGES);
  const found = [];
  for (let number = 1; number <= limit; number++) {
    const lines = await page(number);
    report(number);
    const entries = lines.map(tocEntry).filter(Boolean);
    const head = lines.slice(0, 6);
    const listing = head.some((line) => LIST_HEADING.test(line.text));
    const titled = head.some((line) => TOC_HEADING.test(line.text));
    const isToc = !listing && (entries.length >= 6 || (titled && entries.length >= 3));
    const continues = found.length > 0 && !listing && entries.length >= 2;
    if (isToc || continues) found.push(number);
    else if (found.length) break;
  }
  return found;
}

async function tocFromPrintedPages({ numPages, page, report }) {
  const tocPages = await findTocPages(numPages, page, report);
  if (!tocPages.length) return [];
  const entries = parseTocPages(await Promise.all(tocPages.map((number) => page(number))));
  if (entries.length < MIN_ENTRIES) return [];
  const depths = indentDepths(entries);
  entries.forEach((entry, index) => (entry.depth = depths[index]));

  // Printed page number -> physical page, by voting on where titles actually appear.
  const probes = entries
    .filter((entry) => Number.isInteger(entry.printed))
    .slice(0, 20)
    .map((entry) => ({ printed: entry.printed, key: titleKey(entry.title) }))
    .filter((probe) => probe.key.length >= 3);
  const tocEnd = tocPages.at(-1);
  const votes = new Map();
  const leading = () => {
    const ranked = [...votes].sort((a, b) => b[1] - a[1]);
    return { offset: ranked[0]?.[0], count: ranked[0]?.[1] || 0, next: ranked[1]?.[1] || 0 };
  };
  for (
    let number = tocEnd + 1;
    number <= Math.min(numPages, tocEnd + OFFSET_SCAN_PAGES);
    number++
  ) {
    const keys = (await page(number)).map((line) => titleKey(line.text));
    report(number);
    for (const probe of probes)
      if (keys.some((key) => keysMatch(key, probe.key))) {
        const offset = number - probe.printed;
        votes.set(offset, (votes.get(offset) || 0) + 1);
      }
    const top = leading();
    if (top.count >= 3 && top.count >= top.next + 2) break;
  }
  const top = leading();
  if (top.count < Math.min(2, probes.length) || top.count === 0 || top.count <= top.next) return [];
  const mapped = entries
    .filter((entry) => Number.isInteger(entry.printed))
    .map((entry) => ({ ...entry, page: entry.printed + top.offset }))
    .filter((entry) => entry.page >= 1 && entry.page <= numPages);
  return mapped.length >= MIN_ENTRIES ? mapped : [];
}

const bucket = (size) => Math.round(size * 2) / 2;

function bodySize(pages) {
  const weight = new Map();
  for (const lines of pages)
    for (const line of lines)
      weight.set(bucket(line.size), (weight.get(bucket(line.size)) || 0) + line.chars);
  return [...weight].sort((a, b) => b[1] - a[1])[0]?.[0] || 0;
}

// Letters only, so changing page numbers and spacing do not hide a running header.
const runningKey = (line) => line.text.toLowerCase().replace(/[^\p{L}]+/gu, '');
// Running headers and footers live in the page margins; body headings such as
// "Section 2" and "Section 4" share their letters but are never margin text.
const inMargin = (line) =>
  line.pageHeight > 0 && (line.y < line.pageHeight * 0.15 || line.y > line.pageHeight * 0.88);

function runningText(pages) {
  const seen = new Map();
  for (const lines of pages)
    for (const key of new Set(lines.filter(inMargin).map(runningKey)))
      seen.set(key, (seen.get(key) || 0) + 1);
  const threshold = Math.max(3, Math.ceil(pages.length * 0.25));
  return (line) => inMargin(line) && (seen.get(runningKey(line)) || 0) >= threshold;
}

function headingsFromFonts(pages) {
  const body = bodySize(pages);
  if (!body) return [];
  const repeated = runningText(pages);
  const candidates = [];
  for (const lines of pages) {
    let previous = null;
    for (const line of lines) {
      const gap = previous ? line.y - previous.y : Infinity;
      previous = line;
      const text = line.text;
      const words = text.split(/\s+/).length;
      const numbered = numberingDepth(text) !== null;
      const larger = line.size >= body * 1.12;
      const spaced = gap >= (numbered ? 1.6 : 1.8) * line.size;
      const styled = line.bold && line.size >= body * 0.95;
      if (!larger && !((numbered || styled) && spaced && line.size >= body * 0.95)) continue;
      if (text.length < 2 || text.length > 120 || words > 16 || letters(text) < 2) continue;
      if (/^[\d\s.,:;()[\]-]+$/.test(text) || CAPTION.test(text)) continue;
      if (/[,;，；]$/.test(text) || (!numbered && /[.。]$/.test(text))) continue;
      if (line.pageHeight && (line.y < line.pageHeight * 0.08 || line.y > line.pageHeight * 0.93))
        continue;
      if (repeated(line) || TOC_HEADING.test(text) || LIST_HEADING.test(text)) continue;
      candidates.push({
        line,
        text,
        numbered,
        depth: numberingDepth(text),
        size: bucket(line.size),
      });
    }
  }
  // Join a heading that wraps onto consecutive lines of the same size.
  const headings = [];
  for (const candidate of candidates) {
    const last = headings.at(-1);
    if (
      last &&
      last.line.page === candidate.line.page &&
      last.size === candidate.size &&
      !candidate.numbered &&
      candidate.line.y - last.tail <= 1.6 * candidate.line.size
    ) {
      last.text = clean(`${last.text} ${candidate.text}`);
      last.tail = candidate.line.y;
    } else headings.push({ ...candidate, tail: candidate.line.y });
  }

  // First-page front matter (journal name, authors, title) has sizes no later heading shares.
  const later = new Map();
  for (const heading of headings)
    if (heading.line.page > 1) later.set(heading.size, (later.get(heading.size) || 0) + 1);
  const sections = headings.filter(
    (heading) => heading.line.page > 1 || heading.numbered || (later.get(heading.size) || 0) >= 2,
  );

  const count = new Map();
  for (const heading of sections) count.set(heading.size, (count.get(heading.size) || 0) + 1);
  // A lone, largest style on the first pages is the document title, not a section.
  if (!sections.length) return [];
  const largest = Math.max(...sections.map((heading) => heading.size));
  const dropTitle =
    count.size > 1 &&
    count.get(largest) <= 2 &&
    sections
      .filter((heading) => heading.size === largest)
      .every((heading) => heading.line.page <= 2);
  const sizes = [...count.keys()]
    .filter((size) => !(dropTitle && size === largest))
    .sort((a, b) => b - a)
    .slice(0, 4);
  const kept = sections.filter(
    (heading) => sizes.includes(heading.size) || (heading.numbered && heading.size <= body * 1.12),
  );
  return kept.map((heading) => ({
    title: heading.text,
    page: heading.line.page,
    depth: Math.min(heading.depth ?? Math.max(0, sizes.indexOf(heading.size)), 3),
  }));
}

// Hierarchical ids ("0", "0.1") with no skipped levels, as readOutline produces.
function withIds(entries, source) {
  const path = [];
  let previous = -1;
  return entries.map((entry) => {
    const depth = Math.max(0, Math.min(entry.depth ?? 0, previous + 1));
    path.length = depth + 1;
    path[depth] = (path[depth] ?? -1) + 1;
    previous = depth;
    for (let i = 0; i < depth; i++) path[i] ??= 0;
    return { id: path.join('.'), title: entry.title, depth, page: entry.page, source };
  });
}

/**
 * @param {{numPages:number, getPageLines:(page:number)=>Promise<object[]>,
 *   onProgress?:(state:{phase:string,done:number,total:number})=>void, signal?:AbortSignal}} options
 * @returns {Promise<{items:object[], source:'toc-page'|'heuristic'|null}>}
 */
export async function generateToc({ numPages, getPageLines, onProgress = () => {}, signal }) {
  const cache = new Map();
  const check = () => {
    if (signal?.aborted) throw abortError();
  };
  const page = async (number) => {
    check();
    if (!cache.has(number)) cache.set(number, await getPageLines(number));
    return cache.get(number);
  };
  const report = (phase) => (done) => onProgress({ phase, done, total: numPages });

  const printed = await tocFromPrintedPages({ numPages, page, report: report('toc-page') });
  if (printed.length >= MIN_ENTRIES) {
    onProgress({ phase: 'toc-page', done: numPages, total: numPages });
    return { items: withIds(printed, 'toc-page'), source: 'toc-page' };
  }

  const pages = [];
  for (let number = 1; number <= numPages; number++) {
    pages.push(await page(number));
    onProgress({ phase: 'headings', done: number, total: numPages });
  }
  check();
  const headings = headingsFromFonts(pages);
  if (headings.length < MIN_ENTRIES || headings.length > Math.max(12, numPages * 4))
    return { items: [], source: null };
  return { items: withIds(headings, 'heuristic'), source: 'heuristic' };
}
