import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Match the installed application's identity. Temporary/ad-hoc CI signatures
// cannot pass the updater's trust checks and must never become public releases.
export function verifyMacReleaseArchive(archive, version) {
  const directory = mkdtempSync(join(tmpdir(), 'reader-release-signature-'));
  try {
    execFileSync('/usr/bin/ditto', ['-x', '-k', archive, directory]);
    const bundle = join(directory, 'PDFMathReader.app');
    execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle]);
    const result = spawnSync('/usr/bin/codesign', ['-dv', '--verbose=4', bundle], {
      encoding: 'utf8',
    });
    if (result.error || result.status !== 0)
      throw result.error || Error('Unable to read release signature');
    const identity = result.stdout + result.stderr;
    if (
      !/^Identifier=local\.previewtranslate\.reader$/m.test(identity) ||
      !/^TeamIdentifier=XUG85B2S2L$/m.test(identity) ||
      !/^Authority=/m.test(identity)
    )
      throw Error('Release app must use the pinned macOS signing identity');
    const actual = execFileSync(
      '/usr/bin/plutil',
      [
        '-extract',
        'CFBundleShortVersionString',
        'raw',
        '-o',
        '-',
        join(bundle, 'Contents/Info.plist'),
      ],
      { encoding: 'utf8' },
    ).trim();
    if (actual !== version) throw Error('Release bundle version does not match package version');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
