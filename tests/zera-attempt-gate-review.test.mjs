import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeZeraAttemptGate,availableZeraAttemptHistory,summarizeZeraAuditEvidence} from '../lib/zera-attempt-gate.mjs';

test('closed provider gate blocks a new attempt without history', () => {
  const state = summarizeZeraAttemptGate([], false);
  assert.equal(state.canStartNewAttempt, false);
  assert.equal(state.blockedReason, 'provider-gate-closed');
  assert.equal(state.automaticallyRetried, false);
});

test('prior failed and pending attempts are preserved without automatic retry', () => {
  for (const status of ['provider-failed', 'pending', 'running', 'completed']) {
    const state = summarizeZeraAttemptGate([{status}], true);
    assert.equal(state.canStartNewAttempt, false);
    assert.equal(state.blockedReason, 'previous-attempt-preserved');
    assert.equal(state.needsOperatorReview, true);
    assert.equal(state.automaticallyRetried, false);
    assert.equal(state.attemptHistoryPreserved, true);
  }
});

test('unclassified provider error demands operator review', () => {
  const state = summarizeZeraAttemptGate([{status:'provider-failed',failureReason:null}], true);
  assert.equal(state.historicalFailureUnclassified, true);
  assert.equal(state.needsOperatorReview, true);
});

test('unavailable or malformed history must fail closed', () => {
  for (const history of [undefined, null, {}, 'failed']) {
    const state = summarizeZeraAttemptGate(history, true);
    assert.equal(state.canStartNewAttempt, false);
    assert.equal(state.blockedReason, 'attempt-history-unavailable');
    assert.equal(state.needsOperatorReview, true);
  }
});

test('only a genuinely empty available history with explicit gate permits reviewable first attempt', () => {
  const state = summarizeZeraAttemptGate([], true);
  assert.equal(state.canStartNewAttempt, true);
  assert.equal(state.automaticallyRetried, false);
});

test('missing or malformed attempt table evidence never becomes an empty retry-ready history',()=>{
 for(const [present,rows] of [[false,[]],[false,[{status:'provider-failed'}]],[null,[]],[true,null],[true,{}]]){
  const history=availableZeraAttemptHistory(present,rows);
  assert.equal(history,null);
  assert.equal(summarizeZeraAttemptGate(history,true).canStartNewAttempt,false);
  assert.equal(summarizeZeraAttemptGate(history,true).blockedReason,'attempt-history-unavailable');
 }
});

test('verified existing table distinguishes empty first-attempt history from preserved prior attempt',()=>{
 const empty=availableZeraAttemptHistory(true,[]);
 const used=availableZeraAttemptHistory(true,[{status:'provider-failed'}]);
 assert.deepEqual(empty,[]);
 assert.equal(summarizeZeraAttemptGate(empty,true).canStartNewAttempt,true);
 assert.equal(summarizeZeraAttemptGate(used,true).canStartNewAttempt,false);
});

test('production legacy failure produces redacted unclassified audit evidence without granting retry',()=>{
 const attempts=[Object.freeze({taskId:'brand-ai-de',status:'provider-failed',failureReason:null,comparisonId:null,createdAt:'2026-10-25',secret:'PRIVATE_PAYLOAD'})];
 assert.deepEqual(summarizeZeraAuditEvidence(attempts),{historyAvailable:true,attemptCount:1,unclassifiedFailures:1,comparisonLinks:0});
 assert.equal(summarizeZeraAttemptGate(attempts,true).canStartNewAttempt,false);
 assert.equal(JSON.stringify(summarizeZeraAuditEvidence(attempts)).includes('PRIVATE_PAYLOAD'),false);
});

test('unknown history remains unverified rather than zero attempts',()=>{
 assert.deepEqual(summarizeZeraAuditEvidence(null),{historyAvailable:false,attemptCount:null,unclassifiedFailures:0,comparisonLinks:0});
});
