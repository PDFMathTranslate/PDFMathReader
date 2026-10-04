// Shared display/typesetting spacing: source text and raw translation caches stay verbatim.
const letter = /\p{Letter}/u;
const latin = /\p{Script=Latin}/u;
const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const number = /\p{Decimal_Number}/u;
const mark = /\p{Mark}/u;
function script(char) {
 if (letter.test(char) && cjk.test(char)) return 'cjk';
 if ((letter.test(char) && latin.test(char)) || number.test(char)) return 'western';
 return '';
}
export function translationSpacing(text = '') {
 let result = '', previous = '';
 for (const char of text) {
  if (mark.test(char)) { result += char; continue; }
  const current = script(char);
  if (previous && current && previous !== current) result += ' ';
  result += char;
  previous = /[%％‰‱]/u.test(char) && previous === 'western' ? 'western' : current;
 }
 return result;
}

// Precise may request JSON. Preserve its keys, types and formula placeholders.
export function kernelTranslationSpacing(text) {
 if (typeof text !== 'string') return text;
 try {
  const value = JSON.parse(text);
  const space = value => typeof value === 'string' ? translationSpacing(value)
   : Array.isArray(value) ? value.map(space)
   : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, space(item)])) : value;
  return JSON.stringify(space(value));
 } catch { return translationSpacing(text); }
}

// Display-only Chinese paragraph indentation; leave caches and kernel text unchanged.
export function paragraphDisplayText(text = '') {
 return translationSpacing(text).replace(/^ {2}(?! )([^\r\n]*)/gm, (match, paragraph) =>
  /\p{Script=Han}/u.test(paragraph) ? '\u3000\u3000' + paragraph : match);
}
