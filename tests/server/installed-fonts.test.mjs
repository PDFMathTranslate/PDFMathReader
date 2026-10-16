import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import express from 'express';
import {
  classifyFace,
  coversCjk,
  createInstalledFonts,
  fontDirectories,
  readFontFaces,
  scanInstalledFonts,
} from '../../server/fonts/installed-fonts.mjs';
import { registerFontRoutes } from '../../server/http/font-routes.mjs';

// A name table with Windows English UTF-16 records.
function nameTable(names) {
  const entries = Object.entries(names).map(([id, text]) => [
    Number(id),
    Buffer.from(text, 'utf16le').swap16(),
  ]);
  const header = Buffer.alloc(6 + entries.length * 12);
  header.writeUInt16BE(entries.length, 2);
  header.writeUInt16BE(header.length, 4);
  let offset = 0;
  entries.forEach(([id, bytes], i) => {
    const at = 6 + i * 12;
    header.writeUInt16BE(3, at);
    header.writeUInt16BE(1, at + 2);
    header.writeUInt16BE(0x409, at + 4);
    header.writeUInt16BE(id, at + 6);
    header.writeUInt16BE(bytes.length, at + 8);
    header.writeUInt16BE(offset, at + 10);
    offset += bytes.length;
  });
  return Buffer.concat([header, ...entries.map(([, bytes]) => bytes)]);
}

function os2Table({ familyClass = 0, panose = [], unicodeRange2 = 0, codePages = 0 }) {
  const table = Buffer.alloc(86);
  table.writeUInt16BE(1, 0);
  table.writeInt16BE(familyClass, 30);
  Buffer.from(panose).copy(table, 32);
  table.writeUInt32BE(unicodeRange2 >>> 0, 46);
  table.writeUInt32BE(codePages >>> 0, 78);
  return table;
}

function postTable(fixedPitch) {
  const table = Buffer.alloc(32);
  table.writeUInt32BE(fixedPitch ? 1 : 0, 12);
  return table;
}

// One sfnt face whose tables start at `base` within the file.
function face(
  { family, style = 'Regular', familyClass, panose, fixedPitch = false, unicodeRange2, codePages },
  base = 0,
) {
  const tables = [
    ['OS/2', os2Table({ familyClass, panose, unicodeRange2, codePages })],
    ['name', nameTable({ 1: family, 2: style })],
    ['post', postTable(fixedPitch)],
  ];
  const directory = Buffer.alloc(12 + tables.length * 16);
  directory.writeUInt32BE(0x00010000, 0);
  directory.writeUInt16BE(tables.length, 4);
  let offset = base + directory.length;
  tables.forEach(([tag, data], i) => {
    const at = 12 + i * 16;
    directory.write(tag, at, 'latin1');
    directory.writeUInt32BE(offset, at + 8);
    directory.writeUInt32BE(data.length, at + 12);
    offset += data.length;
  });
  return Buffer.concat([directory, ...tables.map(([, data]) => data)]);
}

function collection(faces) {
  const header = Buffer.alloc(12 + faces.length * 4);
  header.write('ttcf', 0, 'latin1');
  header.writeUInt32BE(0x00010000, 4);
  header.writeUInt32BE(faces.length, 8);
  const parts = [];
  let offset = header.length;
  faces.forEach((spec, i) => {
    header.writeUInt32BE(offset, 12 + i * 4);
    const data = face(spec, offset);
    parts.push(data);
    offset += data.length;
  });
  return Buffer.concat([header, ...parts]);
}

async function withFonts(files, run) {
  const directory = await mkdtemp(join(tmpdir(), 'pmr-fonts-'));
  try {
    await mkdir(join(directory, 'nested'));
    for (const [name, data] of Object.entries(files)) await writeFile(join(directory, name), data);
    return await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('font faces are classified by name, OS/2 class, PANOSE and pitch', () => {
  assert.equal(classifyFace({ family: 'Avenir Next' }), 'sans');
  assert.equal(classifyFace({ family: 'Unnamed', familyClass: 1 << 8 }), 'serif');
  assert.equal(classifyFace({ family: 'Unnamed', familyClass: 8 << 8 }), 'sans');
  assert.equal(classifyFace({ family: 'Unnamed', panose: [2, 2, 5, 3] }), 'serif');
  assert.equal(classifyFace({ family: 'Unnamed', panose: [2, 11, 5, 3] }), 'sans');
  assert.equal(classifyFace({ family: 'Unnamed', panose: [2, 11, 5, 9] }), 'mono');
  assert.equal(classifyFace({ family: 'Unnamed', fixedPitch: true }), 'mono');
  assert.equal(classifyFace({ family: 'JetBrains Mono', familyClass: 8 << 8 }), 'mono');
  assert.equal(classifyFace({ family: 'Noto Sans', familyClass: 1 << 8 }), 'sans');
  assert.equal(classifyFace({ family: 'Songti SC' }), 'serif');
  assert.equal(classifyFace({ family: 'Hiragino Mincho ProN' }), 'serif');
  assert.equal(classifyFace({ family: 'Times New Roman' }), 'serif');
  for (const family of ['Apple Color Emoji', 'Symbol', 'Wingdings', 'STIXSizeOneSym'])
    assert.equal(classifyFace({ family }), '', family);
  assert.equal(classifyFace({ family: 'Unnamed', panose: [5] }), '');
  assert.equal(classifyFace({ family: 'Unnamed', familyClass: 12 << 8 }), '');
});

test('CJK coverage is read from OS/2 Unicode ranges and code pages', () => {
  assert.equal(coversCjk(os2Table({})), false);
  assert.equal(coversCjk(os2Table({ unicodeRange2: 1 << 27 })), true, 'CJK ideographs');
  assert.equal(coversCjk(os2Table({ unicodeRange2: 1 << 24 })), true, 'Hangul syllables');
  assert.equal(coversCjk(os2Table({ codePages: 1 << 18 })), true, 'Simplified Chinese');
  assert.equal(coversCjk(os2Table({ unicodeRange2: 1 << 16 })), false, 'CJK punctuation alone');
  assert.equal(coversCjk(null), false);
});

test('faces are read from single fonts and collections', async () => {
  await withFonts(
    {
      'serif.ttf': face({ family: 'Test Serif Face', panose: [2, 2, 5, 3] }),
      'pair.ttc': collection([
        { family: 'Pair Gothic', style: 'Bold' },
        { family: 'Pair Code', fixedPitch: true },
      ]),
      'broken.otf': Buffer.from('OTTO'),
    },
    async (directory) => {
      assert.deepEqual(await readFontFaces(join(directory, 'serif.ttf')), [
        { family: 'Test Serif Face', regular: true, style: 'serif', cjk: false },
      ]);
      assert.deepEqual(await readFontFaces(join(directory, 'pair.ttc')), [
        { family: 'Pair Gothic', regular: false, style: 'sans', cjk: false },
        { family: 'Pair Code', regular: true, style: 'mono', cjk: false },
      ]);
      assert.deepEqual(await readFontFaces(join(directory, 'broken.otf')), []);
    },
  );
});

test('installed families are grouped by style and sorted by name', async () => {
  await withFonts(
    {
      'b.ttf': face({ family: 'beta Sans' }),
      'a.ttf': face({ family: 'Alpha Sans' }),
      'a10.ttf': face({ family: 'Alpha Sans 10' }),
      'a2.ttf': face({ family: 'Alpha Sans 2' }),
      'serif.otf': face({ family: 'Gamma', familyClass: 1 << 8 }),
      'song.otf': face({ family: 'Song Test', unicodeRange2: 1 << 27 }),
      'mono.ttf': face({ family: 'Delta', fixedPitch: true }),
      'hidden.ttf': face({ family: '.SF NS' }),
      'emoji.ttf': face({ family: 'Color Emoji' }),
      'notes.txt': 'not a font',
      'nested/c.ttf': face({ family: 'Charlie Sans' }),
    },
    async (directory) => {
      assert.deepEqual(await scanInstalledFonts([directory, join(directory, 'missing')]), {
        sans: ['Alpha Sans', 'Alpha Sans 2', 'Alpha Sans 10', 'beta Sans', 'Charlie Sans'],
        serif: ['Gamma', 'Song Test'],
        mono: ['Delta'],
        cjk: ['Song Test'],
      });
    },
  );
});

test('font directories follow the platform', () => {
  assert.ok(fontDirectories('darwin', {}, '/Users/me').includes('/Users/me/Library/Fonts'));
  assert.ok(
    fontDirectories('win32', { WINDIR: 'D:\\Windows' }, 'C:\\Users\\me')[0].startsWith('D:'),
  );
  assert.ok(fontDirectories('linux', {}, '/home/me').includes('/usr/share/fonts'));
});

test('the font list is cached briefly and a failed scan is retried', async () => {
  let scans = 0,
    clock = 0,
    fail = true;
  const fonts = createInstalledFonts({
    now: () => clock,
    scan: async () => {
      scans++;
      if (fail) throw Error('unreadable');
      return { sans: ['A'], serif: [], mono: [] };
    },
  });
  await assert.rejects(fonts.list());
  fail = false;
  assert.deepEqual((await fonts.list()).sans, ['A']);
  await fonts.list();
  assert.equal(scans, 2);
  clock = 61_000;
  await fonts.list();
  assert.equal(scans, 3);
});

test('GET /api/fonts returns installed families or an error', async () => {
  let fail = false;
  const app = express();
  registerFontRoutes(app, {
    installedFonts: {
      list: async () => {
        if (fail) throw Error('unreadable');
        return { sans: ['Avenir Next'], serif: ['Georgia'], mono: ['Menlo'] };
      },
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/fonts`;
  try {
    assert.deepEqual(await (await fetch(url)).json(), {
      sans: ['Avenir Next'],
      serif: ['Georgia'],
      mono: ['Menlo'],
    });
    fail = true;
    const response = await fetch(url);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'unreadable' });
  } finally {
    server.close();
  }
});
