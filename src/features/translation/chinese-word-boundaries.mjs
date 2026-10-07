const segmenter =
  typeof Intl.Segmenter === 'function' ? new Intl.Segmenter('zh', { granularity: 'word' }) : null;

// Keep source offsets so emphasis can be applied without splitting word wrappers.
export function chineseWordBoundaries(text) {
  if (!segmenter) return [{ text, start: 0, end: text.length, protected: false }];
  const words = [];
  for (const segment of segmenter.segment(text)) {
    const previous = words.at(-1);
    if (previous?.protected && /^[，。！？；：、）】》”’]+$/u.test(segment.segment)) {
      previous.text += segment.segment;
      previous.end += segment.segment.length;
      continue;
    }
    words.push({
      text: segment.segment,
      start: segment.index,
      end: segment.index + segment.segment.length,
      protected: segment.isWordLike && /\p{Script=Han}/u.test(segment.segment),
    });
  }
  return words;
}
