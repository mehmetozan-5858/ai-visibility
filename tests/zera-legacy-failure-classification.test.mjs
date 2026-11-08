import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeZeraAttemptGate} from '../lib/zera-attempt-gate.mjs';

test('legacy failed ZERA attempt without cause is unclassified and cannot be rerun',()=>{
 const result=summarizeZeraAttemptGate([{taskId:'brand-ai-de',status:'provider-failed',failureReason:null}],true);
 assert.equal(result.historicalFailureUnclassified,true);
 assert.equal(result.canStartNewAttempt,false);
 assert.equal(result.blockedReason,'previous-attempt-preserved');
 assert.equal(result.automaticallyRetried,false);
});
test('recorded failure classification never enables retry',()=>{
 const result=summarizeZeraAttemptGate([{taskId:'brand-ai-de',status:'provider-failed',failureReason:'provider-http-429'}],true);
 assert.equal(result.historicalFailureUnclassified,false);
 assert.equal(result.canStartNewAttempt,false);
});
