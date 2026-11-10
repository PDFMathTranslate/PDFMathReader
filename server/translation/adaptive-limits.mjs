import { setTimeout as delay } from 'node:timers/promises';
import { createLimiter } from '../kernels/engine-runtime.mjs';

export const ADAPTIVE_CEILING = 16;
const COOLDOWN_MS = 30_000;
const MAX_RETRY_WAIT_MS = 30_000;
const DEFAULT_RETRY_WAIT_MS = 2_000;

export function adaptiveProvider(provider) {
  return provider?.id === 'openai' || provider?.id === 'chatgpt-subscription';
}

export function retryAfterMs(response, now = Date.now()) {
  const value = response?.headers?.get?.('retry-after');
  if (!value) return DEFAULT_RETRY_WAIT_MS;
  const seconds = Number(value);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - now;
  return Number.isFinite(ms) ? Math.max(0, Math.min(MAX_RETRY_WAIT_MS, ms)) : DEFAULT_RETRY_WAIT_MS;
}

const throttledError = (error) => /\bHTTP 429\b/.test(String(error?.message || ''));

// Additive increase, multiplicative decrease per provider identity. The user's
// concurrency setting is the starting point; sustained success raises the limit
// one slot per full window, a 429 halves it and the request is retried once.
export function createAdaptiveLimits({
  ceiling = ADAPTIVE_CEILING,
  now = () => Date.now(),
  wait = (ms, signal) => delay(ms, undefined, { signal }),
} = {}) {
  const states = new Map();

  function stateFor(provider, base) {
    const key = JSON.stringify(provider.identity || { service: provider.id });
    let state = states.get(key);
    if (!state) {
      state = {
        base,
        limit: base,
        successes: 0,
        throttledAt: 0,
        limiter: createLimiter(base, { label: 'provider-adaptive', ceiling, now }),
      };
      states.set(key, state);
    } else if (state.base !== base) {
      Object.assign(state, { base, limit: base, successes: 0 });
      state.limiter.setMax(base);
    }
    return state;
  }

  function succeeded(state, response) {
    if (++state.successes < state.limit) return;
    state.successes = 0;
    if (state.limit >= ceiling || now() - state.throttledAt < COOLDOWN_MS) return;
    const remaining = Number(response?.headers?.get?.('x-ratelimit-remaining-requests') ?? NaN);
    if (Number.isFinite(remaining) && remaining < state.limit * 2) return;
    state.limit++;
    state.limiter.setMax(state.limit);
  }

  function throttled(state) {
    state.limit = Math.max(1, Math.floor(state.limit / 2));
    state.successes = 0;
    state.throttledAt = now();
    state.limiter.setMax(state.limit);
  }

  async function run(provider, base, fn, { signal, meta } = {}) {
    const state = stateFor(provider, base);
    for (let attempt = 0; ; attempt++) {
      let response;
      try {
        response = await state.limiter.run(fn, { signal, meta });
      } catch (error) {
        if (!throttledError(error) || signal?.aborted) throw error;
        throttled(state);
        if (attempt > 0) throw error;
        await wait(DEFAULT_RETRY_WAIT_MS, signal);
        continue;
      }
      if (response.status === 429) {
        throttled(state);
        if (attempt > 0) return response;
        await response.body?.cancel?.().catch(() => {});
        await wait(retryAfterMs(response, now()), signal);
        continue;
      }
      if (response.ok) succeeded(state, response);
      return response;
    }
  }

  return {
    run,
    limit: (provider) =>
      states.get(JSON.stringify(provider.identity || { service: provider.id }))?.limit,
    snapshots: () => [...states.values()].map((state) => state.limiter.snapshot()),
  };
}
