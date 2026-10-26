import test from 'node:test';
import assert from 'node:assert/strict';
import {safeZeraProviderReason} from '../lib/zera-safe-provider-reason.mjs';

test('ZERA diagnostics retain only explicitly safe provider reason codes',()=>{
  for(const reason of [
    'no-answer','not-configured','empty-answer','failed',
    'provider-temporarily-unavailable','provider-quota-or-rate-limit',
    'provider-model-not-found','provider-permission-denied',
    'provider-http-400','provider-http-429','provider-http-503',
  ])assert.equal(safeZeraProviderReason(reason),reason);
});

test('ZERA diagnostics never echo raw provider exceptions or secrets',()=>{
  for(const reason of [
    'API key abc-secret leaked in upstream exception',
    'provider-http-200',
    'provider-http-999',
    'provider-http-403 token=secret',
    'https://provider.invalid/error?key=secret',
    'Error: secret\\nstacktrace',
    '',null,undefined,{},['provider-http-500'],
    'x'.repeat(500),
  ])assert.equal(safeZeraProviderReason(reason),'provider-failed');
});
