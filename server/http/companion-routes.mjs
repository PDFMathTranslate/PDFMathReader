import express from 'express';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  LANGUAGE_CODES,
  isTranslationLanguageSupported,
  translationLanguagesForKernel,
} from '../../shared/translation/languages.mjs';
import {
  normalizePairingCode,
  pairingCodeFromBytes,
  PAIRING_CODE_BYTES,
} from '../../shared/companion/pairing.mjs';
import {
  normalizeTailscaleAddresses,
  tailscaleHttpUrls,
} from '../../shared/companion/tailscale.mjs';

export { normalizePairingCode };
export const createPairingCode = () => pairingCodeFromBytes(randomBytes(PAIRING_CODE_BYTES));

// Companion kernel API: lets PDFMathReader on iPhone and iPad run this computer's
// local Fast and Precise kernels over the local network. It is served on its own
// listener, never on the per-window backend origin, and every route requires the
// pairing token. Pages arrive as one-page PDFs and leave as translated one-page PDFs.
export const COMPANION_PROTOCOL = 1;
export const COMPANION_KERNELS = Object.freeze(['pdf_math_fast', 'pdf_math_precise']);
const JOB_TTL_MS = 10 * 60 * 1000;
const MAX_ACTIVE_JOBS = 8;
const CONNECTION_IDLE_MS = 90 * 1000;
const MAX_CONNECTIONS = 256;
const MAX_FAILED_AUTH = 10;
const AUTH_LOCKOUT_MS = 60 * 1000;

function digest(value) {
  return createHash('sha256').update(String(value)).digest();
}

function validGlossary(value) {
  return (
    Array.isArray(value) &&
    value.length <= 5000 &&
    value.every(
      (entry) =>
        entry &&
        typeof entry.source === 'string' &&
        entry.source.length > 0 &&
        entry.source.length <= 500 &&
        typeof entry.target === 'string' &&
        entry.target.length > 0 &&
        entry.target.length <= 500,
    )
  );
}

function languageOptions(engine, direction) {
  return translationLanguagesForKernel(engine, direction).map((name) => ({
    name,
    code: LANGUAGE_CODES[name] || name,
  }));
}

function publicLanguageOptions(value) {
  if (!Array.isArray(value)) return undefined;
  const result = [];
  const seen = new Set();
  for (const entry of value) {
    const name = typeof entry === 'string' ? entry : entry?.name;
    const code = typeof entry === 'string' ? LANGUAGE_CODES[entry] || entry : entry?.code;
    if (
      typeof name !== 'string' ||
      !name.trim() ||
      typeof code !== 'string' ||
      !code.trim() ||
      seen.has(code)
    )
      continue;
    seen.add(code);
    result.push({ name: name.trim(), code: code.trim() });
  }
  return result;
}

function publicServiceKernel(value) {
  if (!value || typeof value !== 'object' || typeof value.id !== 'string') return null;
  const id = value.id.trim();
  if (!COMPANION_KERNELS.includes(id)) return null;
  const sourceLanguages = publicLanguageOptions(value.sourceLanguages);
  const targetLanguages = publicLanguageOptions(value.targetLanguages);
  return {
    id,
    ...(sourceLanguages ? { sourceLanguages } : {}),
    ...(targetLanguages ? { targetLanguages } : {}),
  };
}

function publicService(service) {
  if (!service || typeof service !== 'object' || typeof service.id !== 'string') return null;
  const id = service.id.trim();
  if (!id) return null;
  const name =
    typeof service.name === 'string' && service.name.trim()
      ? service.name.trim()
      : typeof service.label === 'string' && service.label.trim()
        ? service.label.trim()
        : id;
  const sourceLanguages = publicLanguageOptions(service.sourceLanguages);
  const targetLanguages = publicLanguageOptions(service.targetLanguages);
  const kernels = Array.isArray(service.kernels)
    ? service.kernels
        .map(publicServiceKernel)
        .filter(Boolean)
        .filter(
          (kernel, index, values) => values.findIndex((item) => item.id === kernel.id) === index,
        )
    : undefined;
  return {
    id,
    name,
    ...(sourceLanguages ? { sourceLanguages } : {}),
    ...(targetLanguages ? { targetLanguages } : {}),
    ...(kernels ? { kernels } : {}),
  };
}

function publicKernel(engine, value) {
  const sourceLanguages =
    publicLanguageOptions(value?.sourceLanguages) || languageOptions(engine, 'source');
  const targetLanguages =
    publicLanguageOptions(value?.targetLanguages) || languageOptions(engine, 'target');
  return { id: engine, sourceLanguages, targetLanguages };
}

export function registerCompanionRoutes(
  app,
  {
    token,
    engines,
    providerRuntime,
    pageLimiter,
    proxyJobs,
    origin,
    appVersion = 'development',
    maxDocumentBytes,
    computer,
    documents,
    now = () => Date.now(),
  },
) {
  const expected = digest(normalizePairingCode(token));
  const configured = normalizePairingCode(token).length >= 16;
  const failures = new Map();
  const jobs = new Map();
  const connections = new Map();
  const activeJobsFor = (address) =>
    [...jobs.values()].filter((job) => job.state === 'running' && job.address === address).length;
  const sweepConnections = () => {
    for (const [address, connection] of connections)
      if (now() - connection.lastSeenAt >= CONNECTION_IDLE_MS && !activeJobsFor(address))
        connections.delete(address);
  };
  const clientText = (value, limit) =>
    typeof value === 'string'
      ? Array.from(value)
          .filter((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127)
          .join('')
          .trim()
          .slice(0, limit)
      : '';

  const healthComputer = (() => {
    if (!computer || typeof computer !== 'object') return undefined;
    const name = typeof computer.name === 'string' ? computer.name.trim().slice(0, 63) : '';
    const tailscaleAddresses = normalizeTailscaleAddresses(computer.tailscaleAddresses);
    return name && tailscaleAddresses.length ? { name, tailscaleAddresses } : undefined;
  })();

  // Keep the public companion contract deliberately smaller than the desktop
  // provider schema. Runtime catalogs contain field names, defaults and secret
  // metadata; none of those belong on a network health response. The runtime
  // accessor is also where the desktop supplies its configured service list,
  // including custom profiles and the active automatic provider's limits.
  const companionCapabilities = async () => {
    let supplied;
    try {
      supplied =
        typeof providerRuntime?.companionTranslationOptions === 'function'
          ? await providerRuntime.companionTranslationOptions()
          : undefined;
    } catch {
      supplied = undefined;
    }
    const services = [];
    const serviceIDs = new Set();
    for (const service of supplied?.services || []) {
      const publicValue = publicService(service);
      if (!publicValue || serviceIDs.has(publicValue.id)) continue;
      serviceIDs.add(publicValue.id);
      services.push(publicValue);
    }
    const auto = services.find((service) => service.id === 'auto');
    if (auto) {
      auto.name = 'Use Computer Settings';
      services.splice(services.indexOf(auto), 1);
      services.unshift(auto);
    } else {
      services.unshift({ id: 'auto', name: 'Use Computer Settings' });
    }
    const kernels = COMPANION_KERNELS.map((id) =>
      publicKernel(
        id,
        Array.isArray(supplied?.kernels)
          ? supplied.kernels.find((kernel) => kernel?.id === id)
          : undefined,
      ),
    );
    return { public: { services, kernels } };
  };

  const sweep = () => {
    const time = now();
    for (const [id, job] of jobs)
      if (job.state !== 'running' && time - job.finishedAt > JOB_TTL_MS) jobs.delete(id);
    for (const [address, entry] of failures)
      if (time - entry.at > AUTH_LOCKOUT_MS) failures.delete(address);
  };

  app.use('/companion', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    sweep();
    const address = req.socket.remoteAddress || '';
    const failure = failures.get(address);
    if (failure && failure.count >= MAX_FAILED_AUTH)
      return res.status(429).json({ error: 'Too many attempts. Try again in a minute.' });
    const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const matches = timingSafeEqual(digest(normalizePairingCode(supplied)), expected);
    if (!configured || !matches) {
      failures.set(address, { count: (failure?.count || 0) + 1, at: now() });
      return res.status(401).json({ error: 'Wrong pairing code' });
    }
    failures.delete(address);
    // Desktop document ownership is internal traffic, not a remote consumer.
    if (!req.path.includes('/desktop-session'))
      res.once('finish', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) return;
        sweepConnections();
        let connection = connections.get(address);
        if (!connection) {
          if (connections.size >= MAX_CONNECTIONS) return;
          connection = {
            id: randomUUID(),
            address: address.replace(/^::ffff:/, ''),
            name: '',
            userAgent: clientText(req.headers['user-agent'], 256),
            connectedAt: now(),
            lastSeenAt: now(),
          };
          connections.set(address, connection);
        }
        const deviceName = clientText(req.headers['x-pdfmathreader-device-name'], 128);
        connection.name = deviceName || connection.name;
        connection.lastSeenAt = now();
        // Older clients supply identity when acquiring a document session.
        if (!deviceName && req.method === 'POST' && /\/documents\/[^/]+\/session$/.test(req.path))
          connection.name = clientText(req.body?.deviceName, 128) || connection.name;
      });
    next();
  });

  app.get('/companion/v1/health', async (req, res) => {
    const kernels = await Promise.all(
      COMPANION_KERNELS.map(async (id) => {
        try {
          const state = await engines.check(id);
          return {
            id,
            available: state.available === true,
            version: state.version || '',
            reason: state.available ? '' : state.reason || 'Not installed',
          };
        } catch {
          return { id, available: false, version: '', reason: 'Unknown kernel' };
        }
      }),
    );
    const addresses = healthComputer
      ? tailscaleHttpUrls(healthComputer.tailscaleAddresses, req.socket.localPort)
      : [];
    const capabilities = await companionCapabilities();
    res.json({
      status: 'ok',
      app: 'PDFMathReader',
      protocol: COMPANION_PROTOCOL,
      version: appVersion,
      kernels,
      translation: capabilities.public,
      ...(healthComputer && addresses.length
        ? { computer: { name: healthComputer.name, addresses } }
        : {}),
    });
  });

  const documentJSONLimit = `${Math.ceil(((maxDocumentBytes || 200 * 1024 * 1024) * 4) / 3) + 1024 * 1024}b`;
  const documentError = (res, error) => {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    const payload = {
      error: status >= 500 ? 'Companion document request failed.' : error.message,
      ...(error?.code ? { code: error.code } : {}),
      ...(error?.deviceName ? { deviceName: error.deviceName } : {}),
    };
    return res.status(status).json(payload);
  };
  const documentHandler = (handler) => async (req, res, next) => {
    try {
      return await handler(req, res);
    } catch (error) {
      if (error?.status) return documentError(res, error);
      return next(error);
    }
  };

  if (documents) {
    app.get(
      '/companion/v1/documents',
      documentHandler(async (_req, res) => res.json(await documents.list())),
    );
    app.post(
      '/companion/v1/documents/:id/desktop-session',
      express.json({ limit: '16kb' }),
      documentHandler(async (req, res) =>
        res.json(
          await documents.claimDesktop(
            req.params.id,
            req.body?.sessionID,
            req.body?.deviceName || 'This Mac',
          ),
        ),
      ),
    );
    app.delete(
      '/companion/v1/documents/:id/desktop-session/:sessionID',
      documentHandler(async (req, res) =>
        res.json(await documents.releaseDesktop(req.params.id, req.params.sessionID)),
      ),
    );
    app.post(
      '/companion/v1/documents/:id/session',
      express.json({ limit: documentJSONLimit }),
      documentHandler(async (req, res) => {
        const result = await documents.acquire(req.params.id, req.body || {});
        return res.json(result.response);
      }),
    );
    app.post(
      '/companion/v1/documents/:id/session/:sessionID/heartbeat',
      documentHandler(async (req, res) =>
        res.json(await documents.heartbeat(req.params.id, req.params.sessionID)),
      ),
    );
    app.put(
      '/companion/v1/documents/:id/session/:sessionID',
      express.json({ limit: documentJSONLimit }),
      documentHandler(async (req, res) => {
        const result = await documents.update(req.params.id, req.params.sessionID, req.body || {});
        return res.json(result);
      }),
    );
    app.delete(
      '/companion/v1/documents/:id/session/:sessionID',
      documentHandler(async (req, res) =>
        res.json(await documents.release(req.params.id, req.params.sessionID)),
      ),
    );
  }

  app.post(
    '/companion/v1/jobs',
    express.json({ limit: Math.ceil((maxDocumentBytes * 4) / 3) + 1024 * 1024 }),
    async (req, res) => {
      const body = req.body || {};
      const engine = body.engine;
      const language = body.language;
      const sourceLanguage = body.sourceLanguage ?? undefined;
      const service = body.service ?? 'auto';
      const glossary = body.glossary ?? [];
      const capabilities = await companionCapabilities();
      const serviceOption = capabilities.public.services.find((entry) => entry.id === service);
      const kernelOption = capabilities.public.kernels.find((entry) => entry.id === engine);
      const serviceKernelOption = Array.isArray(serviceOption?.kernels)
        ? serviceOption.kernels.find((entry) => entry.id === engine)
        : undefined;
      const supportedService =
        typeof service === 'string' &&
        !!serviceOption &&
        (!Array.isArray(serviceOption.kernels) || !!serviceKernelOption);
      const serviceLanguageOptions = serviceKernelOption || serviceOption;
      const supportsKernelLanguage = (name, direction) => {
        if (!isTranslationLanguageSupported(engine, name, direction)) return false;
        const languages =
          kernelOption?.[direction === 'source' ? 'sourceLanguages' : 'targetLanguages'];
        if (!languages) return true;
        const code = LANGUAGE_CODES[name] || name;
        return languages.some((entry) => entry.code === code || entry.name === name);
      };
      const supportsServiceLanguage = (name, direction) => {
        const languages =
          serviceLanguageOptions?.[direction === 'source' ? 'sourceLanguages' : 'targetLanguages'];
        if (!languages) return true;
        const code = LANGUAGE_CODES[name] || name;
        return languages.some((entry) => entry.code === code || entry.name === name);
      };
      if (
        !COMPANION_KERNELS.includes(engine) ||
        typeof language !== 'string' ||
        !supportsKernelLanguage(language, 'target') ||
        !supportsServiceLanguage(language, 'target') ||
        (sourceLanguage !== undefined &&
          (typeof sourceLanguage !== 'string' ||
            !supportsKernelLanguage(sourceLanguage, 'source') ||
            !supportsServiceLanguage(sourceLanguage, 'source'))) ||
        typeof service !== 'string' ||
        !supportedService ||
        !validGlossary(glossary) ||
        typeof body.pdf !== 'string'
      )
        return res.status(400).json({ error: 'Invalid kernel request' });
      const bytes = Buffer.from(body.pdf, 'base64');
      if (
        !bytes.length ||
        bytes.length > maxDocumentBytes ||
        !bytes.subarray(0, 1024).includes(Buffer.from('%PDF'))
      )
        return res.status(400).json({ error: 'The page is not a PDF' });
      if ([...jobs.values()].filter((job) => job.state === 'running').length >= MAX_ACTIVE_JOBS)
        return res.status(429).json({ error: 'Too many pages are translating. Try again soon.' });

      let provider;
      let selection;
      try {
        selection =
          typeof providerRuntime?.companionTranslationSelection === 'function'
            ? await providerRuntime.companionTranslationSelection(
                service,
                engine,
                sourceLanguage,
                language,
              )
            : service === 'auto'
              ? undefined
              : { id: service, values: {} };
        if (
          service !== 'auto' &&
          (!selection || typeof selection !== 'object' || typeof selection.id !== 'string')
        )
          throw Error('The selected translation service is not configured on this computer.');
        provider = await providerRuntime.providerFor(selection, engine, sourceLanguage, language);
      } catch (error) {
        return res.status(422).json({ error: error.message });
      }

      const id = randomUUID();
      const controller = new AbortController();
      const job = {
        id,
        address: req.socket.remoteAddress || '',
        state: 'running',
        stage: 'Queued',
        percent: 0,
        error: '',
        result: null,
        finishedAt: 0,
        controller,
      };
      jobs.set(id, job);
      // The proxy entry is what the kernel's translation requests authenticate with.
      const proxyJob = {
        id: `companion-${id}`,
        progress: null,
        state: 'running',
        kernel: engine,
        page: 1,
        language,
        controller,
        error: '',
        provider,
        providerCalls: 0,
        providerQueueMs: 0,
        providerAggregateMs: 0,
        providerMaxMs: 0,
      };
      const proxyToken = randomBytes(32).toString('hex');
      proxyJobs.set(proxyToken, proxyJob);
      res.status(202).json({ id });

      try {
        const translated = await engines.translate({
          id: engine,
          bytes,
          page: 1,
          language,
          sourceLanguage,
          threads: 2,
          model: provider.model,
          proxy: { url: `${origin()}/kernel-proxy/v1`, token: proxyToken },
          signal: controller.signal,
          cacheSelection: selection,
          translationService: provider.native ? provider.selection : undefined,
          serviceIdentity: provider.identity,
          localTranslation: provider.id === 'apple-local',
          glossary,
          onProgress: (progress) => {
            const percent = Number(progress?.percent);
            job.stage = String(progress?.stage || job.stage).slice(0, 200);
            if (Number.isFinite(percent))
              job.percent = Math.max(job.percent, Math.min(99, percent));
          },
          runWorker: (fn) =>
            pageLimiter.run(fn, {
              signal: controller.signal,
              meta: { kind: 'companion-translation', kernel: engine, page: 1, language },
            }),
        });
        if (!translated) throw Error('The kernel returned no page');
        job.result = Buffer.from(translated);
        job.state = 'done';
        job.percent = 100;
        job.stage = 'Done';
      } catch (error) {
        job.state = controller.signal.aborted && !proxyJob.error ? 'cancelled' : 'failed';
        job.error = proxyJob.error || error?.message || 'Translation failed';
      } finally {
        job.finishedAt = now();
        proxyJobs.delete(proxyToken);
      }
    },
  );

  app.get('/companion/v1/jobs/:id', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Unknown job' });
    res.json({
      id: job.id,
      state: job.state,
      stage: job.stage,
      percent: job.percent,
      ...(job.error ? { error: job.error } : {}),
    });
  });

  app.get('/companion/v1/jobs/:id/result', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job) return res.status(404).json({ error: 'Unknown job' });
    if (job.state === 'running') return res.status(409).json({ error: 'Still translating' });
    if (job.state !== 'done') return res.status(422).json({ error: job.error });
    res.type('application/pdf').send(job.result);
  });

  app.delete('/companion/v1/jobs/:id', (req, res) => {
    const job = jobs.get(req.params.id);
    if (!job) return res.sendStatus(204);
    if (job.state === 'running') job.controller.abort();
    else jobs.delete(job.id);
    res.sendStatus(204);
  });

  return {
    connections: () => {
      sweepConnections();
      return [...connections.entries()].map(([address, connection]) => ({
        ...connection,
        activeJobs: activeJobsFor(address),
      }));
    },
    jobs: () => [...jobs.values()].filter((job) => job.state === 'running').length,
    cancelAll: () => {
      for (const job of jobs.values()) if (job.state === 'running') job.controller.abort();
    },
  };
}
