import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';

// Pin the local signing identity so upgrades retain their Keychain identity.
export async function signMacApplication(bundle, root = process.cwd()) {
  const pin = resolve(root, '.cache/macos-signing-identity.txt');
  const identities = execFileSync(
    '/usr/bin/security',
    ['find-identity', '-v', '-p', 'codesigning'],
    { encoding: 'utf8' },
  );
  let identity = process.env.PDF_READER_SIGN_IDENTITY;
  if (!identity)
    try {
      identity = (await readFile(pin, 'utf8')).trim();
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  if (!identity) identity = identities.match(/\b([A-F0-9]{40})\s+"Apple Development:[^"]+"/)?.[1];
  if (!identity || !identities.includes(identity))
    throw Error(
      'A valid, consistent macOS signing identity is required. Set PDF_READER_SIGN_IDENTITY to its certificate hash. Ad-hoc signing is disabled for production packages.',
    );
  for (const name of ['haptic-feedback']) {
    const helper = resolve(bundle, 'Contents/Resources', name);
    if (existsSync(helper))
      execFileSync(
        '/usr/bin/codesign',
        ['--force', '--sign', identity, '--timestamp=none', helper],
        {
          stdio: 'inherit',
        },
      );
  }
  execFileSync(
    '/usr/bin/codesign',
    ['--force', '--deep', '--sign', identity, '--timestamp=none', bundle],
    { stdio: 'inherit' },
  );
  execFileSync('/usr/bin/codesign', ['--verify', '--deep', '--strict', bundle], {
    stdio: 'inherit',
  });
  await mkdir(dirname(pin), { recursive: true });
  await writeFile(pin, identity + '\n', { mode: 0o600 });
  console.log('Signed production app with pinned macOS certificate ' + identity);
}
