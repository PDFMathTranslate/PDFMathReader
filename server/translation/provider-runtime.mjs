import {
  LANGUAGE_CODES,
  translationLanguageCode,
  translationLanguagesForKernel,
} from '../../shared/translation/languages.mjs';
import {
  cloneCustomServices,
  customSelectionValues,
  customServiceDescriptors,
  resolveCustomSelection,
} from '../../shared/translation/custom-services.mjs';
import { isProviderConfigured } from '../../shared/translation/provider-groups.mjs';
import { selectTranslationProvider, createTranslationProvider } from './translation-provider.mjs';

const autoService = { id: 'auto', label: 'Automatic (SiliconFlow free)', fields: [] };
const freeService = { id: 'siliconflow-free', label: 'SiliconFlow free', fields: [] };
const COMPANION_KERNELS = Object.freeze(['pdf_math_fast', 'pdf_math_precise']);
const COMPANION_SERVICE_IDS = new Set([
  'auto',
  'siliconflow-free',
  'chatgpt-subscription',
  'apple-local',
]);
const LANGUAGE_NAMES_BY_CODE = Object.freeze(
  Object.fromEntries(Object.entries(LANGUAGE_CODES).map(([name, code]) => [code, name])),
);
const LANGUAGE_CODE_ALIASES = Object.freeze({
  'zh-cn': 'zh',
  'zh-hans': 'zh',
  'zh-tw': 'zh-TW',
  'zh-hant': 'zh-TW',
  'zh-hk': 'zh-HK',
  'zh-hant-hk': 'zh-HK',
});
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
  chatGPTSubscription,
  cacheDirectory,
  appVersion = 'development',
  getApiKey = () => process.env.OPENAI_API_KEY,
  getCompanionTranslationSettings,
  getCompanionTranslationOptions,
  getCompanionTranslationSelection,
  sessionId,
  developerMockCompletion,
} = {}) {
  let freeServiceNoticeIssued = false;
  const providerClient = createTranslationProvider(providerFetch, { cacheDirectory });
  const providerClientComplete = providerClient.complete;
  providerClient.complete = (provider, body, signal, options = {}) => {
    if (provider?.id === 'chatgpt-subscription')
      return chatGPTSubscription
        .complete({ ...body, model: provider.model }, signal, { clientId: provider.clientId })
        .then((data) => Response.json(data));
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
        ...(chatGPTSubscription
          ? [
              {
                id: 'chatgpt-subscription',
                label: 'ChatGPT Subscription',
                available: (await chatGPTSubscription.status()).signedIn === true,
                fields: [{ id: 'model', label: 'Model', type: 'string', required: true }],
              },
            ]
          : []),
        ...catalog.services.filter((service) => service.id !== 'siliconflow-free'),
        ...((await localTranslator.available())
          ? [{ id: 'apple-local', label: 'Apple Translation (on device)', fields: [] }]
          : []),
      ],
    };
  }

  const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const languageOptions = (engine, direction) =>
    translationLanguagesForKernel(engine, direction).map((name) => ({
      name,
      code: LANGUAGE_CODES[name] || name,
    }));
  const kernelLanguageCapabilities = (engine) => ({
    id: engine,
    sourceLanguages: languageOptions(engine, 'source'),
    targetLanguages: languageOptions(engine, 'target'),
  });

  // The Electron host supplies a live snapshot of reader preferences and the
  // encrypted service credential store. A legacy options callback remains
  // supported for server-side callers and tests that already provide the
  // credential-free projection directly.
  const configuredCompanionTranslation = async () => {
    if (typeof getCompanionTranslationSettings === 'function')
      return getCompanionTranslationSettings();
    if (typeof getCompanionTranslationOptions === 'function')
      return getCompanionTranslationOptions();
    return getCompanionTranslationOptions;
  };

  const settingsParts = (configured) => {
    if (!isRecord(configured)) return { preferences: {}, credentials: {} };
    if (isRecord(configured.preferences) || isRecord(configured.credentials))
      return {
        preferences: isRecord(configured.preferences) ? configured.preferences : {},
        credentials: isRecord(configured.credentials) ? configured.credentials : {},
      };
    return { preferences: configured, credentials: {} };
  };

  const configFor = (preferences, kernel) => {
    const config = preferences?.translationServices?.[kernel];
    return isRecord(config) ? config : {};
  };

  const profileValuesFor = (preferences, kernel, service) => {
    const config = configFor(preferences, kernel);
    const values = config.id === service && isRecord(config.values) ? config.values : {};
    const profile = config.profiles?.[service]?.values;
    return {
      ...values,
      ...(isRecord(profile) ? profile : {}),
    };
  };

  const selectionFor = (preferences, credentials, customServices, kernel, service) => {
    if (service === 'auto') return { id: 'auto', values: {} };
    if (typeof service === 'string' && service.startsWith('custom-'))
      return {
        id: service,
        values: customSelectionValues(service, customServices, credentials) || {},
      };
    return {
      id: service,
      values: {
        ...profileValuesFor(preferences, kernel, service),
        ...(isRecord(credentials?.[kernel]?.[service]) ? credentials[kernel][service] : {}),
      },
    };
  };

  const activeServiceFor = (preferences, kernel) => {
    const id = configFor(preferences, kernel).id;
    return typeof id === 'string' && id ? id : 'auto';
  };

  const keyConfigured = () => {
    try {
      const key = getApiKey();
      return typeof key === 'string' && !!key.trim();
    } catch {
      return false;
    }
  };

  const configuredNativeService = (service, preferences, credentials, kernel) => {
    const kernelCredentials = isRecord(credentials?.[kernel]) ? { ...credentials[kernel] } : {};
    if (service.id === 'openai' && keyConfigured()) {
      const keyField = (service.fields || []).find(
        (field) => field.secret && /api_key|^key$/i.test(field.id),
      );
      if (keyField)
        kernelCredentials.openai = {
          ...(kernelCredentials.openai || {}),
          [keyField.id]: 'configured',
        };
    }
    return isProviderConfigured(service, configFor(preferences, kernel), kernelCredentials);
  };

  const customServiceReady = (service, customServices, credentials) => {
    const values = customSelectionValues(service.id, customServices, credentials);
    return !!(values?.key && values?.base_url && values?.model);
  };

  const localSupportedLanguages = async () => {
    if (typeof localTranslator?.supportedLanguages !== 'function') return undefined;
    try {
      return await localTranslator.supportedLanguages();
    } catch {
      return undefined;
    }
  };

  const companionLanguageOption = (entry) => {
    const rawName = typeof entry === 'string' ? entry : entry?.name;
    const rawCode = typeof entry === 'string' ? entry : entry?.code;
    if (typeof rawName !== 'string' && typeof rawCode !== 'string') return null;
    const name = typeof rawName === 'string' ? rawName.trim() : '';
    const code = typeof rawCode === 'string' ? rawCode.trim().replaceAll('_', '-') : '';
    if (!name && !code) return null;
    const normalizedCode = LANGUAGE_CODE_ALIASES[code.toLowerCase()] || code;
    // Translation.framework reports regional identifiers such as ar-AE and
    // en-US. The companion contract uses the shared base language when that
    // base is one of the kernel's canonical options; explicit Chinese script
    // aliases above retain their distinct Simplified/Traditional choices.
    const baseCode = normalizedCode.split('-')[0];
    const canonicalLookupCode = LANGUAGE_NAMES_BY_CODE[normalizedCode]
      ? normalizedCode
      : LANGUAGE_NAMES_BY_CODE[baseCode]
        ? baseCode
        : normalizedCode;
    const canonicalName =
      LANGUAGE_NAMES_BY_CODE[canonicalLookupCode] ||
      (name && LANGUAGE_CODES[name] ? name : canonicalLookupCode || name);
    const canonicalCode = LANGUAGE_CODES[canonicalName] || canonicalLookupCode;
    return canonicalName && canonicalCode ? { name: canonicalName, code: canonicalCode } : null;
  };

  const localLanguageCapabilities = (engine, value) => {
    if (!value) return null;
    const selected = value?.[engine] ?? value;
    if (!selected) return null;
    const toOptions = (entries, fallbackDirection) => {
      if (!Array.isArray(entries)) return languageOptions(engine, fallbackDirection);
      const allowed = new Map(
        languageOptions(engine, fallbackDirection).map((entry) => [entry.code, entry]),
      );
      const result = [];
      const seen = new Set();
      for (const entry of entries) {
        const option = companionLanguageOption(entry);
        const canonical = option && allowed.get(option.code);
        if (!canonical || seen.has(canonical.code)) continue;
        seen.add(canonical.code);
        result.push(canonical);
      }
      return result;
    };
    if (Array.isArray(selected))
      return {
        sourceLanguages: toOptions(selected, 'source'),
        targetLanguages: toOptions(selected, 'target'),
      };
    if (!isRecord(selected)) return null;
    return {
      sourceLanguages: toOptions(selected.sourceLanguages, 'source'),
      targetLanguages: toOptions(selected.targetLanguages, 'target'),
    };
  };

  async function companionState(configured) {
    // A caller that already supplies the internal projection can continue to
    // use it. It is still reduced by the HTTP route before crossing the LAN.
    if (isRecord(configured) && Array.isArray(configured.services)) return configured;

    const { preferences, credentials } = settingsParts(configured);
    const customServices = cloneCustomServices(preferences.customTranslationServices);
    const catalogs = new Map();
    for (const kernel of COMPANION_KERNELS) {
      try {
        const catalog = await engines?.services?.(kernel);
        catalogs.set(kernel, isRecord(catalog) ? catalog : { services: [] });
      } catch {
        catalogs.set(kernel, { services: [] });
      }
    }
    let appleAvailable = false;
    try {
      appleAvailable = (await localTranslator?.available?.()) === true;
    } catch {}
    const appleLanguages = appleAvailable ? await localSupportedLanguages() : undefined;
    const services = new Map();
    const selections = Object.fromEntries(COMPANION_KERNELS.map((kernel) => [kernel, {}]));
    const perKernel = new Map(COMPANION_KERNELS.map((kernel) => [kernel, new Map()]));

    const add = (kernel, service, capabilities) => {
      if (!service || !service.id || !capabilities) return;
      const entry = services.get(service.id) || {
        id: service.id,
        name: service.name || service.label || service.id,
        kernels: [],
      };
      if (!entry.kernels.some((item) => item.id === kernel))
        entry.kernels.push({ id: kernel, ...capabilities });
      services.set(service.id, entry);
      perKernel.get(kernel).set(service.id, capabilities);
    };

    for (const kernel of COMPANION_KERNELS) {
      const generic = {
        sourceLanguages: languageOptions(kernel, 'source'),
        targetLanguages: languageOptions(kernel, 'target'),
      };
      add(kernel, { id: 'auto', name: 'Use Computer Settings' }, generic);
      add(kernel, { id: 'siliconflow-free', name: 'SiliconFlow free' }, generic);

      const catalog = catalogs.get(kernel) || { services: [] };
      const nativeServices = Array.isArray(catalog.services) ? catalog.services : [];
      for (const service of nativeServices) {
        if (
          !service ||
          typeof service.id !== 'string' ||
          COMPANION_SERVICE_IDS.has(service.id) ||
          service.id === 'default' ||
          service.id === 'siliconflowfree' ||
          service.available === false ||
          !configuredNativeService(service, preferences, credentials, kernel)
        )
          continue;
        add(kernel, { id: service.id, name: service.label || service.id }, generic);
      }

      for (const service of customServiceDescriptors(kernel, nativeServices, customServices))
        if (customServiceReady(service, customServices, credentials))
          add(kernel, { id: service.id, name: service.label || service.id }, generic);

      if (appleAvailable && appleLanguages) {
        const apple = localLanguageCapabilities(kernel, appleLanguages);
        if (apple?.sourceLanguages?.length && apple?.targetLanguages?.length)
          add(kernel, { id: 'apple-local', name: 'Apple Translation (on device)' }, apple);
      }

      let chatGPTModel = profileValuesFor(preferences, kernel, 'chatgpt-subscription').model;
      if (typeof chatGPTModel === 'string') chatGPTModel = chatGPTModel.trim();
      if (
        chatGPTModel &&
        chatGPTSubscription &&
        typeof chatGPTSubscription.status === 'function' &&
        (await Promise.resolve(chatGPTSubscription.status()).catch(() => ({ signedIn: false })))
          .signedIn === true
      )
        add(kernel, { id: 'chatgpt-subscription', name: 'ChatGPT Subscription' }, generic);

      const active = activeServiceFor(preferences, kernel);
      selections[kernel].auto = selectionFor(
        preferences,
        credentials,
        customServices,
        kernel,
        active,
      );
      for (const service of perKernel.get(kernel).keys()) {
        if (service === 'auto') continue;
        selections[kernel][service] = selectionFor(
          preferences,
          credentials,
          customServices,
          kernel,
          service,
        );
      }

      // Automatic uses the desktop's currently selected provider. Keep its
      // per-kernel limits equal to that provider when a capability is known;
      // never merge the Fast and Precise lists into one global service range.
      const activeCapabilities = perKernel.get(kernel).get(active);
      if (activeCapabilities) {
        const automatic = services.get('auto');
        const automaticKernel = automatic?.kernels.find((item) => item.id === kernel);
        if (automaticKernel) Object.assign(automaticKernel, activeCapabilities);
      }
    }

    return {
      services: [...services.values()],
      kernels: COMPANION_KERNELS.map(kernelLanguageCapabilities),
      selections,
    };
  }

  async function companionTranslationOptions() {
    const configured = await configuredCompanionTranslation();
    return companionState(configured);
  }

  // Companion jobs use the desktop's resolved selection, including custom
  // service endpoint and credential values. The route never exposes this
  // object; it is consumed only by providerFor and the local kernel process.
  async function companionTranslationSelection(service, kernel, sourceLanguage, language) {
    if (typeof getCompanionTranslationSelection === 'function')
      return getCompanionTranslationSelection(service, kernel, sourceLanguage, language);
    const configured = await configuredCompanionTranslation();
    const state = await companionState(configured);
    const selection = state?.selections?.[kernel]?.[service];
    if (selection !== undefined) return selection;
    return service === 'auto' ? undefined : { id: service, values: {} };
  }

  async function providerFor(
    selection,
    kernel,
    sourceLanguage,
    language,
    { cacheOnly = false } = {},
  ) {
    // User-defined services run on the kernel's own OpenAI-compatible backend.
    selection = resolveCustomSelection(kernel, selection);
    if (selection?.id === 'chatgpt-subscription') {
      if (!chatGPTSubscription) throw Error('ChatGPT Subscription requires the desktop app.');
      const account = await chatGPTSubscription.status();
      if (!account.signedIn) throw Error('Sign in with ChatGPT in provider settings.');
      const model = selection.values?.model;
      if (typeof model !== 'string' || !model.trim() || model.length > 512)
        throw Error('Choose a ChatGPT Subscription model in provider settings.');
      return {
        id: 'chatgpt-subscription',
        model,
        kernel,
        clientId: account.activeClientId,
        identity: { service: 'chatgpt-subscription', clientId: account.activeClientId, model },
      };
    }
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
    companionTranslationOptions,
    companionTranslationSelection,
    providerFor,
    complete,
    serviceHeader,
  };
}
