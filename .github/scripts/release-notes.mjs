import { compareVersions, parseVersion } from './release-version.mjs';

export function previousRelease(version, releases) {
  return releases
    .filter((release) => {
      if (release.draft) return false;
      try {
        return compareVersions(release.tag_name.replace(/^v/, ''), version) < 0;
      } catch {
        return false;
      }
    })
    .sort((a, b) => compareVersions(b.tag_name.replace(/^v/, ''), a.tag_name.replace(/^v/, '')))[0];
}

const escape = (text) =>
  Array.from(text)
    .filter((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
    .join('')
    .replace(/[\\`*_{}[\]<>#]/g, '\\$&');

export function releaseNotes({ repo, version, sha, previous, commits, assets }) {
  parseVersion(version);
  const groups = { features: [], fixes: [] };
  const seen = new Set();
  for (const item of commits) {
    if (seen.has(item.sha)) continue;
    seen.add(item.sha);
    const [subject, ...body] = item.commit.message.split('\n');
    const match = /^(feat|fix|perf|ux|ui)(?:\([^)]*\))?!?:\s*(.+)$/i.exec(subject);
    if (!match) continue;
    const title = escape(match[2].trim());
    const detail = escape(
      body
        .filter((line) => !/^(?:Co-authored-by|Signed-off-by|Reviewed-by):/i.test(line))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    );
    const bullet = `- **${title}**${detail ? ` — ${detail}` : ''} ([${item.sha.slice(0, 7)}](https://github.com/${repo}/commit/${item.sha}))`;
    groups[match[1].toLowerCase() === 'feat' ? 'features' : 'fixes'].push(bullet);
  }
  const count = groups.features.length + groups.fixes.length;
  const lines = [
    `# PDFMathReader v${version}`,
    '',
    count
      ? `This release includes ${groups.features.length} new features and ${groups.fixes.length} fixes and improvements${previous ? ` since ${escape(previous.tag_name)}` : ''}. See the highlights below.`
      : 'This release includes maintenance updates. See the full changelog for details.',
    '',
    `## ${version}`,
    '',
  ];
  for (const [key, title] of [
    ['features', 'New features'],
    ['fixes', 'Fixes and improvements'],
  ]) {
    if (groups[key].length) lines.push(`### ${title}`, '', ...groups[key], '');
  }
  lines.push(
    '## Update',
    '',
    'Quit PDFMathReader, download the package for your system below, replace the existing application, and reopen it. Your documents and settings are preserved.',
    '',
  );
  const labels = {
    'darwin-arm64': 'macOS Apple silicon',
    'darwin-x64': 'macOS Intel',
    'win32-x64': 'Windows x64',
    'win32-ia32': 'Windows 32-bit',
    'linux-x64': 'Linux x64',
    'linux-armv7l': 'Linux ARMv7',
  };
  for (const path of assets) {
    const name = path.split('/').at(-1);
    const target = Object.keys(labels).find((key) => name.startsWith(`PDFMathReader-${key}.`));
    if (!target) throw Error('Unknown release package: ' + name);
    lines.push(
      `- [${labels[target]}](https://github.com/${repo}/releases/download/v${version}/${encodeURIComponent(name)})`,
    );
  }
  const url = previous
    ? `https://github.com/${repo}/compare/${encodeURIComponent(previous.tag_name)}...${sha}`
    : `https://github.com/${repo}/commits/${sha}`;
  lines.push('', `[Full changelog](${url})`, '');
  return lines.join('\n');
}
