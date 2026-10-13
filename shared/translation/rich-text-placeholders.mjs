// BabelDOC wraps differently styled source runs as <style id='N'>...</style>. An LLM can
// translate the tag name (<样式 id='1'>), which BabelDOC then leaves in the output text.
const OPENING = /<\s*([^\s<>/='"]+)\s+id\s*=\s*(['"]?)\s*\d+\s*\2\s*>/giu;

export function hasRichTextPlaceholders(text) {
  return typeof text === 'string' && new RegExp(OPENING.source, 'iu').test(text);
}

// Drops placeholder tags and keeps their text, as BabelDOC does for unmatched tokens.
export function stripRichTextPlaceholders(text) {
  if (!hasRichTextPlaceholders(text)) return text;
  const names = new Set([...text.matchAll(OPENING)].map((match) => match[1].toLowerCase()));
  return text
    .replace(OPENING, '')
    .replace(/<\s*\/\s*([^\s<>/='"]+)\s*>/gu, (tag, name) =>
      names.has(name.toLowerCase()) ? '' : tag,
    );
}

// Upstream parsers read only <style id='N'> (BabelDOC) and {vN} (pdf2zh). Raw output with
// any other placeholder shape was typeset literally by sidecar schemas before 2.
const CANONICAL_STYLE = /^<\s*style\s*id\s*=\s*'\s*\d+\s*'\s*>$/iu;
const MALFORMED_FORMULA = /\{\s*v\s*\*\s*\}|\{\s*\{\s*v[\d\s]+\}\s*\}/iu;

export function hasUnparsedPlaceholders(text) {
  if (typeof text !== 'string') return false;
  if (MALFORMED_FORMULA.test(text)) return true;
  return [...text.matchAll(OPENING)].some(([tag]) => !CANONICAL_STYLE.test(tag));
}
