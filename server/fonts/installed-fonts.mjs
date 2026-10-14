import { open, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { extname, join } from 'node:path';

// Installed font families, read straight from the font files so the settings can
// offer them by style. Only a few table bytes are read per face: system font
// collections run to hundreds of megabytes.
const FONT_FILE = new Set(['.ttf', '.otf', '.ttc', '.otc']);
const MAX_FILES = 20000;
const CONCURRENCY = 16;
const CACHE_MS = 60_000;
// PingFang and fonts downloaded on demand live among the macOS system assets.
const MAC_ASSETS = '/System/Library/AssetsV2';

export function fontDirectories(platform = process.platform, env = process.env, home = homedir()) {
  if (platform === 'darwin')
    return ['/System/Library/Fonts', '/Library/Fonts', join(home, 'Library/Fonts'), MAC_ASSETS];
  if (platform === 'win32')
    return [
      join(env.WINDIR || 'C:\\Windows', 'Fonts'),
      ...(env.LOCALAPPDATA ? [join(env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts')] : []),
    ];
  return [
    '/usr/share/fonts',
    '/usr/local/share/fonts',
    join(home, '.local/share/fonts'),
    join(home, '.fonts'),
  ];
}

async function fontFiles(directories) {
  const files = [],
    pending = [...directories];
  while (pending.length && files.length < MAX_FILES) {
    const directory = pending.shift();
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (directory !== MAC_ASSETS || entry.name.startsWith('com_apple_MobileAsset_Font'))
          pending.push(path);
      } else if (FONT_FILE.has(extname(entry.name).toLowerCase())) files.push(path);
    }
  }
  return files.slice(0, MAX_FILES);
}

const MAC_ROMAN_ENGLISH = (record) => record.platform === 1 && record.language === 0;
const WINDOWS_ENGLISH = (record) => record.platform === 3 && record.language === 0x409;

function decodeName(bytes, platform) {
  if (platform === 1) return bytes.toString('latin1');
  let text = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) text += String.fromCharCode(bytes.readUInt16BE(i));
  return text;
}

// The typographic family (16) names what CSS matches; legacy families (1) split
// weights into separate names. English names work on every platform.
function nameOf(table, ids) {
  if (!table || table.length < 6) return '';
  const count = table.readUInt16BE(2),
    storage = table.readUInt16BE(4),
    records = [];
  for (let i = 0; i < count && 6 + i * 12 + 12 <= table.length; i++) {
    const at = 6 + i * 12;
    records.push({
      platform: table.readUInt16BE(at),
      language: table.readUInt16BE(at + 4),
      id: table.readUInt16BE(at + 6),
      length: table.readUInt16BE(at + 8),
      offset: table.readUInt16BE(at + 10),
    });
  }
  for (const id of ids)
    for (const prefer of [
      WINDOWS_ENGLISH,
      (r) => r.platform === 3,
      MAC_ROMAN_ENGLISH,
      (r) => r.platform === 0,
    ]) {
      const record = records.find((r) => r.id === id && prefer(r));
      const start = record && storage + record.offset;
      if (!record || start + record.length > table.length) continue;
      const name = decodeName(table.subarray(start, start + record.length), record.platform)
        .replace(/\p{Cc}/gu, '')
        .trim();
      if (name) return name;
    }
  return '';
}

const SERIF_NAME =
  /times|roman|garamond|georgia|baskerville|bodoni|didot|palatino|batang|caslon|charter|cochin|hoefler|century|athelas|stix/i;
// Words a family uses to say what it is; they outrank metadata often left unset.
const SANS_WORD = /sans|gothic|heiti|\bhei\b/i;
const SERIF_WORD = /serif|mincho|myeongjo|myungjo|song|sung|\bming/i;
const MONO_NAME = /mono|courier|consol|menlo|monaco|\bcode\b/i;
// Faces with no text to read: emoji, symbols, ornaments, math and bitmaps.
const PICTORIAL_NAME =
  /emoji|symbol|ornament|dingbat|wingding|webding|bitmap|math|^stix(integrals|size|variants|nonunicode)/i;

/** 'sans', 'serif', 'mono', or '' for symbol and pictorial faces. */
export function classifyFace({ family = '', familyClass = 0, panose = [], fixedPitch = false }) {
  // PANOSE: family kind, serif style, weight, proportion.
  const [kind, serifStyle, , proportion] = panose,
    group = familyClass >> 8;
  if (group === 12 || kind === 5 || PICTORIAL_NAME.test(family)) return '';
  if (fixedPitch || (kind === 2 && proportion === 9) || MONO_NAME.test(family)) return 'mono';
  if (SANS_WORD.test(family)) return 'sans';
  if (SERIF_WORD.test(family)) return 'serif';
  if ([1, 2, 3, 4, 5, 7].includes(group)) return 'serif';
  if (group === 8) return 'sans';
  if (kind === 2 && serifStyle >= 2 && serifStyle <= 10) return 'serif';
  if (kind === 2 && serifStyle >= 11 && serifStyle <= 15) return 'sans';
  return SERIF_NAME.test(family) ? 'serif' : 'sans';
}

/** Faces in one sfnt file or collection: [{ family, regular, style }]. */
export async function readFontFaces(path) {
  const file = await open(path, 'r');
  try {
    const read = async (position, length) => {
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await file.read(buffer, 0, length, position);
      return buffer.subarray(0, bytesRead);
    };
    const head = await read(0, 12);
    if (head.length < 12) return [];
    let offsets = [0];
    if (head.toString('latin1', 0, 4) === 'ttcf') {
      const count = Math.min(head.readUInt32BE(8), 256),
        table = await read(12, count * 4);
      offsets = Array.from({ length: table.length / 4 }, (_, i) => table.readUInt32BE(i * 4));
    }
    const faces = [];
    for (const offset of offsets) {
      const header = await read(offset, 12);
      if (header.length < 12) continue;
      const tag = header.toString('latin1', 0, 4);
      if (!['\0\x01\0\0', 'OTTO', 'true'].includes(tag)) continue;
      const count = header.readUInt16BE(4),
        directory = await read(offset + 12, count * 16),
        tables = {};
      for (let at = 0; at + 16 <= directory.length; at += 16)
        tables[directory.toString('latin1', at, at + 4)] = {
          offset: directory.readUInt32BE(at + 8),
          length: directory.readUInt32BE(at + 12),
        };
      const table = (name, max) =>
        tables[name] ? read(tables[name].offset, Math.min(tables[name].length, max)) : null;
      const [names, os2, post] = await Promise.all([
        table('name', 1 << 20),
        table('OS/2', 64),
        table('post', 16),
      ]);
      const family = nameOf(names, [16, 1]);
      if (!family) continue;
      const style = nameOf(names, [17, 2]);
      faces.push({
        family,
        regular: /^(regular|roman|book|normal|plain|w3|r)$/i.test(style),
        style: classifyFace({
          family,
          familyClass: os2?.length >= 32 ? os2.readInt16BE(30) : 0,
          panose: os2?.length >= 42 ? [...os2.subarray(32, 42)] : [],
          fixedPitch: post?.length >= 16 ? post.readUInt32BE(12) !== 0 : false,
        }),
      });
    }
    return faces;
  } finally {
    await file.close();
  }
}

// Hidden system faces and aliases CSS cannot name.
const HIDDEN = (family) => family.startsWith('.') || /^(lastresort|system font)/i.test(family);
const byName = (a, b) => a.localeCompare(b, 'en', { sensitivity: 'base', numeric: true });

/** Installed families by style, each list sorted by name. */
export async function scanInstalledFonts(directories = fontDirectories()) {
  const files = await fontFiles(directories),
    families = new Map();
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const path = files[next++];
      let faces = [];
      try {
        faces = await readFontFaces(path);
      } catch {
        continue;
      }
      for (const face of faces) {
        if (HIDDEN(face.family)) continue;
        const known = families.get(face.family);
        // A family's regular face speaks for it; otherwise its first face does.
        if (!known || (face.regular && !known.regular)) families.set(face.family, face);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  const fonts = { sans: [], serif: [], mono: [] };
  for (const { family, style } of families.values()) fonts[style]?.push(family);
  for (const list of Object.values(fonts)) list.sort(byName);
  return fonts;
}

export function createInstalledFonts({ scan = scanInstalledFonts, now = Date.now } = {}) {
  let cached = null;
  return {
    // Fonts installed while the app runs show up once the short cache lapses.
    list() {
      if (!cached || now() - cached.at > CACHE_MS) {
        const promise = scan();
        cached = { at: now(), promise };
        promise.catch(() => {
          if (cached?.promise === promise) cached = null;
        });
      }
      return cached.promise;
    },
  };
}
