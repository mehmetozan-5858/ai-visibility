import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {dispatchSignedPaddleEventWithTenantLockReview}
 from '../lib/portal-paddle-locked-dispatch-review.mjs';
import {applyOwnedPaddleSubscriptionTransitionReview,
 UPSERT_CURRENT_OWNED_SUBSCRIPTION_SQL,READ_CANCELLATION_NOOP_ACCOUNT_SQL} from '../lib/portal-paddle-subscription-transition-review.mjs';
import {CANCEL_OWNED_ACCESS_SQL,AUDIT_CANCELLATION_SQL}
 from '../lib/portal-paddle-cancellation-write-review.mjs';
import {RESUME_OWNED_ACCESS_SQL,AUDIT_RESUME_SQL}
 from '../lib/portal-paddle-resume-write-review.mjs';
import {PILOT_LOCK_SQL} from '../lib/portal-pilot-advisory-lock-review.mjs';

const A='11111111-1111-4111-8111-111111111111';
const P='22222222-2222-4222-8222-222222222222';
const secret='test-only-review-signed-subscription-secret';
function signed(type,status,id='evt_reviewtransition123'){
 const raw=JSON.stringify({event_id:id,event_type:type,occurred_at:'2026-11-15T10:00:00Z',
  data:{id:'sub_review123',status,custom_data:{client_id:A,payment_id:P}}});
 const ts=Math.floor(Date.now()/1000);
 return {raw,secret,header:`ts=${ts};h1=${createHmac('sha256',secret).update(`${ts}:${raw}`).digest('hex')}`};
}
function fixture({linked=true,accessChanged=true,failAudit=false,accountStatus='payment-review'}={}){
 const calls=[];let released=0;
 const tx={async query(sql,args=[]){
  calls.push({sql,args});
  if(sql===UPSERT_CURRENT_OWNED_SUBSCRIPTION_SQL)
   return {rows:linked?[{entity_id:'sub_review123'}]:[]};
  if(sql===READ_CANCELLATION_NOOP_ACCOUNT_SQL)
   return {rows:accountStatus===null?[]:[{status:accountStatus}]};
  if(sql===CANCEL_OWNED_ACCESS_SQL||sql===RESUME_OWNED_ACCESS_SQL)
   return {rows:accessChanged?[{id:A}]:[]};
  if(failAudit&&(sql===AUDIT_CANCELLATION_SQL||sql===AUDIT_RESUME_SQL))
   throw Error('synthetic-transition-audit-error');
  return {rows:[]};
 },release(){released++}};
 return {pool:{connect:async()=>tx},calls,get released(){return released}};
}
test('signed cancellation orders tenant lock -> owned current event -> account change -> audit',async()=>{
 const f=fixture();
 const result=await dispatchSignedPaddleEventWithTenantLockReview({
  ...signed('subscription.canceled','canceled'),pool:f.pool,
  write:applyOwnedPaddleSubscriptionTransitionReview
 });
 assert.deepEqual(result,{accessChanged:true,clientStatus:'payment-review',entityAdvanced:true});
 assert.deepEqual(f.calls.slice(3,7).map(x=>x.sql),[
  PILOT_LOCK_SQL,UPSERT_CURRENT_OWNED_SUBSCRIPTION_SQL,
  CANCEL_OWNED_ACCESS_SQL,AUDIT_CANCELLATION_SQL
 ]);
 assert.deepEqual(f.calls[4].args,[A,P,'sub_review123','subscription.canceled',
  'canceled','2026-11-15T10:00:00Z','evt_reviewtransition123']);
 assert.equal(f.calls.at(-1).sql,'COMMIT');
 assert.equal(f.released,1);
 assert.match(UPSERT_CURRENT_OWNED_SUBSCRIPTION_SQL,/JOIN public\.payments p ON p\.id=l\.payment_id AND p\.client_id=l\.client_id/);
 assert.match(UPSERT_CURRENT_OWNED_SUBSCRIPTION_SQL,/occurred_at<EXCLUDED\.occurred_at/);
});
test('signed resume uses same lock and demands downstream settlement before opening',async()=>{
 const f=fixture();
 assert.deepEqual(await dispatchSignedPaddleEventWithTenantLockReview({
  ...signed('subscription.resumed','active','evt_resumetest1'),
  pool:f.pool,write:applyOwnedPaddleSubscriptionTransitionReview
 }),{accessChanged:true,clientStatus:'active',entityAdvanced:true});
 assert.deepEqual(f.calls.slice(3,7).map(x=>x.sql),[
  PILOT_LOCK_SQL,UPSERT_CURRENT_OWNED_SUBSCRIPTION_SQL,
  RESUME_OWNED_ACCESS_SQL,AUDIT_RESUME_SQL
 ]);
 assert.equal(f.calls.at(-1).sql,'COMMIT');
});
test('stale, replayed or unlinked event cannot update account or audit',async()=>{
 const f=fixture({linked:false});
 assert.deepEqual(await dispatchSignedPaddleEventWithTenantLockReview({
  ...signed('subscription.canceled','canceled'),
  pool:f.pool,write:applyOwnedPaddleSubscriptionTransitionReview
 }),{accessChanged:false,staleOrUnlinked:true});
 assert.equal(f.calls.filter(c=>c.sql===CANCEL_OWNED_ACCESS_SQL||
  c.sql===RESUME_OWNED_ACCESS_SQL||c.sql===AUDIT_CANCELLATION_SQL||
  c.sql===AUDIT_RESUME_SQL).length,0);
 assert.equal(f.calls.at(-1).sql,'COMMIT');
});
test('audit failure rolls back entity advance AND account status on same transaction',async()=>{
 const f=fixture({failAudit:true});
 await assert.rejects(dispatchSignedPaddleEventWithTenantLockReview({
  ...signed('subscription.resumed','active'),pool:f.pool,
  write:applyOwnedPaddleSubscriptionTransitionReview
 }),/synthetic-transition-audit-error/);
 assert.equal(f.calls.at(-1).sql,'ROLLBACK');
 assert.equal(f.calls.some(c=>c.sql==='COMMIT'),false);
 assert.equal(f.released,1);
});
test('invalid signed event state is rejected before callback SQL',async()=>{
 let calls=0;const tx={query:async()=>{calls++}};
 const invalid={type:'subscription.created',status:'active',id:'evt_review123',
  entityId:'sub_review123',paymentId:P,clientId:A,occurredAt:'2026-11-15T10:00:00Z'};
 await assert.rejects(applyOwnedPaddleSubscriptionTransitionReview(tx,invalid),
  /review-subscription-transition-invalid/);
 assert.equal(calls,0);
});

test('signed resume without accepted account activation rolls back current entity event',async()=>{
 const f=fixture({linked:true,accessChanged:false});
 await assert.rejects(dispatchSignedPaddleEventWithTenantLockReview({
  ...signed('subscription.resumed','active','evt_reviewunverified123'),
  pool:f.pool,write:applyOwnedPaddleSubscriptionTransitionReview
 }),/review-resume-not-accepted-rollback-current-event/);
 const statements=f.calls.map(c=>c.sql);
 assert.ok(statements.includes(UPSERT_CURRENT_OWNED_SUBSCRIPTION_SQL));
 assert.ok(statements.includes(RESUME_OWNED_ACCESS_SQL));
 assert.equal(statements.includes(AUDIT_RESUME_SQL),false);
 assert.equal(statements.at(-1),'ROLLBACK');
 assert.equal(statements.includes('COMMIT'),false);
 assert.equal(f.released,1);
});
test('cancellation can advance an already suspended subscription without falsely restoring access',async()=>{
 const f=fixture({linked:true,accessChanged:false});
 assert.deepEqual(await dispatchSignedPaddleEventWithTenantLockReview({
  ...signed('subscription.canceled','canceled','evt_reviewalreadycanceled123'),
  pool:f.pool,write:applyOwnedPaddleSubscriptionTransitionReview
 }),{accessChanged:false,entityAdvanced:true});
 assert.equal(f.calls.at(-1).sql,'COMMIT');
 assert.equal(f.calls.some(c=>c.sql===AUDIT_CANCELLATION_SQL),false);
});

test('zero-row cancellation must rollback when account remains active or unverified',async()=>{
 for(const accountStatus of ['active','suspended',null]){
  const f=fixture({linked:true,accessChanged:false,accountStatus});
  await assert.rejects(dispatchSignedPaddleEventWithTenantLockReview({
   ...signed('subscription.canceled','canceled','evt_reviewzeroaudit123'),
   pool:f.pool,write:applyOwnedPaddleSubscriptionTransitionReview
  }),/review-cancellation-unaccepted-rollback-current-event/);
  assert.ok(f.calls.some(c=>c.sql===UPSERT_CURRENT_OWNED_SUBSCRIPTION_SQL));
  assert.ok(f.calls.some(c=>c.sql===READ_CANCELLATION_NOOP_ACCOUNT_SQL));
  assert.equal(f.calls.at(-1).sql,'ROLLBACK');
  assert.equal(f.calls.some(c=>c.sql==='COMMIT'),false);
  assert.equal(f.calls.some(c=>c.sql===AUDIT_CANCELLATION_SQL),false);
  assert.equal(f.released,1);
 }
});
