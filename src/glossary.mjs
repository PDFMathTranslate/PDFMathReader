export function validGlossaries(value) {
  return (
    Array.isArray(value) &&
    value.length <= 50 &&
    value.every(
      (library) =>
        library &&
        typeof library.id === 'string' &&
        typeof library.name === 'string' &&
        library.name.length <= 200 &&
        typeof library.enabled === 'boolean' &&
        Array.isArray(library.entries) &&
        library.entries.length <= 1000 &&
        library.entries.every(
          (entry) =>
            entry &&
            typeof entry.source === 'string' &&
            typeof entry.target === 'string' &&
            entry.source.length <= 500 &&
            entry.target.length <= 500,
        ),
    )
  );
}
export function cloneGlossaries(value) {
  return validGlossaries(value) ? JSON.parse(JSON.stringify(value)) : [];
}
export function glossaryEntries(libraries) {
  const entries = new Map();
  for (const library of cloneGlossaries(libraries)) {
    if (!library.enabled) continue;
    for (const { source, target } of library.entries) {
      if (source.trim() && target.trim() && !entries.has(source.trim()))
        entries.set(source.trim(), target.trim());
    }
  }
  return [...entries]
    .map(([source, target]) => ({ source, target }))
    .sort((a, b) => b.source.length - a.source.length);
}
export function protectTerms(text, entries) {
  let prefix = 'PMRGLOSSARY';
  while (text.includes(prefix)) prefix += 'X';
  const replacements = [];
  const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = entries.length
    ? new RegExp(entries.map((entry) => escape(entry.source)).join('|'), 'gu')
    : null;
  const targets = new Map(entries.map((entry) => [entry.source, entry.target]));
  const protectedText = pattern
    ? text.replace(pattern, (source) => {
        const token = `${prefix}${replacements.length}END`;
        replacements.push([token, targets.get(source)]);
        return token;
      })
    : text;
  return {
    text: protectedText,
    restore(output) {
      for (const [token, target] of replacements) {
        if (!output.includes(token))
          throw Error('Translation did not preserve a required glossary term. Retry translation.');
        output = output.replaceAll(token, () => target);
      }
      return output;
    },
  };
}
