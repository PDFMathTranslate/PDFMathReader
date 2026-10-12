import { inflateRawSync } from 'node:zlib';
import { posix } from 'node:path';

const MAX_ENTRIES = 20000;
const MAX_UNCOMPRESSED_BYTES = 1024 * 1024 * 1024;
const RENDERABLE_TYPES = new Set(['application/xhtml+xml', 'text/html', 'image/svg+xml']);

const decodeEntities = (value) =>
  value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, entity) => {
    const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[entity.toLowerCase()];
    if (named) return named;
    const code =
      entity[1] === 'x' || entity[1] === 'X'
        ? parseInt(entity.slice(2), 16)
        : parseInt(entity.slice(1), 10);
    return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : match;
  });
const textContent = (value) =>
  decodeEntities(value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
function attributes(tag) {
  const result = {};
  for (const [, name, , double, single] of tag.matchAll(/([\w:.-]+)\s*=\s*("([^"]*)"|'([^']*)')/g))
    result[name.toLowerCase()] = decodeEntities(double ?? single);
  return result;
}
const tags = (xml, name) => [...xml.matchAll(new RegExp(`<(?:[\\w-]+:)?${name}\\b[^>]*>`, 'gi'))];

// Archive names are untrusted. Only normalized relative paths can be read or extracted.
export function safeArchivePath(name) {
  if (typeof name !== 'string' || !name || name.includes('\0') || name.includes('\\')) return null;
  const normalized = posix.normalize(name.replace(/^\/+/, ''));
  if (normalized === '.' || normalized.startsWith('../') || normalized === '..') return null;
  return normalized;
}

function resolveHref(base, href) {
  if (typeof href !== 'string' || /^[a-z][a-z\d+.-]*:/i.test(href)) return null;
  const [path, fragment = ''] = href.split('#');
  let decoded;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    decoded = path;
  }
  const resolved = safeArchivePath(decoded ? posix.join(posix.dirname(base), decoded) : base);
  return resolved && { path: resolved, fragment };
}

export function readZip(input) {
  const buffer = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  let end = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 0xffff - 22); i--)
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw Error('This EPUB is not a readable ZIP archive.');
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16);
  if (count === 0xffff || offset === 0xffffffff) throw Error('ZIP64 EPUB files are not supported.');
  if (count > MAX_ENTRIES) throw Error('This EPUB contains too many files.');
  const entries = new Map();
  let total = 0;
  for (let index = 0; index < count; index++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50)
      throw Error('This EPUB archive is damaged.');
    const flags = buffer.readUInt16LE(offset + 8),
      method = buffer.readUInt16LE(offset + 10),
      compressedSize = buffer.readUInt32LE(offset + 20),
      size = buffer.readUInt32LE(offset + 24),
      nameLength = buffer.readUInt16LE(offset + 28),
      extraLength = buffer.readUInt16LE(offset + 30),
      commentLength = buffer.readUInt16LE(offset + 32),
      localOffset = buffer.readUInt32LE(offset + 42);
    const rawName = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    offset += 46 + nameLength + extraLength + commentLength;
    const name = safeArchivePath(rawName);
    if (!name || rawName.endsWith('/')) continue;
    total += size;
    if (total > MAX_UNCOMPRESSED_BYTES) throw Error('This EPUB expands beyond 1 GB.');
    entries.set(name, { flags, method, compressedSize, size, localOffset });
  }
  function read(name) {
    const entry = entries.get(name);
    if (!entry) throw Error(`Missing EPUB file: ${name}`);
    if (entry.flags & 1) throw Error('Encrypted EPUB files are not supported.');
    const local = entry.localOffset;
    if (local + 30 > buffer.length || buffer.readUInt32LE(local) !== 0x04034b50)
      throw Error('This EPUB archive is damaged.');
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const data = buffer.subarray(start, start + entry.compressedSize);
    if (data.length !== entry.compressedSize) throw Error('This EPUB archive is truncated.');
    let bytes;
    if (entry.method === 0) bytes = data;
    else if (entry.method === 8)
      bytes = inflateRawSync(data, { maxOutputLength: Math.max(1, entry.size) });
    else throw Error('This EPUB uses an unsupported compression method.');
    if (bytes.length !== entry.size) throw Error('This EPUB archive is damaged.');
    return bytes;
  }
  return { names: [...entries.keys()], has: (name) => entries.has(name), read };
}

function navigationEntries(xml, base) {
  const nav =
    xml.match(/<nav\b[^>]*epub:type\s*=\s*["'][^"']*\btoc\b[^"']*["'][^>]*>([\s\S]*?)<\/nav>/i) ||
    xml.match(/<nav\b[^>]*>([\s\S]*?)<\/nav>/i);
  if (!nav) return [];
  const body = nav[1],
    entries = [];
  for (const match of body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const before = body.slice(0, match.index);
    const depth =
      (before.match(/<ol\b/gi)?.length || 0) - (before.match(/<\/ol>/gi)?.length || 0) - 1;
    const target = resolveHref(base, attributes(match[1]).href);
    const title = textContent(match[2]);
    if (target && title) entries.push({ title, ...target, depth: Math.max(0, depth) });
  }
  return entries;
}

function ncxEntries(xml, base) {
  const entries = [],
    stack = [];
  for (const match of xml.matchAll(/<(\/?)(?:[\w-]+:)?(navPoint|text|content)\b([^>]*?)\/?>/gi)) {
    const [, closing, name, attrs] = match;
    const kind = name.toLowerCase();
    if (kind === 'navpoint') {
      if (closing) stack.pop();
      else {
        const entry = { title: '', depth: stack.length };
        stack.push(entry);
        entries.push(entry);
      }
    } else if (kind === 'text' && !closing && stack.length && !stack.at(-1).title) {
      const start = match.index + match[0].length;
      const close = xml.slice(start).search(/<\/(?:[\w-]+:)?text>/i);
      stack.at(-1).title = textContent(close < 0 ? '' : xml.slice(start, start + close));
    } else if (kind === 'content' && !closing && stack.length && !stack.at(-1).path)
      Object.assign(stack.at(-1), resolveHref(base, attributes(attrs).src) || {});
  }
  return entries.filter((entry) => entry.title && entry.path);
}

export function readEPUBPackage(bytes) {
  const zip = readZip(bytes);
  if (!zip.has('META-INF/container.xml')) throw Error('This EPUB has no container manifest.');
  const container = zip.read('META-INF/container.xml').toString('utf8');
  const rootfile = tags(container, 'rootfile')
    .map(([tag]) => attributes(tag))
    .find(
      (attrs) => !attrs['media-type'] || attrs['media-type'] === 'application/oebps-package+xml',
    );
  const packagePath = safeArchivePath(rootfile?.['full-path']);
  if (!packagePath || !zip.has(packagePath)) throw Error('This EPUB has no package document.');
  const opf = zip.read(packagePath).toString('utf8');
  const manifest = new Map();
  for (const [tag] of tags(opf, 'item')) {
    const attrs = attributes(tag);
    const target = resolveHref(packagePath, attrs.href);
    if (attrs.id && target)
      manifest.set(attrs.id, {
        path: target.path,
        mediaType: (attrs['media-type'] || '').toLowerCase(),
        properties: (attrs.properties || '').split(/\s+/),
      });
  }
  const spine = tags(opf, 'itemref')
    .map(([tag]) => attributes(tag))
    .filter((attrs) => attrs.linear !== 'no')
    .map((attrs) => manifest.get(attrs.idref))
    .filter((item) => item && RENDERABLE_TYPES.has(item.mediaType) && zip.has(item.path));
  if (!spine.length) throw Error('This EPUB has no readable chapters.');
  // Font obfuscation is harmless, but encrypted chapters indicate DRM.
  if (zip.has('META-INF/encryption.xml')) {
    const encryption = zip.read('META-INF/encryption.xml').toString('utf8');
    const encrypted = new Set(
      tags(encryption, 'CipherReference')
        .map(([tag]) => safeArchivePath(decodeURIComponent(attributes(tag).uri || '')))
        .filter(Boolean),
    );
    if (spine.some((item) => encrypted.has(item.path)))
      throw Error('DRM-protected EPUB files are not supported.');
  }
  let toc = [];
  const nav = [...manifest.values()].find((item) => item.properties.includes('nav'));
  if (nav && zip.has(nav.path))
    toc = navigationEntries(zip.read(nav.path).toString('utf8'), nav.path);
  if (!toc.length) {
    const spineTag = opf.match(/<(?:[\w-]+:)?spine\b[^>]*>/i)?.[0] || '';
    const ncx =
      manifest.get(attributes(spineTag).toc) ||
      [...manifest.values()].find((item) => item.mediaType === 'application/x-dtbncx+xml');
    if (ncx && zip.has(ncx.path)) toc = ncxEntries(zip.read(ncx.path).toString('utf8'), ncx.path);
  }
  const metadata = (name) => {
    const match = opf.match(new RegExp(`<dc:${name}\\b[^>]*>([\\s\\S]*?)</dc:${name}>`, 'i'));
    return match ? textContent(match[1]) : '';
  };
  return {
    zip,
    title: metadata('title'),
    language: metadata('language'),
    spine: spine.map(({ path, mediaType }) => ({ path, mediaType })),
    toc,
  };
}
