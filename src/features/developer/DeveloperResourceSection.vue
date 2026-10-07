<script setup>
import { toRefs } from 'vue';

const props = defineProps({
  hasSample: Boolean,
  primary: { type: Object, required: true },
  resourceCards: { type: Array, required: true },
  unavailableBackendProcesses: { type: Array, default: () => [] },
  text: { type: Function, required: true },
  formatCount: { type: Function, required: true },
  formatBytes: { type: Function, required: true },
  formatCpu: { type: Function, required: true },
  sparklinePoints: { type: Function, required: true },
  rendererText: { type: Function, required: true },
  rendererMetricRows: { type: Function, required: true },
  operationMetricText: { type: Function, required: true },
  operationMetricRows: { type: Function, required: true },
});
const {
  hasSample,
  primary,
  resourceCards,
  unavailableBackendProcesses,
  text,
  formatCount,
  formatBytes,
  formatCpu,
  sparklinePoints,
  rendererText,
  rendererMetricRows,
  operationMetricText,
  operationMetricRows,
} = toRefs(props);
</script>

<template>
  <section v-if="hasSample" class="section-block resources-section">
    <div class="section-heading">
      <div>
        <h2>{{ text('resources.title') }}</h2>
        <span class="section-caption">{{ text('app.developerHint') }}</span>
      </div>
      <span class="section-count"
        >{{ formatCount(primary.eventCount) }} {{ text('console.events').toLowerCase() }}</span
      >
    </div>
    <div class="resource-grid">
      <article
        v-for="card in resourceCards"
        :key="card.key"
        class="resource-card"
        :class="`resource-card--${card.tone}`"
      >
        <div class="resource-card-topline">
          <div class="resource-name">
            <span class="resource-symbol" aria-hidden="true"></span>{{ card.label }}
          </div>
          <span class="resource-state" :class="`resource-state--${card.status}`"
            ><span class="state-dot"></span>{{ text(`resources.${card.status}`) }}</span
          >
        </div>
        <div class="resource-card-body">
          <div class="resource-number">
            {{ card.key === 'backend' ? formatCount(card.count) : formatCount(card.processCount) }}
          </div>
          <div class="resource-detail">
            {{
              card.key === 'backend'
                ? text('resources.windows', { count: formatCount(card.count) })
                : text('resources.processes', { count: formatCount(card.processCount) })
            }}
          </div>
        </div>
        <div
          class="sparkline-stack"
          :aria-label="`${card.label} ${text('resources.cpu')} ${formatCpu(card.cpu)}, ${text('resources.rss')} ${formatBytes(card.rss)}`"
        >
          <div class="sparkline-row">
            <span>{{ text('resources.cpu') }}</span
            ><svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
              <polyline :points="sparklinePoints(card.history.cpu)"></polyline></svg
            ><strong>{{ formatCpu(card.cpu) }}</strong>
          </div>
          <div class="sparkline-row sparkline-row--rss">
            <span>{{ text('resources.rss') }}</span
            ><svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
              <polyline :points="sparklinePoints(card.history.rss)"></polyline></svg
            ><strong>{{ formatBytes(card.rss) }}</strong>
          </div>
        </div>
        <div
          v-if="card.key === 'renderers'"
          class="renderer-frame-metrics"
          :aria-label="rendererText('metricsAria')"
        >
          <div
            v-for="metric in rendererMetricRows(card.frameMetrics)"
            :key="metric.key"
            class="renderer-frame-metric"
            :title="metric.title"
          >
            <span>{{ metric.label }}</span
            ><strong>{{ metric.value }}</strong>
          </div>
          <span v-if="card.frameMetrics.hidden === true" class="renderer-hidden-state">{{
            rendererText('hidden')
          }}</span>
        </div>
        <div
          v-if="card.key === 'main' || card.key === 'backend'"
          class="renderer-frame-metrics resource-operation-metrics"
          :aria-label="
            operationMetricText(card.key === 'main' ? 'mainMetricsAria' : 'backendMetricsAria')
          "
        >
          <div
            v-for="metric in operationMetricRows(card)"
            :key="metric.key"
            class="renderer-frame-metric"
            :title="metric.title"
          >
            <span>{{ metric.label }}</span
            ><strong>{{ metric.value }}</strong>
          </div>
        </div>
        <div v-if="card.status === 'idle'" class="resource-footnote">
          {{ text('resources.noProcess') }}
        </div>
      </article>
    </div>
    <div v-if="unavailableBackendProcesses.length" class="availability-strip" role="status">
      <span class="availability-icon" aria-hidden="true">i</span>
      <strong>{{ text('processes.monitorUnavailable') }}</strong>
      <span
        v-for="status in unavailableBackendProcesses"
        :key="status.title"
        class="availability-item"
      >
        {{ status.title
        }}<span v-if="status.reason">
          · {{ text('processes.monitorReason') }}: {{ status.reason }}</span
        >
      </span>
    </div>
  </section>
</template>

<style scoped>
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
.state-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 13%, transparent);
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

/* Preserve the compact diagnostic card treatment from the host view. */
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
.section-heading h2 {
  font-weight: 600;
}
@media (max-width: 980px) {
  .resource-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (prefers-color-scheme: dark) {
  .resource-state {
    color: #84c99e;
  }
  .resource-state--idle {
    color: var(--dev-muted);
  }
  .resource-state--error {
    color: #f0a39c;
  }
  .sparkline-row polyline {
    stroke: #83aaf8;
  }
  .sparkline-row--rss polyline {
    stroke: #536f9f;
  }
}
</style>
