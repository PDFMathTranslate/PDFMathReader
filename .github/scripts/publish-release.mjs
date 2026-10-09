import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { shouldRelease, parseVersion } from './release-version.mjs';
import { previousRelease, releaseNotes } from './release-notes.mjs';
import { verifyMacReleaseArchive } from './verify-macos-release.mjs';
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const api = (path) => JSON.parse(gh('api', path));
const repo = process.env.GH_REPO,
  runId = process.env.SOURCE_RUN_ID;
if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '') || !/^\d+$/.test(runId || ''))
  throw Error('Invalid repository or source run ID');
const repository = api(`repos/${repo}`),
  run = api(`repos/${repo}/actions/runs/${runId}`);
if (
  run.status !== 'completed' ||
  run.conclusion !== 'success' ||
  run.path !== '.github/workflows/electron-build.yml' ||
  run.name !== 'Packaging' ||
  run.head_repository?.full_name !== repo ||
  run.head_branch !== repository.default_branch ||
  !['push', 'workflow_dispatch'].includes(run.event)
)
  throw Error('Release requires a successful default-branch Packaging run from this repository');
const sha = run.head_sha;
if (!/^[0-9a-f]{40}$/.test(sha)) throw Error('Invalid source commit');
const summary = (text) => {
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text + '\n');
};
const commit = api(`repos/${repo}/commits/${sha}`);
if (!commit.commit.message.startsWith('release')) {
  summary('Commit message does not start with release; nothing to publish.');
  process.exit(0);
}
// Wait for all independent CI workflows at this exact commit, excluding publication itself.
const requiredWorkflows = ['Packaging', 'Code style', 'Update README recent features'];
const deadline = Date.now() + 20 * 60 * 1000;
while (true) {
  const runs = JSON.parse(
    gh('api', '--paginate', '--slurp', `repos/${repo}/actions/runs?head_sha=${sha}&per_page=100`),
  ).flatMap((page) => page.workflow_runs);
  const checks = requiredWorkflows.map(
    (name) =>
      runs
        .filter((item) => item.name === name && item.event === run.event)
        .sort((a, b) => b.id - a.id)[0],
  );
  if (checks.some((check) => check?.status === 'completed' && check.conclusion !== 'success'))
    throw Error('All CI workflows must succeed before release');
  if (checks.every((check) => check?.status === 'completed' && check.conclusion === 'success'))
    break;
  if (Date.now() >= deadline) throw Error('Timed out waiting for all CI workflows');
  console.log('Waiting for all CI workflows at ' + sha);
  await new Promise((resolve) => setTimeout(resolve, 15000));
}
const packageFile = api(`repos/${repo}/contents/package.json?ref=${sha}`);
const { version } = JSON.parse(Buffer.from(packageFile.content, 'base64').toString());
parseVersion(version);
const releases = () =>
  JSON.parse(gh('api', '--paginate', '--slurp', `repos/${repo}/releases?per_page=100`)).flat();
if (!shouldRelease(version, releases())) {
  summary(
    `Version ${version} has not increased beyond the release baseline or published releases; nothing to publish.`,
  );
  process.exit(0);
}
const tag = `v${version}`;
const targets = [
  'darwin-arm64',
  'darwin-x64',
  'win32-x64',
  'win32-ia32',
  'linux-x64',
  'linux-armv7l',
];
const artifacts = JSON.parse(
  gh('api', '--paginate', '--slurp', `repos/${repo}/actions/runs/${runId}/artifacts?per_page=100`),
).flatMap((page) => page.artifacts);
const assets = [];
for (const target of targets) {
  const name = `PDFMathReader-${target}`;
  if (!artifacts.some((item) => item.name === name && !item.expired && item.size_in_bytes > 0))
    throw Error('Missing tested artifact: ' + name);
  const dir = `artifacts/${name}`;
  mkdirSync(dir, { recursive: true });
  gh('run', 'download', runId, '--repo', repo, '--name', name, '--dir', dir);
  const extension = target.startsWith('darwin')
    ? 'zip'
    : target.startsWith('win32')
      ? 'exe'
      : 'tar.gz';
  const path = `${dir}/${name}.${extension}`;
  if (!statSync(path).size) throw Error('Empty package: ' + path);
  if (extension === 'exe') {
    if (readFileSync(path).subarray(0, 2).toString() !== 'MZ')
      throw Error('Invalid executable: ' + path);
  } else if (extension === 'zip')
    execFileSync('python3', [
      '-c',
      'import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None',
      path,
    ]);
  else execFileSync('tar', ['-tzf', path], { stdio: 'ignore' });
  if (target.startsWith('darwin')) verifyMacReleaseArchive(path, version);
  assets.push(path);
}
// The release workflow serializes publication; recheck after artifact downloads.
if (!shouldRelease(version, releases())) {
  summary(`Version ${version} was already published; nothing to publish.`);
  process.exit(0);
}
const refs = api(`repos/${repo}/git/matching-refs/tags/${encodeURIComponent(tag)}`);
if (
  refs.some((ref) => ref.ref === `refs/tags/${tag}`) &&
  api(`repos/${repo}/commits/${encodeURIComponent(tag)}`).sha !== sha
)
  throw Error('Existing release tag points to a different commit');
const existing = releases().find((release) => release.tag_name === tag);
const previous = previousRelease(version, releases());
const historyPath = previous
  ? `repos/${repo}/compare/${encodeURIComponent(previous.tag_name)}...${sha}?per_page=100`
  : `repos/${repo}/commits?sha=${sha}&per_page=100`;
const pages = JSON.parse(gh('api', '--paginate', '--slurp', historyPath));
const commits = previous ? pages.flatMap((page) => page.commits) : pages.flat().reverse();
const notesPath = 'artifacts/release-notes.md';
writeFileSync(notesPath, releaseNotes({ repo, version, sha, previous, commits, assets }));
if (existing) {
  if (!existing.draft) throw Error('Release already exists');
  gh('release', 'upload', tag, ...assets, '--repo', repo, '--clobber');
} else {
  gh(
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
    notesPath,
    '--draft',
    ...(parseVersion(version).pre.length > 0 ? ['--prerelease'] : []),
  );
}
// Only make the release public after every validated package has been uploaded.
gh('release', 'edit', tag, '--repo', repo, '--notes-file', notesPath, '--draft=false');
const url = gh('release', 'view', tag, '--repo', repo, '--json', 'url', '--jq', '.url').trim();
summary(
  `Published ${url}\n\nTested commit: ${sha}\n\nSource CI: ${run.html_url}\n\nAll six installation packages attached.`,
);
