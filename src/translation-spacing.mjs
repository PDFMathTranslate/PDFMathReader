// Display-only spacing: cached translations and source text stay verbatim.
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
  previous = current;
 }
 return result;
}
