<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { AppButton, AppSwitch } from '../../ui/controls.mjs';
import { uiLanguage } from '../../i18n/index.mjs';

const localLabels = {
  en: {
    status: 'Update status',
    automatic: 'Automatically check for updates',
    automaticHint:
      'Checks lazily 30 seconds after launch, then every 6 hours. Install updates manually.',
    check: 'Check for updates',
    checking: 'Checking…',
    idle: 'Not checked yet',
    noRelease: 'No releases available.',
    upToDate: 'You’re up to date.',
    available: 'Update available · {version}',
    networkError: 'Couldn’t check for updates.',
    rateLimitError: 'The update service is rate limited.',
    invalidReleaseError: 'The latest release is unavailable.',
    unavailable: 'Update checks unavailable.',
    lastChecked: 'Last checked',
    neverChecked: 'Not checked yet',
    latest: 'Latest version {version}',
    download: 'Download update',
    release: 'View release',
    openError: 'Could not open the release.',
  },
  'zh-CN': {
    status: '更新状态',
    automatic: '自动检查更新',
    automaticHint: '启动后 30 秒进行首次检查，之后每 6 小时检查一次。更新需手动安装。',
    check: '检查更新',
    checking: '正在检查…',
    idle: '尚未检查',
    noRelease: '暂无可用版本。',
    upToDate: '已是最新版本。',
    available: '发现新版本 · {version}',
    networkError: '无法检查更新。',
    rateLimitError: '更新服务请求过于频繁。',
    invalidReleaseError: '最新版本信息不可用。',
    unavailable: '更新检查不可用。',
    lastChecked: '上次检查',
    neverChecked: '尚未检查',
    latest: '最新版本 {version}',
    download: '下载更新',
    release: '查看发布页面',
    openError: '无法打开发布页面。',
  },
  'zh-TW': {
    status: '更新狀態',
    automatic: '自動檢查更新',
    automaticHint: '啟動後 30 秒進行首次檢查，之後每 6 小時檢查一次。更新需手動安裝。',
    check: '檢查更新',
    checking: '正在檢查…',
    idle: '尚未檢查',
    noRelease: '目前沒有可用版本。',
    upToDate: '已是最新版本。',
    available: '發現新版本 · {version}',
    networkError: '無法檢查更新。',
    rateLimitError: '更新服務請求過於頻繁。',
    invalidReleaseError: '最新版本資訊無法取得。',
    unavailable: '更新檢查無法使用。',
    lastChecked: '上次檢查',
    neverChecked: '尚未檢查',
    latest: '最新版本 {version}',
    download: '下載更新',
    release: '查看發佈頁面',
    openError: '無法開啟發佈頁面。',
  },
  ja: {
    status: 'アップデート状況',
    automatic: 'アップデートを自動で確認',
    automaticHint:
      '起動後 30 秒で最初に確認し、その後は 6 時間ごとに確認します。インストールは手動です。',
    check: 'アップデートを確認',
    checking: '確認中…',
    idle: '未確認',
    noRelease: '利用可能なリリースはありません。',
    upToDate: '最新版です。',
    available: '新しいバージョンがあります · {version}',
    networkError: 'アップデートを確認できませんでした。',
    rateLimitError: 'アップデートサービスの利用制限に達しました。',
    invalidReleaseError: '最新リリースを利用できません。',
    unavailable: 'アップデート確認を利用できません。',
    lastChecked: '最終確認',
    neverChecked: '未確認',
    latest: '最新バージョン {version}',
    download: 'アップデートをダウンロード',
    release: 'リリースページを表示',
    openError: 'リリースページを開けませんでした。',
  },
  ko: {
    status: '업데이트 상태',
    automatic: '업데이트 자동 확인',
    automaticHint:
      '시작 후 30초 뒤 처음 확인하고, 이후 6시간마다 확인합니다. 설치는 수동으로 진행합니다.',
    check: '업데이트 확인',
    checking: '확인 중…',
    idle: '확인하지 않음',
    noRelease: '사용 가능한 릴리스가 없습니다.',
    upToDate: '최신 버전입니다.',
    available: '새 버전 있음 · {version}',
    networkError: '업데이트를 확인할 수 없습니다.',
    rateLimitError: '업데이트 서비스 요청 한도에 도달했습니다.',
    invalidReleaseError: '최신 릴리스를 사용할 수 없습니다.',
    unavailable: '업데이트 확인을 사용할 수 없습니다.',
    lastChecked: '마지막 확인',
    neverChecked: '확인하지 않음',
    latest: '최신 버전 {version}',
    download: '업데이트 다운로드',
    release: '릴리스 페이지 보기',
    openError: '릴리스 페이지를 열 수 없습니다.',
  },
  fr: {
    status: 'État des mises à jour',
    automatic: 'Rechercher automatiquement les mises à jour',
    automaticHint:
      'Première recherche 30 secondes après le démarrage, puis toutes les 6 heures. Installation manuelle.',
    check: 'Rechercher les mises à jour',
    checking: 'Vérification…',
    idle: 'Pas encore vérifié',
    noRelease: 'Aucune version disponible.',
    upToDate: 'Vous utilisez la dernière version.',
    available: 'Nouvelle version disponible · {version}',
    networkError: 'Impossible de rechercher les mises à jour.',
    rateLimitError: 'La limite du service de mise à jour est atteinte.',
    invalidReleaseError: 'La dernière version est indisponible.',
    unavailable: 'Recherche de mises à jour indisponible.',
    lastChecked: 'Dernière recherche',
    neverChecked: 'Pas encore vérifié',
    latest: 'Dernière version {version}',
    download: 'Télécharger la mise à jour',
    release: 'Voir la version publiée',
    openError: 'Impossible d’ouvrir la version publiée.',
  },
  es: {
    status: 'Estado de las actualizaciones',
    automatic: 'Buscar actualizaciones automáticamente',
    automaticHint:
      'Primera búsqueda 30 segundos después del inicio y después cada 6 horas. La instalación es manual.',
    check: 'Buscar actualizaciones',
    checking: 'Comprobando…',
    idle: 'Aún no se ha comprobado',
    noRelease: 'No hay ninguna versión disponible.',
    upToDate: 'Ya tienes la última versión.',
    available: 'Nueva versión disponible · {version}',
    networkError: 'No se pudieron buscar actualizaciones.',
    rateLimitError: 'Se alcanzó el límite del servicio de actualizaciones.',
    invalidReleaseError: 'La última versión no está disponible.',
    unavailable: 'La búsqueda de actualizaciones no está disponible.',
    lastChecked: 'Última comprobación',
    neverChecked: 'Aún no se ha comprobado',
    latest: 'Última versión {version}',
    download: 'Descargar actualización',
    release: 'Ver versión publicada',
    openError: 'No se pudo abrir la versión publicada.',
  },
};

const statuses = new Set(['idle', 'checking', 'no-release', 'up-to-date', 'available', 'error']);
const errors = new Set(['network', 'rate-limit', 'invalid-release']);
const initialState = {
  status: 'idle',
  currentVersion: '',
  latestVersion: null,
  automatic: true,
  checkedAt: null,
  error: null,
  releaseUrl: null,
  downloadUrl: null,
};
const state = ref({ ...initialState }),
  bridgeAvailable = ref(false),
  operationError = ref(''),
  checkBusy = ref(false),
  automaticBusy = ref(false),
  releaseBusy = ref(false);
let updatesBridge = null,
  unsubscribe = null,
  disposed = false,
  changeSequence = 0,
  statusRequest = 0,
  checkRequest = 0,
  automaticRequest = 0,
  releaseRequest = 0;

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
    releaseUrl: typeof value.releaseUrl === 'string' && value.releaseUrl ? value.releaseUrl : null,
    downloadUrl:
      typeof value.downloadUrl === 'string' && value.downloadUrl ? value.downloadUrl : null,
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
    }[error] || 'networkError'
  );
}
function applyFailure(error, base = state.value) {
  const kind = errorKind(error);
  operationError.value = kind;
  state.value = { ...normalize(base), status: 'error', error: kind };
}
function receiveState(value) {
  if (disposed) return;
  changeSequence++;
  operationError.value = '';
  state.value = normalize(value);
}
function setResolvedState(value) {
  operationError.value = '';
  state.value = normalize(value);
}

const visibleError = computed(() => operationError.value || state.value.error);
const statusText = computed(() => {
  if (!bridgeAvailable.value) return local('unavailable');
  if (visibleError.value) return text(errorLabel(visibleError.value));
  if (state.value.status === 'checking') return local('checking');
  if (state.value.status === 'no-release') return local('noRelease');
  if (state.value.status === 'up-to-date') return local('upToDate');
  if (state.value.status === 'available')
    return text('available', { version: state.value.latestVersion || '—' });
  return local('idle');
});
const displayStatus = computed(() =>
  !bridgeAvailable.value ? 'unavailable' : visibleError.value ? 'error' : state.value.status,
);
const checkLabel = computed(() =>
  state.value.status === 'checking' || checkBusy.value ? local('checking') : local('check'),
);
const updateAvailable = computed(
  () =>
    state.value.status === 'available' &&
    Boolean(state.value.releaseUrl || state.value.downloadUrl),
);
const releaseLabel = computed(() =>
  state.value.downloadUrl ? local('download') : local('release'),
);
const checkedDate = computed(() => {
  if (!Number.isFinite(state.value.checkedAt)) return null;
  const value = new Date(state.value.checkedAt);
  return Number.isNaN(value.getTime()) ? null : value;
});
const checkedAtLabel = computed(() => {
  const date = checkedDate.value;
  if (!date) return local('neverChecked');
  try {
    return new Intl.DateTimeFormat(uiLanguage.value, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
});
const checkedAtISO = computed(() => checkedDate.value?.toISOString() || undefined);

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
  if (!updates || checkBusy.value || automaticBusy.value || state.value.status === 'checking')
    return;
  const request = ++checkRequest,
    observedChanges = changeSequence;
  checkBusy.value = true;
  operationError.value = '';
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
const releaseError = ref(false);
async function openRelease() {
  const updates = updatesBridge;
  if (!updates || releaseBusy.value || !updateAvailable.value) return;
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
        <span class="update-status-value" role="status" aria-live="polite">{{ statusText }}</span>
        <AppButton
          size="small"
          :disabled="!bridgeAvailable || checkBusy || automaticBusy || state.status === 'checking'"
          :aria-busy="checkBusy || state.status === 'checking'"
          :aria-label="checkLabel"
          @click="checkUpdates"
          >{{ checkLabel }}</AppButton
        >
      </div>
    </div>
    <div class="update-meta-row">
      <span>{{ local('lastChecked') }}</span>
      <time v-if="checkedAtISO" :datetime="checkedAtISO">{{ checkedAtLabel }}</time>
      <span v-else>{{ checkedAtLabel }}</span>
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
    <p class="update-hint muted">{{ local('automaticHint') }}</p>
    <div v-if="updateAvailable" class="update-available-row">
      <span class="update-version">{{
        text('latest', { version: state.latestVersion || '—' })
      }}</span>
      <AppButton
        size="small"
        :disabled="releaseBusy"
        :aria-busy="releaseBusy"
        @click="openRelease"
        >{{ releaseBusy ? local('checking') : releaseLabel }}</AppButton
      >
    </div>
    <p v-if="releaseError" class="update-error muted" role="alert">{{ local('openError') }}</p>
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
.update-status-value {
  min-width: 0;
  color: var(--text-secondary);
  text-align: right;
  overflow-wrap: anywhere;
}
.update-status-side :deep(.macvue-button) {
  flex: none;
}
.update-meta-row {
  display: flex;
  justify-content: flex-end;
  gap: 4px;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.35;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.update-meta-row time {
  white-space: nowrap;
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
.update-available-row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  min-width: 0;
  padding-top: 3px;
}
.update-version {
  min-width: 0;
  color: var(--text-secondary);
  font-size: 11px;
  overflow-wrap: anywhere;
  text-align: right;
}
.update-available-row :deep(.macvue-button) {
  flex: none;
}
.update-error {
  margin: 0;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.35;
  text-align: right;
}
@media (max-width: 480px) {
  .update-status-row {
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .update-status-side {
    max-width: 100%;
    width: 100%;
    justify-content: space-between;
  }
  .update-meta-row {
    justify-content: flex-start;
    text-align: left;
  }
  .update-available-row {
    justify-content: space-between;
  }
  .update-version {
    text-align: left;
  }
}
</style>
