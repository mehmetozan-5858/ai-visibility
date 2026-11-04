import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeZeraAttemptGate} from '../lib/zera-attempt-gate.mjs';

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
