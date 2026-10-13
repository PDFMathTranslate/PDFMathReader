import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// CI cannot sign; callers skip publication instead of failing on this error.
export class UnsignedMacReleaseError extends Error {}

// Match the installed application's identity. Temporary/ad-hoc CI signatures
// cannot pass the updater's trust checks and must never become public releases.
export function verifyMacReleaseArchive(archive, version) {
  const directory = mkdtempSync(join(tmpdir(), 'reader-release-signature-'));
  try {
    execFileSync('/usr/bin/ditto', ['-x', '-k', archive, directory]);
    const bundle = join(directory, 'PDFMathReader.app');
    const verify = spawnSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle], {
      encoding: 'utf8',
    });
    if (verify.error) throw verify.error;
    if (verify.status !== 0)
      throw new UnsignedMacReleaseError('Invalid macOS release signature: ' + verify.stderr.trim());
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
      throw new UnsignedMacReleaseError('Release app must use the pinned macOS signing identity');
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
