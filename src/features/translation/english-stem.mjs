// Porter2 (Snowball English) stemmer, used only to find where a word's root ends.
const EXCEPTIONS = new Map([
  ['skis', 'ski'],
  ['skies', 'sky'],
  ['dying', 'die'],
  ['lying', 'lie'],
  ['tying', 'tie'],
  ['idly', 'idl'],
  ['gently', 'gentl'],
  ['ugly', 'ugli'],
  ['early', 'earli'],
  ['only', 'onli'],
  ['singly', 'singl'],
  ['sky', 'sky'],
  ['news', 'news'],
  ['howe', 'howe'],
  ['atlas', 'atlas'],
  ['cosmos', 'cosmos'],
  ['bias', 'bias'],
  ['andes', 'andes'],
]);
const POST_1A = new Set([
  'inning',
  'outing',
  'canning',
  'herring',
  'earring',
  'proceed',
  'exceed',
  'succeed',
]);
const DOUBLES = ['bb', 'dd', 'ff', 'gg', 'mm', 'nn', 'pp', 'rr', 'tt'];
const LI_ENDING = 'cdeghkmnrt';
const vowel = (c) => !!c && 'aeiouy'.includes(c);
const hasVowel = (s) => /[aeiouy]/.test(s);

// Start of the region after the first non-vowel that follows a vowel.
function regionAfter(word, from) {
  for (let i = from + 1; i < word.length; i++)
    if (!vowel(word[i]) && vowel(word[i - 1])) return i + 1;
  return word.length;
}

function shortSyllableAt(word, end) {
  // The syllable ending at `end` (exclusive).
  const a = word[end - 3],
    b = word[end - 2],
    c = word[end - 1];
  if (end === 2) return vowel(b) && !vowel(c);
  return !vowel(a) && vowel(b) && !vowel(c) && !'wxY'.includes(c);
}

// Longest listed suffix wins; a shorter suffix is never tried after it.
function longest(word, suffixes) {
  let best = '';
  for (const s of suffixes) if (s.length > best.length && word.endsWith(s)) best = s;
  return best;
}

export function stemEnglish(input = '') {
  let word = String(input).toLowerCase().replace(/’/g, "'");
  if (word.length <= 2) return word;
  if (EXCEPTIONS.has(word)) return EXCEPTIONS.get(word);
  if (word.startsWith("'")) word = word.slice(1);
  word = word.replace(/^y/, 'Y').replace(/([aeiouy])y/g, '$1Y');

  const prefix = /^(gener|commun|arsen)/.exec(word)?.[0];
  const r1 = prefix ? prefix.length : regionAfter(word, 0);
  const r2 = regionAfter(word, r1);
  const inR1 = (s) => word.length - s.length >= r1;
  const inR2 = (s) => word.length - s.length >= r2;
  const cut = (s, add = '') => (word = word.slice(0, word.length - s.length) + add);
  const isShort = () => r1 >= word.length && shortSyllableAt(word, word.length);

  // Step 0
  const s0 = longest(word, ["'s'", "'s", "'"]);
  if (s0) cut(s0);

  // Step 1a
  const s1a = longest(word, ['sses', 'ied', 'ies', 's', 'us', 'ss']);
  if (s1a === 'sses') cut(s1a, 'ss');
  else if (s1a === 'ied' || s1a === 'ies') cut(s1a, word.length > 4 ? 'i' : 'ie');
  else if (s1a === 's' && hasVowel(word.slice(0, -2))) cut(s1a);
  if (POST_1A.has(word)) return word;

  // Step 1b
  const s1b = longest(word, ['eed', 'eedly', 'ed', 'edly', 'ing', 'ingly']);
  if (s1b === 'eed' || s1b === 'eedly') {
    if (inR1(s1b)) cut(s1b, 'ee');
  } else if (s1b && hasVowel(word.slice(0, -s1b.length))) {
    cut(s1b);
    if (/(at|bl|iz)$/.test(word)) word += 'e';
    else if (DOUBLES.some((d) => word.endsWith(d))) word = word.slice(0, -1);
    else if (isShort()) word += 'e';
  }

  // Step 1c
  if (/[yY]$/.test(word) && word.length > 2 && !vowel(word.at(-2))) word = word.slice(0, -1) + 'i';

  // Step 2
  const step2 = {
    tional: 'tion',
    enci: 'ence',
    anci: 'ance',
    abli: 'able',
    entli: 'ent',
    izer: 'ize',
    ization: 'ize',
    ational: 'ate',
    ation: 'ate',
    ator: 'ate',
    alism: 'al',
    aliti: 'al',
    alli: 'al',
    fulness: 'ful',
    ousli: 'ous',
    ousness: 'ous',
    iveness: 'ive',
    iviti: 'ive',
    biliti: 'ble',
    bli: 'ble',
    ogi: 'og',
    fulli: 'ful',
    lessli: 'less',
    li: '',
  };
  const s2 = longest(word, Object.keys(step2));
  if (s2 && inR1(s2)) {
    const before = word.at(-s2.length - 1);
    if (s2 === 'ogi') {
      if (before === 'l') cut(s2, 'og');
    } else if (s2 === 'li') {
      if (before && LI_ENDING.includes(before)) cut(s2);
    } else cut(s2, step2[s2]);
  }

  // Step 3
  const step3 = {
    tional: 'tion',
    ational: 'ate',
    alize: 'al',
    icate: 'ic',
    iciti: 'ic',
    ical: 'ic',
    ful: '',
    ness: '',
    ative: '',
  };
  const s3 = longest(word, Object.keys(step3));
  if (s3 && inR1(s3) && (s3 !== 'ative' || inR2(s3))) cut(s3, step3[s3]);

  // Step 4
  const s4 = longest(word, [
    'al',
    'ance',
    'ence',
    'er',
    'ic',
    'able',
    'ible',
    'ant',
    'ement',
    'ment',
    'ent',
    'ism',
    'ate',
    'iti',
    'ous',
    'ive',
    'ize',
    'ion',
  ]);
  if (s4 && inR2(s4) && (s4 !== 'ion' || /[st]$/.test(word.slice(0, -3)))) cut(s4);

  // Step 5
  if (word.endsWith('e')) {
    if (inR2('e') || (inR1('e') && !shortSyllableAt(word, word.length - 1))) cut('e');
  } else if (word.endsWith('ll') && inR2('l')) cut('l');

  return word.replace(/Y/g, 'y');
}
