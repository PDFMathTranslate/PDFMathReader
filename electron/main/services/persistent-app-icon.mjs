import { execFile } from 'node:child_process';
import { dirname, join } from 'node:path';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';

const runFile = promisify(execFile);
const script = `
ObjC.import('AppKit');
function run(args) {
  const image = $.NSImage.alloc.initWithContentsOfFile($(args[1]));
  if (!image || !$.NSWorkspace.sharedWorkspace.setIconForFileOptions(image, $(args[0]), 0))
    throw Error('Cannot save application icon. The application must be writable.');
  // Recent macOS versions keep a separate Dock icon cache. Re-save the current
  // appearance without changing it, so the Dock reloads Finder's custom icon.
  // This private API is optional: older systems still retain the Finder icon.
  try {
    ObjC.bindFunction('dlopen', ['void *', ['char *', 'int']]);
    $.dlopen('/System/Library/PrivateFrameworks/SkyLight.framework/SkyLight', 1);
    const configurationClass = $.NSClassFromString('SLSIconAppearanceConfiguration');
    if (configurationClass && configurationClass.respondsToSelector('fetchCurrentIconAppearanceConfiguration')) {
      const configuration = configurationClass.fetchCurrentIconAppearanceConfiguration;
      if (configuration && configuration.respondsToSelector('save')) configuration.save;
    }
  } catch (error) {
    console.warn('Dock icon cache refresh unavailable: ' + error.message);
  }
}
`;

// Use Finder's custom-icon metadata rather than changing signed bundle resources.
// Serialize writes because NSWorkspace requires one setIcon call at a time.
export function createPersistentAppIcon({ app, platform = process.platform, run = runFile }) {
  let pending = Promise.resolve();
  let saved;
  return (imagePath) => {
    if (platform !== 'darwin' || !app.isPackaged) return Promise.resolve();
    const bundle = dirname(dirname(dirname(app.getPath('exe'))));
    if (!bundle.endsWith('.app')) return Promise.resolve();
    pending = pending
      .catch(() => {})
      .then(async () => {
        if (saved === imagePath) return;
        // Cocoa cannot read Electron's virtual app.asar paths.
        const temporary = await mkdtemp(join(tmpdir(), 'pdfmathreader-icon-'));
        try {
          const png = join(temporary, 'icon.png');
          await writeFile(png, await readFile(imagePath));
          await run('/usr/bin/osascript', ['-l', 'JavaScript', '-e', script, '--', bundle, png], {
            timeout: 10000,
          });
        } finally {
          await rm(temporary, { recursive: true, force: true });
        }
        saved = imagePath;
      });
    return pending;
  };
}
