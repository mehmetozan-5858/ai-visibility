import test from 'node:test';
import assert from 'node:assert/strict';
import {assessZeraProviderSpendGate} from '../lib/zera-provider-spend-gate.mjs';

test('provider spending is denied by default', () => {
  assert.equal(assessZeraProviderSpendGate().allowed, false);
});

test('truthy flags, preview claims, keys and user confirmation cannot enable spending', () => {
  for (const env of [
    {ZERA_GROUNDED_AI_ENABLED:'true', GEMINI_API_KEY:'test-only'},
    {CUSTOMER_AI_COMPARE_ENABLED:'true', ZERA_PROVIDER_BILLING_CAP_VERIFIED:'true'},
    {VERCEL_ENV:'preview', ZERA_ISOLATED_PREVIEW_DB:'verified',
      ZERA_GEMINI_FREE_TIER_CONFIRMED:'true', ZERA_PROVIDER_BILLING_CAP_VERIFIED:'true'},
  ]) {
    const decision = assessZeraProviderSpendGate(env);
    assert.equal(decision.allowed, false);
    assert.equal(decision.providerSideHardCapVerified, false);
  }
});

test('production never qualifies as isolated preview', () => {
  const result=assessZeraProviderSpendGate({VERCEL_ENV:'production',ZERA_ISOLATED_PREVIEW_DB:'verified'});
  assert.equal(result.previewIsolationConfirmed, false);
  assert.equal(result.allowed, false);
});

