import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLimiter } from './engines.mjs';

test('global translation budget holds across simultaneous page workers and releases after failures', async () => {
  const limiter = createLimiter(2);
  let active = 0,
    peak = 0;
  const completed = [];
  await Promise.allSettled(
    Array.from({ length: 12 }, (_, n) =>
      limiter.run(async () => {
        active++;
        peak = Math.max(peak, active);
        try {
          await new Promise((r) => setTimeout(r, 2 + (n % 3) * 3));
          if (n === 3) throw Error('fixture failure');
          completed.push(n);
        } finally {
          active--;
        }
      }),
    ),
  );
  assert.equal(peak, 2);
  assert.equal(active, 0);
  assert.equal(completed.length, 11);
  assert.ok(completed.includes(11));
});

test('cancelled queued translations release immediately without running or waiting for a slot', async () => {
  const limiter = createLimiter(1);
  let release;
  const running = limiter.run(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  await Promise.resolve();
  const controller = new AbortController();
  let ran = false;
  const cancelled = limiter.run(
    () => {
      ran = true;
    },
    { signal: controller.signal },
  );
  controller.abort();
  await assert.rejects(cancelled, { name: 'AbortError' });
  assert.equal(ran, false);
  release();
  await running;
  assert.equal(await limiter.run(() => 42), 42);
  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(
    limiter.run(
      () => {
        ran = true;
      },
      { signal: aborted.signal },
    ),
    { name: 'AbortError' },
  );
  assert.equal(ran, false);
});
