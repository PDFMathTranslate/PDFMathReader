import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { replaceFile } from '../../../runtime/node/atomic-file.mjs';

export const RELEASES_URL = 'https://github.com/PDFMathTranslate/PDFMathReader/releases';
export const RELEASE_API =
  'https://api.github.com/repos/PDFMathTranslate/PDFMathReader/releases/latest';
export const UPDATE_INTERVAL = 6 * 60 * 60 * 1000;
export const UPDATE_STARTUP_DELAY = 30000;
export const MAX_UPDATE_ERROR_DETAIL_LENGTH = 512;

function errorDetail(error) {
  const value =
    typeof error === 'string'
      ? error
      : typeof error?.message === 'string' && error.message
        ? error.message
        : typeof error?.code === 'string'
          ? error.code
          : '';
  const detail = value.trim();
  if (!detail) return null;
  return detail.length > MAX_UPDATE_ERROR_DETAIL_LENGTH
    ? detail.slice(0, MAX_UPDATE_ERROR_DETAIL_LENGTH - 1) + '…'
    : detail;
}
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
    downloadDigest: /^sha256:[a-f0-9]{64}$/i.test(asset?.digest || '') ? asset.digest : null,
    downloadSize: Number.isSafeInteger(asset?.size) && asset.size > 0 ? asset.size : null,
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
  installer = null,
} = {}) {
  let state = {
    status: 'idle',
    currentVersion,
    latestVersion: null,
    automatic,
    checkedAt: null,
    error: null,
    errorDetail: null,
    releaseUrl: null,
    downloadUrl: null,
    installSupported: Boolean(installer?.supported),
    progress: null,
  };
  let etag = null,
    cached = null,
    timer,
    pending,
    controller,
    started = false,
    stopped = false,
    installPending,
    installController,
    manualInstall = false;
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
  if (installer?.resultPath)
    try {
      const result = JSON.parse(await readFile(installer.resultPath, 'utf8'));
      if (result.status === 'error')
        state = {
          ...state,
          status: 'error',
          error: 'install',
          errorDetail: errorDetail(result),
        };
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
  function install({ automatic: auto = false } = {}) {
    if (stopped) return Promise.resolve(snapshot());
    if (!installer?.supported || !state.downloadUrl || !state.latestVersion)
      return Promise.resolve(snapshot());
    if (!auto) manualInstall = true;
    if (installPending) return installPending;
    if (state.status === 'ready') return Promise.resolve(snapshot());
    installController = new AbortController();
    const signal = installController.signal;
    publish({ status: 'downloading', error: null, errorDetail: null, progress: 0 });
    installPending = (async () => {
      try {
        await installer.prepare(
          snapshot(),
          (progress) => {
            if (!stopped && !signal.aborted)
              publish({ progress: Math.max(0, Math.min(1, progress)) });
          },
          signal,
        );
        if (!stopped && !signal.aborted)
          publish({ status: 'ready', error: null, errorDetail: null, progress: 1 });
      } catch (error) {
        if (!stopped)
          publish(
            signal.aborted
              ? { status: 'available', error: null, errorDetail: null, progress: null }
              : {
                  status: 'error',
                  error: ['unsupported', 'UNSUPPORTED_UPDATE'].includes(error.code)
                    ? 'unsupported'
                    : 'install',
                  errorDetail: errorDetail(error),
                  progress: null,
                },
          );
      } finally {
        installController = null;
      }
      return snapshot();
    })().finally(() => {
      installPending = null;
    });
    return installPending;
  }
  function check() {
    if (stopped) return Promise.resolve(snapshot());
    if (installPending) return installPending;
    if (state.status === 'ready') return Promise.resolve(snapshot());
    if (pending) return pending;
    pending = (async () => {
      controller = new AbortController();
      const timeout = setTimer(() => controller.abort(), 15000);
      publish({ status: 'checking', error: null, errorDetail: null });
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
        publish({ ...info, checkedAt: now(), error: null, errorDetail: null });
        await persist();
        clearTimer(timeout);
        if (state.automatic && state.status === 'available' && installer?.supported)
          await install({ automatic: true });
      } catch (error) {
        if (!stopped)
          publish({
            status: 'error',
            error: ['rate-limit', 'invalid-release'].includes(error.message)
              ? error.message
              : 'network',
            errorDetail: null,
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
    install,
    installOnQuit() {
      if (state.status === 'ready' && (state.automatic || manualInstall))
        return installer?.installOnQuit();
      return false;
    },
    setAutomatic(value) {
      if (typeof value !== 'boolean') throw Error('Invalid automatic update setting');
      publish({ automatic: value });
      if (!value && !manualInstall) {
        installController?.abort();
        if (state.status === 'ready') publish({ status: 'available', progress: null });
      }
      if (value && state.status === 'available' && installer?.supported)
        void install({ automatic: true });
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
      installController?.abort();
    },
  };
}
