<script setup>
import { toRef } from 'vue';
import { useDeveloperQuickTests } from './useDeveloperQuickTests.mjs';

const props = defineProps({
  language: {
    type: String,
    default: 'en',
  },
});

const {
  context,
  run,
  selectedWindowId,
  contextLoading,
  statusLoading,
  actionBusy,
  cancelBusy,
  contextError,
  statusError,
  runError,
  cancelError,
  liveMessage,
  bridgeAvailable,
  readers,
  providerName,
  providerConfiguration,
  kernelActionDescription,
  isRunning,
  isBusy,
  text,
  formatLanguage,
  formatContextValue,
  formatElapsed,
  formatOutput,
  hasOutput,
  resultStatusLabel,
  startTest,
  cancelRun,
  selectReader,
  refreshContext,
} = useDeveloperQuickTests({ language: toRef(props, 'language') });
</script>
<template>
  <section class="developer-quick-tests" :aria-busy="isBusy">
    <div class="quick-tests-card">
      <header class="quick-tests-header">
        <div>
          <p class="eyebrow">{{ text('context') }}</p>
          <h2>{{ text('title') }}</h2>
          <p class="subtitle">{{ text('subtitle') }}</p>
        </div>
        <button
          class="quiet-button"
          type="button"
          :disabled="isBusy || !bridgeAvailable"
          @click="refreshContext"
        >
          {{ contextLoading ? text('loading') : text('refresh') }}
        </button>
      </header>

      <div v-if="contextError" class="message-banner message-banner--error" role="alert">
        {{ contextError }}
      </div>
      <div v-if="statusError" class="message-banner message-banner--error" role="alert">
        {{ statusError }}
      </div>
      <div v-if="runError" class="message-banner message-banner--error" role="alert">
        {{ runError }}
      </div>
      <div v-if="cancelError" class="message-banner message-banner--error" role="alert">
        {{ cancelError }}
      </div>

      <div v-if="readers.length > 1" class="reader-picker">
        <label for="developer-test-reader">{{ text('selectedReader') }}</label>
        <select
          id="developer-test-reader"
          :value="selectedWindowId"
          :disabled="isBusy || isRunning"
          @change="selectReader"
        >
          <option v-for="reader in readers" :key="String(reader.id)" :value="String(reader.id)">
            {{ reader.title }}
          </option>
        </select>
      </div>

      <dl class="context-grid" :aria-label="text('context')">
        <div class="context-item">
          <dt>{{ text('engine') }}</dt>
          <dd>{{ formatContextValue(context?.engine) }}</dd>
        </div>
        <div class="context-item">
          <dt>{{ text('source') }}</dt>
          <dd>{{ formatLanguage(context?.sourceLanguage) }}</dd>
        </div>
        <div class="context-item">
          <dt>{{ text('target') }}</dt>
          <dd>{{ formatLanguage(context?.language) }}</dd>
        </div>
        <div class="context-item">
          <dt>{{ text('provider') }}</dt>
          <dd>
            <span>{{ providerName }}</span
            ><span class="context-subvalue">{{ providerConfiguration }}</span>
          </dd>
        </div>
        <div class="context-item">
          <dt>{{ text('concurrency') }}</dt>
          <dd>{{ formatContextValue(context?.concurrency) }}</dd>
        </div>
        <div class="context-item">
          <dt>{{ text('pageConcurrency') }}</dt>
          <dd>{{ formatContextValue(context?.pageConcurrency) }}</dd>
        </div>
      </dl>

      <div class="test-actions" :aria-label="text('title')">
        <button
          class="test-action"
          type="button"
          :disabled="isBusy || isRunning || !bridgeAvailable"
          @click="startTest('kernel')"
        >
          <span class="test-action-title">{{ text('kernelAction') }}</span>
          <span class="test-action-description">{{ kernelActionDescription }}</span>
        </button>
        <button
          class="test-action"
          type="button"
          :disabled="isBusy || isRunning || !bridgeAvailable"
          @click="startTest('provider')"
        >
          <span class="test-action-title">{{ text('providerAction') }}</span>
          <span class="test-action-description">{{ text('providerDescription') }}</span>
        </button>
        <button
          class="test-action"
          type="button"
          :disabled="isBusy || isRunning || !bridgeAvailable"
          @click="startTest('batch')"
        >
          <span class="test-action-title">{{ text('batchAction') }}</span>
          <span class="test-action-description">{{ text('batchDescription') }}</span>
        </button>
      </div>

      <p class="batch-hint">{{ text('batchHint') }}</p>

      <section
        v-if="run?.results?.length"
        class="test-results"
        :aria-labelledby="'developer-test-results-' + (run?.id || 'empty')"
        :aria-describedby="run?.id ? 'developer-test-run-' + run.id : undefined"
      >
        <div class="results-heading">
          <div>
            <h3 :id="'developer-test-results-' + (run?.id || 'empty')">{{ text('results') }}</h3>
            <span v-if="run?.id" class="sr-only" :id="'developer-test-run-' + run.id">{{
              text('runId', { id: run.id })
            }}</span>
          </div>
          <button
            v-if="isRunning"
            class="cancel-button"
            type="button"
            :disabled="cancelBusy"
            @click="cancelRun"
          >
            {{ cancelBusy ? text('loading') : text('cancel') }}
          </button>
        </div>

        <ul class="result-list">
          <li v-for="result in run.results" :key="String(result.id)" class="result-row">
            <div class="result-main">
              <span class="result-label">{{ result.label }}</span>
              <span class="result-message">{{ result.message || text('noMessage') }}</span>
            </div>
            <div class="result-meta">
              <span class="result-status" :class="`result-status--${result.status}`">{{
                resultStatusLabel(result.status)
              }}</span>
              <span class="result-elapsed">{{ formatElapsed(result.elapsedMs) }}</span>
            </div>
            <details v-if="hasOutput(result)" class="result-output">
              <summary>{{ text('output') }}</summary>
              <pre>{{ formatOutput(result.output) }}</pre>
            </details>
          </li>
        </ul>
      </section>

      <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">{{ liveMessage }}</p>
    </div>
  </section>
</template>

<style scoped>
.developer-quick-tests {
  max-width: 1480px;
  margin: 0 auto 18px;
  color: var(--dev-text, #1d1d1f);
}

.quick-tests-card {
  overflow: hidden;
  border: 1px solid var(--dev-border, rgba(33, 45, 68, 0.1));
  border-radius: 16px;
  background: var(--dev-panel, #fff);
  box-shadow: var(--dev-shadow, 0 1px 3px rgba(0, 0, 0, 0.035));
}

.quick-tests-header,
.reader-picker,
.context-grid,
.test-actions,
.batch-hint,
.test-results {
  padding-right: 16px;
  padding-left: 16px;
}

.quick-tests-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-top: 16px;
  padding-bottom: 14px;
}

.eyebrow {
  margin: 0 0 3px;
  color: var(--dev-muted, #636366);
  font-size: 10px;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

h2,
h3,
p {
  margin-top: 0;
}

h2 {
  margin-bottom: 3px;
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.018em;
}

.subtitle {
  margin-bottom: 0;
  color: var(--dev-muted, #636366);
  font-size: 12px;
  line-height: 1.45;
}

button,
select {
  font: inherit;
}

button {
  cursor: pointer;
}

button:disabled,
select:disabled {
  cursor: default;
}

.quiet-button,
.cancel-button {
  flex: 0 0 auto;
  min-height: 32px;
  padding: 6px 11px;
  border: 1px solid var(--dev-border-strong, rgba(33, 45, 68, 0.16));
  border-radius: 9px;
  color: var(--dev-text, #1d1d1f);
  background: var(--dev-panel-solid, var(--dev-panel, #fff));
  font-size: 11px;
  font-weight: 600;
  transition:
    background-color 140ms ease,
    border-color 140ms ease,
    transform 100ms ease;
}

.quiet-button:hover:not(:disabled),
.cancel-button:hover:not(:disabled) {
  border-color: var(--dev-accent, #326bdf);
  background: var(--dev-accent-soft, rgba(50, 107, 223, 0.1));
}

.quiet-button:active:not(:disabled),
.cancel-button:active:not(:disabled),
.test-action:active:not(:disabled) {
  transform: scale(0.985);
  transition-duration: 60ms;
}

.message-banner {
  margin: 0 16px 10px;
  padding: 9px 11px;
  border: 1px solid var(--dev-border, rgba(33, 45, 68, 0.1));
  border-radius: 9px;
  font-size: 11px;
  line-height: 1.45;
}

.message-banner--error {
  border-color: color-mix(in srgb, var(--dev-error, #d92d20) 28%, transparent);
  color: var(--dev-error, #b42318);
  background: color-mix(in srgb, var(--dev-error, #d92d20) 10%, transparent);
}

.reader-picker {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding-bottom: 10px;
}

.reader-picker label {
  color: var(--dev-muted, #636366);
  font-size: 11px;
  font-weight: 600;
}

.reader-picker select {
  min-width: min(100%, 280px);
  min-height: 32px;
  padding: 5px 28px 5px 9px;
  border: 1px solid var(--dev-border, rgba(33, 45, 68, 0.1));
  border-radius: 9px;
  color: var(--dev-text, #1d1d1f);
  background: var(--dev-bg, #f5f5f7);
}

.context-grid {
  display: grid;
  grid-template-columns: 0.9fr 1fr 1fr 1.7fr 0.7fr 0.9fr;
  gap: 8px 16px;
  margin: 0;
  padding-bottom: 14px;
}

.context-item {
  min-width: 0;
  padding: 2px 0;
}

.context-item dt {
  overflow: hidden;
  margin-bottom: 3px;
  color: var(--dev-muted, #636366);
  font-size: 10px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.context-item dd {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 5px;
  min-height: 17px;
  margin: 0;
  overflow-wrap: anywhere;
  color: var(--dev-text, #1d1d1f);
  font-size: 11px;
  font-weight: 600;
}

.context-subvalue {
  color: var(--dev-muted, #636366);
  font-size: 10px;
  font-weight: 500;
}

.test-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 14px;
  padding-bottom: 10px;
  border-top: 1px solid var(--dev-border, rgba(33, 45, 68, 0.1));
}

.test-action {
  display: flex;
  flex: 1 1 230px;
  min-width: 210px;
  min-height: 78px;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 5px;
  padding: 12px 13px;
  border: 1px solid var(--dev-border-strong, rgba(33, 45, 68, 0.16));
  border-radius: 12px;
  color: var(--dev-text, #1d1d1f);
  background: var(--dev-panel-solid, var(--dev-panel, #fff));
  text-align: left;
  transition:
    border-color 140ms ease,
    background-color 140ms ease,
    transform 100ms ease;
}

.test-action:hover:not(:disabled) {
  border-color: var(--dev-accent, #326bdf);
  background: var(--dev-accent-soft, rgba(50, 107, 223, 0.1));
}

.test-action-title {
  font-size: 12px;
  font-weight: 650;
  line-height: 1.3;
}

.test-action-description {
  color: var(--dev-muted, #636366);
  font-size: 11px;
  font-weight: 400;
  line-height: 1.4;
}

.batch-hint {
  margin-bottom: 0;
  padding-bottom: 14px;
  color: var(--dev-muted, #636366);
  font-size: 11px;
  line-height: 1.45;
}

.test-results {
  padding-top: 14px;
  padding-bottom: 16px;
  border-top: 1px solid var(--dev-border, rgba(33, 45, 68, 0.1));
}

.results-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 9px;
}

h3 {
  margin-bottom: 2px;
  font-size: 13px;
  font-weight: 650;
}

.empty-results {
  margin-bottom: 0;
  padding: 16px 0 5px;
  color: var(--dev-muted, #636366);
  font-size: 11px;
}

.result-list {
  display: grid;
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.result-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 4px 12px;
  padding: 10px 11px;
  border: 1px solid var(--dev-border, rgba(33, 45, 68, 0.1));
  border-radius: 10px;
  background: color-mix(in srgb, var(--dev-bg, #f5f5f7) 62%, transparent);
}

.result-main {
  display: grid;
  min-width: 0;
  gap: 3px;
}

.result-label {
  overflow: hidden;
  color: var(--dev-text, #1d1d1f);
  font-size: 11px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-message {
  overflow-wrap: anywhere;
  color: var(--dev-muted, #636366);
  font-size: 11px;
  line-height: 1.4;
}

.result-meta {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  gap: 8px;
  white-space: nowrap;
}

.result-status {
  padding: 3px 7px;
  border-radius: 999px;
  color: var(--dev-muted, #636366);
  background: color-mix(in srgb, var(--dev-muted, #636366) 13%, transparent);
  font-size: 10px;
  font-weight: 650;
}

.result-status--running,
.result-status--pending {
  color: var(--dev-accent, #326bdf);
  background: var(--dev-accent-soft, rgba(50, 107, 223, 0.1));
}

.result-status--success {
  color: var(--dev-success, #248a3d);
  background: color-mix(in srgb, var(--dev-success, #248a3d) 14%, transparent);
}

.result-status--error {
  color: var(--dev-error, #b42318);
  background: color-mix(in srgb, var(--dev-error, #d92d20) 12%, transparent);
}

.result-status--skipped,
.result-status--cancelled {
  color: var(--dev-muted, #636366);
}

.result-elapsed {
  min-width: 40px;
  color: var(--dev-muted, #636366);
  font-family: var(--dev-mono, ui-monospace, monospace);
  font-size: 10px;
  text-align: right;
}

.result-output {
  grid-column: 1 / -1;
  border-top: 1px solid var(--dev-border, rgba(33, 45, 68, 0.1));
  padding-top: 6px;
}

.result-output summary {
  width: fit-content;
  color: var(--dev-accent, #326bdf);
  cursor: pointer;
  font-size: 10px;
  font-weight: 600;
}

.result-output pre {
  max-height: 220px;
  margin: 7px 0 0;
  overflow: auto;
  padding: 9px;
  border: 1px solid var(--dev-border, rgba(33, 45, 68, 0.1));
  border-radius: 8px;
  color: var(--dev-text, #1d1d1f);
  background: var(--dev-panel-solid, var(--dev-panel, #fff));
  font: 10px/1.5 var(--dev-mono, ui-monospace, monospace);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

button:focus-visible,
select:focus-visible,
summary:focus-visible {
  outline: 3px solid color-mix(in srgb, var(--dev-accent, #326bdf) 65%, transparent);
  outline-offset: 3px;
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

@media (max-width: 980px) {
  .context-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .quick-tests-header {
    flex-direction: column;
  }

  .quiet-button {
    width: 100%;
  }

  .context-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .test-action {
    min-width: 100%;
  }

  .result-row {
    grid-template-columns: minmax(0, 1fr);
  }

  .result-meta {
    justify-content: flex-start;
  }
}

@media (prefers-color-scheme: dark) {
  .developer-quick-tests {
    --dev-success: #84c99e;
    --dev-error: #f0a39c;
  }
}

@media (prefers-reduced-motion: reduce) {
  .quiet-button,
  .cancel-button,
  .test-action {
    transition: none;
  }
}

@media (prefers-contrast: more) {
  .quick-tests-card,
  .test-action,
  .result-row,
  .reader-picker select {
    border-color: color-mix(in srgb, var(--dev-text, #1d1d1f) 45%, transparent);
  }
}
</style>
