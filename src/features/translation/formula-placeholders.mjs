import { stripRichTextPlaceholders } from '../../../shared/translation/rich-text-placeholders.mjs';

// Upstream vN tokens refer to original formula/font runs, not literal prose.
export function restoreFormulaPlaceholders(block) {
  if (typeof block.translation === 'string')
    block = { ...block, translation: stripRichTextPlaceholders(block.translation) };
  const formulas = block.formulaTexts;
  if (!Array.isArray(formulas) || typeof block.translation !== 'string') return block;
  // pdf2zh reads {vN} with spaces allowed inside the digits; doubled braces are one token.
  const token = /\{+\s*v\s*([\d\s]+|\*)\s*\}+/gi;
  const source = typeof block.sourceInput === 'string' ? block.sourceInput : '';
  const ids = [
    ...new Set(
      [...source.matchAll(token)]
        .filter((m) => m[1] !== '*' && m[1].trim())
        .map((m) => Number(m[1].replace(/\s/g, ''))),
    ),
  ];
  const wildcardId = ids.length === 1 ? ids[0] : undefined;
  let ambiguous = false;
  const translation = block.translation.replace(token, (match, id) => {
    if (id === '*') {
      if (wildcardId === undefined) {
        ambiguous = true;
        return match;
      }
      return formulas[wildcardId] ?? '';
    }
    // Upstream skips formula IDs it does not own rather than printing the token.
    const formula = formulas[Number(id.replace(/\s/g, ''))];
    return typeof formula === 'string' ? formula : '';
  });
  // A wildcard is ambiguous when multiple original runs exist.
  // Preserve the original paragraph rather than invent or discard its content.
  return { ...block, translation: ambiguous ? block.text || block.translation : translation };
}
