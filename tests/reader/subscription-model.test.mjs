import test from 'node:test';
import assert from 'node:assert/strict';
import { withSharedSubscriptionModel } from '../../shared/translation/provider-groups.mjs';

const subscription = (model, active = false) => ({
  ...(active ? { id: 'chatgpt-subscription', values: { model } } : { id: 'auto', values: {} }),
  profiles: { 'chatgpt-subscription': { values: { model } } },
});

test('kernels without a subscription model inherit the configured one', () => {
  const services = {
    pdf_math_fast: subscription('gpt-5.6-luna', true),
    pdf_math_precise: { id: 'custom-6cc99f22cbb4', values: {}, profiles: {} },
  };
  const shared = withSharedSubscriptionModel(services);
  assert.equal(
    shared.pdf_math_precise.profiles['chatgpt-subscription'].values.model,
    'gpt-5.6-luna',
  );
  assert.equal(shared.pdf_inspector.profiles['chatgpt-subscription'].values.model, 'gpt-5.6-luna');
  assert.equal(shared.pdf_math_precise.id, 'custom-6cc99f22cbb4');
  assert.equal(withSharedSubscriptionModel(shared), shared);
});

test('a model changed in one kernel follows into the others', () => {
  const previous = {
    pdf_inspector: subscription('a'),
    pdf_math_fast: subscription('a'),
    pdf_math_precise: subscription('a', true),
  };
  const next = { ...previous, pdf_math_fast: subscription('b') };
  const shared = withSharedSubscriptionModel(next, previous);
  assert.equal(shared.pdf_math_precise.values.model, 'b');
  assert.equal(shared.pdf_math_precise.profiles['chatgpt-subscription'].values.model, 'b');
  assert.equal(shared.pdf_inspector.profiles['chatgpt-subscription'].values.model, 'b');
});

test('different saved models are kept when nothing changed', () => {
  const services = {
    pdf_inspector: subscription('a'),
    pdf_math_fast: subscription('b'),
    pdf_math_precise: subscription('c'),
  };
  assert.equal(withSharedSubscriptionModel(services), services);
});
