import { watch } from 'vue';
import { glyphPlan, pageGlyphRuns } from './bionic-rendering.mjs';
import {
  samplePageNumbers,
  tfidfRunRanges,
  tfidfRunText,
  tfidfTermSet,
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
    plans = new WeakMap();
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

  async function plan(page) {
    const runs = await pageGlyphRuns(page),
      text = tfidfRunText(runs);
    if (!text.terms.length) return new Map();
    const { documents, frequencies } = await post('/api/term-corpus/frequencies', {
      exclude: fingerprint(session.pdf) || undefined,
      terms: text.terms,
    });
    const known = new Map(text.terms.map((term, i) => [term, frequencies[i]]));
    return glyphPlan(
      runs,
      tfidfRunRanges(runs, { documents, frequency: (term) => known.get(term) }, text),
    );
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
        plan(page).catch(() => {
          plans.delete(page);
          return new Map();
        }),
      );
    return { key: 'tfidf', plan: await plans.get(page) };
  }

  watch(enabled, () => onToggle?.());
  return { enabled, record, renderOptions };
}
