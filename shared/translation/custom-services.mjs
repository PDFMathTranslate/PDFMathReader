// User-defined OpenAI-compatible services are stored once for the application
// and projected into each kernel as that kernel's own OpenAI-compatible backend.
export const CUSTOM_SERVICE_PREFIX = 'custom-';
export const CUSTOM_CREDENTIAL_BUCKET = 'custom';
export const MAX_CUSTOM_SERVICES = 32;
export const MAX_CUSTOM_SERVICE_NAME = 80;
const CUSTOM_ID = /^custom-[a-z0-9]{8,32}$/;
const TEXT_LIMIT = 2048;

// Backend service and field ids for each kernel's OpenAI-compatible translator.
const BACKENDS = Object.freeze({
  pdf_inspector: { service: 'openai', key: 'key', baseUrl: 'base_url', model: 'model' },
  pdf_math_fast: { service: 'openailiked', key: 'api_key', baseUrl: 'base_url', model: 'model' },
  pdf_math_precise: {
    service: 'openaicompatible',
    key: 'openai_compatible_api_key',
    baseUrl: 'openai_compatible_base_url',
    model: 'openai_compatible_model',
  },
});

const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const singleLine = (value, limit) =>
  typeof value === 'string' && value.length <= limit && !/[\r\n\0]/.test(value);

export function isCustomServiceId(value) {
  return typeof value === 'string' && CUSTOM_ID.test(value);
}

export function createCustomServiceId(random = globalThis.crypto) {
  const bytes = random.getRandomValues(new Uint8Array(6));
  return CUSTOM_SERVICE_PREFIX + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function validCustomService(value) {
  return (
    record(value) &&
    isCustomServiceId(value.id) &&
    singleLine(value.name, MAX_CUSTOM_SERVICE_NAME) &&
    singleLine(value.base_url ?? '', TEXT_LIMIT) &&
    singleLine(value.model ?? '', TEXT_LIMIT)
  );
}

export function isValidCustomServices(value) {
  if (!Array.isArray(value) || value.length > MAX_CUSTOM_SERVICES) return false;
  const ids = new Set();
  for (const entry of value) {
    if (!validCustomService(entry) || ids.has(entry.id)) return false;
    ids.add(entry.id);
  }
  return true;
}

export function cloneCustomServices(value) {
  const result = [],
    ids = new Set();
  for (const entry of Array.isArray(value) ? value : []) {
    if (!validCustomService(entry) || ids.has(entry.id)) continue;
    ids.add(entry.id);
    result.push({
      id: entry.id,
      name: entry.name,
      base_url: entry.base_url || '',
      model: entry.model || '',
    });
    if (result.length === MAX_CUSTOM_SERVICES) break;
  }
  return result;
}

// A kernel can host custom services only when its catalog ships the backend.
export function customBackendFor(kernel, services = []) {
  const backend = BACKENDS[kernel];
  return backend && services.some((service) => service.id === backend.service) ? backend : null;
}

export function customServiceDescriptors(kernel, services, customServices) {
  if (!customBackendFor(kernel, services)) return [];
  return cloneCustomServices(customServices).map((entry) => ({
    id: entry.id,
    label: entry.name || entry.id,
    custom: true,
    fields: [
      { id: 'key', label: 'API key', type: 'string', secret: true, required: true },
      { id: 'base_url', label: 'Base URL', type: 'url', required: true },
      { id: 'model', label: 'Model', type: 'string', required: true },
    ],
  }));
}

// Present global definitions as ordinary per-kernel profiles and secrets.
export function withCustomProfiles(config = {}, customServices = []) {
  const profiles = { ...(record(config.profiles) ? config.profiles : {}) };
  let values = config.values;
  for (const entry of cloneCustomServices(customServices)) {
    const entryValues = {
      ...(entry.base_url ? { base_url: entry.base_url } : {}),
      ...(entry.model ? { model: entry.model } : {}),
    };
    profiles[entry.id] = { values: entryValues };
    if (config.id === entry.id) values = entryValues;
  }
  return { ...config, values, profiles };
}

export function withCustomCredentials(credentials = {}, kernel = '') {
  const custom = record(credentials?.[CUSTOM_CREDENTIAL_BUCKET])
    ? credentials[CUSTOM_CREDENTIAL_BUCKET]
    : {};
  if (!kernel || !Object.keys(custom).length) return credentials || {};
  return {
    ...credentials,
    [kernel]: { ...(record(credentials?.[kernel]) ? credentials[kernel] : {}), ...custom },
  };
}

export function customSelectionValues(id, customServices = [], credentials = {}) {
  const entry = cloneCustomServices(customServices).find((item) => item.id === id);
  if (!entry) return null;
  const key = credentials?.[CUSTOM_CREDENTIAL_BUCKET]?.[id]?.key;
  return {
    ...(entry.base_url ? { base_url: entry.base_url } : {}),
    ...(entry.model ? { model: entry.model } : {}),
    ...(typeof key === 'string' && key ? { key } : {}),
  };
}

// Server side: rewrite a custom selection into the kernel's backend selection.
export function resolveCustomSelection(kernel, selection) {
  if (!isCustomServiceId(selection?.id)) return selection;
  const backend = BACKENDS[kernel];
  if (!backend) throw Error('Unsupported translation service for this kernel');
  const values = record(selection.values) ? selection.values : {};
  const text = (name) => (typeof values[name] === 'string' ? values[name].trim() : '');
  const key = text('key'),
    baseUrl = text('base_url'),
    model = text('model');
  if (!key || !baseUrl || !model)
    throw Error('API key, Base URL and Model are required for this OpenAI-compatible service');
  return {
    id: backend.service,
    values: { [backend.key]: key, [backend.baseUrl]: baseUrl, [backend.model]: model },
  };
}
