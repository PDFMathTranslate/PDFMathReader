import { computed, ref, watch, onBeforeUnmount } from 'vue';

export function useProviderModels({ service, fieldValue, engine, providerId, sharedKey }) {
  const models = ref([]),
    loading = ref(false),
    error = ref('');
  let controller;
  const fields = computed(() => {
    const list = service.value?.fields || [];
    const model = list.find((f) => /(?:^|_)model$/i.test(f.id));
    const key = list.find((f) => f.secret && /api_key|^key$/i.test(f.id));
    const base = list.find((f) => !f.secret && /base_url|api_base|endpoint/i.test(f.id));
    const compatible = /openai|silicon|deepseek|modelscope|model.?scope|moonshot|zhipu/i.test(
      service.value?.id || '',
    );
    return compatible && model && key ? { model, key, base } : null;
  });
  const request = computed(() => {
    const f = fields.value;
    if (!f) return null;
    const apiKey = String(fieldValue(f.key) || '').trim();
    const baseUrl = String(f.base ? fieldValue(f.base) || '' : '').trim();
    return {
      baseUrl:
        baseUrl || (service.value.id.toLowerCase() === 'openai' ? 'https://api.openai.com/v1' : ''),
      apiKey,
      useSharedKey: !apiKey && service.value.id === 'openai' && sharedKey.value,
    };
  });
  const available = computed(
    () => !!request.value?.baseUrl && !!(request.value.apiKey || request.value.useSharedKey),
  );
  watch(
    () => [engine.value, providerId.value, JSON.stringify(request.value)],
    () => {
      controller?.abort();
      controller = null;
      models.value = [];
      error.value = '';
      loading.value = false;
    },
    { flush: 'sync' },
  );
  async function refresh() {
    if (!available.value || loading.value) return;
    const active = new AbortController();
    controller = active;
    loading.value = true;
    error.value = '';
    models.value = [];
    try {
      const response = await fetch('/api/providers/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request.value),
        signal: active.signal,
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || 'Could not retrieve models.');
      if (controller === active) models.value = data.models;
    } catch (e) {
      if (controller === active && !active.signal.aborted) error.value = e.message;
    } finally {
      if (controller === active) loading.value = false;
    }
  }
  onBeforeUnmount(() => controller?.abort());
  return { fields, models, loading, error, available, refresh };
}
