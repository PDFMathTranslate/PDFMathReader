export function providerPortEndpoint(service, config = {}) {
  if (!['ollama', 'xinference'].includes(service.id.toLowerCase())) return null;
  const values =
    config.profiles?.[service.id]?.values ||
    (config.id === service.id ? config.values : null) ||
    {};
  const field = (service.fields || []).find(
    (field) => !field.secret && /(?:^|_)(host|base_url|endpoint|url)$/i.test(field.id),
  );
  return String(
    field
      ? (values[field.id] ?? field.default ?? '')
      : service.id.toLowerCase() === 'ollama'
        ? 'http://127.0.0.1:11434'
        : 'http://127.0.0.1:9997',
  );
}
const record = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
function validValue(field, value) {
  const missing =
    value === undefined || value === null || (typeof value === 'string' && !value.trim());
  if (missing) return !field.required;
  if (field.type === 'boolean') return typeof value === 'boolean';
  if (field.type === 'integer' || field.type === 'number') {
    const number =
      typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    return (
      Number.isFinite(number) &&
      (!(field.type === 'integer' || field.integer) || Number.isInteger(number)) &&
      (!Number.isFinite(field.min) || number >= field.min) &&
      (!Number.isFinite(field.max) || number <= field.max)
    );
  }
  if (field.choices?.length && !field.choices.some((choice) => String(choice) === String(value)))
    return false;
  if (field.type === 'url') {
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
    } catch {
      return false;
    }
  }
  return typeof value === 'string';
}
export function isProviderConfigured(service, config = {}, credentials = {}) {
  if (service?.id === 'chatgpt-subscription' && service.available !== true) return false;
  const saved = config.profiles?.[service.id]?.values;
  const values = record(saved)
    ? saved
    : config.id === service.id && record(config.values)
      ? config.values
      : {};
  const secrets = record(credentials[service.id]) ? credentials[service.id] : {};
  const fields = service.fields || [];
  if (
    !fields.every((field) =>
      validValue(
        field,
        field.secret
          ? secrets[field.id]
          : Object.hasOwn(values, field.id)
            ? values[field.id]
            : field.default,
      ),
    )
  )
    return false;
  return (
    !fields.some((field) => field.secret) ||
    Object.keys(values).length > 0 ||
    Object.values(secrets).some((value) => typeof value === 'string' && !!value.trim())
  );
}
export function groupProviders(services, config = {}, credentials = {}, history = {}, ports = {}) {
  const groups = [
    { id: 'configured', services: [] },
    { id: 'unconfigured', services: [] },
    { id: 'error', services: [] },
  ];
  for (const service of services) {
    const status = history?.[service.id]?.status;
    const group =
      status === 'error'
        ? groups[2]
        : isProviderConfigured(service, config, credentials) &&
            (providerPortEndpoint(service, config) === null || ports[service.id] === true)
          ? groups[0]
          : groups[1];
    group.services.push(service);
  }
  return groups;
}

// Reflect the shared secure credential in UI availability without exposing it.
export function withSharedOpenAIKey(services, credentials = {}, configured = false) {
  if (!configured) return credentials;
  const fields = services.find((service) => service.id === 'openai')?.fields || [];
  const shared = Object.fromEntries(
    fields
      .filter((field) => field.secret && /api_key|^key$/i.test(field.id))
      .map((field) => [field.id, 'configured']),
  );
  return { ...credentials, openai: { ...shared, ...credentials.openai } };
}
