import { orderedAnnotations } from '../reader/sidebar-outline.mjs';

export const ANNOTATION_EXPORT_FORMATS = Object.freeze({
  markdown: { extension: 'md', label: 'Markdown' },
  'markdown-outline': { extension: 'md', label: 'Markdown' },
  text: { extension: 'txt', label: 'Plain Text' },
});

// PDF selections carry hard line breaks; exported items read as single lines.
function oneLine(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function prepared(annotations) {
  return orderedAnnotations(
    (Array.isArray(annotations) ? annotations : [])
      .filter((item) => item && Number.isInteger(item.page))
      .map((item) => ({
        ...item,
        rects: Array.isArray(item.rects) ? item.rects : [],
        createdAt: String(item.createdAt ?? ''),
      })),
  ).filter((item) => oneLine(item.text) || oneLine(item.comment));
}

function markdownItem(item, indent) {
  const pad = '  '.repeat(indent);
  const text = oneLine(item.text),
    comment = oneLine(item.comment);
  const lines = [`${pad}- ${text || comment} (p. ${item.page})`];
  if (text && comment) lines.push(`${pad}  - ${comment}`);
  return lines;
}

// Assigns each annotation to the deepest outline entry starting at or before its page.
// Ties on page prefer the later entry, which is the more specific heading.
function chapterIndex(outline, page) {
  let selected = -1;
  outline.forEach((entry, index) => {
    if (!Number.isInteger(entry.page) || entry.page > page) return;
    if (selected < 0 || entry.page >= outline[selected].page) selected = index;
  });
  return selected;
}

function outlineMarkdown(items, outline) {
  const entries = (Array.isArray(outline) ? outline : []).map((entry) => ({
    title: oneLine(entry?.title) || 'Untitled',
    depth: Number.isInteger(entry?.depth) && entry.depth >= 0 ? entry.depth : 0,
    page: entry?.page,
  }));
  const buckets = new Map();
  const loose = [];
  for (const item of items) {
    const index = chapterIndex(entries, item.page);
    if (index < 0) loose.push(item);
    else buckets.set(index, [...(buckets.get(index) || []), item]);
  }
  // Keep annotated entries and the headings that enclose them.
  const kept = new Set();
  for (const index of buckets.keys()) {
    kept.add(index);
    let depth = entries[index].depth;
    for (let parent = index - 1; parent >= 0 && depth > 0; parent--) {
      if (entries[parent].depth >= depth) continue;
      kept.add(parent);
      depth = entries[parent].depth;
    }
  }
  const lines = loose.flatMap((item) => markdownItem(item, 0));
  for (let index = 0; index < entries.length; index++) {
    if (!kept.has(index)) continue;
    const { title, depth } = entries[index];
    lines.push(`${'  '.repeat(depth)}- **${title}**`);
    for (const item of buckets.get(index) || []) lines.push(...markdownItem(item, depth + 1));
  }
  return lines;
}

function plainText(items) {
  return items.flatMap((item) => {
    const text = oneLine(item.text),
      comment = oneLine(item.comment);
    return [
      `p. ${item.page}`,
      text || comment,
      ...(text && comment ? [`Comment: ${comment}`] : []),
      '',
    ];
  });
}

export function formatAnnotations(annotations, { format, outline = [], title = '' } = {}) {
  if (!ANNOTATION_EXPORT_FORMATS[format]) throw Error('Unknown annotation export format.');
  const items = prepared(annotations);
  const heading = oneLine(title);
  if (format === 'text')
    return [...(heading ? [heading, ''] : []), ...plainText(items)].join('\n').trimEnd() + '\n';
  const body =
    format === 'markdown-outline'
      ? outlineMarkdown(items, outline)
      : items.flatMap((item) => markdownItem(item, 0));
  return [...(heading ? [`# ${heading}`, ''] : []), ...body].join('\n') + '\n';
}

export function annotationExportName(title, format) {
  const base =
    oneLine(title)
      .replace(/\.(pdf|epub)$/i, '')
      .replace(/[/\\:*?"<>|]/g, '-') || 'Document';
  return `${base} annotations.${ANNOTATION_EXPORT_FORMATS[format].extension}`;
}
