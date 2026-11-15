import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyPaddleAdjustmentReview} from '../lib/portal-paddle-adjustment-classifier-review.mjs';
import {readFile} from 'node:fs/promises';

const event=(overrides={})=>({
 event_id:'evt_01hvgfdfepj8eaevsjh5g4swbe',
 event_type:'adjustment.created',
 data:{id:'adj_01hvgf2s84dr6reszzg29zbvcm',
  transaction_id:'txn_01hvcc93znj3mpqt1tenkjb04y',
  action:'refund',status:'approved',type:'full',...overrides}
});

test('approved full refund is ownership/tenant review, never automatic entitlement',()=>{
 const r=classifyPaddleAdjustmentReview(event());
 assert.deepEqual(r,{decision:'verified-refund-needs-ownership',reason:'full-refund-verify-tenant-and-payment'});
 assert.equal('clientId' in r,false);
});

test('approved partial refund cannot revoke full customer entitlement by inference',()=>{
 assert.equal(classifyPaddleAdjustmentReview(event({type:'partial'})).decision,'manual-review');
});

test('pending, rejected and reversed refunds are distinct outcomes',()=>{
 for(const [status,decision] of [['pending_approval','hold'],['rejected','no-revocation'],['reversed','manual-review']])
  assert.equal(classifyPaddleAdjustmentReview(event({status})).decision,decision);
});

test('adjustment.created and adjustment.updated are both relevant, not transaction.refunded',()=>{
 const updated={...event(),event_type:'adjustment.updated'};
 assert.equal(classifyPaddleAdjustmentReview(updated).decision,'verified-refund-needs-ownership');
 assert.equal(classifyPaddleAdjustmentReview({...event(),event_type:'transaction.refunded'}).decision,'deny');
});

test('credit and chargeback adjustments cannot be mistaken for refund approvals',()=>{
 for(const action of ['credit','chargeback','chargeback_warning','chargeback_reverse','credit_reverse'])
  assert.equal(classifyPaddleAdjustmentReview(event({action})).decision,'manual-review');
});

test('missing transaction link, unknown status/action/type or untrusted shape are denied',()=>{
 for(const e of [
  event({transaction_id:''}),event({transaction_id:'txn_not;safe'}),
  event({status:'unknown'}),event({action:'unknown'}),
  event({type:'opaque'}),{...event(),event_id:'bad'},null
 ]){
  assert.equal(classifyPaddleAdjustmentReview(e).decision,'deny');
 }
});

test('review classifier cannot silently make production Paddle accept adjustments',async()=>{
 const s=await readFile(new URL('../lib/paddle-live.js',import.meta.url),'utf8');
 assert.doesNotMatch(s,/classifyPaddleAdjustmentReview/);
});
