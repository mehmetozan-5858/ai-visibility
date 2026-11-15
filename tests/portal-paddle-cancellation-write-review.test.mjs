import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {dispatchSignedPaddleEventWithTenantLockReview}
 from '../lib/portal-paddle-locked-dispatch-review.mjs';
import {applyOwnedPaddleCancellationReview,CANCEL_OWNED_ACCESS_SQL,AUDIT_CANCELLATION_SQL}
 from '../lib/portal-paddle-cancellation-write-review.mjs';
import {PILOT_LOCK_SQL} from '../lib/portal-pilot-advisory-lock-review.mjs';
const A='11111111-1111-4111-8111-111111111111',P='22222222-2222-4222-8222-222222222222';
const secret='synthetic-paddle-secret-review-only-123';
function signed(type='subscription.canceled',status='canceled'){
 const raw=JSON.stringify({event_id:'evt_reviewcancel123',event_type:type,
 occurred_at:'2026-11-15T09:00:00Z',
 data:{id:'sub_review123',status,custom_data:{payment_id:P,client_id:A}}});
 const ts=Math.floor(Date.now()/1000);
 const hash=createHmac('sha256',secret).update(`${ts}:${raw}`).digest('hex');
 return {raw,header:`ts=${ts};h1=${hash}`,secret};
}
function fixture({changed=true,failAudit=false}={}){
 const calls=[];let releases=0;
 const tx={query:async(sql,args)=>{
  calls.push({sql,args});
  if(sql===CANCEL_OWNED_ACCESS_SQL)return {rows:changed?[{id:A}]:[]};
  if(sql===AUDIT_CANCELLATION_SQL&&failAudit)throw Error('synthetic-audit-failure');
  return {rows:[]};
 },release(){releases++}};
 return {pool:{connect:async()=>tx},calls,get releases(){return releases}};
}
test('signed cancellation is tenant-locked before owned conditional update and audit',async()=>{
 const f=fixture();
 const result=await dispatchSignedPaddleEventWithTenantLockReview({
  ...signed(),pool:f.pool,write:applyOwnedPaddleCancellationReview
 });
 assert.deepEqual(result,{accessChanged:true,clientStatus:'payment-review'});
 assert.equal(f.calls[3].sql,PILOT_LOCK_SQL);
 assert.equal(f.calls[4].sql,CANCEL_OWNED_ACCESS_SQL);
 assert.deepEqual(f.calls[4].args,[A,P,'sub_review123','evt_reviewcancel123','2026-11-15T09:00:00Z']);
 assert.equal(f.calls[5].sql,AUDIT_CANCELLATION_SQL);
 assert.equal(f.calls[5].args[1],A);
 assert.equal(f.calls.at(-1).sql,'COMMIT');
 assert.equal(f.releases,1);
 assert.match(CANCEL_OWNED_ACCESS_SQL,/JOIN public\.payments p ON p\.id=l\.payment_id AND p\.client_id=l\.client_id/);
 assert.match(CANCEL_OWNED_ACCESS_SQL,/l\.client_id=c\.id AND l\.payment_id=\$2::uuid AND l\.subscription_id=\$3/);
 assert.match(CANCEL_OWNED_ACCESS_SQL,/e\.event_id=\$4 AND e\.occurred_at=\$5::timestamptz/);
});
test('already-revoked or missing ownership adds no extra audit',async()=>{
 const f=fixture({changed:false});
 assert.deepEqual(await dispatchSignedPaddleEventWithTenantLockReview({
  ...signed('subscription.paused','paused'),pool:f.pool,write:applyOwnedPaddleCancellationReview
 }),{accessChanged:false});
 assert.equal(f.calls.filter(c=>c.sql===AUDIT_CANCELLATION_SQL).length,0);
 assert.equal(f.calls.at(-1).sql,'COMMIT');
});
test('failed audit always rolls back access mutation and returns error',async()=>{
 const f=fixture({failAudit:true});
 await assert.rejects(dispatchSignedPaddleEventWithTenantLockReview({
  ...signed(),pool:f.pool,write:applyOwnedPaddleCancellationReview
 }),/synthetic-audit-failure/);
 assert.equal(f.calls.at(-1).sql,'ROLLBACK');
 assert.equal(f.calls.some(c=>c.sql==='COMMIT'),false);
 assert.equal(f.releases,1);
});
test('active subscription, wrong tenant/payment and unknown subscription reject mutation',async()=>{
 const f=fixture(),tx={query:async()=>{throw Error('unexpected SQL')}};
 for(const event of [
  {type:'subscription.resumed',status:'active',clientId:A,paymentId:P,entityId:'sub_review123'},
  {type:'subscription.canceled',clientId:'invalid',paymentId:P,entityId:'sub_review123'},
  {type:'subscription.canceled',clientId:A,paymentId:'invalid',entityId:'sub_review123'},
  {type:'subscription.canceled',clientId:A,paymentId:P,entityId:'txn_wrong'}
 ]){
  await assert.rejects(applyOwnedPaddleCancellationReview(tx,event),
   /review-cancellation-invalid-or-unsupported/);
 }
 assert.equal(f.calls.length,0);
});

test('missing event identity or timestamp must reject before query',async()=>{
 let calls=0;
 const tx={query:async()=>{calls++;return {rows:[]}}};
 const base={type:'subscription.canceled',status:'canceled',clientId:A,
  paymentId:P,entityId:'sub_review123',id:'evt_valid123',
  occurredAt:'2026-11-15T09:00:00Z'};
 for(const event of [
  {...base,id:null},{...base,id:'wrong-id'},
  {...base,occurredAt:null},{...base,occurredAt:'not-a-date'}
 ]){
  await assert.rejects(applyOwnedPaddleCancellationReview(tx,event),
   /review-cancellation-invalid-or-unsupported/);
 }
 assert.equal(calls,0);
});

test('current provider event identity is required, so stale or replayed cancellation cannot update',()=>{
 assert.match(CANCEL_OWNED_ACCESS_SQL,/JOIN public\.paddle_live_entities e ON e\.entity_id=l\.subscription_id/);
 assert.match(CANCEL_OWNED_ACCESS_SQL,/e\.client_id=l\.client_id AND e\.payment_id=l\.payment_id/);
 assert.match(CANCEL_OWNED_ACCESS_SQL,/e\.event_id=\$4 AND e\.occurred_at=\$5::timestamptz/);
 assert.match(CANCEL_OWNED_ACCESS_SQL,/e\.event_type IN \('subscription\.paused','subscription\.canceled','subscription\.past_due'\)/);
});
