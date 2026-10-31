import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeZeraAttemptGate} from '../lib/zera-attempt-gate.mjs';
test('failed history remains blocked even with enabled provider',()=>{
 assert.deepEqual(summarizeZeraAttemptGate([{taskId:'de',status:'provider-failed'}],true),{
 enabled:true,canStartNewAttempt:false,blockedReason:'previous-attempt-preserved',needsOperatorReview:true,attemptHistoryPreserved:true,automaticallyRetried:false});
});
test('missing provider gate remains closed',()=>{
 const x=summarizeZeraAttemptGate([],false);assert.equal(x.canStartNewAttempt,false);assert.equal(x.blockedReason,'provider-gate-closed');
});
test('diagnostic never mutates attempt records',()=>{
 const original=Object.freeze([{status:'stored'}]);summarizeZeraAttemptGate(original,true);assert.equal(original[0].status,'stored');
});
