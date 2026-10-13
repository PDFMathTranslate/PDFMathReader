// Publish a GitHub release from this Mac. CI builds and tests every package, but
// only a local build can carry the pinned macOS signature the updater trusts.
//
//   bun run release <version>   bump package.json, commit "release: <version>",
//                               push, then publish once CI passes
//   bun run release             publish the latest pushed release commit
//   bun run release --dry-run   rehearse every step except the GitHub release
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseVersion, shouldRelease } from '../.github/scripts/release-version.mjs';
import { previousRelease, releaseNotes } from '../.github/scripts/release-notes.mjs';
import { verifyMacReleaseArchive } from '../.github/scripts/verify-macos-release.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const run = (command, args, options = {}) =>
  execFileSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    ...options,
  });
const step = (command, args) => execFileSync(command, args, { cwd: root, stdio: 'inherit' });
const git = (...args) => run('git', args).trim();
const gh = (...args) => run('gh', args);
const api = (path) => JSON.parse(gh('api', path));
const pages = (path) => JSON.parse(gh('api', '--paginate', '--slurp', path));
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const log = (text) => console.log(`\n==> ${text}`);
const isAncestor = (commit, ref) => {
  try {
    git('merge-base', '--is-ancestor', commit, ref);
    return true;
  } catch {
    return false;
  }
};

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const positional = args.filter((arg) => !arg.startsWith('-'));
if (args.some((arg) => arg.startsWith('-') && arg !== '--dry-run') || positional.length > 1)
  throw Error('Usage: bun run release [<version>] [--dry-run]');
const bump = positional[0]?.replace(/^v/, '');
if (bump && dryRun)
  throw Error('--dry-run rehearses an existing release commit; omit the version.');
if (process.platform !== 'darwin') throw Error('Releases must be built and signed on macOS.');

const { nameWithOwner: repo, defaultBranchRef } = JSON.parse(
  gh('repo', 'view', '--json', 'nameWithOwner,defaultBranchRef'),
);
const branch = defaultBranchRef.name;
const releases = () => pages(`repos/${repo}/releases?per_page=100`).flat();
if (git('status', '--porcelain', '--untracked-files=no'))
  throw Error('Commit or stash tracked changes before releasing.');
if (git('rev-parse', '--abbrev-ref', 'HEAD') !== branch) throw Error(`Check out ${branch} first.`);
git('fetch', '--quiet', 'origin', branch);

if (bump) {
  parseVersion(bump);
  step('git', ['merge', '--ff-only', '--quiet', `origin/${branch}`]);
  if (!shouldRelease(bump, releases()))
    throw Error(`${bump} must be higher than every published release.`);
  const file = join(root, 'package.json'),
    text = readFileSync(file, 'utf8'),
    current = JSON.parse(text).version;
  const updated = text.replace(`"version": "${current}"`, `"version": "${bump}"`);
  if (JSON.parse(updated).version !== bump) throw Error('Could not update package.json version.');
  log(`Committing release: ${bump}`);
  writeFileSync(file, updated);
  step('bun', ['install', '--lockfile-only']);
  step('git', ['add', 'package.json', 'bun.lock']);
  step('git', ['commit', '--quiet', '-m', `release: ${bump}`]);
  step('git', ['push', '--quiet', 'origin', branch]);
}

// The README bot commits after each push, so the release commit may sit just below HEAD.
const sha = git('log', '-50', '--format=%H %s')
  .split('\n')
  .find((line) => line.slice(41).startsWith('release'))
  ?.slice(0, 40);
if (!sha) throw Error('No release commit found. Run: bun run release <version>');
const later = git('diff', '--name-only', `${sha}..HEAD`).split('\n').filter(Boolean);
if (later.some((path) => path !== 'README.md'))
  throw Error(
    `HEAD has changes after release commit ${sha.slice(0, 7)}. Bump again: bun run release <version>`,
  );
if (!isAncestor(sha, `origin/${branch}`))
  throw Error(`Push release commit ${sha.slice(0, 7)} to ${branch} first.`);
const version = JSON.parse(git('show', `${sha}:package.json`)).version;
parseVersion(version);
const tag = `v${version}`;
const prerelease = parseVersion(version).pre.length > 0;
log(`Releasing ${tag} from ${sha.slice(0, 7)}${dryRun ? ' (dry run)' : ''}`);

const published = releases().find((release) => release.tag_name === tag && !release.draft);
if (!shouldRelease(version, releases())) {
  const reason = published
    ? `${tag} is already published: ${published.html_url}`
    : `${version} is not higher than every published release.`;
  if (!dryRun) {
    if (!published) throw Error(reason);
    console.log(reason);
    process.exit(0);
  }
  console.log(`Warning: ${reason} Continuing the rehearsal.`);
}
const refs = api(`repos/${repo}/git/matching-refs/tags/${encodeURIComponent(tag)}`);
if (
  refs.some((ref) => ref.ref === `refs/tags/${tag}`) &&
  api(`repos/${repo}/commits/${encodeURIComponent(tag)}`).sha !== sha
)
  throw Error(`Tag ${tag} already points to a different commit.`);

const work = join(root, 'release', `publish-${tag}`),
  assetDir = join(work, 'assets');
rmSync(work, { recursive: true, force: true });
mkdirSync(assetDir, { recursive: true });
const targets = [
  'darwin-arm64',
  'darwin-x64',
  'win32-x64',
  'win32-ia32',
  'linux-x64',
  'linux-armv7l',
];
const assetName = (target) =>
  `PDFMathReader-${target}.${target.startsWith('darwin') ? 'zip' : target.startsWith('win32') ? 'exe' : 'tar.gz'}`;
const assets = targets.map((target) => join(assetDir, assetName(target)));

// Sign locally first; this overlaps with CI, which usually takes longer.
log('Building and signing macOS packages');
step('bun', ['install', '--frozen-lockfile']);
if (!existsSync(join(root, 'electron/AppIcon.icns')) || !existsSync(join(root, 'public/symbols')))
  step('bun', ['run', 'icons:mac']);
step('bun', ['run', 'build']);
for (const arch of ['arm64', 'x64']) {
  step(process.execPath, [
    'electron/build/package.mjs',
    '--platform=darwin',
    `--arch=${arch}`,
    '--distribute',
  ]);
  const name = assetName(`darwin-${arch}`);
  copyFileSync(join(root, 'release', name), join(assetDir, name));
  verifyMacReleaseArchive(join(assetDir, name), version);
  console.log(`Verified signature and version of ${name}`);
}

// Publication needs the same green checks the CI release gate requires.
log('Waiting for CI at ' + sha.slice(0, 7));
const workflows = ['Packaging', 'Code style', 'Update README recent features'];
const deadline = Date.now() + 60 * 60 * 1000;
let packaging;
while (!packaging) {
  const runs = pages(`repos/${repo}/actions/runs?head_sha=${sha}&event=push&per_page=100`)
    .flatMap((page) => page.workflow_runs)
    .filter((item) => item.head_branch === branch);
  const latest = workflows.map(
    (name) => runs.filter((item) => item.name === name).sort((a, b) => b.id - a.id)[0],
  );
  const failed = latest.find(
    (item) => item?.status === 'completed' && item.conclusion !== 'success',
  );
  if (failed)
    throw Error(
      `${failed.name} ${failed.conclusion}: ${failed.html_url}\nFix it or rerun it (gh run rerun ${failed.id}), then run: bun run release`,
    );
  if (latest.every((item) => item?.status === 'completed')) packaging = latest[0];
  else {
    if (Date.now() > deadline) throw Error('Timed out waiting for CI. Rerun: bun run release');
    console.log(
      'Waiting: ' +
        latest.map((item, i) => `${workflows[i]} ${item?.status ?? 'not started'}`).join(', '),
    );
    await sleep(30000);
  }
}

log('Downloading Windows and Linux packages from ' + packaging.html_url);
for (const target of targets.filter((item) => !item.startsWith('darwin'))) {
  const name = assetName(target),
    dir = join(work, `download-${target}`);
  for (let attempt = 1; ; attempt++) {
    rmSync(dir, { recursive: true, force: true });
    try {
      run('gh', [
        'run',
        'download',
        String(packaging.id),
        '--repo',
        repo,
        '--name',
        `PDFMathReader-${target}`,
        '--dir',
        dir,
      ]);
      renameSync(join(dir, name), join(assetDir, name));
      console.log('Downloaded ' + name);
      break;
    } catch (error) {
      // Large artifact downloads occasionally drop; retry from scratch.
      if (attempt === 4) throw error;
      console.log(`Download of ${name} failed (attempt ${attempt}); retrying`);
      await sleep(5000 * attempt);
    }
  }
  rmSync(dir, { recursive: true, force: true });
}

// Same package checks as .github/scripts/publish-release.mjs.
for (const path of assets) {
  if (!statSync(path).size) throw Error('Empty package: ' + path);
  if (path.endsWith('.exe')) {
    if (readFileSync(path).subarray(0, 2).toString() !== 'MZ')
      throw Error('Invalid executable: ' + path);
  } else if (path.endsWith('.zip'))
    run('python3', [
      '-I',
      '-c',
      'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None',
      path,
    ]);
  else run('tar', ['-tzf', path], { stdio: 'ignore' });
}
console.log('All six packages passed validation');

log('Writing release notes');
const previous = previousRelease(version, releases());
const history = pages(
  previous
    ? `repos/${repo}/compare/${encodeURIComponent(previous.tag_name)}...${sha}?per_page=100`
    : `repos/${repo}/commits?sha=${sha}&per_page=100`,
);
const commits = previous ? history.flatMap((page) => page.commits) : history.flat().reverse();
const notes = join(work, 'release-notes.md');
writeFileSync(notes, releaseNotes({ repo, version, sha, previous, commits, assets }));
console.log(`${commits.length} commits since ${previous?.tag_name ?? 'the first commit'}`);

if (dryRun) {
  log(`Dry run complete. Packages and notes are in ${work}`);
  process.exit(0);
}

log(`Uploading ${tag} as a draft`);
const existing = releases().find((release) => release.tag_name === tag);
if (existing && !existing.draft) {
  console.log(`${tag} was published meanwhile: ${existing.html_url}`);
  process.exit(0);
}
if (existing) step('gh', ['release', 'upload', tag, ...assets, '--repo', repo, '--clobber']);
else
  step('gh', [
    'release',
    'create',
    tag,
    ...assets,
    '--repo',
    repo,
    '--target',
    sha,
    '--title',
    tag,
    '--notes-file',
    notes,
    '--draft',
    ...(prerelease ? ['--prerelease'] : []),
  ]);
const uploaded = JSON.parse(gh('release', 'view', tag, '--repo', repo, '--json', 'assets')).assets;
for (const path of assets) {
  const name = path.slice(assetDir.length + 1);
  const asset = uploaded.find((item) => item.name === name);
  if (asset?.state !== 'uploaded' || asset.size !== statSync(path).size)
    throw Error(`Upload of ${name} is incomplete; the draft stays unpublished. Rerun to retry.`);
}

// Only make the release public after every validated package has been uploaded.
log(`Publishing ${tag}`);
step('gh', [
  'release',
  'edit',
  tag,
  '--repo',
  repo,
  '--notes-file',
  notes,
  '--draft=false',
  ...(prerelease ? [] : ['--latest']),
]);
if (api(`repos/${repo}/commits/${encodeURIComponent(tag)}`).sha !== sha)
  throw Error(`Tag ${tag} does not point to ${sha}`);
rmSync(work, { recursive: true, force: true });
log(
  `Published ${gh('release', 'view', tag, '--repo', repo, '--json', 'url', '--jq', '.url').trim()}`,
);
