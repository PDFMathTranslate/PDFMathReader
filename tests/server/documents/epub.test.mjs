import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, deflateRawSync } from 'node:zlib';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readEPUBPackage, readZip } from '../../../electron/main/services/epub-package.mjs';
import {
  configureEPUBSupport,
  documentSource,
  pdfLaunchPaths,
  readSystemPDF,
  validateSystemPDF,
} from '../../../electron/main/services/documents.mjs';

function zip(files) {
  const locals = [],
    central = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const raw = Buffer.from(content),
      stored = name === 'mimetype',
      data = stored ? raw : deflateRawSync(raw),
      encodedName = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(stored ? 0 : 8, 8);
    local.writeUInt32LE(crc32(raw), 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(encodedName.length, 26);
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(stored ? 0 : 8, 10);
    header.writeUInt32LE(crc32(raw), 16);
    header.writeUInt32LE(data.length, 20);
    header.writeUInt32LE(raw.length, 24);
    header.writeUInt16LE(encodedName.length, 28);
    header.writeUInt32LE(offset, 42);
    locals.push(local, encodedName, data);
    central.push(header, encodedName);
    offset += local.length + encodedName.length + data.length;
  }
  const directory = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const container = `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`;
const opf = (extra = '') => `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>A &amp; B</dc:title><dc:language>en</dc:language></metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item media-type="application/xhtml+xml" href="text/chapter%201.xhtml" id="c1"/>
    <item id="c2" href='text/c2.xhtml' media-type="application/xhtml+xml"/>
    <item id="notes" href="text/notes.xhtml" media-type="application/xhtml+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
    ${extra}
  </manifest>
  <spine toc="ncx"><itemref idref="c1"/><itemref idref="notes" linear="no"/><itemref idref="c2"/></spine>
</package>`;
const nav = `<html xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol>
<li><a href="text/chapter%201.xhtml">One</a><ol><li><a href="text/chapter%201.xhtml#s1">One <em>a</em></a></li></ol></li>
<li><a href="text/c2.xhtml">Two</a></li></ol></nav></body></html>`;
const book = (files = {}) =>
  zip({
    mimetype: 'application/epub+zip',
    'META-INF/container.xml': container,
    'OEBPS/content.opf': opf(),
    'OEBPS/nav.xhtml': nav,
    'OEBPS/text/chapter 1.xhtml': '<html><body><p>One</p></body></html>',
    'OEBPS/text/c2.xhtml': '<html><body><p>Two</p></body></html>',
    'OEBPS/text/notes.xhtml': '<html><body><p>Notes</p></body></html>',
    'OEBPS/style.css': 'p{}',
    ...files,
  });

test('EPUB package exposes the linear spine, metadata and nested navigation', () => {
  const parsed = readEPUBPackage(book());
  assert.equal(parsed.title, 'A & B');
  assert.equal(parsed.language, 'en');
  assert.deepEqual(
    parsed.spine.map((item) => item.path),
    ['OEBPS/text/chapter 1.xhtml', 'OEBPS/text/c2.xhtml'],
  );
  assert.deepEqual(
    parsed.toc.map(({ title, path, fragment, depth }) => [title, path, fragment, depth]),
    [
      ['One', 'OEBPS/text/chapter 1.xhtml', '', 0],
      ['One a', 'OEBPS/text/chapter 1.xhtml', 's1', 1],
      ['Two', 'OEBPS/text/c2.xhtml', '', 0],
    ],
  );
  assert.equal(parsed.zip.read('OEBPS/style.css').toString(), 'p{}');
});

test('EPUB 2 navigation falls back to the NCX table of contents', () => {
  const ncx = `<ncx><navMap><navPoint id="a"><navLabel><text>First</text></navLabel><content src="text/chapter%201.xhtml"/>
<navPoint id="b"><navLabel><text>Inner</text></navLabel><content src="text/c2.xhtml#x"/></navPoint></navPoint></navMap></ncx>`;
  const parsed = readEPUBPackage(
    book({
      'OEBPS/content.opf': opf(
        '<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>',
      ).replace('properties="nav"', ''),
      'OEBPS/toc.ncx': ncx,
    }),
  );
  assert.deepEqual(
    parsed.toc.map(({ title, path, depth }) => [title, path, depth]),
    [
      ['First', 'OEBPS/text/chapter 1.xhtml', 0],
      ['Inner', 'OEBPS/text/c2.xhtml', 1],
    ],
  );
});

test('EPUB archives reject traversal names and DRM-encrypted chapters', () => {
  const archive = readZip(zip({ '../escape.txt': 'x', '/abs/../ok.txt': 'y' }));
  assert.deepEqual(archive.names, ['ok.txt']);
  const encryption = `<encryption><EncryptedData><CipherData><CipherReference URI="OEBPS/text/c2.xhtml"/></CipherData></EncryptedData></encryption>`;
  assert.throws(
    () => readEPUBPackage(book({ 'META-INF/encryption.xml': encryption })),
    /DRM-protected/,
  );
  assert.throws(() => readZip(Buffer.from('not a zip')), /not a readable ZIP/);
});

test('EPUB documents are gated by the preference and never treated as writable sources', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'epub-documents-test-'));
  t.after(async () => {
    configureEPUBSupport(null);
    await rm(root, { recursive: true, force: true });
  });
  const path = join(root, 'Book.epub');
  await writeFile(path, book());
  let enabled = true;
  const converted = new Uint8Array(Buffer.from('%PDF-1.7 converted'));
  configureEPUBSupport({ enabled: () => enabled, convert: async () => converted });
  assert.equal(await validateSystemPDF(path), true);
  assert.deepEqual(await readSystemPDF(path), { name: 'Book.epub', bytes: converted });
  assert.equal(documentSource(path).reliable, false);
  assert.equal(documentSource(join(root, 'Paper.pdf')).reliable, true);
  assert.deepEqual(pdfLaunchPaths(['Book.epub', 'Paper.PDF', 'notes.txt'], root), [
    path,
    join(root, 'Paper.PDF'),
  ]);
  enabled = false;
  await assert.rejects(validateSystemPDF(path), /Choose a PDF document/);
  enabled = true;
  await writeFile(path, 'plain text');
  await assert.rejects(validateSystemPDF(path), /not a readable EPUB/);
});
