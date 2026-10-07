// Feature factories consume stable domain ports.  A port is intentionally
// descriptor based: values that are declared later in the composition root are
// read only when a feature uses them, preserving the existing setup order.
export function createLazyPort(getters) {
  const descriptors = {};
  for (const [name, getter] of Object.entries(getters))
    descriptors[name] = { enumerable: true, get: getter };
  return Object.defineProperties({}, descriptors);
}

export function createWritablePort(entries) {
  const descriptors = {};
  for (const [name, [getter, setter]] of Object.entries(entries))
    descriptors[name] = { enumerable: true, get: getter, set: setter };
  return Object.defineProperties({}, descriptors);
}
