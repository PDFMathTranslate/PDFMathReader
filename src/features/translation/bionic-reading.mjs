// Bionic reading: bold the start of each word so the eye fixates on it.
import { stemEnglish } from './english-stem.mjs';
import { joinLogicalRuns, splitLogicalRanges } from './information-emphasis.mjs';

export const BIONIC_READING_MODES = Object.freeze(['off', 'fixed', 'root']);
export const BIONIC_FIXED_LENGTH = Object.freeze({ min: 1, max: 6, default: 3 });

export function normalizeBionicReading({ mode, fixedLength } = {}) {
  const length = Math.round(Number(fixedLength));
  return {
    mode: BIONIC_READING_MODES.includes(mode) ? mode : 'off',
    fixedLength: Number.isFinite(length)
      ? Math.min(BIONIC_FIXED_LENGTH.max, Math.max(BIONIC_FIXED_LENGTH.min, length))
      : BIONIC_FIXED_LENGTH.default,
  };
}

export const bionicReadingActive = (options) => normalizeBionicReading(options).mode !== 'off';

const words = new Intl.Segmenter(undefined, { granularity: 'word' });
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const LETTER = /\p{L}/u;
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

// Short words keep one letter, longer ones about two fifths.
const proportional = (n) => (n <= 3 ? 1 : n === 4 ? 2 : Math.ceil(n * 0.4));

function rootLength(word, letters) {
  if (letters <= 3) return 1;
  if (/^[A-Za-z'’]+$/.test(word)) {
    const lower = word.toLowerCase().replace(/’/g, "'"),
      stem = stemEnglish(lower);
    let common = 0;
    while (common < stem.length && stem[common] === lower[common]) common++;
    if (common >= 2 && common < letters) return common;
  }
  return proportional(letters);
}

/** Number of leading graphemes to bold in one word, or 0. */
export function bionicFixationLength(word, options) {
  const { mode, fixedLength } = normalizeBionicReading(options);
  if (mode === 'off' || !LETTER.test(word)) return 0;
  const letters = [...graphemes.segment(word)].length;
  if (CJK.test(word)) {
    if (letters <= 1) return 0;
    return mode === 'fixed' ? Math.min(fixedLength, letters - 1) : 1;
  }
  if (letters === 1) return 1;
  return mode === 'fixed' ? Math.min(fixedLength, letters - 1) : rootLength(word, letters);
}

/** UTF-16 ranges of the bold word starts in unchanged source text. */
export function bionicReadingRanges(text = '', options) {
  if (typeof text !== 'string' || !text || !bionicReadingActive(options)) return [];
  const ranges = [];
  for (const { segment, index, isWordLike } of words.segment(text)) {
    if (!isWordLike) continue;
    const count = bionicFixationLength(segment, options);
    if (!count) continue;
    let end = index,
      taken = 0;
    for (const { segment: g } of graphemes.segment(segment)) {
      if (taken++ === count) break;
      end += g.length;
    }
    ranges.push({ start: index, end });
  }
  return ranges;
}

/** Split shared text segments so each part is wholly bold or not. */
export function withBionicSegments(parts = [], ranges = []) {
  if (!ranges.length) return parts.map((part) => ({ ...part, bionic: false }));
  return parts.flatMap((part) => {
    const cuts = [
      ...new Set([
        part.start,
        part.end,
        ...ranges.flatMap((r) => [r.start, r.end]).filter((n) => n > part.start && n < part.end),
      ]),
    ].sort((a, b) => a - b);
    return cuts.slice(0, -1).map((start, i) => ({
      ...part,
      text: part.text.slice(start - part.start, cuts[i + 1] - part.start),
      start,
      end: cuts[i + 1],
      bionic: ranges.some((r) => start >= r.start && start < r.end),
    }));
  });
}

/** Per-run ranges for native PDF text, joining hyphenated and split words. */
export function bionicRunRanges(runs = [], options) {
  if (!bionicReadingActive(options)) return [];
  const { logical, parts } = joinLogicalRuns(runs);
  return splitLogicalRanges(bionicReadingRanges(logical, options), parts);
}
