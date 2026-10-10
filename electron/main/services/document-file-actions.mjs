import { shell } from 'electron';
import { shareWindowsFile } from './windows-file-share.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { createHash } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';

const run = promisify(execFile);
// Keep the Cocoa service alive until its native recipient picker finishes.
const airDropScript = String.raw`
ObjC.import('AppKit');
ObjC.import('Foundation');
var finished = false;
ObjC.registerSubclass({
  name: 'PDFMathReaderSharingDelegate',
  protocols: ['NSSharingServiceDelegate'],
  methods: {
    'sharingService:didShareItems:': {
      types: ['void', ['id', 'id']], implementation: function() { finished = true; }
    },
    'sharingService:didFailToShareItems:error:': {
      types: ['void', ['id', 'id', 'id']], implementation: function() { finished = true; }
    }
  }
});
function run(args) {
  var application = $.NSApplication.sharedApplication;
  application.setActivationPolicy($.NSApplicationActivationPolicyAccessory);
  var items = $.NSArray.arrayWithObject($.NSURL.fileURLWithPath($(args[0])));
  var service = $.NSSharingService.sharingServiceNamed($.NSSharingServiceNameSendViaAirDrop);
  if (!service || !service.canPerformWithItems(items)) throw Error('AirDrop is unavailable.');
  var delegate = $.PDFMathReaderSharingDelegate.alloc.init;
  service.delegate = delegate;
  application.activateIgnoringOtherApps(true);
  service.performWithItems(items);
  while (!finished) {
    $.NSRunLoop.currentRunLoop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(0.1));
  }
}
`;

export function createDocumentFileActions({
  app,
  platform,
  registry,
  documentPath,
  validateSystemPDF,
  reveal = (path) => shell.showItemInFolder(path),
  runAirDrop = run,
  shareWindows = shareWindowsFile,
}) {
  async function resolvePath(target, kind) {
    if (!target || target.isDestroyed()) return;
    const source = registry.stateFor(target)?.unkeyedAnnotationSource;
    const original = documentPath(target);
    if (!original) return;
    const current = () =>
      !target.isDestroyed() &&
      registry.stateFor(target)?.unkeyedAnnotationSource === source &&
      documentPath(target) === original;
    await validateSystemPDF(original);
    if (!current()) return;
    let path = original;
    if (kind === 'translated') {
      const pages = await target.webContents.executeJavaScript(
        'window.previewTranslatedFilePages?.()',
      );
      if (!current()) return;
      if (!Array.isArray(pages) || !pages.some((page) => Array.isArray(page) && page.length))
        throw Error('Translate at least one page before viewing or sharing the translated PDF.');
      const pdf = await PDFDocument.create();
      const originalPDF = pages.includes(null)
        ? await PDFDocument.load(await readFile(original))
        : null;
      if (originalPDF && originalPDF.getPageCount() !== pages.length)
        throw Error('The original PDF page count has changed. Reopen the document and try again.');
      for (const [index, bytes] of pages.entries()) {
        if (bytes === null) {
          const [page] = await pdf.copyPages(originalPDF, [index]);
          pdf.addPage(page);
          continue;
        }
        const pagePDF = await PDFDocument.load(Uint8Array.from(bytes));
        for (const page of await pdf.copyPages(pagePDF, pagePDF.getPageIndices()))
          pdf.addPage(page);
      }
      const bytes = await pdf.save();
      if (!current()) return;
      const directory = join(
        app.getPath('userData'),
        'translated-files',
        createHash('sha256').update(bytes).digest('hex'),
      );
      await mkdir(directory, { recursive: true });
      path = join(directory, basename(original, '.pdf') + '-translated.pdf');
      try {
        await access(path);
      } catch {
        await writeFile(path, bytes);
      }
    }
    if (!current()) return;
    return path;
  }
  async function perform(target, kind, action) {
    if (!['darwin', 'win32', 'linux'].includes(platform) || !target || target.isDestroyed()) return;
    if (!['original', 'translated'].includes(kind)) throw Error('Invalid file kind.');
    if (action !== 'reveal' && action !== (platform === 'darwin' ? 'airdrop' : 'share'))
      throw Error('Unsupported file action.');
    const source = registry.stateFor(target)?.unkeyedAnnotationSource;
    const path = await resolvePath(target, kind);
    if (
      !path ||
      target.isDestroyed() ||
      registry.stateFor(target)?.unkeyedAnnotationSource !== source
    )
      return;
    if (action === 'reveal' || (action === 'share' && platform === 'linux')) await reveal(path);
    else if (action === 'share') await shareWindows(target, path);
    else if (action === 'airdrop')
      await runAirDrop('/usr/bin/osascript', ['-l', 'JavaScript', '-e', airDropScript, path], {
        timeout: 10 * 60 * 1000,
      });
  }
  return { perform, resolvePath };
}
