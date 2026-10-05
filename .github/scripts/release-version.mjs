// Initial rollout must not release the existing package version automatically.
export const INITIAL_VERSION = '0.1.0';
const pattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
export function parseVersion(value) {
  const match = typeof value === 'string' && value.match(pattern);
  if (!match) throw Error('Invalid semantic version: ' + value);
  const pre = match[4]?.split('.') || [];
  if (pre.some((part) => /^\d+$/.test(part) && part.length > 1 && part.startsWith('0')))
    throw Error('Invalid semantic version: ' + value);
  return { core: match.slice(1, 4).map(BigInt), pre };
}
export function compareVersions(a, b) {
  const left = parseVersion(a),
    right = parseVersion(b);
  for (let i = 0; i < 3; i++)
    if (left.core[i] !== right.core[i]) return left.core[i] > right.core[i] ? 1 : -1;
  if (!left.pre.length || !right.pre.length)
    return left.pre.length === right.pre.length ? 0 : left.pre.length ? -1 : 1;
  for (let i = 0; i < Math.max(left.pre.length, right.pre.length); i++) {
    const x = left.pre[i],
      y = right.pre[i];
    if (x === y) continue;
    if (x === undefined || y === undefined) return x === undefined ? -1 : 1;
    const xn = /^\d+$/.test(x),
      yn = /^\d+$/.test(y);
    if (xn && yn) return BigInt(x) > BigInt(y) ? 1 : -1;
    if (xn !== yn) return xn ? -1 : 1;
    return x > y ? 1 : -1;
  }
  return 0;
}
export function shouldRelease(version, releases, baseline = INITIAL_VERSION) {
  parseVersion(version);
  if (compareVersions(version, baseline) <= 0) return false;
  return releases
    .filter((release) => !release.draft)
    .every((release) => {
      let previous = release.tag_name.replace(/^v/, '');
      try {
        parseVersion(previous);
      } catch {
        return true;
      }
      return compareVersions(version, previous) > 0;
    });
}
