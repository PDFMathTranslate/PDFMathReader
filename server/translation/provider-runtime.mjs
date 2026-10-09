import { LANGUAGE_CODES, translationLanguageCode } from '../../shared/translation/languages.mjs';
import { selectTranslationProvider, createTranslationProvider } from './translation-provider.mjs';

const autoService = { id: 'auto', label: 'Automatic (SiliconFlow free)', fields: [] };
const freeService = { id: 'siliconflow-free', label: 'SiliconFlow free', fields: [] };
const inspectorOpenAI = {
  id: 'openai',
  label: 'OpenAI compatible',
  fields: [
    { id: 'key', label: 'API key', type: 'string', secret: true, required: true },
    { id: 'base_url', label: 'Base URL', type: 'string', default: 'https://api.openai.com/v1' },
    { id: 'model', label: 'Model', type: 'string', default: 'gpt-4.1-mini' },
  ],
};

export function createTranslationRuntime({
  engines,
  localTranslator,
  providerFetch = globalThis.fetch,
  cacheDirectory,
  appVersion = 'development',
  getApiKey = () => process.env.OPENAI_API_KEY,
  sessionId,
  developerMockCompletion,
} = {}) {
  let freeServiceNoticeIssued = false;
  const providerClient = createTranslationProvider(providerFetch, { cacheDirectory });
  const providerClientComplete = providerClient.complete;
  providerClient.complete = (provider, body, signal, options = {}) => {
    if (provider?.developerMock === true) return developerMockCompletion(body, provider);
    if (provider?.developerTest === true)
      return providerClientComplete(provider, body, signal, { ...options, cache: false });
    return providerClientComplete(provider, body, signal, options);
  };

  async function translationServices(id) {
    const catalog =
      id === 'pdf_inspector'
        ? { id, version: appVersion, services: [inspectorOpenAI] }
        : await engines.services(id);
    return {
      ...catalog,
      services: [
        autoService,
        freeService,
        ...catalog.services.filter((service) => service.id !== 'siliconflow-free'),
        ...((await localTranslator.available())
          ? [{ id: 'apple-local', label: 'Apple Translation (on device)', fields: [] }]
          : []),
      ],
    };
  }

  async function providerFor(
    selection,
    kernel,
    sourceLanguage,
    language,
    { cacheOnly = false } = {},
  ) {
    if (!selection || selection.id === 'auto')
      return {
        ...selectTranslationProvider(''),
        kernel,
        language: LANGUAGE_CODES[language] || language,
      };
    if (selection.id === 'siliconflow-free')
      return {
        ...selectTranslationProvider(''),
        explicit: true,
        kernel,
        language: LANGUAGE_CODES[language] || language,
      };
    if (selection.id === 'apple-local') {
      if (!(await localTranslator.available()))
        throw Error('Apple Translation requires macOS 26 or later.');
      return {
        id: 'apple-local',
        model: 'apple-local',
        identity: { service: 'apple-local' },
        kernel,
        source: translationLanguageCode(sourceLanguage || 'English'),
        language: LANGUAGE_CODES[language] || language,
      };
    }
    if (kernel !== 'pdf_inspector') {
      if (selection.id === 'openai' && !cacheOnly) {
        const catalog = await engines.services(kernel),
          service = catalog.services.find((service) => service.id === 'openai');
        const field = service?.fields.find(
          (field) => field.secret && /api_key|^key$/i.test(field.id),
        );
        if (field && !selection.values?.[field.id] && getApiKey())
          selection = { ...selection, values: { ...selection.values, [field.id]: getApiKey() } };
      }
      return { id: selection.id, model: selection.id, native: true, kernel, selection };
    }
    if (selection.id !== 'openai') throw Error('Unsupported translation service for Inspector');
    const values = selection.values || {},
      key = values.key || getApiKey() || '',
      model = values.model || 'gpt-4.1-mini',
      baseUrl = values.base_url || 'https://api.openai.com/v1';
    if (typeof key !== 'string' || !key.trim() || typeof model !== 'string' || !model.trim())
      throw Error('API key and model are required');
    const endpoint = new URL(baseUrl);
    if (!['https:', 'http:'].includes(endpoint.protocol) || endpoint.username || endpoint.password)
      throw Error('Invalid translation base URL');
    return {
      id: 'openai',
      key,
      model,
      baseUrl,
      identity: { service: 'openai', baseUrl, model },
      kernel,
    };
  }

  async function complete(provider, body, signal, options) {
    if (provider.id !== 'apple-local') {
      const { sourceText, ...request } = body;
      return providerClient.complete(provider, request, signal, options);
    }
    const text = body.sourceText;
    if (typeof text !== 'string') throw Error('Apple Translation requires source text');
    const translation = await localTranslator.translate({
      text,
      source: provider.source,
      target: provider.language,
      signal,
    });
    return Response.json({
      model: provider.model,
      choices: [{ message: { role: 'assistant', content: translation } }],
    });
  }

  function serviceHeader(res, provider) {
    res.setHeader('X-Translation-Service', provider.id);
    res.setHeader('X-Translation-Session', sessionId);
    if (provider.id === 'siliconflow-free' && !provider.explicit && !freeServiceNoticeIssued) {
      freeServiceNoticeIssued = true;
      res.setHeader('X-Free-Service-Notice', '1');
    }
  }

  return {
    providerClient,
    translationServices,
    providerFor,
    complete,
    serviceHeader,
  };
}
