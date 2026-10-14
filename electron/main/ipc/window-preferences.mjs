// Preferences each window keeps for its own document while sharing the rest.
export const WINDOW_LOCAL_PREFERENCES = [
  'engine',
  'direction',
  'columns',
  'fit',
  'zoom',
  'translationMode',
];

// A window's chosen service per kernel follows its document, like its kernel; the
// saved service profiles stay shared by every window. A kernel the window never chose
// a service for keeps the automatic service it was using.
export const withServiceSelections = (services, own) => {
  if (!services) return own ?? services;
  const result = { ...services };
  for (const kernel of new Set([...Object.keys(services || {}), ...Object.keys(own || {})])) {
    const shared = services?.[kernel],
      id = typeof own?.[kernel]?.id === 'string' ? own[kernel].id : 'auto';
    if (!shared) {
      if (own?.[kernel]) result[kernel] = own[kernel];
      continue;
    }
    const values =
      shared.profiles?.[id]?.values || (shared.id === id ? shared.values : own?.[kernel]?.values);
    result[kernel] = { ...shared, id, values: { ...(values || {}) } };
  }
  return result;
};
export const mergeWindowPreferences = (next, current, value, isSender, sameDocument = isSender) => {
  const result = { ...next };
  for (const key of WINDOW_LOCAL_PREFERENCES)
    if (current?.[key] !== undefined) result[key] = current[key];
  if (isSender)
    for (const key of WINDOW_LOCAL_PREFERENCES)
      if (value && Object.prototype.hasOwnProperty.call(value, key) && value[key] !== undefined)
        result[key] = next[key];
  const adopt =
    sameDocument && Object.prototype.hasOwnProperty.call(value || {}, 'translationServices');
  if (!adopt && current)
    result.translationServices = withServiceSelections(
      next.translationServices,
      current.translationServices,
    );
  return result;
};
