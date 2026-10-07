import { randomUUID } from 'node:crypto';
import { isProviderConfigured } from '../../../shared/translation/provider-groups.mjs';
import { normalizeTranslationServiceSchema } from '../../../shared/translation/service-schema.mjs';

// Credentials stay in the main process; renderer context contains labels only.
export function createDeveloperTestRunner({
  readers,
  loadCredentials,
  request,
  defaultReader = () => undefined,
}) {
  let run = null,
    controller = null,
    starting = false;
  const snapshot = () => (run ? structuredClone(run) : null);
  const candidates = () => readers().filter((reader) => !reader.settingsOwner);
  function select(windowId) {
    const list = candidates(),
      id = windowId ?? defaultReader();
    const reader =
      id === undefined ? list[0] : list.find((reader) => String(reader.id) === String(id));
    if (!reader) throw Error('The selected reader is no longer available.');
    return { reader, list };
  }
  async function context(windowId) {
    const { reader, list } = select(windowId),
      settings = structuredClone(reader.preferences);
    const engine = settings.engine || 'pdf_inspector';
    const raw = await request(reader, `/api/engines/${engine}/services`, undefined, {
      timeoutMs: 20000,
    });
    const schema = normalizeTranslationServiceSchema(raw, engine);
    const credentials = await loadCredentials();
    const config = settings.translationServices?.[engine] || {};
    const selected =
      schema.services.find((service) => service.id === config.id)?.id ||
      schema.services[0]?.id ||
      config.id ||
      'auto';
    const providers = schema.services.map((service) => ({
      id: service.id,
      label: service.label,
      configured: isProviderConfigured(service, config, credentials?.[engine] || {}),
    }));
    return {
      public: {
        windowId: reader.id,
        engine,
        language: settings.language || 'Simplified Chinese',
        sourceLanguage: settings.sourceLanguage || 'English',
        concurrency: settings.concurrency || 2,
        pageConcurrency: settings.pageConcurrency || 2,
        providerId: selected,
        providers,
        readers: list.map((item) => ({ id: item.id, title: item.title || `Reader ${item.id}` })),
      },
      reader,
      settings,
      credentials,
      schema,
      config,
    };
  }
  function selection(ctx, id) {
    const service = ctx.schema.services.find((item) => item.id === id);
    if (!service) throw Error('The selected provider is not available for this kernel.');
    const saved =
      ctx.config.profiles?.[id]?.values || (ctx.config.id === id ? ctx.config.values : {}) || {};
    const secret = ctx.credentials?.[ctx.public.engine]?.[id] || {};
    return {
      id,
      values: Object.fromEntries(
        service.fields
          .map((field) => [
            field.id,
            field.secret ? secret[field.id] : (saved[field.id] ?? field.default),
          ])
          .filter(([, value]) => value !== undefined),
      ),
    };
  }
  const sanitize = (value, ctx) => {
    let result = String(value || '');
    const secrets = Object.values(ctx.credentials?.[ctx.public.engine] || {})
      .flatMap((values) => Object.values(values))
      .filter((value) => typeof value === 'string' && value);
    for (const secret of secrets) result = result.replaceAll(secret, '[redacted]');
    return result.slice(0, 4000);
  };
  async function execute(ctx, kind, entries) {
    for (const entry of entries) {
      if (controller.signal.aborted) break;
      if (kind === 'batch' && !entry.configured) {
        entry.status = 'skipped';
        entry.message = 'Required provider settings are missing.';
        continue;
      }
      entry.status = 'running';
      const started = performance.now();
      try {
        const body = {
          kind: kind === 'kernel' ? 'kernel' : 'provider',
          engine: ctx.public.engine,
          language: ctx.public.language,
          sourceLanguage: ctx.public.sourceLanguage,
          concurrency: ctx.public.concurrency,
          pageConcurrency: ctx.public.pageConcurrency,
          advancedOptions: ctx.settings.kernelAdvancedOptions?.[ctx.public.engine] || {},
          ...(kind !== 'kernel' ? { translationService: selection(ctx, entry.id) } : {}),
        };
        const result = await request(ctx.reader, '/api/developer/test', body, {
          timeoutMs: 95000,
          signal: controller.signal,
        });
        entry.status = result.status === 'success' ? 'success' : 'error';
        entry.message = sanitize(result.message, ctx);
        if (result.output) entry.output = sanitize(result.output, ctx);
        entry.elapsedMs = Number.isFinite(result.elapsedMs)
          ? result.elapsedMs
          : Math.round(performance.now() - started);
      } catch (error) {
        entry.status = controller.signal.aborted ? 'cancelled' : 'error';
        entry.message = controller.signal.aborted
          ? 'Test cancelled.'
          : sanitize(error.message, ctx);
        entry.elapsedMs = Math.round(performance.now() - started);
      }
    }
    for (const entry of entries)
      if (entry.status === 'pending') {
        entry.status = 'cancelled';
        entry.message = 'Test cancelled.';
      }
    run.running = false;
  }
  return {
    context: async (windowId) => (await context(windowId)).public,
    status: snapshot,
    async start({ kind, windowId } = {}) {
      if (!['kernel', 'provider', 'batch'].includes(kind)) throw Error('Unknown developer test.');
      if (starting || run?.running) throw Error('A developer test is already running.');
      starting = true;
      controller = new AbortController();
      try {
        const ctx = await context(windowId);
        controller.signal.throwIfAborted();
        const targets =
          kind === 'kernel'
            ? [{ id: 'kernel', label: ctx.public.engine, configured: true }]
            : kind === 'batch'
              ? ctx.public.providers
              : [
                  ctx.public.providers.find((service) => service.id === ctx.public.providerId) || {
                    id: ctx.public.providerId,
                    label: ctx.public.providerId,
                    configured: false,
                  },
                ];
        run = {
          id: randomUUID(),
          kind,
          windowId: ctx.public.windowId,
          engine: ctx.public.engine,
          running: true,
          results: targets.map((item) => ({
            ...item,
            status: 'pending',
            message: '',
            elapsedMs: 0,
          })),
        };
        void execute(ctx, kind, run.results).catch(() => {
          for (const entry of run.results)
            if (['pending', 'running'].includes(entry.status)) {
              entry.status = 'error';
              entry.message = 'Developer test could not finish.';
            }
          run.running = false;
        });
        return snapshot();
      } finally {
        starting = false;
      }
    },
    cancel() {
      controller?.abort();
      return snapshot();
    },
  };
}
