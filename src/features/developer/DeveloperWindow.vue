<script setup>
import { computed, ref } from 'vue';
import DeveloperQuickTests from './DeveloperQuickTests.vue';
import DeveloperResourceSection from './DeveloperResourceSection.vue';
import { developerText } from '../../i18n/developer-locales.mjs';
import { useDeveloperEventLog } from './useDeveloperEventLog.mjs';
import { EMPTY_VALUE, useDeveloperFormatting } from './useDeveloperFormatting.mjs';
import { useDeveloperSnapshot } from './useDeveloperSnapshot.mjs';

const language = ref('en');

function text(key, values) {
  return developerText(language.value, key, values);
}

const {
  formatBytes,
  formatCount,
  formatCpu,
  formatProgress,
  formatTime,
  operationMetricRows,
  operationMetricText,
  rendererMetricRows,
  rendererText,
  sparklinePoints,
  stateKey,
} = useDeveloperFormatting({ language });

const {
  bridgeMissing,
  copied,
  copyDiagnostics,
  copyFailed,
  hasSample,
  lastUpdated,
  loading,
  primary,
  paused,
  refreshNow,
  refreshing,
  resourceCards,
  snapshotData,
  snapshotError,
  systemMemory,
  togglePaused,
  unavailableBackendProcesses,
} = useDeveloperSnapshot({ language, text });

const {
  activeTab,
  autoScroll,
  clearView,
  consoleViewport,
  hasCommands,
  hasEvents,
  hasTasks,
  kernelFilter,
  kernelOptions,
  processRows,
  searchQuery,
  taskCounts,
  visibleCommandCount,
  visibleCommands,
  visibleEventCount,
  visibleEvents,
  visibleTasks,
} = useDeveloperEventLog({ snapshotData, stateKey });

const sampleState = computed(() => {
  if (paused.value) return 'paused';
  if (refreshing.value) return 'refreshing';
  if (!snapshotData.value) return 'waiting';
  return 'live';
});
const sampleStateLabel = computed(() => text(`status.${sampleState.value}`));
const updatedLabel = computed(() =>
  lastUpdated.value ? text('status.updated', { time: formatTime(lastUpdated.value) }) : '',
);
</script>

<template>
  <main class="developer-window">
    <header class="developer-header">
      <div class="brand-lockup">
        <div class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div>
        <div>
          <h1>{{ text('app.title') }}</h1>
          <p>{{ text('app.subtitle') }}</p>
        </div>
      </div>

      <div class="header-actions">
        <div class="sample-status" :class="`sample-status--${sampleState}`" aria-live="polite">
          <span class="status-dot" aria-hidden="true"></span>
          <span>{{ sampleStateLabel }}</span>
          <span v-if="updatedLabel" class="updated-label">{{ updatedLabel }}</span>
        </div>
        <button
          class="icon-button"
          type="button"
          :aria-label="text('action.refresh')"
          :title="text('action.refresh')"
          @click="refreshNow"
        >
          <span aria-hidden="true">↻</span>
        </button>
        <button
          class="secondary-button"
          type="button"
          :title="text('action.copyDiagnostics')"
          @click="copyDiagnostics"
        >
          <span aria-hidden="true">⧉</span>
          <span>{{ copied ? text('action.copied') : text('action.copyDiagnostics') }}</span>
        </button>
        <button
          class="primary-button"
          type="button"
          :aria-pressed="paused"
          :title="paused ? text('action.resume') : text('action.pause')"
          @click="togglePaused"
        >
          <span aria-hidden="true">{{ paused ? '▶' : 'Ⅱ' }}</span>
          <span>{{ paused ? text('action.resume') : text('action.pause') }}</span>
        </button>
      </div>
    </header>

    <div v-if="snapshotError" class="error-banner" role="alert">
      <span class="error-icon" aria-hidden="true">!</span>
      <span>{{ bridgeMissing ? text('error.noBridge') : text('error.snapshot') }}</span>
      <button type="button" class="banner-action" @click="refreshNow">
        {{ text('action.refresh') }}
      </button>
    </div>
    <div v-if="copyFailed" class="copy-banner" role="status">{{ text('error.copy') }}</div>

    <DeveloperQuickTests :language="language" />

    <section v-if="hasSample" class="summary-strip" :aria-label="text('resources.title')">
      <div class="summary-stat">
        <span class="summary-label">{{ text('resources.cpu') }}</span>
        <strong>{{ formatCpu(primary.totalCpuPercent) }}</strong>
      </div>
      <div class="summary-stat">
        <span class="summary-label">{{ text('resources.rss') }}</span>
        <strong>{{ formatBytes(primary.totalRssBytes) }}</strong>
      </div>
      <div class="summary-stat">
        <span class="summary-label">{{ text('system.totalMemory') }}</span>
        <strong>{{ formatBytes(systemMemory.totalMemory) }}</strong>
      </div>
      <div class="summary-stat">
        <span class="summary-label">{{ text('system.freeMemory') }}</span>
        <strong>{{ formatBytes(systemMemory.freeMemory) }}</strong>
      </div>
      <div class="summary-stat">
        <span class="summary-label">{{ text('processes.title') }}</span>
        <strong>{{ formatCount(primary.processCount) }}</strong>
      </div>
      <div class="summary-stat">
        <span class="summary-label">{{ text('tasks.title') }}</span>
        <strong>{{ formatCount(primary.taskCount) }}</strong>
      </div>
    </section>

    <DeveloperResourceSection
      v-if="hasSample"
      :has-sample="hasSample"
      :primary="primary"
      :resource-cards="resourceCards"
      :unavailable-backend-processes="unavailableBackendProcesses"
      :text="text"
      :format-count="formatCount"
      :format-bytes="formatBytes"
      :format-cpu="formatCpu"
      :sparkline-points="sparklinePoints"
      :renderer-text="rendererText"
      :renderer-metric-rows="rendererMetricRows"
      :operation-metric-text="operationMetricText"
      :operation-metric-rows="operationMetricRows"
    />

    <section v-if="hasSample" class="panel console-panel">
      <div class="panel-heading console-heading">
        <div class="tab-list" role="tablist" :aria-label="text('app.title')">
          <button
            class="tab-button"
            :class="{ active: activeTab === 'console' }"
            role="tab"
            :aria-selected="activeTab === 'console'"
            type="button"
            @click="activeTab = 'console'"
          >
            {{ text('console.consoleTab') }}
          </button>
          <button
            class="tab-button"
            :class="{ active: activeTab === 'commands' }"
            role="tab"
            :aria-selected="activeTab === 'commands'"
            type="button"
            @click="activeTab = 'commands'"
          >
            {{ text('console.commandsTab') }}
          </button>
        </div>
        <div class="console-tools">
          <label class="search-field">
            <span class="search-icon" aria-hidden="true">⌕</span>
            <span class="sr-only">{{ text('console.search') }}</span>
            <input
              v-model="searchQuery"
              type="search"
              :placeholder="text('console.searchPlaceholder')"
            />
          </label>
          <label class="kernel-select">
            <span class="sr-only">{{ text('console.kernel') }}</span>
            <select v-model="kernelFilter">
              <option value="all">{{ text('console.allKernels') }}</option>
              <option v-for="kernel in kernelOptions" :key="kernel" :value="kernel">
                {{ kernel }}
              </option>
            </select>
          </label>
          <label class="toggle-control"
            ><input v-model="autoScroll" type="checkbox" /><span class="toggle-track"
              ><span></span></span
            ><span>{{ text('console.autoScroll') }}</span></label
          >
          <button
            class="small-button"
            type="button"
            :disabled="activeTab === 'console' ? !visibleEventCount : !visibleCommandCount"
            @click="clearView"
          >
            {{ text('action.clearView') }}
          </button>
        </div>
      </div>

      <div ref="consoleViewport" class="console-viewport">
        <table v-if="activeTab === 'console'" class="data-table console-table">
          <thead>
            <tr>
              <th>{{ text('events.time') }}</th>
              <th>{{ text('events.kind') }}</th>
              <th>{{ text('events.kernel') }}</th>
              <th>{{ text('events.pid') }}</th>
              <th>{{ text('events.backend') }}</th>
              <th>{{ text('events.message') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="event in visibleEvents" :key="event.key">
              <td class="time-cell">{{ formatTime(event.time) }}</td>
              <td>
                <span class="kind-pill">{{ event.kind }}</span>
              </td>
              <td class="mono-cell">{{ event.kernel || EMPTY_VALUE }}</td>
              <td class="mono-cell">{{ event.pid || EMPTY_VALUE }}</td>
              <td class="source-cell">{{ event.backend }}</td>
              <td class="message-cell" :title="event.message">
                {{ event.message || EMPTY_VALUE }}
              </td>
            </tr>
            <tr v-if="!visibleEvents.length" class="empty-row">
              <td colspan="6">
                <span class="empty-table-icon" aria-hidden="true">⌁</span
                >{{ hasEvents ? text('events.noMatch') : text('events.empty') }}
              </td>
            </tr>
          </tbody>
        </table>

        <table v-else class="data-table commands-table">
          <thead>
            <tr>
              <th>{{ text('commands.time') }}</th>
              <th>{{ text('commands.command') }}</th>
              <th>{{ text('commands.result') }}</th>
              <th>{{ text('commands.kernel') }}</th>
              <th>{{ text('commands.backend') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="command in visibleCommands" :key="command.rowKey">
              <td class="time-cell">{{ formatTime(command.time) }}</td>
              <td class="message-cell" :title="command.command">
                {{ command.command || EMPTY_VALUE }}
              </td>
              <td class="message-cell" :title="command.result">
                {{ command.result || EMPTY_VALUE }}
              </td>
              <td class="mono-cell">{{ command.kernel || EMPTY_VALUE }}</td>
              <td class="source-cell">{{ command.backend }}</td>
            </tr>
            <tr v-if="!visibleCommands.length" class="empty-row">
              <td colspan="5">
                <span class="empty-table-icon" aria-hidden="true">⌁</span
                >{{ hasCommands ? text('console.filterResults') : text('commands.empty') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="paused" class="panel-footnote">
        <span class="pause-mark" aria-hidden="true">Ⅱ</span>{{ text('console.pauseHint') }}
      </div>
    </section>

    <section v-if="hasSample" class="lower-grid">
      <section class="panel table-panel">
        <div class="panel-heading">
          <div>
            <h2>{{ text('processes.title') }}</h2>
            <span class="section-caption">{{ formatCount(processRows.length) }}</span>
          </div>
          <span class="panel-icon" aria-hidden="true">⌁</span>
        </div>
        <div class="table-scroll">
          <table class="data-table process-table">
            <thead>
              <tr>
                <th>{{ text('processes.pid') }}</th>
                <th>{{ text('processes.role') }}</th>
                <th>{{ text('processes.name') }}</th>
                <th>{{ text('processes.cpu') }}</th>
                <th>{{ text('processes.rss') }}</th>
                <th>{{ text('processes.source') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="process in processRows" :key="process.rowKey">
                <td class="mono-cell pid-cell">{{ process.pid || EMPTY_VALUE }}</td>
                <td>
                  <span class="role-badge" :class="`role-${process.role.replace(/\s+/g, '-')}`">{{
                    process.role
                  }}</span>
                </td>
                <td class="process-name" :title="process.command || process.name">
                  <details
                    v-if="process.command || process.cpuPercentBasis"
                    class="process-details"
                  >
                    <summary>{{ process.name }}</summary>
                    <div class="process-detail">
                      <span v-if="process.command" class="process-command">{{
                        process.command
                      }}</span>
                      <span v-if="process.cpuPercentBasis" class="process-cpu-basis">{{
                        process.cpuPercentBasis
                      }}</span>
                    </div>
                  </details>
                  <span v-else>{{ process.name }}</span>
                  <span v-if="process.kernel" class="process-kernel">{{ process.kernel }}</span>
                </td>
                <td class="numeric-cell" :title="process.cpuPercentBasis || text('resources.cpu')">
                  {{ formatCpu(process.cpuPercent) }}
                </td>
                <td class="numeric-cell">{{ formatBytes(process.rssBytes) }}</td>
                <td class="source-cell">{{ process.sourceTitle || text('resources.main') }}</td>
              </tr>
              <tr v-if="!processRows.length" class="empty-row">
                <td colspan="6">
                  <span class="empty-table-icon" aria-hidden="true">◌</span
                  >{{ text('processes.empty') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="panel table-panel">
        <div class="panel-heading">
          <div>
            <h2>{{ text('tasks.title') }}</h2>
            <span class="section-caption">{{ formatCount(visibleTasks.length) }}</span>
          </div>
          <div class="queue-counts">
            <span v-if="taskCounts.queued">{{ taskCounts.queued }} {{ text('state.queued') }}</span
            ><span v-if="taskCounts.running"
              >{{ taskCounts.running }} {{ text('state.running') }}</span
            ><span v-if="taskCounts.failed" class="queue-count--failed"
              >{{ taskCounts.failed }} {{ text('state.failed') }}</span
            ><span class="panel-icon" aria-hidden="true">◷</span>
          </div>
        </div>
        <div class="table-scroll">
          <table class="data-table task-table">
            <thead>
              <tr>
                <th>{{ text('tasks.id') }}</th>
                <th>{{ text('tasks.label') }}</th>
                <th>{{ text('tasks.kernel') }}</th>
                <th>{{ text('tasks.status') }}</th>
                <th>{{ text('tasks.progress') }}</th>
                <th>{{ text('tasks.page') }}</th>
                <th>{{ text('tasks.queuedAt') }}</th>
                <th>{{ text('tasks.startedAt') }}</th>
                <th>{{ text('tasks.backend') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="task in visibleTasks" :key="task.rowKey">
                <td class="mono-cell task-id">{{ task.id }}</td>
                <td :title="task.kind">{{ task.label || task.kind }}</td>
                <td class="mono-cell">{{ task.kernel || EMPTY_VALUE }}</td>
                <td>
                  <span class="task-state" :class="`task-state--${stateKey(task.status)}`">{{
                    text(`state.${stateKey(task.status)}`)
                  }}</span>
                </td>
                <td>
                  <div class="progress-cell">
                    <div class="progress-track">
                      <span
                        :style="{ width: `${task.progress === null ? 0 : task.progress}%` }"
                      ></span>
                    </div>
                    <span>{{ formatProgress(task.progress) }}</span>
                  </div>
                </td>
                <td class="mono-cell">
                  {{ task.page === null || task.page === undefined ? EMPTY_VALUE : task.page }}
                </td>
                <td class="time-cell">{{ formatTime(task.queuedAt) }}</td>
                <td class="time-cell">{{ formatTime(task.startedAt) }}</td>
                <td class="source-cell">{{ task.backend }}</td>
              </tr>
              <tr v-if="!visibleTasks.length" class="empty-row">
                <td colspan="9">
                  <span class="empty-table-icon" aria-hidden="true">◌</span
                  >{{ hasTasks ? text('tasks.noMatch') : text('tasks.empty') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </section>

    <section v-if="!hasSample && loading" class="standalone-state loading-state">
      <span class="loading-orbit" aria-hidden="true"></span>
      <h2>{{ text('status.waiting') }}</h2>
    </section>
    <section v-else-if="!hasSample" class="standalone-state empty-state">
      <div class="empty-illustration" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>
      <h2>{{ text('empty.title') }}</h2>
      <p>{{ text('empty.body') }}</p>
    </section>
  </main>
</template>

<style scoped>
:global(html),
:global(body),
:global(#app) {
  min-width: 760px;
  min-height: 560px;
  margin: 0;
}

:global(body) {
  overflow: hidden;
  background: #f4f5f8;
  color: #182132;
  font-family:
    -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', sans-serif;
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
}

:global(button),
:global(input),
:global(select) {
  font: inherit;
}

.developer-window {
  --dev-bg: #f5f5f7;
  --dev-panel: #fff;
  --dev-panel-solid: #fff;
  --dev-border: rgba(33, 45, 68, 0.1);
  --dev-border-strong: rgba(33, 45, 68, 0.16);
  --dev-text: #1d1d1f;
  --dev-muted: #636366;
  --dev-faint: #76767b;
  --dev-accent: #326bdf;
  --dev-accent-soft: #eaf0ff;
  --dev-shadow: 0 1px 3px rgba(0, 0, 0, 0.035);
  --dev-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  width: 100%;
  min-width: 760px;
  min-height: 560px;
  height: 100dvh;
  overflow: auto;
  padding: 26px 30px 34px;
  color: var(--dev-text);
  background: var(--dev-bg);
  color-scheme: light dark;
}

.developer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 26px;
  max-width: 1480px;
  margin: 0 auto 22px;
}
.brand-lockup {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 13px;
}
.brand-mark {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 3px;
  width: 38px;
  height: 38px;
  padding: 9px;
  border: 1px solid rgba(50, 107, 223, 0.16);
  border-radius: 12px;
  background: linear-gradient(145deg, #eef3ff, #dbe7ff);
  box-shadow:
    inset 0 1px rgba(255, 255, 255, 0.8),
    0 5px 13px rgba(50, 107, 223, 0.12);
}
.brand-mark span {
  width: 4px;
  border-radius: 4px;
  background: #4b7de1;
}
.brand-mark span:nth-child(1) {
  height: 11px;
  opacity: 0.58;
}
.brand-mark span:nth-child(2) {
  height: 17px;
}
.brand-mark span:nth-child(3) {
  height: 8px;
  opacity: 0.72;
}
h1,
h2,
p {
  margin: 0;
}
h1 {
  font-size: 20px;
  letter-spacing: -0.025em;
  font-weight: 700;
}
.brand-lockup p {
  margin-top: 3px;
  color: var(--dev-muted);
  font-size: 12px;
}
.header-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}
.sample-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 29px;
  margin-right: 3px;
  padding: 0 10px;
  border: 1px solid var(--dev-border);
  border-radius: 99px;
  color: #2c6b43;
  background: rgba(237, 251, 241, 0.78);
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
}
.status-dot,
.state-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 13%, transparent);
}
.sample-status--paused {
  color: #896316;
  background: rgba(255, 247, 224, 0.85);
}
.sample-status--refreshing .status-dot {
  animation: pulse-dot 1s ease-in-out infinite;
}
.sample-status--waiting {
  color: var(--dev-muted);
  background: rgba(128, 139, 158, 0.1);
}
.updated-label {
  color: inherit;
  opacity: 0.62;
  font-weight: 500;
}
.icon-button,
.secondary-button,
.primary-button,
.small-button,
.banner-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 30px;
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition:
    background-color 0.16s ease,
    border-color 0.16s ease,
    transform 0.16s ease;
}
.icon-button:hover,
.secondary-button:hover,
.primary-button:hover,
.small-button:hover,
.banner-action:hover {
  transform: none;
  background: color-mix(in srgb, var(--dev-accent) 8%, var(--dev-panel));
}
.icon-button {
  width: 30px;
  border-color: var(--dev-border);
  color: var(--dev-muted);
  background: var(--dev-panel);
  font-size: 18px;
}
.secondary-button,
.small-button {
  padding: 0 10px;
  border-color: var(--dev-border);
  color: var(--dev-text);
  background: var(--dev-panel);
  font-size: 12px;
  font-weight: 600;
}
.primary-button {
  padding: 0 12px;
  border-color: #326bdf;
  color: white;
  background: #326bdf;
  box-shadow: 0 4px 10px rgba(50, 107, 223, 0.2);
  font-size: 12px;
  font-weight: 650;
}
.icon-button:disabled,
.secondary-button:disabled,
.primary-button:disabled,
.small-button:disabled {
  opacity: 0.48;
  cursor: default;
  transform: none;
}

.error-banner,
.copy-banner {
  display: flex;
  align-items: center;
  gap: 9px;
  max-width: 1480px;
  margin: 0 auto 14px;
  padding: 10px 12px;
  border: 1px solid rgba(191, 77, 75, 0.22);
  border-radius: 10px;
  color: #934844;
  background: rgba(255, 241, 240, 0.9);
  font-size: 12px;
}
.copy-banner {
  border-color: rgba(50, 107, 223, 0.2);
  color: #315cae;
  background: rgba(237, 243, 255, 0.9);
}
.error-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 17px;
  height: 17px;
  border-radius: 50%;
  color: white;
  background: #c65b55;
  font-size: 11px;
  font-weight: 700;
}
.banner-action {
  margin-left: auto;
  padding: 0 8px;
  border-color: currentColor;
  color: inherit;
  background: transparent;
}
.summary-strip {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  max-width: 1480px;
  margin: 0 auto 18px;
  border: 1px solid var(--dev-border);
  border-radius: 12px;
  overflow: hidden;
  background: var(--dev-panel);
  box-shadow: var(--dev-shadow);
}
.summary-stat {
  min-width: 0;
  padding: 11px 15px;
  border-right: 1px solid var(--dev-border);
}
.summary-stat:last-child {
  border-right: 0;
}
.summary-label {
  display: block;
  overflow: hidden;
  color: var(--dev-muted);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.01em;
  line-height: 1.3;
  text-overflow: ellipsis;
  text-transform: none;
  white-space: nowrap;
}
.summary-stat strong {
  display: block;
  margin-top: 5px;
  color: var(--dev-text);
  font-family: var(--dev-mono);
  font-size: 15px;
  font-weight: 650;
}
.section-block,
.panel {
  max-width: 1480px;
  margin-right: auto;
  margin-left: auto;
}
.section-block {
  margin-bottom: 18px;
}
.section-heading,
.panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 9px;
}
.section-heading h2,
.panel-heading h2 {
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.01em;
}
.section-caption,
.section-count {
  display: block;
  margin-top: 2px;
  color: var(--dev-muted);
  font-size: 11px;
}
.section-count {
  margin-top: 0;
  font-family: var(--dev-mono);
}
.resource-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 11px;
}
.resource-card {
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--dev-border);
  border-radius: 13px;
  background: var(--dev-panel);
  box-shadow: var(--dev-shadow);
}
.resource-card-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 7px;
}
.resource-name {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: 7px;
  color: var(--dev-text);
  font-size: 12px;
  font-weight: 680;
}
.resource-symbol {
  width: 8px;
  height: 8px;
  border-radius: 3px;
  background: #5280dc;
  box-shadow: 0 0 0 3px rgba(82, 128, 220, 0.12);
}
.resource-card--violet .resource-symbol {
  background: #8062d9;
  box-shadow: 0 0 0 3px rgba(128, 98, 217, 0.12);
}
.resource-card--amber .resource-symbol {
  background: #c98a32;
  box-shadow: 0 0 0 3px rgba(201, 138, 50, 0.14);
}
.resource-card--green .resource-symbol {
  background: #38a36c;
  box-shadow: 0 0 0 3px rgba(56, 163, 108, 0.12);
}
.resource-state {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #388054;
  font-size: 10px;
  font-weight: 650;
  white-space: nowrap;
}
.resource-state--idle {
  color: var(--dev-muted);
}
.resource-state--error {
  color: #b5534f;
}
.resource-card-body {
  display: flex;
  align-items: baseline;
  gap: 7px;
  margin: 15px 0 12px;
}
.resource-number {
  color: var(--dev-text);
  font-family: var(--dev-mono);
  font-size: 25px;
  font-weight: 600;
  letter-spacing: -0.055em;
}
.resource-detail {
  overflow: hidden;
  color: var(--dev-muted);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sparkline-stack {
  display: grid;
  gap: 4px;
}
.sparkline-row {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  align-items: center;
  gap: 5px;
  min-width: 0;
  color: var(--dev-muted);
  font-family: var(--dev-mono);
  font-size: 9px;
}
.sparkline-row svg {
  width: 100%;
  height: 22px;
  overflow: visible;
}
.sparkline-row polyline {
  fill: none;
  stroke: #4c7fe2;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.2;
}
.sparkline-row--rss polyline {
  stroke: #a4b9e9;
}
.sparkline-row strong {
  color: var(--dev-text);
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}
.renderer-frame-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
  margin-top: 11px;
  padding-top: 10px;
  border-top: 1px solid var(--dev-border);
}
.resource-operation-metrics {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.renderer-frame-metric {
  min-width: 0;
  cursor: help;
}
.renderer-frame-metric span {
  display: block;
  overflow: hidden;
  color: var(--dev-muted);
  font-size: 9px;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.renderer-frame-metric strong {
  display: block;
  margin-top: 3px;
  color: var(--dev-text);
  font-family: var(--dev-mono);
  font-size: 11px;
  font-weight: 650;
  white-space: nowrap;
}
.renderer-hidden-state {
  grid-column: 1 / -1;
  color: var(--dev-faint);
  font-size: 9px;
}
.resource-footnote {
  margin-top: 7px;
  color: var(--dev-faint);
  font-size: 10px;
}
.availability-strip {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 9px;
  margin-top: 10px;
  padding: 8px 10px;
  border: 1px solid rgba(201, 138, 50, 0.22);
  border-radius: 9px;
  color: #8d641f;
  background: rgba(255, 247, 228, 0.82);
  font-size: 10px;
}
.availability-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 15px;
  height: 15px;
  border-radius: 50%;
  color: #fff;
  background: #c98a32;
  font-size: 10px;
  font-weight: 700;
}
.availability-item {
  color: var(--dev-muted);
}

.panel {
  border: 1px solid var(--dev-border);
  border-radius: 13px;
  background: var(--dev-panel);
  box-shadow: var(--dev-shadow);
}
.console-panel {
  margin-bottom: 18px;
  overflow: hidden;
}
.panel-heading {
  min-height: 50px;
  margin: 0;
  padding: 0 14px;
  border-bottom: 1px solid var(--dev-border);
}
.console-heading {
  align-items: stretch;
  padding-right: 10px;
}
.tab-list {
  display: flex;
  align-items: stretch;
  gap: 4px;
}
.tab-button {
  position: relative;
  padding: 0 11px;
  border: 0;
  color: var(--dev-muted);
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  font-weight: 650;
}
.tab-button::after {
  position: absolute;
  right: 9px;
  bottom: -1px;
  left: 9px;
  height: 2px;
  border-radius: 2px;
  background: transparent;
  content: '';
}
.tab-button:hover {
  color: var(--dev-text);
}
.tab-button.active {
  color: var(--dev-accent);
}
.tab-button.active::after {
  background: var(--dev-accent);
}
.console-tools {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 7px;
  min-width: 0;
}
.search-field {
  display: flex;
  align-items: center;
  width: min(28vw, 260px);
  min-width: 150px;
  height: 29px;
  gap: 5px;
  padding: 0 8px;
  border: 1px solid var(--dev-border);
  border-radius: 7px;
  color: var(--dev-muted);
  background: var(--dev-bg);
}
.search-field input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  color: var(--dev-text);
  background: transparent;
  font-size: 11px;
}
.search-field input::placeholder {
  color: var(--dev-faint);
}
.search-icon {
  font-size: 16px;
  line-height: 1;
}
.kernel-select select {
  height: 29px;
  max-width: 130px;
  padding: 0 25px 0 8px;
  border: 1px solid var(--dev-border);
  border-radius: 7px;
  outline: 0;
  color: var(--dev-text);
  background: var(--dev-bg);
  font-size: 11px;
}
.toggle-control {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--dev-muted);
  font-size: 10px;
  white-space: nowrap;
}
.toggle-control input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}
.toggle-track {
  display: inline-flex;
  align-items: center;
  width: 25px;
  height: 15px;
  padding: 2px;
  border-radius: 99px;
  background: #c4cbd6;
  transition: background-color 0.16s ease;
}
.toggle-track span {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: transform 0.16s ease;
}
.toggle-control input:checked + .toggle-track {
  background: var(--dev-accent);
}
.toggle-control input:checked + .toggle-track span {
  transform: translateX(10px);
}
.small-button {
  min-height: 29px;
  padding: 0 8px;
  font-size: 10px;
}
.console-viewport {
  max-height: 292px;
  min-height: 122px;
  overflow: auto;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}
.data-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 8px 11px;
  border-bottom: 1px solid var(--dev-border);
  color: var(--dev-muted);
  background: color-mix(in srgb, var(--dev-panel-solid) 94%, transparent);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.01em;
  text-align: left;
  text-transform: none;
  white-space: nowrap;
}
.data-table td {
  max-width: 0;
  padding: 9px 11px;
  border-bottom: 1px solid var(--dev-border);
  color: var(--dev-text);
  font-size: 11px;
  vertical-align: middle;
}
.data-table tr:last-child td {
  border-bottom: 0;
}
.data-table tbody tr:hover td {
  background: color-mix(in srgb, var(--dev-accent-soft) 52%, transparent);
}
.console-table th:nth-child(1) {
  width: 77px;
}
.console-table th:nth-child(2) {
  width: 95px;
}
.console-table th:nth-child(3) {
  width: 112px;
}
.console-table th:nth-child(4) {
  width: 66px;
}
.console-table th:nth-child(5) {
  width: 150px;
}
.commands-table th:nth-child(1) {
  width: 77px;
}
.commands-table th:nth-child(4) {
  width: 112px;
}
.commands-table th:nth-child(5) {
  width: 150px;
}
.time-cell,
.mono-cell {
  color: var(--dev-muted) !important;
  font-family: var(--dev-mono);
  font-size: 10px !important;
  white-space: nowrap;
}
.kind-pill,
.role-badge,
.task-state {
  display: inline-flex;
  max-width: 100%;
  overflow: hidden;
  padding: 3px 6px;
  border-radius: 5px;
  color: #536da8;
  background: #edf2ff;
  font-size: 9px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.message-cell,
.source-cell,
.process-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.process-kernel {
  display: block;
  margin-top: 4px;
  color: var(--dev-accent);
  font: 10px var(--dev-mono);
}
.source-cell {
  color: var(--dev-muted) !important;
  font-size: 10px !important;
}
.empty-row td {
  height: 104px;
  color: var(--dev-muted);
  text-align: center;
}
.empty-table-icon {
  display: block;
  margin-bottom: 6px;
  color: var(--dev-faint);
  font-size: 20px;
}
.panel-footnote {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 13px;
  border-top: 1px solid var(--dev-border);
  color: var(--dev-muted);
  font-size: 10px;
}
.pause-mark {
  font-family: var(--dev-mono);
}
.lower-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  max-width: 1480px;
  margin: 0 auto;
  gap: 14px;
  padding-bottom: 18px;
}
.table-panel {
  width: 100%;
  min-width: 0;
  overflow: hidden;
}
.panel-icon {
  color: var(--dev-faint);
  font-size: 18px;
}
.queue-counts {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--dev-muted);
  font-size: 9px;
  white-space: nowrap;
}
.queue-count--failed {
  color: #b5534f;
}
.table-scroll {
  max-height: 286px;
  overflow: auto;
}
.process-table th:nth-child(1) {
  width: 68px;
}
.process-table th:nth-child(2) {
  width: 91px;
}
.process-table th:nth-child(4) {
  width: 61px;
}
.process-table th:nth-child(5) {
  width: 72px;
}
.process-table th:nth-child(6) {
  width: 116px;
}
.task-table {
  min-width: 760px;
}
.task-table th:nth-child(1) {
  width: 63px;
}
.task-table th:nth-child(2) {
  width: 108px;
}
.task-table th:nth-child(3) {
  width: 86px;
}
.task-table th:nth-child(4) {
  width: 86px;
}
.task-table th:nth-child(5) {
  width: 93px;
}
.task-table th:nth-child(6) {
  width: 52px;
}
.task-table th:nth-child(7),
.task-table th:nth-child(8) {
  width: 78px;
}
.task-table th:nth-child(9) {
  width: 116px;
}
.pid-cell,
.task-id {
  font-weight: 600;
}
.role-badge {
  color: var(--dev-muted);
  background: color-mix(in srgb, var(--dev-muted) 10%, transparent);
}
.role-renderer {
  color: #7651b7;
  background: #f1ecff;
}
.role-backend {
  color: #a26919;
  background: #fff5df;
}
.role-kernel,
.role-kernel-worker {
  color: #278355;
  background: #e8f8ef;
}
.role-main {
  color: #3569bd;
  background: #eaf0ff;
}
.numeric-cell {
  color: var(--dev-text);
  font-family: var(--dev-mono);
  font-size: 10px !important;
  white-space: nowrap;
}
.process-details summary {
  overflow: hidden;
  cursor: pointer;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.process-details summary::marker {
  color: var(--dev-faint);
}
.process-detail {
  display: grid;
  gap: 2px;
  max-width: 260px;
  padding: 5px 0 1px;
  color: var(--dev-muted);
  font-family: var(--dev-mono);
  font-size: 9px;
  line-height: 1.35;
}
.process-command,
.process-cpu-basis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.process-cpu-basis {
  color: var(--dev-faint);
}
.task-state {
  color: var(--dev-muted);
  background: color-mix(in srgb, var(--dev-muted) 10%, transparent);
}
.task-state--running {
  color: #3c63b2;
  background: #eaf0ff;
}
.task-state--queued,
.task-state--waiting {
  color: #95691e;
  background: #fff5df;
}
.task-state--completed {
  color: #2d8257;
  background: #e8f8ef;
}
.task-state--failed {
  color: #ae534d;
  background: #fff0ef;
}
.progress-cell {
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--dev-muted);
  font-family: var(--dev-mono);
  font-size: 9px;
  white-space: nowrap;
}
.progress-track {
  width: 43px;
  height: 4px;
  overflow: hidden;
  border-radius: 5px;
  background: color-mix(in srgb, var(--dev-muted) 16%, transparent);
}
.progress-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--dev-accent);
}
.standalone-state {
  display: grid;
  place-items: center;
  max-width: 600px;
  min-height: 300px;
  margin: 70px auto;
  color: var(--dev-muted);
  text-align: center;
}
.standalone-state h2 {
  margin-top: 15px;
  color: var(--dev-text);
  font-size: 16px;
}
.standalone-state p {
  max-width: 450px;
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.6;
}
.loading-state {
  display: flex;
  flex-direction: column;
}
.loading-orbit {
  width: 26px;
  height: 26px;
  border: 2px solid rgba(50, 107, 223, 0.18);
  border-top-color: var(--dev-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
.empty-illustration {
  display: flex;
  align-items: end;
  justify-content: center;
  gap: 5px;
  width: 78px;
  height: 52px;
  padding: 12px;
  border: 1px solid var(--dev-border);
  border-radius: 17px;
  background: var(--dev-panel);
}
.empty-illustration span {
  width: 9px;
  border-radius: 5px;
  background: #bed0f5;
}
.empty-illustration span:nth-child(1) {
  height: 17px;
}
.empty-illustration span:nth-child(2) {
  height: 28px;
  background: #7ea1ea;
}
.empty-illustration span:nth-child(3) {
  height: 22px;
  background: #a5bceb;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@keyframes pulse-dot {
  0%,
  100% {
    opacity: 0.45;
    transform: scale(0.85);
  }
  50% {
    opacity: 1;
    transform: scale(1.15);
  }
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 980px) {
  .developer-window {
    padding: 21px 20px 28px;
  }
  .developer-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 14px;
  }
  .header-actions {
    width: 100%;
    justify-content: flex-start;
  }
  .summary-strip {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .summary-stat:nth-child(3) {
    border-right: 0;
  }
  .summary-stat:nth-child(n + 4) {
    border-top: 1px solid var(--dev-border);
  }
  .summary-stat:nth-child(4) {
    border-right: 1px solid var(--dev-border);
  }
  .resource-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .console-heading {
    align-items: flex-start;
    flex-direction: column;
    padding-top: 9px;
  }
  .console-tools {
    width: 100%;
    justify-content: flex-start;
    padding-bottom: 9px;
  }
}

@media (max-width: 820px) {
  .lower-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-color-scheme: dark) {
  :global(body) {
    background: #11151c;
    color: #e8edf6;
  }
  .developer-window {
    --dev-bg: #202022;
    --dev-panel: #2c2c2e;
    --dev-panel-solid: #2c2c2e;
    --dev-border: rgba(220, 231, 250, 0.11);
    --dev-border-strong: rgba(220, 231, 250, 0.18);
    --dev-text: #e8edf6;
    --dev-muted: #9ea9bb;
    --dev-faint: #687487;
    --dev-accent: #83aaf8;
    --dev-accent-soft: #243452;
    --dev-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    background: var(--dev-bg);
  }
  .brand-mark {
    border-color: rgba(131, 170, 248, 0.22);
    background: linear-gradient(145deg, #243557, #1d2942);
  }
  .brand-mark span {
    background: #83aaf8;
  }
  .sample-status {
    color: #84c99e;
    background: rgba(48, 106, 72, 0.23);
  }
  .sample-status--paused {
    color: #ddb86b;
    background: rgba(126, 91, 25, 0.22);
  }
  .sample-status--waiting {
    color: var(--dev-muted);
    background: rgba(160, 174, 198, 0.1);
  }
  .primary-button {
    color: #101725;
    background: #83aaf8;
    border-color: #83aaf8;
  }
  .error-banner {
    color: #f0a39c;
    background: rgba(116, 45, 42, 0.23);
    border-color: rgba(240, 163, 156, 0.24);
  }
  .copy-banner {
    color: #a9c5ff;
    background: rgba(44, 73, 132, 0.25);
    border-color: rgba(131, 170, 248, 0.24);
  }
  .error-icon {
    color: #231216;
    background: #f0a39c;
  }
  .availability-strip {
    color: #e5bd78;
    background: rgba(126, 91, 25, 0.22);
    border-color: rgba(229, 189, 120, 0.22);
  }
  .availability-icon {
    color: #2b2112;
    background: #e5bd78;
  }
  .kind-pill {
    color: #aec7ff;
    background: #25385e;
  }
  .role-renderer {
    color: #c4affd;
    background: #362d58;
  }
  .role-backend {
    color: #e5bd78;
    background: #4a3b25;
  }
  .role-kernel,
  .role-kernel-worker {
    color: #8ad3ad;
    background: #254b39;
  }
  .role-main {
    color: #aec7ff;
    background: #25385e;
  }
  .task-state {
    color: var(--dev-muted);
    background: rgba(160, 174, 198, 0.12);
  }
  .task-state--running {
    color: #aec7ff;
    background: #25385e;
  }
  .task-state--queued,
  .task-state--waiting {
    color: #e5bd78;
    background: #4a3b25;
  }
  .task-state--completed {
    color: #8ad3ad;
    background: #254b39;
  }
  .task-state--failed {
    color: #f0a39c;
    background: #532d2b;
  }
  .toggle-track {
    background: #536074;
  }
  .toggle-track span {
    background: #d9e2f5;
  }
  .sparkline-row polyline {
    stroke: #83aaf8;
  }
  .sparkline-row--rss polyline {
    stroke: #536f9f;
  }
  .empty-illustration span {
    background: #3d527c;
  }
  .empty-illustration span:nth-child(2) {
    background: #83aaf8;
  }
  .empty-illustration span:nth-child(3) {
    background: #627fac;
  }
}

/* The control layer floats above quiet, opaque diagnostic content. */
.developer-header {
  position: sticky;
  top: -26px;
  z-index: 5;
  padding: 16px 18px;
  margin-bottom: 24px;
  border-radius: 20px;
  background: color-mix(in srgb, var(--dev-panel-solid) 82%, transparent);
  backdrop-filter: blur(24px) saturate(140%);
  border: 1px solid var(--dev-border);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.22),
    0 4px 16px rgba(0, 0, 0, 0.05);
}
h1 {
  font-size: 18px;
  font-weight: 650;
}
.brand-mark {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  box-shadow: none;
}
.sample-status {
  border: 0;
  background: transparent;
  font-size: 11px;
  font-weight: 500;
}
.sample-status--paused,
.sample-status--waiting {
  background: transparent;
}
.icon-button,
.secondary-button,
.primary-button {
  min-height: 32px;
  border-radius: 99px;
}
.icon-button {
  width: 32px;
}
.primary-button {
  color: var(--dev-text);
  border-color: var(--dev-border);
  background: var(--dev-panel);
  box-shadow: none;
  font-weight: 600;
}
.primary-button[aria-pressed='true'] {
  color: var(--dev-accent);
  background: var(--dev-accent-soft);
}
.icon-button:active:not(:disabled),
.secondary-button:active:not(:disabled),
.primary-button:active:not(:disabled),
.small-button:active:not(:disabled),
.tab-button:active {
  transform: scale(0.97);
  transition-duration: 60ms;
}
button:focus-visible,
select:focus-visible,
.search-field:focus-within,
.toggle-control:has(input:focus-visible) .toggle-track {
  outline: 3px solid color-mix(in srgb, var(--dev-accent) 65%, transparent);
  outline-offset: 3px;
}
.summary-strip {
  border-radius: 16px;
}
.summary-stat {
  padding: 14px 16px;
}
.summary-stat strong {
  font-family: inherit;
  font-size: 20px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
.resource-grid {
  gap: 12px;
}
.resource-card {
  padding: 16px;
  border-radius: 16px;
}
.resource-number {
  font-family: inherit;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.025em;
  font-size: 28px;
}
.section-heading h2,
.panel-heading h2 {
  font-weight: 600;
}
.panel {
  border-radius: 16px;
}
.console-heading {
  gap: 12px;
  padding: 12px;
}
.tab-list {
  align-self: center;
  flex-shrink: 0;
  gap: 2px;
  padding: 3px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--dev-muted) 10%, transparent);
}
.tab-button {
  min-height: 28px;
  padding: 0 12px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 500;
}
.tab-button::after {
  content: none;
}
.tab-button.active {
  color: var(--dev-text);
  background: var(--dev-panel-solid);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}
.search-field {
  height: 32px;
  border-radius: 9px;
}
.kernel-select select {
  height: 32px;
  border-radius: 9px;
}
.data-table th {
  font-size: 11px;
  font-weight: 600;
  padding-top: 10px;
  padding-bottom: 10px;
}
.data-table tbody tr:nth-child(even) {
  background: color-mix(in srgb, var(--dev-muted) 4%, transparent);
}
.data-table td {
  border-bottom-color: color-mix(in srgb, var(--dev-border) 45%, transparent);
}
.kind-pill,
.role-badge,
.task-state {
  border-radius: 6px;
  font-size: 10px;
}
@media (max-width: 980px) {
  .developer-header {
    top: -21px;
    gap: 12px;
  }
  .console-tools {
    flex-wrap: wrap;
    gap: 10px;
    padding-bottom: 0;
  }
  .search-field {
    flex: 1;
    width: auto;
  }
}
@media (prefers-color-scheme: dark) {
  .primary-button {
    color: var(--dev-text);
    border-color: var(--dev-border);
    background: var(--dev-panel);
  }
  .sample-status,
  .sample-status--paused,
  .sample-status--waiting {
    background: transparent;
  }
  .resource-state {
    color: #84c99e;
  }
  .resource-state--idle {
    color: var(--dev-muted);
  }
  .resource-state--error {
    color: #f0a39c;
  }
}
@media (prefers-reduced-transparency: reduce) {
  .developer-header {
    background: var(--dev-panel-solid);
    backdrop-filter: none;
  }
}
@media (prefers-contrast: more) {
  .developer-window {
    --dev-border: color-mix(in srgb, var(--dev-text) 45%, transparent);
    --dev-muted: var(--dev-text);
    --dev-faint: var(--dev-text);
  }
  .developer-header {
    background: var(--dev-panel-solid);
    backdrop-filter: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.001ms !important;
  }
}
</style>
