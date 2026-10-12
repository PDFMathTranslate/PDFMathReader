import { BrowserWindow, session as electronSession } from 'electron';
import { createHash, randomUUID } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PDFDocument, PDFHexString, PDFName, PDFNumber } from 'pdf-lib';
import { readEPUBPackage } from './epub-package.mjs';

// Bump when layout changes so cached conversions are rebuilt.
const CONVERTER_VERSION = 1;
const MAX_PDF_BYTES = 200 * 1024 * 1024;
const MAX_CACHED_BOOKS = 24;
const CHAPTER_TIMEOUT_MS = 30000;
const PARTITION = 'epub-render';
const PRINT_OPTIONS = {
  pageSize: 'A5',
  printBackground: true,
  preferCSSPageSize: false,
  margins: { top: 0.6, bottom: 0.6, left: 0.55, right: 0.55 },
};
const BOOK_CSS = `
img, svg, video, canvas, table { max-width: 100% !important; }
img, svg { height: auto; break-inside: avoid; }
h1, h2, h3, h4, h5, h6 { break-after: avoid; }
pre { white-space: pre-wrap; }
`;

const withTimeout = (promise, ms, message) =>
  new Promise((resolvePromise, reject) => {
    const timer = setTimeout(() => reject(Error(message)), ms);
    promise.then(resolvePromise, reject).finally(() => clearTimeout(timer));
  });

async function extract(zip, directory) {
  for (const name of zip.names) {
    const target = resolve(directory, ...name.split('/'));
    if (!target.startsWith(directory + sep)) continue;
    await mkdir(resolve(target, '..'), { recursive: true });
    await writeFile(target, zip.read(name));
  }
}

function addOutline(document, entries) {
  if (!entries.length) return;
  const root = { children: [] },
    stack = [{ node: root, depth: -1 }];
  for (const entry of entries) {
    while (stack.length > 1 && stack.at(-1).depth >= entry.depth) stack.pop();
    const node = { ...entry, children: [] };
    stack.at(-1).node.children.push(node);
    stack.push({ node, depth: entry.depth });
  }
  const { context } = document,
    pages = document.getPages();
  const build = (nodes, parent) => {
    const refs = nodes.map(() => context.nextRef());
    nodes.forEach((node, index) => {
      const item = context.obj({
        Title: PDFHexString.fromText(node.title),
        Parent: parent,
        Dest: [pages[node.page].ref, 'XYZ', null, null, null],
      });
      if (index > 0) item.set(PDFName.of('Prev'), refs[index - 1]);
      if (index < nodes.length - 1) item.set(PDFName.of('Next'), refs[index + 1]);
      if (node.children.length) {
        const [first, last] = build(node.children, refs[index]);
        item.set(PDFName.of('First'), first);
        item.set(PDFName.of('Last'), last);
        // Nested chapters start collapsed.
        item.set(PDFName.of('Count'), PDFNumber.of(-node.children.length));
      }
      context.assign(refs[index], item);
    });
    return [refs[0], refs.at(-1)];
  };
  const outlines = context.nextRef();
  const [first, last] = build(root.children, outlines);
  context.assign(
    outlines,
    context.obj({ Type: 'Outlines', First: first, Last: last, Count: root.children.length }),
  );
  document.catalog.set(PDFName.of('Outlines'), outlines);
}

async function renderBook(book, directory) {
  const root = pathToFileURL(directory + sep).href;
  const ses = electronSession.fromPartition(PARTITION, { cache: false });
  // Books are untrusted: no scripts, no permissions and no access outside the extracted copy.
  ses.webRequest.onBeforeRequest((details, callback) =>
    callback({ cancel: !(details.url.startsWith(root) || details.url.startsWith('data:')) }),
  );
  ses.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
  const window = new BrowserWindow({
    show: false,
    width: 600,
    height: 840,
    webPreferences: {
      partition: PARTITION,
      javascript: false,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
      backgroundThrottling: false,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  const output = await PDFDocument.create({ updateMetadata: false });
  const chapterStarts = new Map();
  try {
    for (const chapter of book.spine) {
      try {
        await withTimeout(
          window.loadURL(pathToFileURL(resolve(directory, ...chapter.path.split('/'))).href),
          CHAPTER_TIMEOUT_MS,
          'EPUB chapter timed out.',
        );
        await window.webContents.insertCSS(BOOK_CSS, { cssOrigin: 'user' });
        const printed = await withTimeout(
          window.webContents.printToPDF(PRINT_OPTIONS),
          CHAPTER_TIMEOUT_MS,
          'EPUB chapter timed out.',
        );
        const part = await PDFDocument.load(printed);
        chapterStarts.set(chapter.path, output.getPageCount());
        for (const page of await output.copyPages(part, part.getPageIndices()))
          output.addPage(page);
      } catch {
        // A malformed chapter should not make the rest of the book unreadable.
      }
    }
  } finally {
    ses.webRequest.onBeforeRequest(null);
    if (!window.isDestroyed()) window.destroy();
  }
  if (!output.getPageCount()) throw Error('This EPUB has no printable chapters.');
  const seen = new Set();
  addOutline(
    output,
    book.toc
      .filter((entry) => chapterStarts.has(entry.path))
      .filter((entry) => {
        const key = `${entry.path}#${entry.fragment}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((entry) => ({ ...entry, page: chapterStarts.get(entry.path) })),
  );
  if (book.title) output.setTitle(book.title);
  if (book.language) output.setLanguage(book.language);
  output.setProducer('PDFMathReader EPUB');
  return output.save();
}

export function createEPUBConverter({ directory }) {
  const pending = new Map();
  let queue = Promise.resolve();
  async function prune() {
    const files = [];
    for (const name of await readdir(directory).catch(() => []))
      if (name.endsWith('.pdf'))
        files.push({ name, time: (await stat(join(directory, name))).mtimeMs });
    files.sort((a, b) => b.time - a.time);
    for (const { name } of files.slice(MAX_CACHED_BOOKS))
      await rm(join(directory, name), { force: true });
  }
  async function convertUncached(bytes, path) {
    const book = readEPUBPackage(bytes);
    const workspace = await mkdtemp(join(tmpdir(), 'pdfmathreader-epub-'));
    try {
      await extract(book.zip, workspace);
      const pdf = await renderBook(book, workspace);
      if (pdf.byteLength > MAX_PDF_BYTES) throw Error('The converted EPUB exceeds 200 MB.');
      await mkdir(directory, { recursive: true });
      const temporary = `${path}.${randomUUID()}.tmp`;
      await writeFile(temporary, pdf);
      await rename(temporary, path);
      await prune().catch(() => {});
      return pdf;
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  }
  async function convert(bytes) {
    const key = createHash('sha256')
      .update(`epub:${CONVERTER_VERSION}:`)
      .update(bytes)
      .digest('hex');
    const path = join(directory, `${key}.pdf`);
    try {
      const cached = await readFile(path);
      const now = new Date();
      await utimes(path, now, now).catch(() => {});
      return new Uint8Array(cached);
    } catch {}
    if (pending.has(key)) return pending.get(key);
    // One hidden renderer at a time keeps memory bounded for large books.
    const operation = queue.then(() => convertUncached(bytes, path));
    queue = operation.catch(() => {});
    pending.set(key, operation);
    try {
      return new Uint8Array(await operation);
    } finally {
      pending.delete(key);
    }
  }
  return { convert };
}
