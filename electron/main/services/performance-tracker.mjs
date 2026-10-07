import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';

export const PERFORMANCE_SCHEMA_VERSION = 1;
export const MAX_PERFORMANCE_REPORT_BYTES = 64 * 1024;
export const MAX_PERFORMANCE_REPORTS = 20;

function finiteNonNegative(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw Error(`Invalid performance metric: ${label}`);
  return value;
}
function finiteNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw Error(`Invalid performance metric: ${label}`);
  return value;
}

function integerPid(value, label) {
  if (!Number.isInteger(value) || value < 1) throw Error(`Invalid performance pid: ${label}`);
  return value;
}

export function kibibytesToBytes(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return Math.round(value * 1024);
}

export function memoryMetricToBytes(metric) {
  const memory = metric?.memory || metric || {};
  return {
    workingSetBytes: kibibytesToBytes(memory.workingSetSize),
    peakWorkingSetBytes: kibibytesToBytes(memory.peakWorkingSetSize),
  };
}

export function sumMemoryMetrics(metrics) {
  const total = { workingSetBytes: 0, peakWorkingSetBytes: 0 };
  let processPeakWorkingSetBytes = 0,
    rssEstimateBytes = 0,
    hasProcessPeak = false,
    hasRssEstimate = false;
  for (const metric of metrics || []) {
    const value = metric?.workingSetBytes === undefined ? memoryMetricToBytes(metric) : metric;
    total.workingSetBytes += value.workingSetBytes || 0;
    total.peakWorkingSetBytes += value.peakWorkingSetBytes || 0;
    if (typeof value.processPeakWorkingSetBytes === 'number') {
      processPeakWorkingSetBytes += value.processPeakWorkingSetBytes;
      hasProcessPeak = true;
    }
    if (typeof value.rssEstimateBytes === 'number') {
      rssEstimateBytes += value.rssEstimateBytes;
      hasRssEstimate = true;
    }
  }
  if (hasProcessPeak) total.processPeakWorkingSetBytes = processPeakWorkingSetBytes;
  if (hasRssEstimate) {
    total.rssEstimateBytes = rssEstimateBytes;
    total.workingSetKind = 'rss-estimate';
  }
  return total;
}

const ROOT_KEYS = new Set([
  'schemaVersion',
  'capturedAtMs',
  'sampledAtMs',
  'openedAt',
  'durationMs',
  'firstScreenMs',
  'firstScreenTimeMs',
  'fileBytes',
  'pageCount',
  'scrollLongTaskCount',
  'scrollLongTaskTotalMs',
  'scrollLongTaskMaxMs',
  'requests',
  'requestBodyBytes',
  'responseBodyBytes',
  'uploadBytes',
  'layout',
  'nativeExtraction',
  'memory',
  'peakMemory',
  'bytes',
  'transferredBytes',
  'transport',
  'server',
  'renderer',
  'backend',
  'shared',
  'aggregate',
  'stages',
  'scrollLongTasks',
  'resize',
  'samples',
  'timingScope',
  'scope',
  'processPeakWorkingSetBytes',
  'rssEstimateBytes',
  'workingSetKind',
]);
const NESTED_KEYS = new Set([
  'schemaVersion',
  'capturedAtMs',
  'sampledAtMs',
  'openedAt',
  'durationMs',
  'firstScreenMs',
  'firstScreenTimeMs',
  'fileBytes',
  'pageCount',
  'scrollLongTaskCount',
  'scrollLongTaskTotalMs',
  'scrollLongTaskMaxMs',
  'requests',
  'requestBodyBytes',
  'responseBodyBytes',
  'uploadBytes',
  'totalBytes',
  'count',
  'totalDurationMs',
  'maxDurationMs',
  'lastDurationMs',
  'durationMs',
  'workingSetBytes',
  'peakWorkingSetBytes',
  'pid',
  'rendererPid',
  'backendPid',
  'mainPid',
  'gpuPid',
  'renderer',
  'backend',
  'main',
  'gpu',
  'scoped',
  'shared',
  'aggregate',
  'total',
  'memory',
  'peakMemory',
  'bytes',
  'transferredBytes',
  'layout',
  'nativeExtraction',
  'server',
  'processPeakWorkingSetBytes',
  'rssEstimateBytes',
  'workingSetKind',
  'transport',
  'stages',
  'scrollLongTasks',
  'longTasks',
  'firstScreen',
  'startMs',
  'resize',
  'layoutCommits',
  'snapshotTransitions',
  'samples',
  'scope',
  'timingScope',
  'gpuPids',
  'processPeakWorkingSetBytes',
  'totalMs',
  'maxMs',
  'fileRead',
  'upload',
  'pdfReady',
  'pageGeometry',
  'recentHistory',
  'restoreView',
]);
const OPTIONAL_KEYS = new Set([
  'fileBytes',
  'pageCount',
  'firstScreenMs',
  'firstScreenTimeMs',
  'durationMs',
  'startMs',
  'totalDurationMs',
  'maxDurationMs',
  'lastDurationMs',
  'count',
  'requests',
  'requestBodyBytes',
  'responseBodyBytes',
  'uploadBytes',
  'totalBytes',
  'workingSetBytes',
  'peakWorkingSetBytes',
  'processPeakWorkingSetBytes',
  'rssEstimateBytes',
  'scrollLongTaskCount',
  'scrollLongTaskTotalMs',
  'scrollLongTaskMaxMs',
  'layoutCommits',
  'snapshotTransitions',
  'memory',
  'transport',
  'fileRead',
  'upload',
  'pdfReady',
  'pageGeometry',
  'recentHistory',
  'restoreView',
]);
const OBJECT_ARRAY_KEYS = new Set(['samples', 'gpu']);

function plainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeObject(value, depth = 0, root = false) {
  if (depth > 6 || !plainObject(value)) throw Error('Invalid performance report object.');
  const output = {};
  for (const key of Object.keys(value)) {
    if (!(root ? ROOT_KEYS : NESTED_KEYS).has(key))
      throw Error(`Unsupported performance report field: ${key}`);
    const entry = value[key];
    if (entry === null && OPTIONAL_KEYS.has(key)) {
      output[key] = null;
      continue;
    }
    if (
      typeof entry === 'string' &&
      key === 'openedAt' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(entry) &&
      Number.isFinite(Date.parse(entry))
    ) {
      output[key] = entry;
      continue;
    }
    if (typeof entry === 'string' && key === 'workingSetKind' && entry === 'rss-estimate') {
      output[key] = entry;
      continue;
    }
    if (
      typeof entry === 'string' &&
      ((key === 'scope' && ['since-document-open', 'window-session'].includes(entry)) ||
        (key === 'timingScope' && ['since-document-open', 'window-session'].includes(entry)))
    ) {
      output[key] = entry;
      continue;
    }
    if (typeof entry === 'number') {
      const metric = key === 'startMs' ? finiteNumber(entry, key) : finiteNonNegative(entry, key);
      if (key.endsWith('Pid') || key === 'pid') integerPid(metric, key);
      output[key] = metric;
    } else if (plainObject(entry)) output[key] = normalizeObject(entry, depth + 1, false);
    else if (OBJECT_ARRAY_KEYS.has(key) && Array.isArray(entry)) {
      if (entry.length > 512) throw Error('Performance report samples are capped.');
      output[key] = entry.map((sample) => normalizeObject(sample, depth + 1, false));
    } else if (key === 'gpuPids' && Array.isArray(entry)) {
      if (entry.length > 32) throw Error('Performance report GPU process list is capped.');
      output[key] = entry.map((pid, index) =>
        integerPid(finiteNonNegative(pid, `${key}[${index}]`), `${key}[${index}]`),
      );
    } else throw Error(`Invalid performance report field: ${key}`);
  }
  return output;
}

export function validatePerformanceReport(value) {
  const report = normalizeObject(value, 0, true);
  if (report.schemaVersion !== PERFORMANCE_SCHEMA_VERSION)
    throw Error('Unsupported performance report schema.');
  const encoded = JSON.stringify(report);
  if (Buffer.byteLength(encoded, 'utf8') > MAX_PERFORMANCE_REPORT_BYTES)
    throw Error('Performance report exceeds 64 KiB.');
  return report;
}

export function appendPerformanceReport(reports, value) {
  const report = validatePerformanceReport(value);
  const valid = Array.isArray(reports) ? reports.map(validatePerformanceReport) : [];
  return [...valid, report].slice(-MAX_PERFORMANCE_REPORTS);
}

export async function loadPerformanceReports(path) {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8'));
    const values = Array.isArray(parsed) ? parsed : parsed?.reports;
    if (!Array.isArray(values)) return [];
    return values.map(validatePerformanceReport).slice(-MAX_PERFORMANCE_REPORTS);
  } catch {
    return [];
  }
}

export async function writePerformanceReports(path, reports) {
  const values = (Array.isArray(reports) ? reports : [])
    .map(validatePerformanceReport)
    .slice(-MAX_PERFORMANCE_REPORTS);
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(values, null, 2), 'utf8');
  await rename(temporary, path);
  return values.length;
}
