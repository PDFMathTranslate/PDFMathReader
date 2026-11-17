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
    ja: {
      emphasizeResearchFindings: '結果、証拠、有意',
      emphasizeOrdinals: '最初に、次に、最後に',
      emphasizeKeyVerbs: '支持する、示す、明らかにする',
      emphasizeLogicalConnectives: 'しかし、したがって、なぜなら',
    },
    ko: {
      emphasizeResearchFindings: '결과, 증거, 유의미한',
      emphasizeOrdinals: '첫째, 둘째, 마지막으로',
      emphasizeKeyVerbs: '뒷받침하다, 나타내다, 밝히다',
      emphasizeLogicalConnectives: '그러나, 따라서, 왜냐하면',
    },
    fr: {
      emphasizeResearchFindings: 'résultats, preuves, significatif',
      emphasizeOrdinals: 'premier, deuxième, enfin',
      emphasizeKeyVerbs: 'soutenir, indiquer, révéler',
      emphasizeLogicalConnectives: 'cependant, donc, parce que',
    },
    es: {
      emphasizeResearchFindings: 'resultados, evidencia, significativo',
      emphasizeOrdinals: 'primero, segundo, finalmente',
      emphasizeKeyVerbs: 'respaldar, indicar, revelar',
      emphasizeLogicalConnectives: 'sin embargo, por tanto, porque',
    },
    de: {
      emphasizeResearchFindings: 'Ergebnisse, Belege, signifikant',
      emphasizeOrdinals: 'erstens, zweitens, schließlich',
      emphasizeKeyVerbs: 'unterstützen, zeigen, offenbaren',
      emphasizeLogicalConnectives: 'jedoch, daher, weil',
    },
    pt: {
      emphasizeResearchFindings: 'resultados, evidências, significativo',
      emphasizeOrdinals: 'primeiro, segundo, finalmente',
      emphasizeKeyVerbs: 'apoiar, indicar, revelar',
      emphasizeLogicalConnectives: 'no entanto, portanto, porque',
    },
    ru: {
      emphasizeResearchFindings: 'результаты, доказательства, значимый',
      emphasizeOrdinals: 'во-первых, во-вторых, наконец',
      emphasizeKeyVerbs: 'поддерживать, указывать, раскрывать',
      emphasizeLogicalConnectives: 'однако, поэтому, потому что',
    },
    ar: {
      emphasizeResearchFindings: 'النتائج، الأدلة، دال',
      emphasizeOrdinals: 'أولًا، ثانيًا، أخيرًا',
      emphasizeKeyVerbs: 'يدعم، يشير، يكشف',
      emphasizeLogicalConnectives: 'لكن، لذلك، لأن',
    },
    arz: {
      emphasizeResearchFindings: 'النتايج، الأدلة، مهم',
      emphasizeOrdinals: 'أولًا، تانيًا، أخيرًا',
      emphasizeKeyVerbs: 'يدعم، يوضح، يكشف',
      emphasizeLogicalConnectives: 'بس، عشان كده، عشان',
    },
    hi: {
      emphasizeResearchFindings: 'परिणाम, प्रमाण, महत्वपूर्ण',
      emphasizeOrdinals: 'पहला, दूसरा, अंत में',
      emphasizeKeyVerbs: 'समर्थन करना, संकेत देना, प्रकट करना',
      emphasizeLogicalConnectives: 'हालाँकि, इसलिए, क्योंकि',
    },
    bn: {
      emphasizeResearchFindings: 'ফলাফল, প্রমাণ, তাৎপর্যপূর্ণ',
      emphasizeOrdinals: 'প্রথম, দ্বিতীয়, শেষে',
      emphasizeKeyVerbs: 'সমর্থন করা, নির্দেশ করা, প্রকাশ করা',
      emphasizeLogicalConnectives: 'তবে, তাই, কারণ',
    },
    ur: {
      emphasizeResearchFindings: 'نتائج، شواہد، اہم',
      emphasizeOrdinals: 'اول، دوم، آخر میں',
      emphasizeKeyVerbs: 'حمایت کرنا، اشارہ کرنا، ظاہر کرنا',
      emphasizeLogicalConnectives: 'تاہم، لہٰذا، کیونکہ',
    },
    pcm: {
      emphasizeResearchFindings: 'result, evidence, important',
      emphasizeOrdinals: 'first, second, finally',
      emphasizeKeyVerbs: 'support, show, reveal',
      emphasizeLogicalConnectives: 'but, so, because',
    },
  };
  return (examples[locale] || examples.en)[key] || '';
}
