import { paragraphs } from './layout.mjs';
import { isReferencesHeading } from '../../shared/translation/references-section.mjs';

const SCAN_CHUNK = 8;

// Finds the page where a document's reference list starts. Only the second half of the
// document is searched, so a table of contents listing "References" cannot match.
export function createReferencesLocator({ extractPage }) {
  if (typeof extractPage !== 'function') throw Error('A layout extractor is required.');
  const headings = new WeakMap();

  function hasHeading(entry, page) {
    let pages = headings.get(entry);
    if (!pages) headings.set(entry, (pages = new Map()));
    let promise = pages.get(page);
    if (promise) return promise;
    promise = Promise.resolve()
      .then(() => extractPage(entry, page))
      .then((items) =>
        paragraphs(Array.isArray(items) ? items : [], 0).some((block) =>
          isReferencesHeading(block.text),
        ),
      );
    pages.set(page, promise);
    promise.catch(() => {
      if (pages.get(page) === promise) pages.delete(page);
    });
    return promise;
  }

  async function referencesStart(entry, { page, pageCount }) {
    for (let first = Math.ceil(pageCount / 2); first <= page; first += SCAN_CHUNK) {
      const numbers = [];
      for (let number = first; number <= Math.min(page, first + SCAN_CHUNK - 1); number++)
        numbers.push(number);
      const found = await Promise.all(numbers.map((number) => hasHeading(entry, number)));
      const index = found.indexOf(true);
      if (index >= 0) return numbers[index];
    }
    return null;
  }

  return { referencesStart };
}
