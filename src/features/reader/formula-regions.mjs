// `math` marks every paragraph from the math translation backend. Only its
// formula classification (or an explicit formula region) is an OCR target.
export function isFormulaBlock(block) {
  const label = String(block.layoutLabel || block.type || block.category || '')
    .toLowerCase()
    .replace(/[\s_-]/g, '');
  return (
    block.isFormula === true ||
    ['formula', 'equation', 'isolateformula', 'displayformula', 'inlineformula'].includes(label)
  );
}

export function formulaRegions(blocks, translations) {
  return blocks.filter(isFormulaBlock).flatMap((block) => {
    const translated = !!(translations && block.translatedBox);
    const box = (translated ? block.translatedBox : block.sourceBox) || block;
    if (
      ![box.x, box.y, box.width, box.height].every(Number.isFinite) ||
      box.width <= 0 ||
      box.height <= 0
    )
      return [];
    return [{ id: block.id, box, translated }];
  });
}
