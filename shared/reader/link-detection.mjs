// Finds web links in selected PDF text. PDF text layers break long URLs across
// lines (for example "https://doi." / "org/10.1073/..."), so a line break is
// rejoined when the text before it clearly continues a URL.
const urlPattern =
  /\b(?:https?:\/\/|www\.)[^\s<>"，。；：、（）【】《》]+|\b(?:doi:\s*)?10\.\d{4,9}\/[^\s<>"，。；：、（）【】《》]+/gi;
const trailingPunctuation = /[.,;:!?'"\u2018\u2019\u201c\u201d]+$/;
const closers = { ')': '(', ']': '[', '}': '{', '>': '<' };
const maxLinks = 5;
const emailPattern =
  /(?<![\w.%+-])[A-Za-z0-9][\w.%+-]*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}\b/g;

function rejoinWrappedUrls(text) {
  // Each pass joins one break per URL; repeat for URLs spanning several lines.
  for (let pass = 0; pass < 8; pass++) {
    // The lookahead leaves the next line's token unconsumed so it can begin a URL.
    const joined = text.replace(/(\S+)[^\S\n]*\n\s*(?=(\S+))/g, (whole, before, after) => {
      if (!/(?:https?:\/\/|www\.|doi:|\b10\.\d{4,9}\/)/i.test(before)) return whole;
      // A break after "/" or "-" is always mid-URL; after "." it is only a
      // continuation when the next token itself looks like part of a URL.
      if (/[/\-_=&?#%~]$/.test(before) || (/\.$/.test(before) && /[./]/.test(after))) return before;
      return whole;
    });
    if (joined === text) return text;
    text = joined;
  }
  return text;
}

function trimUrl(candidate) {
  let url = candidate;
  for (;;) {
    const trimmed = url.replace(trailingPunctuation, '');
    const last = trimmed.at(-1);
    const opener = closers[last];
    // Drop a closing bracket only when the URL does not contain its opener,
    // so Wikipedia-style "/Foo_(bar)" survives but "(https://x.org)" does not.
    if (opener && trimmed.split(opener).length <= trimmed.split(last).length - 1) {
      url = trimmed.slice(0, -1);
      continue;
    }
    if (trimmed === url) return url;
    url = trimmed;
  }
}

function normalize(candidate) {
  const doi = candidate.match(/^(?:doi:\s*)?(10\.\d{4,9}\/.+)$/i);
  const raw = doi
    ? `https://doi.org/${doi[1]}`
    : /^www\./i.test(candidate)
      ? `https://${candidate}`
      : candidate;
  try {
    const url = new URL(raw);
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || !url.hostname.includes('.'))
      return null;
    return url.href;
  } catch {
    return null;
  }
}

// Offsets stay in the original text so PDF text runs can become links without
// replacing their glyphs or approximating their on-screen positions.
export function detectDoiRanges(text) {
  const pattern =
    /\b(?:https?:\/\/(?:dx\.)?doi\.\s*org\/\s*|doi:\s*)?10\.\d{4,9}\/[^\s<>"，。；：、（）【】《》]+/gi;
  const ranges = [];
  // Join only breaks with clear continuation punctuation, as detectLinks does.
  const joined = [];
  const offsets = [];
  for (let i = 0; i < text.length; i++) {
    if (
      text[i] === '\n' &&
      /[/\-_.]/.test(joined.at(-1) || '') &&
      !/^(?:https?:\/\/|doi:|10\.\d{4,9}\/)/i.test(text.slice(i + 1).trimStart()) &&
      (joined.at(-1) !== '.' || /^[^\s]*[./]/.test(text.slice(i + 1).trimStart()))
    ) {
      while (/\s/.test(text[i + 1] || '') && i + 1 < text.length) i++;
      continue;
    }
    joined.push(text[i]);
    offsets.push(i);
  }
  // Newlines that were not joined are boundaries, never part of a DOI.
  for (const match of joined.join('').matchAll(pattern)) {
    const candidate = trimUrl(match[0]);
    const url = normalize(candidate.slice(candidate.search(/10\.\d{4,9}\//)).replace(/\s+/g, ''));
    if (url)
      ranges.push({
        start: offsets[match.index],
        end: offsets[match.index + candidate.length - 1] + 1,
        url,
      });
  }
  return ranges;
}

export function detectLinks(text) {
  if (typeof text !== 'string' || !text.trim()) return [];
  const links = [];
  for (const [match] of rejoinWrappedUrls(text).matchAll(urlPattern)) {
    const url = normalize(trimUrl(match));
    if (url && !links.includes(url)) links.push(url);
    if (links.length === maxLinks) break;
  }
  return links;
}

export function detectEmails(text) {
  if (typeof text !== 'string' || !text.trim()) return [];
  const emails = [];
  for (const [match] of text.matchAll(emailPattern)) {
    // Domains are case-insensitive; keep the local part as written.
    const at = match.lastIndexOf('@');
    const email = match.slice(0, at) + match.slice(at).toLowerCase();
    if (!emails.includes(email)) emails.push(email);
    if (emails.length === maxLinks) break;
  }
  return emails;
}

export function linkLabel(url, maxLength = 48) {
  const { host, pathname, search, hash } = new URL(url);
  const text = host.replace(/^www\./, '') + (pathname === '/' ? '' : pathname) + search + hash;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
