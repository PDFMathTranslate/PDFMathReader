import { computed } from 'vue';
import { OPERATION_METRIC_MESSAGES, RENDERER_METRIC_MESSAGES } from './metric-messages.mjs';

export const EMPTY_VALUE = '—';

function finiteNumber(value, fallback = 0) {
  const number = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(number) ? number : fallback;
}

function nonNegativeNumber(value, fallback = 0) {
  return Math.max(0, finiteNumber(value, fallback));
}

function nullableFraction(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : null;
}

export function useDeveloperFormatting({ language }) {
  const localeCode = computed(() => (language.value === 'en' ? 'en-US' : language.value));

  function sparklinePoints(values) {
    const usable = Array.isArray(values) ? values.filter(Number.isFinite) : [];
    const series = usable.length ? usable : [0];
    const known = series.filter((value) => Number.isFinite(Number(value))).map(Number);
    if (!known.length) return '';
    let previous = known[0];
    const plotted = series.map((value) => {
      const number = Number(value);
      if (Number.isFinite(number)) previous = number;
      return previous;
    });
    const min = Math.min(...plotted);
    const max = Math.max(...plotted);
    const range = max - min || 1;
    return plotted
      .map((value, index) => {
        const x = plotted.length === 1 ? 50 : (index / (plotted.length - 1)) * 100;
        const y = 28 - ((value - min) / range) * 22;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  }

  function formatBytes(value) {
    const number = nonNegativeNumber(value, Number.NaN);
    if (!Number.isFinite(number) || number <= 0) return EMPTY_VALUE;
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let amount = number;
    let index = 0;
    while (amount >= 1024 && index < units.length - 1) {
      amount /= 1024;
      index++;
    }
    const digits = amount >= 100 || index === 0 ? 0 : amount >= 10 ? 1 : 2;
    return `${amount.toFixed(digits)} ${units[index]}`;
  }

  function formatCpu(value) {
    const number = nonNegativeNumber(value, Number.NaN);
    return Number.isFinite(number) ? `${number.toFixed(1)}%` : EMPTY_VALUE;
  }

  function rendererText(key) {
    return RENDERER_METRIC_MESSAGES[language.value]?.[key] || RENDERER_METRIC_MESSAGES.en[key];
  }

  function formatMilliseconds(value) {
    const number = nonNegativeNumber(value, Number.NaN);
    return Number.isFinite(number) ? `${number.toFixed(1)} ms` : EMPTY_VALUE;
  }

  function formatFps(value) {
    const number = nonNegativeNumber(value, Number.NaN);
    return Number.isFinite(number) ? number.toFixed(1) : EMPTY_VALUE;
  }

  function rendererMetricRows(metrics) {
    return [
      {
        key: 'fps',
        label: rendererText('fps'),
        value: formatFps(metrics?.fps),
        title: rendererText('fpsTooltip'),
      },
      {
        key: 'frameInterval',
        label: rendererText('frameInterval'),
        value: formatMilliseconds(metrics?.frameIntervalMs),
        title: rendererText('frameIntervalTooltip'),
      },
      {
        key: 'latency',
        label: rendererText('latency'),
        value: formatMilliseconds(metrics?.latencyMs),
        title: rendererText('latencyTooltip'),
      },
    ];
  }

  function operationMetricText(key) {
    return OPERATION_METRIC_MESSAGES[language.value]?.[key] || OPERATION_METRIC_MESSAGES.en[key];
  }

  function formatPercentage(value) {
    const number = nullableFraction(value);
    return number === null ? EMPTY_VALUE : `${(number * 100).toFixed(1)}%`;
  }

  function hasSamples(count) {
    return Number.isFinite(count) && count > 0;
  }

  function formatSampledMilliseconds(value, count) {
    return hasSamples(count) ? formatMilliseconds(value) : EMPTY_VALUE;
  }

  function formatSampledPercentage(value, count) {
    return hasSamples(count) ? formatPercentage(value) : EMPTY_VALUE;
  }

  function operationMetricRows(card) {
    if (card.key === 'main') {
      const metrics = card.mainOperationMetrics || {};
      return [
        {
          key: 'operation',
          label: operationMetricText('operation'),
          value: formatSampledMilliseconds(metrics.averageOperationMs, metrics.operationCount),
          title: operationMetricText('operationTooltip'),
        },
        {
          key: 'fileOpen',
          label: operationMetricText('fileOpen'),
          value: formatSampledMilliseconds(metrics.averageFileOpenMs, metrics.fileOpenCount),
          title: operationMetricText('fileOpenTooltip'),
        },
      ];
    }
    if (card.key === 'backend') {
      const metrics = card.backendCommunicationMetrics || {};
      return [
        {
          key: 'errorRate',
          label: operationMetricText('errorRate'),
          value: formatSampledPercentage(metrics.errorRate, metrics.requestCount),
          title: operationMetricText('errorRateTooltip'),
        },
        {
          key: 'communication',
          label: operationMetricText('communication'),
          value: formatSampledMilliseconds(metrics.averageCommunicationMs, metrics.requestCount),
          title: operationMetricText('communicationTooltip'),
        },
      ];
    }
    return [];
  }

  function formatCount(value) {
    return new Intl.NumberFormat(localeCode.value).format(
      Math.max(0, Math.round(finiteNumber(value, 0))),
    );
  }

  function formatTime(value) {
    if (!value) return EMPTY_VALUE;
    try {
      return new Intl.DateTimeFormat(localeCode.value, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date(value));
    } catch {
      return EMPTY_VALUE;
    }
  }

  function formatProgress(value) {
    return value === null || value === undefined
      ? EMPTY_VALUE
      : `${Math.round(Math.max(0, Math.min(100, value)))}%`;
  }

  function stateKey(value) {
    const state = String(value || '').toLowerCase();
    if (state.includes('queue')) return 'queued';
    if (state.includes('run') || state.includes('process')) return 'running';
    if (state.includes('complete') || state.includes('done') || state.includes('success'))
      return 'completed';
    if (state.includes('fail') || state.includes('error')) return 'failed';
    if (state.includes('wait') || state.includes('pending')) return 'waiting';
    return 'unknown';
  }

  return {
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
  };
}
