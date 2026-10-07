const SERVICE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const FIELD_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const FIELD_TYPES = new Set(['text', 'string', 'url', 'number', 'integer', 'boolean']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
export function validServiceId(value) {
  return typeof value === 'string' && SERVICE_ID.test(value);
}
function validFieldId(value) {
  return typeof value === 'string' && FIELD_ID.test(value);
}
function isSecretFieldId(value) {
  return /(?:api[_-]?key|auth[_-]?key|access[_-]?token)|(?:^|[_-])(token|secret|password|credential|key)(?:$|[_-])/i.test(
    value,
  );
}
function normalizeField(field) {
  if (!isRecord(field) || !validFieldId(field.id)) return null;
  const type = FIELD_TYPES.has(field.type) ? field.type : 'text';
  return {
    id: field.id,
    label: typeof field.label === 'string' && field.label ? field.label : field.id,
    type,
    secret: field.secret === true,
    default: field.default,
    required: field.required === true,
    ...(Array.isArray(field.choices) ? { choices: field.choices.slice(0, 100) } : {}),
    ...(Number.isFinite(field.min) ? { min: field.min } : {}),
    ...(Number.isFinite(field.max) ? { max: field.max } : {}),
    integer: field.integer === true,
  };
}
function normalizeService(service) {
  if (!isRecord(service) || !validServiceId(service.id)) return null;
  const fields = [];
  const seen = new Set();
  for (const field of Array.isArray(service.fields) ? service.fields : []) {
    const normalized = normalizeField(field);
    if (normalized && !seen.has(normalized.id)) {
      seen.add(normalized.id);
      fields.push(normalized);
    }
  }
  return {
    id: service.id,
    label: typeof service.label === 'string' && service.label ? service.label : service.id,
    fields,
    ...(typeof service.supportsPrompt === 'boolean'
      ? { supportsPrompt: service.supportsPrompt }
      : {}),
  };
}
export function normalizeTranslationServiceSchema(raw, engine, version = '') {
  const source = isRecord(raw) ? raw : {};
  const services = [];
  const seen = new Set();
  for (const service of Array.isArray(source.services) ? source.services : []) {
    const normalized = normalizeService(service);
    if (normalized && !seen.has(normalized.id)) {
      seen.add(normalized.id);
      services.push(normalized);
    }
  }
  return {
    id: validServiceId(source.id) ? source.id : engine,
    version: typeof source.version === 'string' ? source.version : version,
    services,
    ...(typeof source.reason === 'string' && source.reason ? { reason: source.reason } : {}),
  };
}

export function cloneTranslationServices(value) {
  const result = {};
  if (!isRecord(value)) return result;
  for (const [engine, config] of Object.entries(value)) {
    if (!validServiceId(engine) || !isRecord(config) || !validServiceId(config.id)) continue;
    const values = isRecord(config.values)
      ? Object.fromEntries(
          Object.entries(config.values).filter(
            ([id, entry]) =>
              validFieldId(id) &&
              !isSecretFieldId(id) &&
              (typeof entry === 'string' ||
                (typeof entry === 'number' && Number.isFinite(entry)) ||
                typeof entry === 'boolean'),
          ),
        )
      : {};
    const profiles = {};
    if (isRecord(config.profiles))
      for (const [service, profile] of Object.entries(config.profiles))
        if (validServiceId(service) && isRecord(profile))
          profiles[service] = {
            values: isRecord(profile.values)
              ? Object.fromEntries(
                  Object.entries(profile.values).filter(
                    ([id, entry]) =>
                      validFieldId(id) &&
                      !isSecretFieldId(id) &&
                      (typeof entry === 'string' ||
                        (typeof entry === 'number' && Number.isFinite(entry)) ||
                        typeof entry === 'boolean'),
                  ),
                )
              : {},
          };
    result[engine] = { id: config.id, values, profiles };
  }
  return result;
}
