import { fileURLToPath } from 'node:url';
import { open } from 'node:fs/promises';
import { basename, extname, isAbsolute, resolve } from 'node:path';
const MAX_PDF_BYTES = 200 * 1024 * 1024;
const DOCUMENT_EXTENSIONS = new Set(['.pdf', '.epub']);
let epubSupport = null;

// EPUB is converted to PDF in the main process; everything downstream reads PDF bytes.
export function configureEPUBSupport(support) {
  epubSupport = support;
}
export const isEPUBPath = (path) =>
  typeof path === 'string' && extname(path).toLowerCase() === '.epub';
const epubAvailable = () => !!epubSupport && epubSupport.enabled() !== false;
// Annotations are never written back into an EPUB; its PDF form lives in the app cache.
export const documentSource = (path) => ({
  path,
  reliable: !isEPUBPath(path),
  preserveWithoutPath: false,
});

async function inspectSystemPDF(path, readBytes) {
  const epub = isEPUBPath(path) && epubAvailable();
  if (typeof path !== 'string' || (extname(path).toLowerCase() !== '.pdf' && !epub))
    throw Error('Choose a PDF document.');
  const file = await open(path, 'r');
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size > MAX_PDF_BYTES)
      throw Error('Choose a PDF smaller than 200 MB.');
    const header = Buffer.alloc(Math.min(info.size, 1024));
    await file.read(header, 0, header.length, 0);
    if (epub) {
      if (header.length < 4 || header.readUInt32LE(0) !== 0x04034b50)
        throw Error('This file is not a readable EPUB.');
      if (!readBytes) return true;
      const bytes = await file.readFile();
      return { name: basename(path), bytes: await epubSupport.convert(bytes) };
    }
    if (!header.includes(Buffer.from('%PDF-'))) throw Error('This file is not a readable PDF.');
    if (!readBytes) return true;
    const bytes = await file.readFile();
    if (bytes.length > MAX_PDF_BYTES) throw Error('Choose a PDF smaller than 200 MB.');
    return { name: basename(path), bytes: new Uint8Array(bytes) };
  } finally {
    await file.close();
  }
}
export async function validateSystemPDF(path) {
  return inspectSystemPDF(path, false);
}
export async function readSystemPDF(path) {
  return inspectSystemPDF(path, true);
}

export function pdfLaunchPaths(args, cwd) {
  const paths = [];
  for (const arg of args) {
    if (typeof arg !== 'string' || arg.startsWith('-')) continue;
    try {
      const path = arg.startsWith('file:')
        ? fileURLToPath(arg)
        : isAbsolute(arg)
          ? arg
          : resolve(cwd, arg);
      if (DOCUMENT_EXTENSIONS.has(extname(path).toLowerCase()) && !paths.includes(path))
        paths.push(path);
    } catch {}
  }
  return paths;
}
