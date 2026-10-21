<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { uiLanguage } from '../../i18n/index.mjs';
import { AppButton } from '../../ui/controls.mjs';

const POLL_INTERVAL_MS = 5000;
const popoverId = 'companion-connections-popover';

const labels = {
  en: {
    button: 'Show connected devices',
    title: 'Connected devices',
    close: 'Close connected devices',
    connected: 'Connected',
    translating: 'Translating',
    remoteDevice: 'Remote device',
    address: 'IP address',
    client: 'Client',
    connectedAt: 'Connected',
    lastActive: 'Last active',
  },
  'zh-CN': {
    button: '显示已连接设备',
    title: '已连接设备',
    close: '关闭已连接设备',
    connected: '已连接',
    translating: '翻译中',
    remoteDevice: '远程设备',
    address: 'IP 地址',
    client: '客户端',
    connectedAt: '连接时间',
    lastActive: '最近活动',
  },
  'zh-TW': {
    button: '顯示已連線裝置',
    title: '已連線裝置',
    close: '關閉已連線裝置',
    connected: '已連線',
    translating: '翻譯中',
    remoteDevice: '遠端裝置',
    address: 'IP 位址',
    client: '客戶端',
    connectedAt: '連線時間',
    lastActive: '最近活動',
  },
};

const companionConnections = ref([]);
const popover = ref(null);
const trigger = ref(null);
const container = ref(null);
const popoverOpen = ref(false);
const text = computed(() => labels[uiLanguage.value] || labels.en);
const nativePopoverSupported =
  typeof HTMLElement !== 'undefined' && typeof HTMLElement.prototype.showPopover === 'function';

let pollTimer;
let requestInFlight = false;
let disposed = false;
let restoreFocusOnClose = true;

function normalizeConnections(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((connection) => connection && typeof connection === 'object')
    .map((connection, index) => ({
      ...connection,
      key: String(connection.id || connection.address || connection.name || index),
      name: typeof connection.name === 'string' ? connection.name.trim() : '',
      address: typeof connection.address === 'string' ? connection.address.trim() : '',
      userAgent: typeof connection.userAgent === 'string' ? connection.userAgent.trim() : '',
      activeJobs: Number.isFinite(Number(connection.activeJobs))
        ? Math.max(0, Number(connection.activeJobs))
        : 0,
    }));
}

function localizedTime(value) {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '—';
  try {
    return new Intl.DateTimeFormat(uiLanguage.value, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(timestamp));
  } catch {
    return new Date(timestamp).toLocaleString(uiLanguage.value);
  }
}

function restoreFocus() {
  if (disposed || !companionConnections.value.length) return;
  void nextTick(() => {
    const button = container.value?.querySelector('.companion-button');
    if (typeof button?.focus === 'function') button.focus();
    else trigger.value?.focus?.();
  });
}

function handlePopoverToggle(event) {
  popoverOpen.value = event.newState === 'open';
  if (event.newState !== 'open' && restoreFocusOnClose) restoreFocus();
  restoreFocusOnClose = true;
}

function closePopover({ returnFocus = true } = {}) {
  restoreFocusOnClose = returnFocus;
  if (nativePopoverSupported && popover.value?.hidePopover && popoverOpen.value) {
    try {
      popover.value.hidePopover();
      return;
    } catch {
      // Fall through to the state-based fallback when the native popover is unavailable.
    }
  }
  popoverOpen.value = false;
  if (returnFocus) restoreFocus();
}

function togglePopover() {
  if (!popover.value) return;
  if (popoverOpen.value) {
    closePopover();
    return;
  }
  if (nativePopoverSupported && popover.value.showPopover) {
    try {
      popover.value.showPopover();
      popoverOpen.value = true;
      return;
    } catch {
      // Fall through to the state-based fallback when the native popover is unavailable.
    }
  }
  popoverOpen.value = true;
}

function handleDocumentPointerDown(event) {
  if (!popoverOpen.value || container.value?.contains(event.target)) return;
  closePopover({ returnFocus: false });
}

function handleDocumentKeydown(event) {
  if (event.key !== 'Escape' || !popoverOpen.value) return;
  event.preventDefault();
  closePopover();
}

async function refreshConnections() {
  if (disposed || requestInFlight) return;
  const api = typeof window === 'undefined' ? undefined : window.previewCompanion;
  if (typeof api?.connections !== 'function') {
    closePopover({ returnFocus: false });
    companionConnections.value = [];
    return;
  }

  requestInFlight = true;
  try {
    const nextConnections = normalizeConnections(await api.connections());
    if (!disposed) companionConnections.value = nextConnections;
  } catch {
    if (!disposed) {
      closePopover({ returnFocus: false });
      companionConnections.value = [];
    }
  } finally {
    requestInFlight = false;
  }
}

watch(companionConnections, (connections) => {
  if (!connections.length) closePopover({ returnFocus: false });
});

onMounted(() => {
  void refreshConnections();
  pollTimer = window.setInterval(() => void refreshConnections(), POLL_INTERVAL_MS);
  document.addEventListener('pointerdown', handleDocumentPointerDown, true);
  document.addEventListener('keydown', handleDocumentKeydown, true);
});

onBeforeUnmount(() => {
  disposed = true;
  if (pollTimer) window.clearInterval(pollTimer);
  document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
  document.removeEventListener('keydown', handleDocumentKeydown, true);
  closePopover({ returnFocus: false });
});
</script>

<template>
  <div v-if="companionConnections.length" ref="container" class="companion-connections">
    <AppButton
      ref="trigger"
      class="icon-button companion-button"
      :aria-label="text.button"
      aria-haspopup="dialog"
      :aria-expanded="popoverOpen"
      :aria-controls="popoverId"
      :title="text.button"
      @click="togglePopover"
    >
      <span
        class="system-icon"
        aria-hidden="true"
        data-symbol="iphone"
        style="--symbol: url('/symbols/iphone.png')"
      ></span>
      <span class="companion-status-dot" aria-hidden="true"></span>
    </AppButton>

    <section
      :id="popoverId"
      ref="popover"
      class="companion-connections-popover"
      popover="auto"
      role="dialog"
      :aria-label="text.title"
      :data-fallback-open="nativePopoverSupported ? undefined : popoverOpen"
      @toggle="handlePopoverToggle"
    >
      <header class="companion-connections-header">
        <h2>{{ text.title }}</h2>
        <button type="button" :aria-label="text.close" @click="closePopover()">×</button>
      </header>
      <ul class="companion-device-list">
        <li
          v-for="connection in companionConnections"
          :key="connection.key"
          class="companion-device"
        >
          <div class="companion-device-heading">
            <strong>{{ connection.name || text.remoteDevice }}</strong>
            <span class="companion-device-state">
              <span class="companion-state-dot" aria-hidden="true"></span>
              {{ connection.activeJobs ? text.translating : text.connected }}
            </span>
          </div>
          <dl>
            <div v-if="connection.address">
              <dt>{{ text.address }}</dt>
              <dd>{{ connection.address }}</dd>
            </div>
            <div v-if="connection.userAgent">
              <dt>{{ text.client }}</dt>
              <dd :title="connection.userAgent">{{ connection.userAgent }}</dd>
            </div>
            <div>
              <dt>{{ text.connectedAt }}</dt>
              <dd>{{ localizedTime(connection.connectedAt) }}</dd>
            </div>
            <div>
              <dt>{{ text.lastActive }}</dt>
              <dd>{{ localizedTime(connection.lastSeenAt || connection.connectedAt) }}</dd>
            </div>
          </dl>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.companion-connections {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
  -webkit-app-region: no-drag;
}

.companion-connections :deep(.companion-button) {
  position: relative;
}

.companion-connections :deep(.companion-button .system-icon) {
  width: 18px;
  height: 18px;
}

.companion-status-dot,
.companion-state-dot {
  display: inline-block;
  border-radius: 50%;
  background: var(--success);
}

.companion-status-dot {
  position: absolute;
  right: 6px;
  bottom: 6px;
  width: 6px;
  height: 6px;
  border: 1.5px solid var(--chrome-solid);
}

.companion-connections-popover {
  position: fixed;
  inset: calc(var(--toolbar-height) + 10px) 14px auto auto;
  z-index: 30;
  width: min(340px, calc(100vw - 28px));
  max-height: calc(100dvh - var(--toolbar-height) - var(--statusbar-height) - 24px);
  margin: 0;
  padding: 14px;
  overflow: auto;
  color: var(--text);
  background: var(--chrome);
  border: 1px solid var(--chrome-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-popover);
  -webkit-app-region: no-drag;
  -webkit-backdrop-filter: blur(20px) saturate(1.25);
  backdrop-filter: blur(20px) saturate(1.25);
}

.companion-connections-popover:not([popover]) {
  display: none;
}

.companion-connections-popover[data-fallback-open='false'] {
  display: none;
}

:global(
    :is(
      .reduced-transparency,
      [data-reduced-transparency='true'],
      [data-reduce-transparency='true']
    )
  )
  .companion-connections-popover {
  background: var(--chrome-solid);
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

.companion-connections-header,
.companion-device-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.companion-connections-header {
  padding-bottom: 8px;
}

.companion-connections-header h2 {
  margin: 0;
  color: var(--text);
  font-size: 14px;
  font-weight: 650;
  letter-spacing: -0.015em;
}

.companion-connections-header button {
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  padding: 0;
  color: var(--text-secondary);
  background: transparent;
  border: 0;
  border-radius: 6px;
  font-size: 18px;
  line-height: 1;
}

.companion-connections-header button:hover {
  color: var(--text);
  background: var(--chrome-hover);
}

.companion-device-list {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.companion-device {
  display: grid;
  gap: 8px;
  padding-top: 10px;
  border-top: 1px solid var(--chrome-divider);
}

.companion-device-heading strong {
  min-width: 0;
  overflow: hidden;
  color: var(--text);
  font-size: 12px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.companion-device-state {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 5px;
  color: var(--text-tertiary);
  font-size: 11px;
  white-space: nowrap;
}

.companion-state-dot {
  width: 6px;
  height: 6px;
}

.companion-device dl {
  display: grid;
  gap: 4px;
  margin: 0;
}

.companion-device dl > div {
  display: grid;
  grid-template-columns: minmax(76px, auto) minmax(0, 1fr);
  gap: 10px;
  color: var(--text-secondary);
  font-size: 11px;
  line-height: 1.35;
}

.companion-device dt,
.companion-device dd {
  min-width: 0;
  margin: 0;
}

.companion-device dt {
  color: var(--text-tertiary);
}

.companion-device dd {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:global(.reduced-transparency .companion-connections-popover),
:global([data-reduce-transparency='true'] .companion-connections-popover) {
  background: var(--chrome-solid);
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
}

@media (prefers-reduced-transparency: reduce) {
  .companion-connections-popover {
    background: var(--chrome-solid);
    -webkit-backdrop-filter: none;
    backdrop-filter: none;
  }
}
</style>
