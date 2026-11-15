import test from 'node:test';
import assert from 'node:assert/strict';
import {strictPaddleSubscriptionStateReview} from '../lib/portal-paddle-subscription-status-review.mjs';
import {applyOwnedPaddleSubscriptionTransitionReview}
 from '../lib/portal-paddle-subscription-transition-review.mjs';
import {applyOwnedPaddleResumeReview}
 from '../lib/portal-paddle-resume-write-review.mjs';
import {applyOwnedPaddleCancellationReview}
 from '../lib/portal-paddle-cancellation-write-review.mjs';
const base={id:'evt_reviewstatus123',occurredAt:'2026-11-15T11:00:00Z',
 entityId:'sub_review123',clientId:'11111111-1111-4111-8111-111111111111',
 paymentId:'22222222-2222-4222-8222-222222222222'};
test('Paddle lifecycle only accepts consistent type/status pairs',()=>{
 for(const type of ['subscription.activated','subscription.resumed']){
  assert.equal(strictPaddleSubscriptionStateReview({type,status:'active'}),'active');
  for(const status of ['canceled','past_due','paused','','paid'])
   assert.equal(strictPaddleSubscriptionStateReview({type,status}),null);
 }
 for(const [type,status] of [
  ['subscription.canceled','canceled'],['subscription.paused','paused'],
  ['subscription.past_due','past_due']
 ]){
  assert.equal(strictPaddleSubscriptionStateReview({type,status}),'payment-review');
  assert.equal(strictPaddleSubscriptionStateReview({type,status:'active'}),null);
 }
 for(const status of ['paused','canceled','past_due'])
  assert.equal(strictPaddleSubscriptionStateReview({type:'subscription.updated',status}),'payment-review');
 assert.equal(strictPaddleSubscriptionStateReview({type:'subscription.updated',status:'active'}),'active');
 for(const status of ['',null,'trialing','incomplete','unknown'])
  assert.equal(strictPaddleSubscriptionStateReview({type:'subscription.updated',status}),null);
});
test('contradictory signed lifecycle cannot reach account, event, or audit SQL',async()=>{
 let queries=0;
 const tx={query:async()=>{queries++;return {rows:[]}}};
 for(const event of [
  {...base,type:'subscription.resumed',status:'canceled'},
  {...base,type:'subscription.activated',status:'paused'},
  {...base,type:'subscription.canceled',status:'active'},
  {...base,type:'subscription.paused',status:'active'},
  {...base,type:'subscription.updated',status:'trialing'}
 ]){
  await assert.rejects(applyOwnedPaddleSubscriptionTransitionReview(tx,event),
   /review-subscription-transition-invalid/);
  await assert.rejects(applyOwnedPaddleResumeReview(tx,event),
   /review-resume-invalid-or-unsupported/);
  await assert.rejects(applyOwnedPaddleCancellationReview(tx,event),
   /review-cancellation-invalid-or-unsupported/);
 }
 assert.equal(queries,0);
});
