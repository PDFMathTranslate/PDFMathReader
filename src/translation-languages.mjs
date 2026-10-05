// Canonical names remain stable in preferences, prompts and translation cache keys.
// Fast: pdf2zh/gui.py lang_map. Precise: BabelDOC supported_languages table:
// https://funstory-ai.github.io/BabelDOC/supported_languages/
const entries = [
  ['Simplified Chinese', 'zh'],
  ['Traditional Chinese', 'zh-TW'],
  ['English', 'en'],
  ['Japanese', 'ja'],
  ['Korean', 'ko'],
  ['French', 'fr'],
  ['German', 'de'],
  ['Spanish', 'es'],
  ['Russian', 'ru'],
  ['Italian', 'it'],
  ['Portuguese', 'pt'],
  ['Brazilian Portuguese', 'pt-BR'],
  ['Traditional Chinese (Hong Kong)', 'zh-HK'],
  ['Polish', 'pl'],
  ['Dutch', 'nl'],
  ['Ukrainian', 'uk'],
  ['Czech', 'cs'],
  ['Romanian', 'ro'],
  ['Hungarian', 'hu'],
  ['Slovak', 'sk'],
  ['Croatian', 'hr'],
  ['Slovenian', 'sl'],
  ['Bulgarian', 'bg'],
  ['Serbian', 'sr'],
  ['Greek', 'el'],
  ['Swedish', 'sv'],
  ['Danish', 'da'],
  ['Norwegian', 'no'],
  ['Finnish', 'fi'],
  ['Icelandic', 'is'],
  ['Estonian', 'et'],
  ['Latvian', 'lv'],
  ['Lithuanian', 'lt'],
  ['Turkish', 'tr'],
  ['Vietnamese', 'vi'],
  ['Indonesian', 'id'],
  ['Malay', 'ms'],
  ['Filipino', 'tl'],
  ['Thai', 'th'],
  ['Catalan', 'ca'],
  ['Irish', 'ga'],
  ['Albanian', 'sq'],
  ['Afrikaans', 'af'],
  ['Swahili', 'sw'],
  ['Armenian', 'hy'],
  ['Georgian', 'ka'],
  ['Mongolian', 'mn'],
  ['Arabic', 'ar'],
  ['Hebrew', 'he'],
  ['Hindi', 'hi'],
  ['Persian', 'fa'],
];
export const LANGUAGE_CODES = Object.freeze(Object.fromEntries(entries));
export function isCustomLanguageCode(value) {
  return (
    typeof value === 'string' &&
    !Object.hasOwn(LANGUAGE_CODES, value) &&
    value.length <= 63 &&
    /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(value)
  );
}
export function translationLanguageCode(value) {
  return Object.hasOwn(LANGUAGE_CODES, value)
    ? LANGUAGE_CODES[value]
    : isCustomLanguageCode(value)
      ? value
      : undefined;
}
const all = Object.freeze(entries.map(([name]) => name));
const fast = Object.freeze(all.slice(0, 10));
// These scripts need shaping / right-to-left layout that the PDF kernels do not provide.
const precise = Object.freeze(
  all.filter((name) => !['Arabic', 'Hebrew', 'Hindi', 'Persian'].includes(name)),
);
const targets = Object.freeze({
  pdf_inspector: all,
  pdf_math_fast: fast,
  pdf_math_precise: precise,
});
export function translationLanguagesForKernel(engine, direction = 'target') {
  if (!Object.hasOwn(targets, engine)) return Object.freeze([]);
  // Input text does not need to be typeset in the source language.
  return direction === 'source' ? all : targets[engine];
}
export function isTranslationLanguageSupported(engine, name, direction = 'target') {
  return (
    Object.hasOwn(targets, engine) &&
    (translationLanguagesForKernel(engine, direction).includes(name) || isCustomLanguageCode(name))
  );
}
export function normalizeTranslationLanguage(engine, name, fallback, direction = 'target') {
  const languages = translationLanguagesForKernel(engine, direction);
  return isTranslationLanguageSupported(engine, name, direction)
    ? name
    : languages.includes(fallback)
      ? fallback
      : languages[0] || '';
}
const displayNames = new Map();
export function translationLanguageLabel(name, locale = 'en') {
  const code = LANGUAGE_CODES[name];
  if (!code) return name;
  if (!displayNames.has(locale))
    displayNames.set(locale, new Intl.DisplayNames([locale], { type: 'language' }));
  return (
    displayNames
      .get(locale)
      .of(
        code === 'zh'
          ? 'zh-Hans'
          : code === 'zh-TW'
            ? 'zh-Hant'
            : code === 'zh-HK'
              ? 'zh-Hant-HK'
              : code,
      ) || name
  );
}
