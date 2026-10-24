import { shallowRef, watch } from 'vue';
import { topicSentenceLength } from '../translation/topic-sentences.mjs';
import { collectPageLines } from './toc-page-text.mjs';

const TERMINAL = /[.!?。！？…]["'”’)\]]*$/u;
const normalize = (text) => (text || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

function appendLine(text, line) {
  if (!text) return line;
  // Rejoin words hyphenated across a line break; keep compounds such as "LLM-based".
  if (/[\p{L}\p{N}]-$/u.test(text) && /^\p{Ll}/u.test(line))
    return (/\p{Ll}-$/u.test(text) ? text.slice(0, -1) : text) + line;
  if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]$/u.test(text)) return text + line;
  return text + ' ' + line;
}

// Lines whose normalized text begins an outline title, or which a title begins.
function headingMatches(line, title) {
  const text = normalize(line.text);
  if (text.length < 3 || title.length < 3) return false;
  return text === title || (text.length >= 8 && title.startsWith(text)) || text.startsWith(title);
}

/** Return line indices of the outline headings printed on one page, in outline order. */
export function locateHeadings(lines, items) {
  const found = new Map();
  let from = 0;
  for (const item of items) {
    const title = normalize(item.title);
    const index = lines.findIndex((line, i) => i >= from && headingMatches(line, title));
    if (index < 0) continue;
    found.set(item.id, index);
    from = index + 1;
  }
  return found;
}

// The most common baseline step between adjacent lines of equal size, in font
// sizes, so double-spaced manuscripts are not split at every line.
function linePitch(lines) {
  const counts = new Map();
  for (let index = 1; index < lines.length; index++) {
    const [a, b] = [lines[index - 1], lines[index]];
    const step = (b.y - a.y) / Math.max(a.size, 1);
    if (Math.abs(a.size - b.size) > 0.5 || step < 0.9 || step > 3) continue;
    const key = Math.round(step * 10) / 10;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] || 1.2;
}

/** Group the positioned lines of one page into body paragraphs. */
export function pageParagraphs(lines, skip = new Set()) {
  const paragraphs = [];
  const pitch = linePitch(lines);
  let current = null;
  const close = () => {
    if (current?.text) paragraphs.push({ line: current.line, text: current.text });
    current = null;
  };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (skip.has(index)) {
      close();
      continue;
    }
    const previous = current?.last;
    if (previous) {
      const size = Math.max(previous.size, line.size, 1);
      const gap = line.y - previous.y;
      const ended = TERMINAL.test(previous.text);
      const broken =
        Math.abs(previous.size - line.size) > size * 0.15 ||
        gap > size * (pitch + 0.45) ||
        // A new column continues the paragraph only after an unfinished sentence.
        (gap <= 0 && ended) ||
        (gap > 0 && line.x > previous.x + size * 0.8) ||
        (ended && previous.right < current.right - size * 3);
      if (broken) close();
    }
    if (!current) current = { line: index, text: '', right: line.right };
    current.text = appendLine(current.text, line.text);
    current.right = Math.max(current.right, line.right);
    current.last = line;
  }
  close();
  return paragraphs;
}

/**
 * Attach the first sentence of each long body paragraph to the deepest outline
 * entry that precedes it in reading order. `pageLines` maps page numbers to the
 * lines from `collectPageLines`.
 */
export function outlineTopicSentences(outline, pageLines, locale = 'en') {
  const result = new Map();
  const anchored = outline.filter((item) => Number.isInteger(item.page));
  if (!anchored.length) return result;
  const byPage = new Map();
  for (const item of anchored) byPage.set(item.page, [...(byPage.get(item.page) || []), item]);
  const anchors = [];
  const located = new Map();
  for (const [page, items] of byPage) {
    const lines = pageLines.get(page);
    const found = lines ? locateHeadings(lines, items) : new Map();
    located.set(page, found);
    // Unlocated headings start at the top of their page, after located ones before them.
    let last = -1;
    for (const item of items) {
      last = found.get(item.id) ?? last;
      anchors.push({ id: item.id, page, line: last, order: anchors.length });
    }
  }
  anchors.sort((a, b) => a.page - b.page || a.line - b.line || a.order - b.order);
  let next = 0,
    owner = null;
  for (const page of [...pageLines.keys()].sort((a, b) => a - b)) {
    const lines = pageLines.get(page);
    const headings = new Set(located.get(page)?.values() || []);
    for (const paragraph of pageParagraphs(lines, headings)) {
      while (
        next < anchors.length &&
        (anchors[next].page < page ||
          (anchors[next].page === page && anchors[next].line < paragraph.line))
      )
        owner = anchors[next++].id;
      if (owner === null) continue;
      const end = topicSentenceLength(paragraph.text, locale);
      if (!end) continue;
      const sentences = result.get(owner) || [];
      sentences.push({
        id: `${owner}#${page}:${paragraph.line}`,
        page,
        sentence: paragraph.text.slice(0, end),
        paragraph: paragraph.text,
      });
      result.set(owner, sentences);
    }
  }
  return result;
}

/**
 * Scan the open PDF in the background while the outline is shown and the
 * experimental preference is on. Page text is cached per document and partial
 * results are published as pages arrive.
 */
export function useOutlineTopicSentences({ session, pages, outline, enabled, visible, locale }) {
  const sections = shallowRef(new Map());
  let cache = { pdf: null, epoch: null, lines: new Map() };
  let completed = null,
    shown = null;
  let run = 0;

  async function scan() {
    const pdf = session.pdf;
    const items = outline.value;
    const id = ++run;
    if (!enabled.value || !pdf || !items.length) {
      sections.value = new Map();
      completed = shown = null;
      return;
    }
    if (cache.pdf !== pdf || cache.epoch !== session.epoch)
      cache = { pdf, epoch: session.epoch, lines: new Map() };
    const key = { pdf, items, locale: locale.value };
    if (
      completed?.pdf === key.pdf &&
      completed.items === key.items &&
      completed.locale === key.locale
    )
      return;
    // Never show sentences gathered for another document or outline.
    if (shown?.pdf !== key.pdf || shown.items !== key.items || shown.locale !== key.locale) {
      sections.value = new Map();
      shown = key;
    }
    if (!visible.value) return;
    const first = Math.min(...items.map((item) => item.page).filter(Number.isInteger));
    if (!Number.isFinite(first)) {
      sections.value = new Map();
      return;
    }
    const publish = () => (sections.value = outlineTopicSentences(items, cache.lines, key.locale));
    let pending = 0;
    for (let number = first; number <= pdf.numPages; number++) {
      if (!cache.lines.has(number)) {
        try {
          cache.lines.set(number, await collectPageLines(pdf, number));
        } catch {
          cache.lines.set(number, []);
        }
        // Stop when the document, outline or preference changed meanwhile.
        if (id !== run || session.pdf !== pdf) return;
        if (++pending >= 8) {
          pending = 0;
          publish();
        }
      }
    }
    publish();
    completed = key;
  }

  watch([pages, outline, enabled, visible, locale], () => void scan(), { immediate: true });
  return sections;
}
