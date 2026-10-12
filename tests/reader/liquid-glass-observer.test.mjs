import { test } from 'node:test';
import assert from 'node:assert/strict';

const frames = [];
const observers = [];
class FakeMutationObserver {
  constructor(callback) {
    this.callback = callback;
    this.targets = [];
    observers.push(this);
  }
  observe(target, options) {
    this.targets.push({ target, options });
  }
  disconnect() {
    this.targets = [];
  }
}
const root = { dataset: {} };
const body = {};
const media = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
Object.assign(globalThis, {
  window: { previewAppearance: { platform: 'darwin' } },
  MutationObserver: FakeMutationObserver,
  matchMedia: media,
  requestAnimationFrame: (callback) => frames.push(callback),
  cancelAnimationFrame() {},
  document: {
    documentElement: root,
    body,
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
    querySelectorAll: () => [],
  },
});

const { installLiquidGlass } = await import('../../src/platform/macos/liquid-glass.mjs');

async function settle() {
  while (frames.length) frames.shift()();
  await new Promise((resolve) => setImmediate(resolve));
}
const watchingBody = () =>
  observers.some((observer) => observer.targets.some(({ target }) => target === body));

test('the body-wide observer runs only while Liquid Glass is enabled', async () => {
  const dispose = installLiquidGlass();
  const [settings] = observers;
  await settle();
  assert.equal(watchingBody(), false, 'default style does not watch page mutations');
  assert.equal(settings.targets[0].target, root, 'setting changes are still observed');

  root.dataset.interfaceStyle = 'liquid-glass';
  settings.callback([{ type: 'attributes' }]);
  await settle();
  assert.equal(watchingBody(), true);

  root.dataset.reduceTransparency = 'true';
  settings.callback([{ type: 'attributes' }]);
  await settle();
  assert.equal(watchingBody(), false, 'the solid fallback draws no glass');
  delete root.dataset.reduceTransparency;

  settings.callback([{ type: 'attributes' }]);
  await settle();
  assert.equal(watchingBody(), true);

  root.dataset.interfaceStyle = 'default';
  settings.callback([{ type: 'attributes' }]);
  await settle();
  assert.equal(watchingBody(), false, 'switching the style off stops watching');

  root.dataset.interfaceStyle = 'liquid-glass';
  settings.callback([{ type: 'attributes' }]);
  await settle();
  dispose();
  assert.equal(watchingBody(), false);
  assert.equal(settings.targets.length, 0);
});
