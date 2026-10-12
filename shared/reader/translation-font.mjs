// Ultra fast draws translations as HTML text, so its font is a reader preference
// rather than a kernel option. Han glyph forms follow the target language.
const SERIF_CJK = {
  Japanese: ['Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif CJK JP'],
  Korean: ['AppleMyungjo', 'Batang', 'Noto Serif CJK KR'],
  'Traditional Chinese': ['Songti TC', 'PMingLiU', 'Noto Serif CJK TC'],
};
const SERIF = (language) => [
  'Iowan Old Style',
  'Georgia',
  'Times New Roman',
  ...(SERIF_CJK[language] || ['Songti SC', 'SimSun', 'Noto Serif CJK SC']),
  'serif',
];
const SANS = [
  '-apple-system',
  'BlinkMacSystemFont',
  'Segoe UI',
  'PingFang SC',
  'Microsoft YaHei',
  'sans-serif',
];
const GENERIC = new Set(['serif', 'sans-serif', '-apple-system', 'BlinkMacSystemFont']);

export const MAX_TRANSLATION_FONT_LENGTH = 100;

// Quotes, backslashes and control characters cannot form a valid family name.
// Inner and trailing spaces survive so multi-word names can be typed.
export function stripTranslationFont(value) {
  return typeof value === 'string'
    ? value.replace(/[\p{Cc}"\\;{}]/gu, '').slice(0, MAX_TRANSLATION_FONT_LENGTH)
    : '';
}

export function isValidTranslationFont(value) {
  return typeof value === 'string' && stripTranslationFont(value) === value;
}

// Returns '' when the reader should keep its default font.
export function translationFontFamily({ serif = false, font = '', language = '' } = {}) {
  const name = stripTranslationFont(font).trim();
  if (!serif && !name) return '';
  return [...(name ? [name] : []), ...(serif ? SERIF(language) : SANS)]
    .map((family) => (GENERIC.has(family) ? family : `"${family}"`))
    .join(', ');
}
