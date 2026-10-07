import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { replaceFile } from '../../../runtime/node/atomic-file.mjs';

export const RELEASES_URL = 'https://github.com/PDFMathTranslate/PDFMathReader/releases';
export const RELEASE_API =
  'https://api.github.com/repos/PDFMathTranslate/PDFMathReader/releases/latest';
export const UPDATE_INTERVAL = 6 * 60 * 60 * 1000;
export const UPDATE_STARTUP_DELAY = 30000;
function versionParts(value) {
  const match =
    /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\da-zA-Z.-]+))?(?:\+[\da-zA-Z.-]+)?$/.exec(
      value || '',
    );
  return match ? { numbers: match.slice(1, 4).map(Number), pre: match[4]?.split('.') || [] } : null;
}
export function compareVersions(a, b) {
  const left = versionParts(a),
    right = versionParts(b);
  if (!left || !right) return null;
  for (let i = 0; i < 3; i++)
    if (left.numbers[i] !== right.numbers[i]) return Math.sign(left.numbers[i] - right.numbers[i]);
  if (!left.pre.length || !right.pre.length) return left.pre.length ? -1 : right.pre.length ? 1 : 0;
  for (let i = 0; i < Math.max(left.pre.length, right.pre.length); i++) {
    const x = left.pre[i],
      y = right.pre[i];
    if (x === y) continue;
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const xn = /^\d+$/.test(x),
      yn = /^\d+$/.test(y);
    if (xn && yn) return Math.sign(Number(x) - Number(y));
    if (xn !== yn) return xn ? -1 : 1;
    return x < y ? -1 : 1;
  }
  return 0;
}
export function releaseLink(url, { download = false } = {}) {
  try {
    const parsed = new URL(url);
    return parsed.origin === 'https://github.com' &&
      !parsed.username &&
      !parsed.password &&
      parsed.pathname.startsWith(
        '/PDFMathTranslate/PDFMathReader/releases/' + (download ? 'download/' : 'tag/'),
      )
      ? parsed.href
      : null;
  } catch {
    return null;
  }
}
function releaseState(release, currentVersion, platform, arch) {
  const version = release?.tag_name,
    comparison = compareVersions(version, currentVersion),
    releaseUrl = releaseLink(release?.html_url);
  if (
    comparison === null ||
    release.draft ||
    release.prerelease ||
    versionParts(version).pre.length ||
    !releaseUrl
  )
    throw Error('invalid-release');
  const extension = platform === 'darwin' ? 'zip' : platform === 'win32' ? 'exe' : 'tar.gz';
  const asset = (Array.isArray(release.assets) ? release.assets : []).find(
    (item) => item.name === `PDFMathReader-${platform}-${arch}.${extension}`,
  );
  return {
    status: comparison > 0 ? 'available' : 'up-to-date',
    latestVersion: version.replace(/^v/, ''),
    releaseUrl,
    downloadUrl: releaseLink(asset?.browser_download_url, { download: true }),
  };
}
export async function createAppUpdates({
  currentVersion,
  platform = process.platform,
  arch = process.arch,
  automatic = true,
  path,
  fetchImpl = globalThis.fetch,
  onChange = () => {},
  now = Date.now,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  startupDelay = UPDATE_STARTUP_DELAY,
  interval = UPDATE_INTERVAL,
} = {}) {
  let state = {
    status: 'idle',
    currentVersion,
    latestVersion: null,
    automatic,
    checkedAt: null,
    error: null,
    releaseUrl: null,
    downloadUrl: null,
  };
  let etag = null,
    cached = null,
    timer,
    pending,
    controller,
    started = false,
    stopped = false;
  if (path)
    try {
      const saved = JSON.parse(await readFile(path, 'utf8'));
      if (Number.isFinite(saved.checkedAt) && saved.checkedAt <= now()) {
        cached = saved.release === null ? null : saved.release;
        const info = cached
          ? releaseState(cached, currentVersion, platform, arch)
          : { status: 'no-release' };
        state = { ...state, ...info, checkedAt: saved.checkedAt };
        etag = typeof saved.etag === 'string' ? saved.etag : null;
      }
    } catch {}
  function snapshot() {
    return { ...state };
  }
  function publish(patch) {
    state = { ...state, ...patch };
    onChange(snapshot());
  }
  async function persist() {
    if (!path) return;
    try {
      await mkdir(dirname(path), { recursive: true });
      const temp = path + '.tmp';
      await writeFile(temp, JSON.stringify({ checkedAt: state.checkedAt, etag, release: cached }));
      await replaceFile(temp, path);
    } catch {
      /* Checking updates must not block reading on a cache write failure. */
    }
  }
  function schedule(delay) {
    clearTimer(timer);
    if (started && !stopped && state.automatic) {
      timer = setTimer(async () => {
        await check();
        schedule(interval);
      }, delay);
      timer?.unref?.();
    }
  }
  function check() {
    if (stopped) return Promise.resolve(snapshot());
    if (pending) return pending;
    pending = (async () => {
      controller = new AbortController();
      const timeout = setTimer(() => controller.abort(), 15000);
      publish({ status: 'checking', error: null });
      try {
        const response = await fetchImpl(RELEASE_API, {
          headers: {
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'PDFMathReader/' + currentVersion,
            ...(etag ? { 'If-None-Match': etag } : {}),
          },
          signal: controller.signal,
        });
        if (stopped) return snapshot();
        let info;
        if (response.status === 404) {
          cached = null;
          etag = null;
          info = { status: 'no-release', latestVersion: null, releaseUrl: null, downloadUrl: null };
        } else if (response.status === 304) {
          if (!cached) throw Error('invalid-release');
          info = releaseState(cached, currentVersion, platform, arch);
        } else if (!response.ok)
          throw Error(
            response.status === 429 || response.status === 403 ? 'rate-limit' : 'network',
          );
        else {
          const release = await response.json();
          if (stopped) return snapshot();
          info = releaseState(release, currentVersion, platform, arch);
          cached = release;
          etag = response.headers.get('etag');
        }
        publish({ ...info, checkedAt: now(), error: null });
        await persist();
      } catch (error) {
        if (!stopped)
          publish({
            status: 'error',
            error: ['rate-limit', 'invalid-release'].includes(error.message)
              ? error.message
              : 'network',
          });
      } finally {
        clearTimer(timeout);
        controller = null;
      }
      return snapshot();
    })().finally(() => {
      pending = null;
    });
    return pending;
  }
  return {
    status: snapshot,
    check,
    setAutomatic(value) {
      if (typeof value !== 'boolean') throw Error('Invalid automatic update setting');
      publish({ automatic: value });
      schedule(startupDelay);
      return snapshot();
    },
    start() {
      if (started) return;
      started = true;
      schedule(startupDelay);
    },
    stop() {
      stopped = true;
      clearTimer(timer);
      controller?.abort();
    },
  };
}
