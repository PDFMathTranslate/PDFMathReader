import express from 'express';
import { kernelTranslationSpacing } from '../../shared/translation/spacing.mjs';

export function registerProxyRoutes(app, { limiter, proxyJobs, localTranslator, providerClient }) {
  app.post('/kernel-proxy/v1/translate', express.json({ limit: '1mb' }), async (req, res) => {
    const job = proxyJobs.get(String(req.headers.authorization || '').replace(/^Bearer /, ''));
    if (!job || job.provider.id !== 'apple-local') return res.sendStatus(403);
    try {
      const translation = await limiter.run(
        () =>
          localTranslator.translate({
            text: req.body.text,
            source: job.provider.source,
            target: job.provider.language,
            signal: job.controller.signal,
          }),
        { signal: job.controller.signal, meta: { kind: 'local-translation', kernel: job.kernel } },
      );
      job.providerCalls++;
      res.json({ translation: kernelTranslationSpacing(translation) });
    } catch (error) {
      job.error = error.message;
      job.controller.abort();
      res.status(502).json({ error: job.error });
    }
  });

  app.post(
    '/kernel-proxy/v1/chat/completions',
    express.json({ limit: '1mb' }),
    async (req, res) => {
      const job = proxyJobs.get(String(req.headers.authorization || '').replace(/^Bearer /, ''));
      if (!job) return res.sendStatus(403);
      const provider = job.provider;
      const controller = new AbortController();
      const signal = AbortSignal.any([controller.signal, job.controller.signal]);
      const timeout = setTimeout(() => controller.abort(), 60000);
      res.on('close', () => {
        if (!res.writableEnded) controller.abort();
      });
      try {
        const queuedAt = performance.now();
        await limiter.run(
          async () => {
            job.providerQueueMs += performance.now() - queuedAt;
            if (signal.aborted) throw Error('Cancelled');
            const providerStarted = performance.now();
            job.providerCalls++;
            const response = await providerClient.complete(provider, req.body, signal, {
              cacheScope: job.cacheScope,
              cache: !job.forceRetranslation,
            });
            const data = await response.json();
            const elapsed = performance.now() - providerStarted;
            job.providerAggregateMs += elapsed;
            job.providerMaxMs = Math.max(job.providerMaxMs, elapsed);
            if (!response.ok) {
              job.error =
                provider.id === 'siliconflow-free'
                  ? `SiliconFlow free service request failed (${response.status}). Please retry later.`
                  : response.status === 401
                    ? 'OpenAI rejected the configured API key. Update it in Settings.'
                    : response.status === 429
                      ? 'OpenAI rate limit or quota reached. Check your account and reduce parallel requests.'
                      : `OpenAI request failed (${response.status}).`;
              res.status(response.status).json({ error: { message: job.error } });
              job.controller.abort();
              return;
            }
            for (const choice of data.choices || []) {
              if (choice.message)
                choice.message.content = kernelTranslationSpacing(choice.message.content);
            }
            if (response.ok && req.body.stream) {
              res.setHeader('Content-Type', 'text/event-stream');
              const base = {
                id: data.id || 'local-completion',
                object: 'chat.completion.chunk',
                created: data.created || Math.floor(Date.now() / 1000),
                model: data.model,
              };
              res.write(
                'data: ' +
                  JSON.stringify({
                    ...base,
                    choices: [
                      {
                        index: 0,
                        delta: {
                          role: 'assistant',
                          content: data.choices?.[0]?.message?.content || '',
                        },
                        finish_reason: null,
                      },
                    ],
                  }) +
                  '\n\n',
              );
              res.write(
                'data: ' +
                  JSON.stringify({
                    ...base,
                    choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
                  }) +
                  '\n\n',
              );
              res.end('data: [DONE]\n\n');
            } else res.status(response.status).json(data);
          },
          {
            signal,
            meta: { kind: 'provider-request', kernel: provider.kernel },
          },
        );
      } catch (error) {
        job.error ||=
          provider.id === 'chatgpt-subscription'
            ? error.message || 'ChatGPT Subscription request failed. Check provider settings.'
            : `Could not reach ${provider.id === 'openai' ? 'OpenAI' : 'SiliconFlow free service'} or the request timed out. Check network access and retry.`;
        job.controller.abort();
        if (!res.destroyed) res.status(502).json({ error: { message: job.error } });
      } finally {
        clearTimeout(timeout);
      }
    },
  );
}
