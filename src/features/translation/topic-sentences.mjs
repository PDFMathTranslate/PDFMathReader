const SENTENCE_MARKS = new Set([
  '.',
  '!',
  '?',
  '。',
  '！',
  '？',
  '｡',
  '．',
  '‼',
  '⁇',
  '⁈',
  '⁉',
  '…',
]);
const CLOSING_MARKS = new Set([
  '"',
  "'",
  '”',
  '’',
  '»',
  '›',
  '）',
  '」',
  '』',
  '】',
  '〕',
  '〉',
  '》',
  '］',
  '｝',
  '〟',
  '〞',
  '〗',
  ')',
  ']',
  '}',
  '»',
]);
const OPENING_MARKS = new Set([
  '"',
  "'",
  '“',
  '‘',
  '«',
  '‹',
  '（',
  '【',
  '〔',
  '〈',
  '《',
  '［',
  '｛',
  '(',
  '[',
  '{',
]);
const CJK_MARKS =
  /[\u2e80-\u2fff\u3040-\u30ff\u3130-\u318f\u31a0-\u31ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/u;
const ASCII_LETTER_OR_DOT = /[A-Za-z.]/;
const WHITESPACE = /\s/u;
const ABBREVIATIONS = new Set([
  'a.m',
  'approx',
  'aug',
  'cf',
  'dept',
  'dec',
  'dr',
  'e.g',
  'eq',
  'est',
  'etc',
  'fig',
  'feb',
  'jan',
  'jr',
  'jul',
  'jun',
  'mar',
  'mr',
  'mrs',
  'ms',
  'no',
  'nov',
  'oct',
  'p.m',
  'prof',
  'sep',
  'sept',
  'sr',
  'st',
  'vs',
  'inc',
  'i.e',
  'u.s',
  'u.k',
  'al',
]);

function textValue(value) {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  return String(value);
}

function trimWhitespaceEnd(text, end) {
  while (end > 0 && WHITESPACE.test(text[end - 1])) end--;
  return end;
}

function firstTextOffset(text) {
  for (let index = 0; index < text.length; index++) if (!WHITESPACE.test(text[index])) return index;
  return -1;
}

function afterClosingMarks(text, punctuationIndex) {
  let end = punctuationIndex + 1;
  while (end < text.length && CLOSING_MARKS.has(text[end])) end++;
  return end;
}

function tokenBeforePeriod(text, punctuationIndex) {
  let start = punctuationIndex;
  while (start > 0 && ASCII_LETTER_OR_DOT.test(text[start - 1])) start--;
  return text.slice(start, punctuationIndex + 1);
}

function nextNonWhitespace(text, offset) {
  let index = offset;
  while (index < text.length && WHITESPACE.test(text[index])) index++;
  return index < text.length ? index : -1;
}

function falsePeriodBoundary(text, punctuationIndex, boundary) {
  const next = text[punctuationIndex + 1];
  const previous = text[punctuationIndex - 1];
  if (next && /\d/u.test(next) && previous && /\d/u.test(previous)) return true;
  if (next === '.') return true;

  const token = tokenBeforePeriod(text, punctuationIndex);
  const normalized = token.toLowerCase().replace(/\.+$/u, '');
  if (ABBREVIATIONS.has(normalized)) return true;
  if (/^(?:[A-Za-z]\.){2,}$/u.test(token)) return true;
  if (/^[A-Za-z]\.$/u.test(token)) return true;

  const nextIndex = nextNonWhitespace(text, boundary);
  if (nextIndex >= 0 && /[a-z]/u.test(text[nextIndex]) && nextIndex > boundary) return true;
  return false;
}

function fallbackSentenceEnd(text) {
  const first = firstTextOffset(text);
  if (first < 0) return 0;
  for (let index = first; index < text.length; index++) {
    const mark = text[index];
    if (!SENTENCE_MARKS.has(mark)) continue;
    const end = afterClosingMarks(text, index);
    if (mark === '.' && falsePeriodBoundary(text, index, end)) continue;
    return trimWhitespaceEnd(text, end);
  }
  return trimWhitespaceEnd(text, text.length);
}

function intlSentenceEnd(text, locale) {
  const Segmenter = globalThis.Intl?.Segmenter;
  if (typeof Segmenter !== 'function') return fallbackSentenceEnd(text);
  let segments;
  try {
    const segmenter = new Segmenter(locale, { granularity: 'sentence' });
    segments = [...segmenter.segment(text)];
  } catch {
    return fallbackSentenceEnd(text);
  }
  if (!segments.length) return fallbackSentenceEnd(text);

  const first = firstTextOffset(text);
  if (first < 0) return 0;
  let end = 0;
  try {
    for (const segment of segments) {
      const index = Number(segment.index);
      const length = textValue(segment.segment).length;
      if (!Number.isInteger(index) || index < end || !length) return fallbackSentenceEnd(text);
      end = index + length;
      if (end <= first) continue;
      const boundary = trimWhitespaceEnd(text, end);
      const markIndex = (() => {
        let candidate = boundary - 1;
        while (candidate >= 0 && CLOSING_MARKS.has(text[candidate])) candidate--;
        return candidate;
      })();
      if (
        end < text.length &&
        markIndex >= 0 &&
        text[markIndex] === '.' &&
        falsePeriodBoundary(text, markIndex, boundary)
      )
        continue;
      return boundary;
    }
  } catch {
    return fallbackSentenceEnd(text);
  }
  return trimWhitespaceEnd(text, end || text.length);
}

/** Return the original-string offset immediately after the first sentence. */
export function firstSentenceLength(text, locale = 'en') {
  const source = textValue(text);
  return source ? intlSentenceEnd(source, locale) : 0;
}

/** Emphasize only multi-sentence paragraphs over 60 word-equivalents. */
export function topicSentenceLength(text, locale = 'en') {
  const source = textValue(text);
  const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
  const characters = source.match(cjk)?.length || 0;
  const words =
    source.replace(cjk, ' ').match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length || 0;
  if (words + characters / 2 <= 60) return 0;
  const end = firstSentenceLength(source, locale);
  return source.slice(end).trim() ? end : 0;
}

/** Use the paragraph geometry of the PDF currently displayed, including math kernels. */
export function topicParagraphBoxes(blocks, translated = false) {
  const source = Array.isArray(blocks) ? blocks : [];
  const fonts = new Map();
  for (const block of source) {
    const size = numeric(block.fontSize);
    if (!size || size <= 0) continue;
    const key = Math.round(size * 2) / 2;
    fonts.set(key, (fonts.get(key) || 0) + textValue(block.text).length * size * size);
  }
  const bodySize = [...fonts].sort((a, b) => b[1] - a[1])[0]?.[0];
  const firstBody = source.find(
    (block) =>
      textValue(block.text).trim().length > 20 &&
      (!bodySize || numeric(block.fontSize) >= bodySize * 0.9),
  );
  return source.map((block) => ({
    ...((translated ? block.translatedBox : block.sourceBox) || block),
    id: block.id,
    // A lowercase source at the page's first body block is a carried-over sentence.
    // Small numbered notes belong to the apparatus, not the body paragraphs.
    eligible:
      !(block === firstBody && /^[a-z]/u.test(textValue(block.text).trimStart())) &&
      !(
        bodySize &&
        numeric(block.fontSize) < bodySize * 0.9 &&
        /^\s*\d{1,3}(?!\d)/u.test(textValue(block.text))
      ),
  }));
}

function numeric(value) {
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
}

function rectangle(value) {
  if (!value || typeof value !== 'object') return null;
  const nested =
    value.x === undefined && value.y === undefined
      ? value.box || value.sourceBox || value.translatedBox
      : value;
  if (!nested || typeof nested !== 'object') return null;
  const x = numeric(nested.x ?? nested.left);
  const y = numeric(nested.y ?? nested.top);
  let width = numeric(nested.width ?? nested.w);
  let height = numeric(nested.height ?? nested.h);
  if (width === undefined && numeric(nested.right) !== undefined && x !== undefined)
    width = numeric(nested.right) - x;
  if (height === undefined && numeric(nested.bottom) !== undefined && y !== undefined)
    height = numeric(nested.bottom) - y;
  if (x === undefined || y === undefined || width === undefined || height === undefined)
    return null;
  return { x, y, width: Math.max(0, width), height: Math.max(0, height) };
}

function runGeometry(run) {
  const rect = rectangle(run);
  if (!rect) return null;
  const fontSize = numeric(run.fontSize ?? run.font_size ?? run.size) ?? Math.max(rect.height, 1);
  return {
    ...rect,
    centerX: rect.x + rect.width / 2,
    centerY: rect.y + rect.height / 2,
    fontSize: Math.max(fontSize, 1),
  };
}

function explicitGeometry(value) {
  const rect = rectangle(value);
  if (!rect) return null;
  const id = value.id ?? value.paragraphId ?? value.blockId ?? value.groupId ?? value.paragraph;
  return { rect, id, eligible: value.eligible !== false };
}

function contains(rect, x, y) {
  const epsilon = 1e-6;
  return (
    x >= rect.x - epsilon &&
    x <= rect.x + rect.width + epsilon &&
    y >= rect.y - epsilon &&
    y <= rect.y + rect.height + epsilon
  );
}

function explicitKey(box, index) {
  if (box.id === undefined || box.id === null) return `box:${index}`;
  let id;
  try {
    id = JSON.stringify(box.id);
  } catch {
    id = String(box.id);
  }
  return `id:${typeof box.id}:${id}`;
}

function bestExplicitBox(center, boxes) {
  if (!center || !boxes.length) return null;
  const matches = boxes.filter((box) => contains(box.rect, center.centerX, center.centerY));
  if (!matches.length) return null;
  matches.sort((a, b) => {
    const areaA = a.rect.width * a.rect.height;
    const areaB = b.rect.width * b.rect.height;
    return areaA - areaB || a.index - b.index;
  });
  return matches[0];
}

function lineFontSize(line) {
  return Math.max(1, line.fontSize || 1);
}

function sameLine(run, line) {
  if (!run.geometry || !line.geometry) return false;
  const minimum = Math.max(
    1,
    Math.min(run.geometry.height || run.geometry.fontSize, line.height || line.fontSize),
  );
  const runCenter = run.geometry.y + (run.geometry.height || run.geometry.fontSize) / 2;
  const lineCenter = line.top + line.height / 2;
  const overlap =
    Math.min(run.geometry.y + (run.geometry.height || run.geometry.fontSize), line.bottom) -
    Math.max(run.geometry.y, line.top);
  const vertical =
    overlap >= minimum * 0.25 || Math.abs(runCenter - lineCenter) <= Math.max(2, minimum * 0.45);
  if (!vertical) return false;
  const gap =
    run.geometry.x > line.right
      ? run.geometry.x - line.right
      : line.x > run.geometry.x + run.geometry.width
        ? line.x - (run.geometry.x + run.geometry.width)
        : 0;
  return gap <= Math.max(12, lineFontSize(line) * 2);
}

function newLine(run, index) {
  const geometry = run.geometry;
  if (!geometry)
    return {
      indices: [index],
      geometry: null,
      x: 0,
      right: 0,
      top: 0,
      bottom: 0,
      height: 0,
      fontSize: 1,
    };
  return {
    indices: [index],
    geometry: true,
    x: geometry.x,
    right: geometry.x + geometry.width,
    top: geometry.y,
    bottom: geometry.y + Math.max(geometry.height, geometry.fontSize),
    height: Math.max(geometry.height, geometry.fontSize),
    fontSize: geometry.fontSize,
  };
}

function addToLine(line, run, index) {
  const geometry = run.geometry;
  line.indices.push(index);
  if (!geometry) return;
  line.geometry = true;
  line.x = Math.min(line.x, geometry.x);
  line.right = Math.max(line.right, geometry.x + geometry.width);
  line.top = Math.min(line.top, geometry.y);
  line.bottom = Math.max(line.bottom, geometry.y + Math.max(geometry.height, geometry.fontSize));
  line.height = line.bottom - line.top;
  line.fontSize = (line.fontSize + geometry.fontSize) / 2;
}

function paragraphBreak(previous, line, paragraph) {
  if (!previous.geometry || !line.geometry) return false;
  const size = Math.max(lineFontSize(previous), lineFontSize(line));
  const gap = line.top - previous.bottom;
  if (gap < -Math.max(2, size * 0.45)) return true;
  if (gap > Math.max(3, size * 0.9)) return true;
  if (Math.abs(previous.fontSize - line.fontSize) > Math.max(1.5, size * 0.2)) return true;
  const xJump = Math.abs(line.x - previous.x);
  // An indented first line returning to the body margin is still the same paragraph.
  if (paragraph.lines.length === 1 && previous.x > line.x && xJump <= size * 3) return false;
  if (xJump > Math.max(3, size * 1.35)) return true;
  const indent = Math.abs(line.x - paragraph.firstX);
  return indent > Math.max(3, size * 1.35) && xJump > Math.max(2, size * 0.5);
}

function fallbackGroups(indices, normalized) {
  const lines = [];
  for (const index of indices) {
    const run = normalized[index];
    let target;
    let score = Infinity;
    for (const line of lines) {
      if (!sameLine(run, line)) continue;
      const candidate = run.geometry
        ? Math.abs(run.geometry.y - line.top) + Math.abs(run.geometry.x - line.right) * 0.01
        : 0;
      if (candidate < score) {
        target = line;
        score = candidate;
      }
    }
    if (target) addToLine(target, run, index);
    else lines.push(newLine(run, index));
  }
  const groups = [];
  for (const line of lines) {
    const previous = groups.at(-1);
    if (previous && !paragraphBreak(previous.lines.at(-1), line, previous))
      previous.lines.push(line);
    else groups.push({ lines: [line], firstX: line.x });
  }
  return groups.map((group) => group.lines.flatMap((line) => line.indices));
}

function cjkLike(character) {
  return (
    !!character &&
    (CJK_MARKS.test(character) || '，。！？、；：…「」『』（）【】《》'.includes(character))
  );
}

function needsSeparator(left, right) {
  if (!left || !right || WHITESPACE.test(left.at(-1)) || WHITESPACE.test(right[0])) return false;
  const last = left.at(-1);
  const first = right[0];
  if (cjkLike(last) || cjkLike(first) || last === '-' || last === '‐' || last === '‑') return false;
  if (SENTENCE_MARKS.has(first) || ',;:)]}'.includes(first) || CLOSING_MARKS.has(first))
    return false;
  if (OPENING_MARKS.has(last)) return false;
  return true;
}

function rangesForIndices(indices, normalized, locale) {
  let logical = '';
  const parts = [];
  for (const index of indices) {
    const text = normalized[index].text;
    if (logical && needsSeparator(logical, text)) logical += ' ';
    const start = logical.length;
    logical += text;
    parts.push({ index, start, end: logical.length });
  }
  const sentenceEnd = topicSentenceLength(logical, locale);
  if (!sentenceEnd) return [];
  const ranges = [];
  for (const part of parts) {
    if (part.start >= sentenceEnd) break;
    const end = Math.min(part.end, sentenceEnd) - part.start;
    if (end > 0) ranges.push({ index: part.index, start: 0, end });
  }
  return ranges;
}

/** Return source offsets for the first sentence in each inferred paragraph. */
export function topicSentenceRanges(runs, boxes = [], locale = 'en') {
  const source = Array.isArray(runs) ? runs : [];
  const normalized = source.map((run) => ({
    text: textValue(run?.text),
    geometry: runGeometry(run || {}),
  }));
  const explicit = (Array.isArray(boxes) ? boxes : [])
    .map((box, index) => {
      const geometry = explicitGeometry(box);
      return geometry ? { ...geometry, index, key: explicitKey(geometry, index) } : null;
    })
    .filter(Boolean);
  const groups = new Map();
  const unmatched = [];

  for (let index = 0; index < normalized.length; index++) {
    const match = bestExplicitBox(normalized[index].geometry, explicit);
    if (!match) {
      unmatched.push(index);
      continue;
    }
    let group = groups.get(match.key);
    if (!group) {
      group = { indices: [], order: index, eligible: match.eligible };
      groups.set(match.key, group);
    }
    group.indices.push(index);
  }
  for (const indices of fallbackGroups(unmatched, normalized))
    groups.set(`fallback:${indices[0]}`, { indices, order: indices[0] });

  const ranges = [];
  for (const group of [...groups.values()].sort((a, b) => a.order - b.order)) {
    if (group.eligible !== false)
      ranges.push(...rangesForIndices(group.indices, normalized, locale));
  }
  return ranges.sort((a, b) => a.index - b.index || a.start - b.start);
}
