import { createHash, randomBytes } from 'node:crypto';
import { isTranslationLanguageSupported } from '../../shared/translation/languages.mjs';
import { paragraphs } from '../documents/layout.mjs';

export const DEVELOPER_TEST_TIMEOUT_MS = 90_000;
export const DEVELOPER_TEST_OUTPUT_LIMIT = 4_000;

const ENGINES = new Set(['pdf_inspector', 'pdf_math_fast', 'pdf_math_precise']);
const IDENTIFIER = /^[a-z][a-z0-9_-]{0,100}$/i;
let pdfLib;

function loadPdfLib() {
  pdfLib ??= import('pdf-lib');
  return pdfLib;
}

export class DeveloperTestInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DeveloperTestInputError';
    this.status = 400;
  }
}

function record(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value))
  );
}

function boundedInteger(value, name) {
  if (!Number.isInteger(value) || value < 1 || value > 12)
    throw new DeveloperTestInputError(`${name} must be an integer from 1 to 12.`);
  return value;
}

function boundedOptions(value) {
  if (value === undefined) return {};
  if (!record(value)) throw new DeveloperTestInputError('advancedOptions must be an object.');
  if (JSON.stringify(value).length > 50_000)
    throw new DeveloperTestInputError('advancedOptions is too large.');
  return value;
}

export function validateDeveloperTestRequest(body) {
  if (!record(body)) throw new DeveloperTestInputError('A JSON request body is required.');
  const { kind, engine, language, sourceLanguage } = body;
  if (kind !== 'kernel' && kind !== 'provider')
    throw new DeveloperTestInputError('kind must be kernel or provider.');
  if (typeof engine !== 'string' || !ENGINES.has(engine))
    throw new DeveloperTestInputError('Unknown developer test engine.');
  if (typeof language !== 'string' || !isTranslationLanguageSupported(engine, language))
    throw new DeveloperTestInputError('Invalid target language.');
  if (
    typeof sourceLanguage !== 'string' ||
    !isTranslationLanguageSupported(engine, sourceLanguage, 'source')
  )
    throw new DeveloperTestInputError('Invalid source language.');
  const concurrency = boundedInteger(body.concurrency, 'concurrency');
  const pageConcurrency = boundedInteger(body.pageConcurrency, 'pageConcurrency');
  const advancedOptions = boundedOptions(body.advancedOptions);
  let translationService;
  if (kind === 'provider') {
    if (
      !record(body.translationService) ||
      typeof body.translationService.id !== 'string' ||
      !IDENTIFIER.test(body.translationService.id)
    )
      throw new DeveloperTestInputError('translationService must contain a valid service id.');
    if (body.translationService.values !== undefined && !record(body.translationService.values))
      throw new DeveloperTestInputError('translationService.values must be an object.');
    translationService = {
      id: body.translationService.id,
      values: body.translationService.values || {},
    };
  }
  return {
    kind,
    engine,
    language,
    sourceLanguage,
    concurrency,
    pageConcurrency,
    advancedOptions,
    ...(translationService ? { translationService } : {}),
  };
}

export function developerTestSecretValues(body) {
  const values = [];
  const serviceValues = body?.translationService?.values;
  if (record(serviceValues))
    for (const value of Object.values(serviceValues))
      if (typeof value === 'string' && value) values.push(value);
  return values;
}

export function limitDeveloperTestOutput(value, maxLength = DEVELOPER_TEST_OUTPUT_LIMIT) {
  const text = String(value ?? '');
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 32))}… [truncated ${text.length - maxLength + 32} chars]`;
}

export async function createDeveloperSamplePDF({ marker = randomBytes(8).toString('hex') } = {}) {
  const { PDFDocument, StandardFonts, rgb } = await loadPdfLib();
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const page = document.addPage([612, 792]);
  page.drawText('PDFMathReader developer test', {
    x: 54,
    y: 708,
    size: 20,
    font: bold,
    color: rgb(0.12, 0.14, 0.18),
  });
  page.drawText('A small local paragraph exercises extraction, layout, and translation.', {
    x: 54,
    y: 660,
    size: 12,
    font,
  });
  page.drawText(`The configured test uses one page and marker ${marker}.`, {
    x: 54,
    y: 630,
    size: 12,
    font,
  });
  page.drawText('The source remains local unless this request is a provider test.', {
    x: 54,
    y: 600,
    size: 12,
    font,
  });
  return Buffer.from(await document.save());
}

function sampleText(sourceLanguage, language) {
  return 'Water freezes at zero degrees Celsius.';
}

function resolveProxyUrl(value) {
  if (typeof value === 'function') return value();
  return value || '';
}

function abortIfNeeded(signal) {
  if (signal?.aborted) throw signal.reason || Error('Developer test cancelled.');
}

async function resultPDF(bytes) {
  if (!bytes || typeof bytes.length !== 'number') throw Error('The kernel did not return a PDF.');
  const { PDFDocument } = await loadPdfLib();
  return PDFDocument.load(bytes);
}

export function developerMockCompletion(body, provider = {}) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const last = messages.at(-1)?.content;
  const source = typeof last === 'string' && last.trim() ? last.trim() : 'developer sample';
  const content = `Local developer test translation (${provider.language || 'target'}): ${source.slice(0, 2_000)}`;
  return Response.json({
    id: 'developer-local-completion',
    object: 'chat.completion',
    model: provider.model || 'developer-local',
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
  });
}

export function createDeveloperTests({
  engines,
  layoutExtraction,
  providerFor,
  complete,
  limiter,
  pageLimiter,
  proxyJobs,
  proxyUrl,
  samplePDF = createDeveloperSamplePDF,
} = {}) {
  if (!engines || typeof engines.translate !== 'function')
    throw Error('Developer tests require an engines.translate helper.');
  if (!layoutExtraction || typeof layoutExtraction.extractPage !== 'function')
    throw Error('Developer tests require a layout extraction helper.');
  if (typeof providerFor !== 'function' || typeof complete !== 'function')
    throw Error('Developer tests require provider helpers.');
  if (!limiter || typeof limiter.run !== 'function' || typeof pageLimiter?.run !== 'function')
    throw Error('Developer tests require limiter helpers.');
  if (!(proxyJobs instanceof Map)) throw Error('Developer tests require the proxy job map.');

  async function runInspectorKernel(bytes, request, signal) {
    abortIfNeeded(signal);
    const { PDFDocument } = await loadPdfLib();
    const document = await PDFDocument.load(bytes),
      height = document.getPage(0).getHeight();
    const items = await layoutExtraction.extractPage(bytes, 1);
    abortIfNeeded(signal);
    const blocks = paragraphs(items, height);
    if (!blocks.length)
      throw Error('PDF Inspector extracted no paragraphs from the developer sample.');
    return {
      message: `PDF Inspector extracted ${blocks.length} paragraph${blocks.length === 1 ? '' : 's'} from a one-page sample.`,
      output: limitDeveloperTestOutput(blocks[0].text),
    };
  }

  async function runEngine(
    bytes,
    request,
    provider,
    signal,
    { native = false, localTranslation = false, controller } = {},
  ) {
    const runController = controller || new AbortController();
    const abortListener = () => {
      if (!runController.signal.aborted)
        runController.abort(signal?.reason || Error('Developer test cancelled.'));
    };
    if (signal && signal !== runController.signal) {
      if (signal.aborted) abortListener();
      else signal.addEventListener('abort', abortListener, { once: true });
    }
    abortIfNeeded(runController.signal);
    limiter.setMax(request.concurrency);
    pageLimiter.setMax(request.pageConcurrency);
    const proxyToken = `developer-${randomBytes(24).toString('hex')}`;
    const proxyProvider = { ...provider, developerTest: true };
    const job = {
      id: `developer-test-${randomBytes(8).toString('hex')}`,
      state: 'running',
      kernel: request.engine,
      page: 1,
      language: request.language,
      controller: runController,
      provider: proxyProvider,
      cacheScope: '',
      providerCalls: 0,
      providerQueueMs: 0,
      providerAggregateMs: 0,
      providerMaxMs: 0,
      bypassCache: true,
      developerMock: provider.developerMock === true,
    };
    proxyJobs.set(proxyToken, job);
    try {
      const result = await engines.translate({
        id: request.engine,
        bytes,
        documentHash: createHash('sha256').update(bytes),
        page: 1,
        language: request.language,
        sourceLanguage: request.sourceLanguage,
        threads: request.concurrency,
        model: provider.model,
        proxy: { url: resolveProxyUrl(proxyUrl), token: proxyToken },
        signal: runController.signal,
        translationService: native ? provider.selection || request.translationService : undefined,
        serviceIdentity: localTranslation ? { service: 'apple-local' } : undefined,
        localTranslation,
        advancedOptions: request.advancedOptions,
        reuseTranslations: false,
        cacheOnly: false,
        runWorker: (fn) =>
          pageLimiter.run(fn, {
            signal: runController.signal,
            meta: {
              kind: 'developer-test',
              kernel: request.engine,
              page: 1,
              language: request.language,
            },
          }),
      });
      abortIfNeeded(runController.signal);
      if (result?.cached === true)
        throw Error('Developer test unexpectedly used a cached kernel result.');
      if (!native && job.providerCalls < 1) throw Error('The provider transport was not called.');
      const output = await resultPDF(result);
      if (output.getPageCount() !== 1) throw Error('The kernel test did not return one page.');
      let layout;
      if (typeof result?.layoutKey === 'string' && typeof engines.layout === 'function') {
        try {
          layout = await engines.layout(result.layoutKey);
        } catch (error) {
          if (native) throw error;
        }
      }
      if (native) {
        if (
          !Array.isArray(layout?.paragraphs) ||
          !layout.paragraphs.some(
            (item) => typeof item?.translation === 'string' && item.translation.trim(),
          )
        )
          throw Error('The native kernel returned no translated paragraphs.');
      }
      const sample = layout?.paragraphs?.find(
        (item) => typeof item?.translation === 'string' && item.translation.trim(),
      )?.translation;
      return {
        message: `${request.engine} completed a one-page translation using ${provider.developerMock ? 'the local mock transport' : provider.id === 'apple-local' ? 'Apple Translation' : 'the configured provider'}.`,
        output: sample
          ? limitDeveloperTestOutput(sample)
          : `Target ${request.language}; source ${request.sourceLanguage}; cache bypassed.`,
      };
    } catch (error) {
      if (job.error) throw Error(job.error);
      throw error;
    } finally {
      proxyJobs.delete(proxyToken);
      if (signal && signal !== runController.signal)
        signal.removeEventListener('abort', abortListener);
    }
  }

  async function runInspectorProvider(request, provider, signal) {
    limiter.setMax(request.concurrency);
    abortIfNeeded(signal);
    const text = sampleText(request.sourceLanguage, request.language);
    const messages = [
      {
        role: 'system',
        content: `Translate from ${request.sourceLanguage} into ${request.language}. Return only the translation.`,
      },
      { role: 'user', content: text },
    ];
    const response = await limiter.run(
      () =>
        complete(provider, { model: provider.model, sourceText: text, messages }, signal, {
          cache: false,
        }),
      {
        signal,
        meta: {
          kind: 'developer-provider-test',
          kernel: request.engine,
          language: request.language,
          sourceLanguage: request.sourceLanguage,
        },
      },
    );
    if (!response?.ok)
      throw Error(`Configured provider returned HTTP ${response?.status || 'an error'}.`);
    const data = await response.json(),
      translation = data?.choices?.[0]?.message?.content;
    if (typeof translation !== 'string' || !translation.trim())
      throw Error('Configured provider returned an empty translation.');
    return {
      message: `${provider.id} returned a translation for the one-sentence sample.`,
      output: limitDeveloperTestOutput(translation),
    };
  }

  async function run(request, { signal, controller } = {}) {
    const validated = validateDeveloperTestRequest(request);
    abortIfNeeded(signal);
    const bytes = await samplePDF();
    abortIfNeeded(signal);
    if (validated.kind === 'kernel') {
      if (validated.engine === 'pdf_inspector') return runInspectorKernel(bytes, validated, signal);
      const provider = {
        id: 'developer-local',
        model: 'developer-local',
        kernel: validated.engine,
        language: validated.language,
        developerMock: true,
        native: false,
      };
      return runEngine(bytes, validated, provider, signal, { controller });
    }
    const provider = await providerFor(
      validated.translationService,
      validated.engine,
      validated.sourceLanguage,
      validated.language,
    );
    abortIfNeeded(signal);
    if (validated.engine === 'pdf_inspector')
      return runInspectorProvider(validated, provider, signal);
    const localTranslation = provider.id === 'apple-local';
    return runEngine(bytes, validated, provider, signal, {
      native: provider.native === true,
      localTranslation,
      controller,
    });
  }

  return { run, validate: validateDeveloperTestRequest, secretValues: developerTestSecretValues };
}
