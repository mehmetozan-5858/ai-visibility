import test from 'node:test';
import assert from 'node:assert/strict';
import {comparisonAttemptFailure} from '../lib/comparison-attempt-failure.mjs';
test('storage failures distinguish schema, reference, permission and transport without reflecting secrets',()=>{
 for(const [code,reason] of Object.entries({'42P01':'schema-unavailable','42703':'schema-mismatch',
  '23503':'customer-reference-missing','42501':'storage-permission-denied','57014':'storage-timeout',
  '08006':'storage-connection-failed'})){
  const value=comparisonAttemptFailure({code,message:'SECRET sql password',detail:'private customer answer'},'comparison-storage');
  assert.equal(value.reason,reason);assert.equal(value.stage,'comparison-storage');
  assert.equal(value.automaticRetryAllowed,false);assert.doesNotMatch(JSON.stringify(value),/SECRET|password|customer answer/);
 }
});
test('unknown failures and provider errors stay bounded and cannot authorize retries',()=>{
 const value=comparisonAttemptFailure({code:'secret',message:'private'},'attacker supplied');
 assert.deepEqual(value,{stage:'unknown',reason:'internal-error',automaticRetryAllowed:false});
 assert.equal(comparisonAttemptFailure({code:'42501'},'provider').reason,'provider-processing-error');
 assert.equal(comparisonAttemptFailure({},'attempt-status').stage,'attempt-status');
 assert.equal(comparisonAttemptFailure({code:'constructor'},'comparison-storage').reason,'internal-error');
});
