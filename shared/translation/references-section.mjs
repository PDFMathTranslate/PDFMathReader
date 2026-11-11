// Detects a reference-list heading ("References", "参考文献", "Bibliographie", ...)
// among one page's layout blocks, so translation can stop at the reference list.

const TITLES = [
  // English
  'references',
  'reference',
  'reference list',
  'references cited',
  'references and notes',
  'notes and references',
  'bibliography',
  'select bibliography',
  'works cited',
  'literature cited',
  'cited literature',
  // Chinese, Japanese, Korean
  '参考文献',
  '參考文獻',
  '参考资料',
  '參考資料',
  '引用文献',
  '引用文獻',
  '主要参考文献',
  '主要參考文獻',
  '참고문헌',
  '인용문헌',
  // European languages
  'références',
  'références bibliographiques',
  'bibliographie',
  'referencias',
  'referencias bibliográficas',
  'bibliografía',
  'referências',
  'referências bibliográficas',
  'bibliografia',
  'riferimenti bibliografici',
  'literatur',
  'literaturverzeichnis',
  'quellenverzeichnis',
  'literaturangaben',
  'referenzen',
  'referenties',
  'literatuurlijst',
  'literatuur',
  'piśmiennictwo',
  'kaynaklar',
  'kaynakça',
  'литература',
  'список литературы',
  'список использованной литературы',
  'библиография',
  'список источников',
  'література',
  'список літератури',
  // Other scripts
  'المراجع',
  'قائمة المراجع',
  'المصادر والمراجع',
  'संदर्भ',
  'संदर्भ सूची',
  'ग्रंथसूची',
  'তথ্যসূত্র',
  'গ্রন্থপঞ্জি',
  'حوالہ جات',
  'کتابیات',
  'tài liệu tham khảo',
  'daftar pustaka',
  'referensi',
];

// Spaces are dropped before comparing, so letter-spaced and small-caps headings such as
// "R EFERENCES" or "参 考 文 献" match too.
const compact = (text) => text.normalize('NFKC').toLocaleLowerCase().replace(/\s+/gu, '');
const TITLE_KEYS = new Set(TITLES.map(compact));

// Section numbering ("7", "7.", "VII.", "A.", "§ 5", "第五章") and trailing colons or periods.
const NUMBERING =
  /^(?:§\s*)?(?:\d+(?:\.\d+)*|[IVXLC]+|[A-Z])[.):]?\s+|^第[一二三四五六七八九十百\d]+[章节節]\s*/u;
const TRAILING = /[\s:：.。]+$/u;

export function isReferencesHeading(text) {
  const value = String(text || '')
    .trim()
    .replace(TRAILING, '');
  if (!value || value.length > 48) return false;
  // Try the text as is too: "R EFERENCES" would otherwise lose "R" as a section letter.
  return TITLE_KEYS.has(compact(value)) || TITLE_KEYS.has(compact(value.replace(NUMBERING, '')));
}

// The last heading on the page; reference lists rarely restart within a page.
export function referencesHeading(blocks) {
  return (Array.isArray(blocks) ? blocks : []).findLast((block) =>
    isReferencesHeading(block?.text),
  );
}

// Keeps the blocks that come before the heading in reading order, and the heading
// itself. A block in a column to the right of the heading's column comes after it;
// a block in a column to its left comes before it; otherwise vertical order decides.
// The column's right edge is the median over blocks aligned with the heading, so a
// full-width running header or title cannot widen it.
// A heading centred over the text area (it spans the area's midline without starting at
// its left edge) heads the whole page, so only vertical order decides.
export function blocksBeforeReferences(blocks) {
  const list = Array.isArray(blocks) ? blocks : [];
  const heading = referencesHeading(list);
  if (!heading) return list;
  const size = heading.fontSize || 10;
  const tolerance = Math.max(2, size * 0.5);
  const left = Math.min(...list.map((block) => block.x));
  const middle = (left + Math.max(...list.map((block) => block.x + block.width))) / 2;
  if (
    heading.x > left + size * 2 &&
    heading.x - tolerance <= middle &&
    middle <= heading.x + heading.width + tolerance
  )
    return list.filter((block) => block === heading || block.y < heading.y);
  const edges = list
    .filter((block) => block !== heading && Math.abs(block.x - heading.x) < size * 1.5)
    .map((block) => block.x + block.width)
    .sort((a, b) => a - b);
  const columnRight = Math.max(
    heading.x + heading.width,
    edges.length ? edges[Math.floor(edges.length / 2)] : 0,
  );
  return list.filter((block) => {
    if (block === heading) return true;
    if (block.x >= columnRight - tolerance) return false;
    if (block.x + block.width <= heading.x + tolerance) return true;
    return block.y < heading.y;
  });
}
