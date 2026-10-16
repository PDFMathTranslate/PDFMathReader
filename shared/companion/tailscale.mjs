// Tailscale's stable address ranges are the only addresses that may be
// carried in discovery metadata.  Keeping the parser here avoids trusting
// peer entries or arbitrary command output when building URLs and TXT data.
export const TAILSCALE_IPV4_NETWORK = '100.64.0.0/10';
export const TAILSCALE_IPV6_NETWORK = 'fd7a:115c:a1e0::/48';
export const TAILSCALE_TXT_KEY = 'ts';
export const MAX_TAILSCALE_ADDRESSES = 8;
export const MAX_TAILSCALE_TXT_BYTES = 240;

const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function normalizeIPv4(value) {
  const match = ipv4Pattern.exec(value);
  if (!match) return '';
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return '';
  const number = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  // 100.64.0.0/10 is reserved for carrier-grade NAT and is Tailscale's
  // IPv4 address space.  Reject every other private/public address.
  // 100.100.100.100 is Tailscale's Quad100 DNS service, not a peer address.
  if (number < 0x64400000 || number > 0x647fffff || number === 0x64646464) return '';
  return parts.join('.');
}

function parseIPv6(value) {
  if (!value || value.includes('%') || value.includes('.')) return null;
  const lower = value.toLowerCase();
  const marker = lower.indexOf('::');
  if (marker >= 0 && lower.indexOf('::', marker + 2) >= 0) return null;
  const parseGroups = (part) => {
    if (!part) return [];
    const groups = part.split(':');
    if (groups.some((group) => !/^[\da-f]{1,4}$/.test(group))) return null;
    return groups.map((group) => Number.parseInt(group, 16));
  };
  let groups;
  if (marker < 0) {
    groups = parseGroups(lower);
    if (!groups || groups.length !== 8) return null;
  } else {
    const head = parseGroups(lower.slice(0, marker));
    const tail = parseGroups(lower.slice(marker + 2));
    if (!head || !tail || head.length + tail.length >= 8) return null;
    groups = [...head, ...Array(8 - head.length - tail.length).fill(0), ...tail];
  }
  return groups;
}

function formatIPv6(groups) {
  let bestStart = -1;
  let bestLength = 1;
  for (let index = 0; index < groups.length; index++) {
    if (groups[index] !== 0) continue;
    let end = index;
    while (end < groups.length && groups[end] === 0) end++;
    if (end - index > bestLength) {
      bestStart = index;
      bestLength = end - index;
    }
    index = end - 1;
  }
  if (bestStart < 0) return groups.map((group) => group.toString(16)).join(':');
  const left = groups
    .slice(0, bestStart)
    .map((group) => group.toString(16))
    .join(':');
  const right = groups
    .slice(bestStart + bestLength)
    .map((group) => group.toString(16))
    .join(':');
  return `${left}::${right}`;
}

function normalizeIPv6(value) {
  const groups = parseIPv6(value);
  if (!groups || groups[0] !== 0xfd7a || groups[1] !== 0x115c || groups[2] !== 0xa1e0) return '';
  return formatIPv6(groups);
}

export function normalizeTailscaleAddress(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return normalizeIPv4(trimmed) || normalizeIPv6(trimmed);
}

export function normalizeTailscaleAddresses(values) {
  if (!Array.isArray(values)) return [];
  const result = [];
  const seen = new Set();
  for (const value of values) {
    const address = normalizeTailscaleAddress(value);
    if (!address || seen.has(address)) continue;
    seen.add(address);
    result.push(address);
    if (result.length >= MAX_TAILSCALE_ADDRESSES) break;
  }
  return result;
}

export function tailscaleHttpUrls(addresses, port) {
  if (!Number.isInteger(port) || port <= 0 || port >= 65536) return [];
  return normalizeTailscaleAddresses(addresses).map((address) =>
    address.includes(':') ? `http://[${address}]:${port}` : `http://${address}:${port}`,
  );
}

export function tailscaleTxt(addresses, maxBytes = MAX_TAILSCALE_TXT_BYTES) {
  if (!Number.isInteger(maxBytes) || maxBytes < TAILSCALE_TXT_KEY.length + 2) return '';
  const values = [];
  for (const address of normalizeTailscaleAddresses(addresses)) {
    const candidate = `${TAILSCALE_TXT_KEY}=${[...values, address].join(',')}`;
    if (new globalThis.TextEncoder().encode(candidate).byteLength > maxBytes) break;
    values.push(address);
  }
  return values.length ? `${TAILSCALE_TXT_KEY}=${values.join(',')}` : '';
}
