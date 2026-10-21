import { watch } from 'vue';
import { glyphPlan, pageGlyphRuns } from './bionic-rendering.mjs';
import {
  samplePageNumbers,
  tfidfRunRanges,
  tfidfRunText,
  tfidfTermSet,
  tfidfTokens,
  tfidfStrengths,
} from '../translation/tfidf-weighting.mjs';

// Sampling waits until the first pages are drawn, then reads one page at a time.
const RECORD_DELAY_MS = 1500;

async function post(path, body) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw Error(`${path} failed: ${response.status}`);
  return response.json();
}

// Plain text of a page as pdf.js extracts it, with line-end hyphens rejoined.
async function pageText(page) {
  const { items } = await page.getTextContent();
  return items
    .map((item) => (item.str || '') + (item.hasEOL ? '\n' : ''))
    .join('')
    .replace(/(\p{L})-\n(?=\p{Ll})/gu, '$1')
    .replace(/\s+/g, ' ');
}

const fingerprint = (pdf) => pdf?.fingerprints?.[0] || '';

// Experimental TF-IDF font weighting of original pages. Every opened document
// lends the terms of a few random pages to a local document-frequency cache,
// whether or not the weighting is on, so the corpus grows with use.
export function createTfidfWeighting({ session, preferences, onToggle }) {
  const recorded = new Set(),
    plans = new WeakMap(),
    rankings = new WeakMap();
  const enabled = () => !!preferences.tfidfWeightingEnabled?.value;

  async function sample(pdf) {
    const texts = [];
    for (const number of samplePageNumbers(pdf.numPages)) {
      // A document closed meanwhile is sampled no further.
      if (session.pdf !== pdf) return null;
      const page = await pdf.getPage(number);
      texts.push(await pageText(page));
    }
    return tfidfTermSet(texts);
  }

  /** Adds a newly opened document to the DF cache once per session. */
  function record(pdf) {
    const id = fingerprint(pdf);
    if (!id || recorded.has(id)) return;
    recorded.add(id);
    setTimeout(async () => {
      try {
        if (session.pdf !== pdf) return recorded.delete(id);
        if ((await post('/api/term-corpus/documents', { id })).known) return;
        const terms = await sample(pdf);
        if (!terms) return recorded.delete(id);
        if (terms.length) await post('/api/term-corpus/documents', { id, terms });
      } catch {
        recorded.delete(id);
      }
    }, RECORD_DELAY_MS);
  }

  async function rankDocument(pdf) {
    const counts = new Map();
    for (let number = 1; number <= pdf.numPages; number++) {
      if (session.pdf !== pdf) throw Error('Document closed during TF-IDF extraction');
      const text = await pageText(await pdf.getPage(number));
      for (const { term } of tfidfTokens(text)) counts.set(term, (counts.get(term) || 0) + 1);
    }
    const terms = [...counts.keys()],
      known = new Map();
    let documents = 0;
    for (let offset = 0; offset < terms.length; offset += 20000) {
      const batch = terms.slice(offset, offset + 20000);
      const result = await post('/api/term-corpus/frequencies', {
        exclude: fingerprint(pdf) || undefined,
        terms: batch,
      });
      documents = result.documents;
      batch.forEach((term, i) => known.set(term, result.frequencies[i]));
    }
    return tfidfStrengths(counts, { documents, frequency: (term) => known.get(term) });
  }

  function documentRanking(pdf) {
    if (!rankings.has(pdf))
      rankings.set(
        pdf,
        rankDocument(pdf).catch((error) => {
          rankings.delete(pdf);
          throw error;
        }),
      );
    return rankings.get(pdf);
  }

  async function plan(page, pdf) {
    const strengths = await documentRanking(pdf);
    const runs = await pageGlyphRuns(page),
      text = tfidfRunText(runs);
    return glyphPlan(runs, tfidfRunRanges(runs, strengths, text));
  }

  /**
   * Glyph strengths for an original page. A page that cannot be weighed (too few
   * cached documents) gets an empty plan under the same key; a failed lookup is
   * tried again on the next draw.
   */
  async function renderOptions(page) {
    if (!plans.has(page))
      plans.set(
        page,
        plan(page, session.pdf).catch(() => {
          plans.delete(page);
          return new Map();
        }),
      );
    return { key: 'tfidf', plan: await plans.get(page) };
  }

  watch(enabled, () => onToggle?.());
  return { enabled, record, renderOptions };
}
