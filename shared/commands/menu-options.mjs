// Never include credential values in native menu metadata.
export function configuredMenuServices(schema, config = {}, credentials = {}) {
  return (schema?.services || [])
    .filter((service) => {
      if (service.id === 'chatgpt-subscription' && service.available !== true) return false;
      if (service.id === 'auto' || service.id === 'apple-local') return true;
      const profile =
        config.profiles?.[service.id]?.values ||
        (config.id === service.id ? config.values : {}) ||
        {};
      const secrets = credentials[service.id] || {};
      const fields = service.fields || [];
      const present = (field) => {
        const value = field.secret ? secrets[field.id] : (profile[field.id] ?? field.default);
        return typeof value === 'string' ? !!value.trim() : value !== undefined && value !== null;
      };
      if (!fields.filter((field) => field.required).every(present)) return false;
      return (
        Object.keys(profile).length > 0 ||
        Object.keys(secrets).length > 0 ||
        !fields.some((field) => field.secret)
      );
    })
    .map(({ id, label }) => ({ value: id, label }));
}
