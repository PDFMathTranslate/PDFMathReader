<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { AppButton, AppSwitch } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';

const localLabels = {
  en: {
    status: 'Update status',
    automatic: 'Automatically check and install updates',
    automaticHintSupported:
      'Checks lazily 30 seconds after launch, then every 6 hours. Downloads updates automatically and installs them when you quit normally.',
    automaticHintUnsupported:
      'Checks lazily 30 seconds after launch, then every 6 hours. Automatic installation is unavailable on this platform; open the release page to update manually.',
    check: 'Check for updates',
    checking: 'Checking…',
    idle: 'Not checked yet',
    noRelease: 'No releases available.',
    upToDate: 'You’re up to date.',
    latest: 'Latest',
    latestVersion: 'Latest version {version}.',
    available: 'Update available · {version}',
    install: 'Install update',
    installing: 'Installing…',
    downloading: 'Downloading… {progress}%',
    ready: 'Install on exit',
    retry: 'Retry',
    networkError: 'Couldn’t check for updates.',
    rateLimitError: 'The update service is rate limited.',
    invalidReleaseError: 'The latest release is unavailable.',
    downloadError: 'Couldn’t download the update.',
    installError: 'Couldn’t install the update.',
    unsupportedError: 'Automatic installation is unavailable on this platform.',
    unavailable: 'Update checks unavailable.',
    release: 'View release',
    opening: 'Opening…',
    openError: 'Could not open the release.',
    retryStatus: 'Retry: {status}',
  },
  'zh-CN': {
    status: '更新状态',
    automatic: '自动检查并安装更新',
    automaticHintSupported:
      '启动后 30 秒进行首次检查，之后每 6 小时检查一次。更新会自动下载，并在正常退出时安装。',
    automaticHintUnsupported:
      '启动后 30 秒进行首次检查，之后每 6 小时检查一次。此平台不支持自动安装，请打开发布页面手动更新。',
    check: '检查更新',
    checking: '正在检查…',
    idle: '尚未检查',
    noRelease: '暂无可用版本。',
    upToDate: '已是最新版本。',
    latest: '最新',
    latestVersion: '最新版本 {version}。',
    available: '发现新版本 · {version}',
    install: '安装更新',
    installing: '正在安装…',
    downloading: '正在下载… {progress}%',
    ready: '退出时安装',
    retry: '重试',
    networkError: '无法检查更新。',
    rateLimitError: '更新服务请求过于频繁。',
    invalidReleaseError: '最新版本信息不可用。',
    downloadError: '无法下载更新。',
    installError: '无法安装更新。',
    unsupportedError: '此平台不支持自动安装。',
    unavailable: '更新检查不可用。',
    release: '查看发布页面',
    opening: '正在打开…',
    openError: '无法打开发布页面。',
    retryStatus: '重试：{status}',
  },
  'zh-TW': {
    status: '更新狀態',
    automatic: '自動檢查並安裝更新',
    automaticHintSupported:
      '啟動後 30 秒進行首次檢查，之後每 6 小時檢查一次。更新會自動下載，並在正常結束時安裝。',
    automaticHintUnsupported:
      '啟動後 30 秒進行首次檢查，之後每 6 小時檢查一次。此平台不支援自動安裝，請開啟發佈頁面手動更新。',
    check: '檢查更新',
    checking: '正在檢查…',
    idle: '尚未檢查',
    noRelease: '目前沒有可用版本。',
    upToDate: '已是最新版本。',
    latest: '最新',
    latestVersion: '最新版本 {version}。',
    available: '發現新版本 · {version}',
    install: '安裝更新',
    installing: '正在安裝…',
    downloading: '正在下載… {progress}%',
    ready: '結束時安裝',
    retry: '重試',
    networkError: '無法檢查更新。',
    rateLimitError: '更新服務請求過於頻繁。',
    invalidReleaseError: '最新版本資訊無法取得。',
    downloadError: '無法下載更新。',
    installError: '無法安裝更新。',
    unsupportedError: '此平台不支援自動安裝。',
    unavailable: '更新檢查無法使用。',
    release: '查看發佈頁面',
    opening: '正在開啟…',
    openError: '無法開啟發佈頁面。',
    retryStatus: '重試：{status}',
  },
  ja: {
    status: 'アップデート状況',
    automatic: 'アップデートを自動で確認してインストール',
    automaticHintSupported:
      '起動後 30 秒で最初に確認し、その後は 6 時間ごとに確認します。アップデートは自動でダウンロードし、通常終了時にインストールします。',
    automaticHintUnsupported:
      '起動後 30 秒で最初に確認し、その後は 6 時間ごとに確認します。このプラットフォームでは自動インストールを利用できません。リリースページを開いて手動で更新してください。',
    check: 'アップデートを確認',
    checking: '確認中…',
    idle: '未確認',
    noRelease: '利用可能なリリースはありません。',
    upToDate: '最新版です。',
    latest: '最新版',
    latestVersion: '最新バージョン {version}。',
    available: '新しいバージョンがあります · {version}',
    install: 'アップデートをインストール',
    installing: 'インストール中…',
    downloading: 'ダウンロード中… {progress}%',
    ready: '終了時にインストール',
    retry: '再試行',
    networkError: 'アップデートを確認できませんでした。',
    rateLimitError: 'アップデートサービスの利用制限に達しました。',
    invalidReleaseError: '最新リリースを利用できません。',
    downloadError: 'アップデートをダウンロードできませんでした。',
    installError: 'アップデートをインストールできませんでした。',
    unsupportedError: 'このプラットフォームでは自動インストールを利用できません。',
    unavailable: 'アップデート確認を利用できません。',
    release: 'リリースページを表示',
    opening: '開いています…',
    openError: 'リリースページを開けませんでした。',
    retryStatus: '再試行：{status}',
  },
  ko: {
    status: '업데이트 상태',
    automatic: '업데이트 자동 확인 및 설치',
    automaticHintSupported:
      '시작 후 30초 뒤 처음 확인하고 이후 6시간마다 확인합니다. 업데이트를 자동으로 다운로드하고 정상 종료할 때 설치합니다.',
    automaticHintUnsupported:
      '시작 후 30초 뒤 처음 확인하고 이후 6시간마다 확인합니다. 이 플랫폼에서는 자동 설치를 지원하지 않으므로 릴리스 페이지를 열어 수동으로 업데이트하세요.',
    check: '업데이트 확인',
    checking: '확인 중…',
    idle: '확인하지 않음',
    noRelease: '사용 가능한 릴리스가 없습니다.',
    upToDate: '최신 버전입니다.',
    latest: '최신',
    latestVersion: '최신 버전 {version}.',
    available: '새 버전 있음 · {version}',
    install: '업데이트 설치',
    installing: '설치 중…',
    downloading: '다운로드 중… {progress}%',
    ready: '종료 시 설치',
    retry: '다시 시도',
    networkError: '업데이트를 확인할 수 없습니다.',
    rateLimitError: '업데이트 서비스 요청 한도에 도달했습니다.',
    invalidReleaseError: '최신 릴리스를 사용할 수 없습니다.',
    downloadError: '업데이트를 다운로드할 수 없습니다.',
    installError: '업데이트를 설치할 수 없습니다.',
    unsupportedError: '이 플랫폼에서는 자동 설치를 지원하지 않습니다.',
    unavailable: '업데이트 확인을 사용할 수 없습니다.',
    release: '릴리스 페이지 보기',
    opening: '여는 중…',
    openError: '릴리스 페이지를 열 수 없습니다.',
    retryStatus: '다시 시도: {status}',
  },
  fr: {
    status: 'État des mises à jour',
    automatic: 'Rechercher et installer automatiquement les mises à jour',
    automaticHintSupported:
      'Première recherche 30 secondes après le démarrage, puis toutes les 6 heures. Les mises à jour sont téléchargées automatiquement et installées à la fermeture normale.',
    automaticHintUnsupported:
      'Première recherche 30 secondes après le démarrage, puis toutes les 6 heures. L’installation automatique n’est pas disponible sur cette plateforme ; ouvrez la version publiée pour mettre à jour manuellement.',
    check: 'Rechercher les mises à jour',
    checking: 'Vérification…',
    idle: 'Pas encore vérifié',
    noRelease: 'Aucune version disponible.',
    upToDate: 'Vous utilisez la dernière version.',
    latest: 'À jour',
    latestVersion: 'Dernière version {version}.',
    available: 'Nouvelle version disponible · {version}',
    install: 'Installer la mise à jour',
    installing: 'Installation…',
    downloading: 'Téléchargement… {progress}%',
    ready: 'Installer à la fermeture',
    retry: 'Réessayer',
    networkError: 'Impossible de rechercher les mises à jour.',
    rateLimitError: 'La limite du service de mise à jour est atteinte.',
    invalidReleaseError: 'La dernière version est indisponible.',
    downloadError: 'Impossible de télécharger la mise à jour.',
    installError: 'Impossible d’installer la mise à jour.',
    unsupportedError: 'L’installation automatique n’est pas disponible sur cette plateforme.',
    unavailable: 'Recherche de mises à jour indisponible.',
    release: 'Voir la version publiée',
    opening: 'Ouverture…',
    openError: 'Impossible d’ouvrir la version publiée.',
    retryStatus: 'Réessayer : {status}',
  },
  es: {
    status: 'Estado de las actualizaciones',
    automatic: 'Buscar e instalar actualizaciones automáticamente',
    automaticHintSupported:
      'Primera búsqueda 30 segundos después del inicio y después cada 6 horas. Las actualizaciones se descargan automáticamente y se instalan al salir normalmente.',
    automaticHintUnsupported:
      'Primera búsqueda 30 segundos después del inicio y después cada 6 horas. La instalación automática no está disponible en esta plataforma; abre la versión publicada para actualizar manualmente.',
    check: 'Buscar actualizaciones',
    checking: 'Comprobando…',
    idle: 'Aún no se ha comprobado',
    noRelease: 'No hay ninguna versión disponible.',
    upToDate: 'Ya tienes la última versión.',
    latest: 'Actualizado',
    latestVersion: 'Última versión {version}.',
    available: 'Nueva versión disponible · {version}',
    install: 'Instalar actualización',
    installing: 'Instalando…',
    downloading: 'Descargando… {progress}%',
    ready: 'Instalar al salir',
    retry: 'Reintentar',
    networkError: 'No se pudieron buscar actualizaciones.',
    rateLimitError: 'Se alcanzó el límite del servicio de actualizaciones.',
    invalidReleaseError: 'La última versión no está disponible.',
    downloadError: 'No se pudo descargar la actualización.',
    installError: 'No se pudo instalar la actualización.',
    unsupportedError: 'La instalación automática no está disponible en esta plataforma.',
    unavailable: 'La búsqueda de actualizaciones no está disponible.',
    release: 'Ver versión publicada',
    opening: 'Abriendo…',
    openError: 'No se pudo abrir la versión publicada.',
    retryStatus: 'Reintentar: {status}',
  },
};

const statuses = new Set([
  'idle',
  'checking',
  'no-release',
  'up-to-date',
  'available',
  'downloading',
  'ready',
  'error',
]);
const errors = new Set([
  'network',
  'rate-limit',
  'invalid-release',
  'download',
  'install',
  'unsupported',
]);
const initialState = {
  status: 'idle',
  currentVersion: '',
  latestVersion: null,
  automatic: true,
  checkedAt: null,
  error: null,
  errorDetail: null,
  releaseUrl: null,
  downloadUrl: null,
  progress: null,
  installSupported: false,
};
const state = ref({ ...initialState }),
  bridgeAvailable = ref(false),
  operationError = ref(''),
  checkBusy = ref(false),
  automaticBusy = ref(false),
  installBusy = ref(false),
  releaseBusy = ref(false);
let updatesBridge = null,
  unsubscribe = null,
  disposed = false,
  changeSequence = 0,
  statusRequest = 0,
  checkRequest = 0,
  automaticRequest = 0,
  installRequest = 0,
  releaseRequest = 0;
const releaseError = ref(false);

function local(key) {
  return localLabels[uiLanguage.value]?.[key] || localLabels.en[key] || key;
}
function text(key, values = {}) {
  return local(key).replace(/\{([A-Za-z0-9_]+)\}/g, (_, name) =>
    Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : `{${name}}`,
  );
}
function bridge() {
  const candidate = globalThis.window?.previewUpdates;
  return candidate &&
    ['status', 'check', 'setAutomatic', 'openRelease', 'onChange'].every(
      (method) => typeof candidate[method] === 'function',
    )
    ? candidate
    : null;
}
function normalize(raw) {
  const value = raw && typeof raw === 'object' ? raw : {};
  return {
    status: statuses.has(value.status) ? value.status : 'idle',
    currentVersion: typeof value.currentVersion === 'string' ? value.currentVersion : '',
    latestVersion: typeof value.latestVersion === 'string' ? value.latestVersion : null,
    automatic: typeof value.automatic === 'boolean' ? value.automatic : true,
    checkedAt: Number.isFinite(value.checkedAt) ? value.checkedAt : null,
    error: errors.has(value.error) ? value.error : null,
    errorDetail:
      typeof value.errorDetail === 'string' && value.errorDetail.trim() ? value.errorDetail : null,
    releaseUrl: typeof value.releaseUrl === 'string' && value.releaseUrl ? value.releaseUrl : null,
    downloadUrl:
      typeof value.downloadUrl === 'string' && value.downloadUrl ? value.downloadUrl : null,
    progress: Number.isFinite(value.progress)
      ? Math.min(1, Math.max(0, Number(value.progress)))
      : null,
    installSupported: value.installSupported === true,
  };
}
function errorKind(error) {
  const value = typeof error === 'string' ? error : error?.code || error?.message;
  return errors.has(value) ? value : 'network';
}
function errorLabel(error) {
  return (
    {
      network: 'networkError',
      'rate-limit': 'rateLimitError',
      'invalid-release': 'invalidReleaseError',
      download: 'downloadError',
      install: 'installError',
      unsupported: 'unsupportedError',
    }[error] || 'networkError'
  );
}
function applyFailure(error, base = state.value) {
  const kind = errorKind(error);
  operationError.value = kind;
  releaseError.value = false;
  state.value = { ...normalize(base), status: 'error', error: kind, progress: null };
}
function receiveState(value) {
  if (disposed) return;
  changeSequence++;
  operationError.value = '';
  releaseError.value = false;
  state.value = normalize(value);
}
function setResolvedState(value) {
  operationError.value = '';
  releaseError.value = false;
  state.value = normalize(value);
}

const visibleError = computed(() => operationError.value || state.value.error);
const installSupported = computed(
  () => state.value.installSupported && typeof updatesBridge?.install === 'function',
);
const hasRelease = computed(() => Boolean(state.value.releaseUrl || state.value.downloadUrl));
const retryInstall = computed(
  () =>
    state.value.status === 'error' &&
    hasRelease.value &&
    installSupported.value &&
    ['download', 'install'].includes(visibleError.value),
);
const progressPercent = computed(() =>
  Number.isFinite(state.value.progress) ? Math.round(state.value.progress * 100) : 0,
);
const statusText = computed(() => {
  if (releaseError.value) return local('openError');
  if (!bridgeAvailable.value) return local('unavailable');
  if (visibleError.value) {
    const label = text(errorLabel(visibleError.value));
    return visibleError.value === 'install' && state.value.errorDetail
      ? `${label} ${state.value.errorDetail}`
      : label;
  }
  if (state.value.status === 'checking') return local('checking');
  if (state.value.status === 'downloading')
    return text('downloading', { progress: progressPercent.value });
  if (state.value.status === 'ready') return local('ready');
  if (state.value.status === 'no-release') return local('noRelease');
  if (state.value.status === 'up-to-date')
    return text('latestVersion', { version: state.value.latestVersion || '—' });
  if (state.value.status === 'available')
    return text('available', { version: state.value.latestVersion || '—' });
  return local('idle');
});
const displayStatus = computed(() =>
  !bridgeAvailable.value || releaseError.value
    ? releaseError.value
      ? 'error'
      : 'unavailable'
    : visibleError.value
      ? 'error'
      : state.value.status,
);
const automaticHint = computed(() =>
  installSupported.value ? local('automaticHintSupported') : local('automaticHintUnsupported'),
);
const actionLabel = computed(() => {
  if (!bridgeAvailable.value) return local('unavailable');
  if (releaseError.value || visibleError.value) return local('retry');
  if (installBusy.value) return local('installing');
  if (releaseBusy.value) return local('opening');
  if (state.value.status === 'checking') return local('checking');
  if (state.value.status === 'downloading')
    return text('downloading', { progress: progressPercent.value });
  if (state.value.status === 'ready') return local('ready');
  if (state.value.status === 'up-to-date') return local('latest');
  if (state.value.status === 'available' && hasRelease.value)
    return installSupported.value ? local('install') : local('release');
  return local('check');
});
const actionTitle = computed(() => {
  if (!bridgeAvailable.value) return local('unavailable');
  if (releaseError.value || visibleError.value) return statusText.value;
  if (state.value.status === 'up-to-date') return statusText.value;
  if (state.value.status === 'available') return statusText.value;
  if (state.value.status === 'downloading') return statusText.value;
  if (state.value.status === 'ready') return statusText.value;
  if (state.value.status === 'no-release') return statusText.value;
  return actionLabel.value;
});
const actionAriaLabel = computed(() => {
  if (releaseError.value || visibleError.value)
    return text('retryStatus', { status: actionTitle.value });
  return actionLabel.value;
});
const actionDisabled = computed(
  () =>
    !bridgeAvailable.value ||
    checkBusy.value ||
    automaticBusy.value ||
    installBusy.value ||
    releaseBusy.value ||
    ['checking', 'downloading', 'ready'].includes(state.value.status),
);
const actionBusy = computed(
  () =>
    checkBusy.value ||
    installBusy.value ||
    releaseBusy.value ||
    ['checking', 'downloading'].includes(state.value.status),
);

async function loadStatus(updates) {
  const request = ++statusRequest,
    observedChanges = changeSequence;
  try {
    const result = await updates.status();
    if (disposed || request !== statusRequest || observedChanges !== changeSequence) return;
    setResolvedState(result);
  } catch (error) {
    if (!disposed && request === statusRequest && observedChanges === changeSequence)
      applyFailure(error);
  }
}
async function checkUpdates() {
  const updates = updatesBridge;
  if (
    !updates ||
    checkBusy.value ||
    automaticBusy.value ||
    installBusy.value ||
    releaseBusy.value ||
    state.value.status === 'checking'
  )
    return;
  const request = ++checkRequest,
    observedChanges = changeSequence;
  checkBusy.value = true;
  operationError.value = '';
  releaseError.value = false;
  state.value = { ...state.value, status: 'checking', error: null };
  try {
    const result = await updates.check();
    if (disposed || request !== checkRequest) return;
    if (observedChanges === changeSequence) setResolvedState(result);
  } catch (error) {
    if (!disposed && request === checkRequest && observedChanges === changeSequence)
      applyFailure(error);
  } finally {
    if (request === checkRequest) checkBusy.value = false;
  }
}
async function setAutomatic(value) {
  const updates = updatesBridge;
  if (!updates || automaticBusy.value) return;
  const next = Boolean(value),
    previous = state.value.automatic,
    request = ++automaticRequest,
    observedChanges = changeSequence;
  automaticBusy.value = true;
  operationError.value = '';
  releaseError.value = false;
  state.value = { ...state.value, automatic: next };
  try {
    const result = await updates.setAutomatic(next);
    if (disposed || request !== automaticRequest) return;
    if (observedChanges === changeSequence) setResolvedState(result);
  } catch (error) {
    if (!disposed && request === automaticRequest && observedChanges === changeSequence)
      applyFailure(error, { ...state.value, automatic: previous });
  } finally {
    if (request === automaticRequest) automaticBusy.value = false;
  }
}
async function installUpdate() {
  const updates = updatesBridge;
  if (
    !updates ||
    typeof updates.install !== 'function' ||
    !installSupported.value ||
    !hasRelease.value ||
    installBusy.value
  )
    return;
  const request = ++installRequest,
    observedChanges = changeSequence;
  installBusy.value = true;
  operationError.value = '';
  releaseError.value = false;
  try {
    const result = await updates.install();
    if (disposed || request !== installRequest) return;
    if (observedChanges === changeSequence && result) setResolvedState(result);
  } catch (error) {
    if (!disposed && request === installRequest && observedChanges === changeSequence)
      applyFailure(error);
  } finally {
    if (request === installRequest) installBusy.value = false;
  }
}
async function openRelease() {
  const updates = updatesBridge;
  if (!updates || releaseBusy.value || state.value.status !== 'available' || !hasRelease.value)
    return;
  const request = ++releaseRequest;
  releaseBusy.value = true;
  operationError.value = '';
  releaseError.value = false;
  try {
    await updates.openRelease();
  } catch {
    if (!disposed && request === releaseRequest) releaseError.value = true;
  } finally {
    if (request === releaseRequest) releaseBusy.value = false;
  }
}
async function performAction() {
  if (actionDisabled.value) return;
  if (releaseError.value) return openRelease();
  if (state.value.status === 'available' && hasRelease.value)
    return installSupported.value ? installUpdate() : openRelease();
  if (state.value.status === 'error' && retryInstall.value) return installUpdate();
  return checkUpdates();
}

onMounted(() => {
  disposed = false;
  const updates = bridge();
  if (!updates) return;
  updatesBridge = updates;
  bridgeAvailable.value = true;
  try {
    const stop = updates.onChange(receiveState);
    if (typeof stop === 'function') unsubscribe = stop;
  } catch (error) {
    operationError.value = errorKind(error);
  }
  void loadStatus(updates);
});
onBeforeUnmount(() => {
  disposed = true;
  statusRequest++;
  checkRequest++;
  automaticRequest++;
  installRequest++;
  releaseRequest++;
  try {
    unsubscribe?.();
  } catch {}
  unsubscribe = null;
  updatesBridge = null;
});
</script>

<template>
  <div class="app-update-status" :data-status="displayStatus">
    <div class="setting-row update-status-row">
      <span>{{ local('status') }}</span>
      <div class="update-status-side">
        <AppButton
          data-setting="app-update-action"
          size="small"
          :disabled="actionDisabled"
          :aria-busy="actionBusy"
          :aria-label="actionAriaLabel"
          :title="actionTitle"
          aria-live="polite"
          @click="performAction"
          >{{ actionLabel }}</AppButton
        >
      </div>
    </div>
    <div class="setting-row update-automatic-row">
      <span id="app-update-automatic-label">{{ local('automatic') }}</span>
      <AppSwitch
        :model-value="state.automatic"
        :disabled="!bridgeAvailable || automaticBusy"
        aria-labelledby="app-update-automatic-label"
        @update:model-value="setAutomatic"
      />
    </div>
    <p class="update-hint muted">{{ automaticHint }}</p>
  </div>
</template>

<style scoped>
.app-update-status {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.update-status-row {
  min-height: 30px;
  gap: 10px;
}
.update-status-side {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
  max-width: 72%;
}
.update-status-side :deep(.macvue-button) {
  flex: none;
}
.update-automatic-row {
  min-height: 30px;
  gap: 10px;
}
.update-hint {
  margin: 0;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.35;
}
@media (max-width: 480px) {
  .update-status-row {
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .update-status-side {
    max-width: 100%;
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
