// Examples are literal entries in the reading aid's keyword lists.
export function informationExamples(key, locale) {
  const examples = {
    en: {
      emphasizeResearchFindings: 'results, evidence, significant',
      emphasizeOrdinals: 'first, second, finally',
      emphasizeKeyVerbs: 'support, indicate, reveal',
      emphasizeLogicalConnectives: 'however, therefore, because',
    },
    'zh-CN': {
      emphasizeResearchFindings: '结果、证据、显著',
      emphasizeOrdinals: '首先、其次、最后',
      emphasizeKeyVerbs: '支持、表明、揭示',
      emphasizeLogicalConnectives: '然而、因此、因为',
    },
    'zh-TW': {
      emphasizeResearchFindings: '結果、證據、顯著',
      emphasizeOrdinals: '首先、其次、最後',
      emphasizeKeyVerbs: '支持、表明、揭示',
      emphasizeLogicalConnectives: '然而、因此、因為',
    },
  };
  return (examples[locale] || examples.en)[key] || '';
}
