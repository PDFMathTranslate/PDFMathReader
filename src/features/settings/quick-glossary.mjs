import { cloneGlossaries, validGlossaries } from '../../../shared/translation/glossary.mjs';

// PDF selections often use line breaks, tabs or nonbreaking spaces between words.
export function normalizeGlossaryTerm(text) {
  return typeof text === 'string' ? text.replace(/\s+/gu, ' ').trim() : '';
}

export const GLOSSARY_REQUEST = 'reader:add-glossary-term';
export function requestGlossaryTerm(text) {
  const source = normalizeGlossaryTerm(text);
  if (source) window.dispatchEvent(new CustomEvent(GLOSSARY_REQUEST, { detail: source }));
}

export function addQuickGlossaryTerm(value, { libraryId, source, target, newLibraryName }) {
  source = normalizeGlossaryTerm(source);
  target = normalizeGlossaryTerm(target);
  if (!source || !target || source.length > 500 || target.length > 500)
    throw Error('Source and target terms must contain between 1 and 500 characters.');
  const libraries = cloneGlossaries(value);
  let library = libraries.find((item) => item.id === libraryId);
  if (!library) {
    if (libraryId) throw Error('This glossary is no longer available. Choose another glossary.');
    library = {
      id: `glossary-${globalThis.crypto.randomUUID()}`,
      name: newLibraryName,
      enabled: true,
      entries: [],
    };
    libraries.push(library);
  }
  const existing = library.entries.find((entry) => normalizeGlossaryTerm(entry.source) === source);
  if (existing) {
    existing.source = source;
    existing.target = target;
  } else library.entries.push({ source, target });
  library.enabled = true;
  if (!validGlossaries(libraries)) throw Error('This glossary is full. Choose another glossary.');
  return libraries;
}
