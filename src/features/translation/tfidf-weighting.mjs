// Experimental TF-IDF font weighting for original PDF pages.
// Scoring follows fasttfidf (https://github.com/purijs/fasttfidf): lowercase
// tokens of 2-127 characters, raw term counts, idf = ln(N / df) + 1 and a
// max_df cutoff. N and df count the open document as one of the corpus, so
// every term on its page has df >= 1.
import { joinLogicalRuns, splitLogicalRanges } from './information-emphasis.mjs';

// Random pages read from each opened document for the shared DF cache.
export const TFIDF_SAMPLE_PAGES = 12;
// Other cached documents needed before IDF separates common from rare terms.
export const TFIDF_MIN_DOCUMENTS = 3;
// Terms in more than this share of documents (fasttfidf max_df) stay regular.
export const TFIDF_MAX_DF = 0.5;
// Share of a page's distinct terms that is emphasized.
export const TFIDF_EMPHASIZED_SHARE = 0.3;
// Stroke strengths from the highest-scoring band down; 1 matches bionic bold.
export const TFIDF_LEVELS = Object.freeze([1, 0.7, 0.4]);
const MAX_TERM_LENGTH = 127;

const words = new Intl.Segmenter(undefined, { granularity: 'word' });
const LETTER = /\p{L}/u;

/** The corpus term for one word segment, or '' when it is not counted. */
export function tfidfTerm(word = '') {
  const term = word.normalize('NFKC').toLowerCase();
  const length = [...term].length;
  return length >= 2 && length <= MAX_TERM_LENGTH && LETTER.test(term) ? term : '';
}

/** Counted terms in text, with their UTF-16 offsets. */
export function tfidfTokens(text = '') {
  if (typeof text !== 'string' || !text) return [];
  const tokens = [];
  for (const { segment, index, isWordLike } of words.segment(text)) {
    const term = isWordLike && tfidfTerm(segment);
    if (term) tokens.push({ term, start: index, end: index + segment.length });
  }
  return tokens;
}

/** Distinct terms across texts, as stored for one document in the DF cache. */
export function tfidfTermSet(texts = []) {
  const terms = new Set();
  for (const text of texts) for (const { term } of tfidfTokens(text)) terms.add(term);
  return [...terms];
}

/** Up to `size` distinct page numbers drawn uniformly at random, ascending. */
export function samplePageNumbers(count, size = TFIDF_SAMPLE_PAGES, random = Math.random) {
  const pages = Array.from({ length: Math.max(0, count) }, (_, i) => i + 1);
  const take = Math.min(size, pages.length);
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(random() * (pages.length - i));
    [pages[i], pages[j]] = [pages[j], pages[i]];
  }
  return pages.slice(0, take).sort((a, b) => a - b);
}

export const inverseDocumentFrequency = (df, documents) => Math.log(documents / df) + 1;

/**
 * Emphasized word ranges in text. `corpus.documents` and `corpus.frequency(term)`
 * describe the other cached documents only.
 */
export function tfidfRanges(text, corpus) {
  const tokens = tfidfTokens(text);
  if (!tokens.length || !(corpus?.documents >= TFIDF_MIN_DOCUMENTS)) return [];
  const counts = new Map();
  for (const { term } of tokens) counts.set(term, (counts.get(term) || 0) + 1);
  const documents = corpus.documents + 1,
    scored = [];
  for (const [term, tf] of counts) {
    const df = Math.max(0, Number(corpus.frequency(term)) || 0) + 1;
    if (df / documents > TFIDF_MAX_DF) continue;
    scored.push({ term, score: tf * inverseDocumentFrequency(df, documents) });
  }
  scored.sort((a, b) => b.score - a.score || (a.term < b.term ? -1 : 1));
  const emphasized = Math.min(scored.length, Math.ceil(counts.size * TFIDF_EMPHASIZED_SHARE)),
    strengths = new Map();
  for (let i = 0; i < emphasized; i++)
    strengths.set(scored[i].term, TFIDF_LEVELS[Math.floor((i * TFIDF_LEVELS.length) / emphasized)]);
  return tokens
    .filter(({ term }) => strengths.has(term))
    .map(({ term, start, end }) => ({ start, end, strength: strengths.get(term) }));
}

/** Joined text of native PDF runs and its distinct terms, for a DF lookup. */
export function tfidfRunText(runs = []) {
  const { logical, parts } = joinLogicalRuns(runs);
  return { logical, parts, terms: [...new Set(tfidfTokens(logical).map((t) => t.term))] };
}

/** Per-run emphasized ranges for native PDF text, joining hyphenated and split words. */
export function tfidfRunRanges(runs, corpus, text = tfidfRunText(runs)) {
  return splitLogicalRanges(tfidfRanges(text.logical, corpus), text.parts);
}
