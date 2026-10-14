import { MAX_RECENT_DOCUMENT_FONTS } from '../../../shared/reader/translation-font.mjs';

export const DOCUMENT_FONT_STYLES = ['sans', 'serif', 'mono'];
const RECENT = 'recent:';
// Select items cannot use an empty value, so the document's own font has a token.
export const DOCUMENT_FONT_DEFAULT = 'default:';

let installed = null;

// One scan serves every popup and settings window; a failed scan is retried
// the next time the settings open.
export function loadInstalledFonts(request = fetch) {
  installed ??= request('/api/fonts')
    .then((response) => {
      if (!response.ok) throw Error(`/api/fonts failed: ${response.status}`);
      return response.json();
    })
    .catch((error) => {
      installed = null;
      throw error;
    });
  return installed;
}

/**
 * Popup items for one style: the document's own font, recently used fonts,
 * then installed families by style with the popup's style first.
 */
export function documentFontMenu({ fonts, style, value = '', recent = [], label }) {
  const known = new Set(DOCUMENT_FONT_STYLES.flatMap((key) => fonts?.[key] || [])),
    items = [{ value: DOCUMENT_FONT_DEFAULT, label: label('default') }];
  if (value && fonts && !known.has(value))
    items.push({ value, label: label('missing', { name: value }), family: value });
  const used = recent.filter((name) => !fonts || known.has(name));
  if (used.length) {
    items.push({ value: 'section:recent', label: label('recent'), header: true });
    for (const name of used) items.push({ value: RECENT + name, label: name, family: name });
  }
  for (const key of [style, ...DOCUMENT_FONT_STYLES.filter((other) => other !== style)]) {
    if (!fonts?.[key]?.length) continue;
    items.push({ value: `section:${key}`, label: label(key), header: true });
    for (const name of fonts[key]) items.push({ value: name, label: name, family: name });
  }
  return items;
}

/** The font name an item stands for, '' for the document's font, or null for a header. */
export function chosenFont(value) {
  if (typeof value !== 'string' || value.startsWith('section:')) return null;
  if (value === DOCUMENT_FONT_DEFAULT) return '';
  return value.startsWith(RECENT) ? value.slice(RECENT.length) : value;
}

export const rememberFont = (recent, name) =>
  name
    ? [name, ...recent.filter((other) => other !== name)].slice(0, MAX_RECENT_DOCUMENT_FONTS)
    : recent;
