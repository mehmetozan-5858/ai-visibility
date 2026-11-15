import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {dispatchSignedPaddleEventWithTenantLockReview}
 from '../lib/portal-paddle-locked-dispatch-review.mjs';
import {applyOwnedPaddleResumeReview,RESUME_OWNED_ACCESS_SQL,AUDIT_RESUME_SQL}
 from '../lib/portal-paddle-resume-write-review.mjs';
import {PILOT_LOCK_SQL} from '../lib/portal-pilot-advisory-lock-review.mjs';

const A='11111111-1111-4111-8111-111111111111',P='22222222-2222-4222-8222-222222222222';
const secret='synthetic-resume-signing-secret-review-only';
function signed(type='subscription.resumed',status='active'){
 const raw=JSON.stringify({
  event_id:'evt_reviewresume123',event_type:type,occurred_at:'2026-11-15T09:30:00Z',
  data:{id:'sub_review123',status,custom_data:{client_id:A,payment_id:P}}
 });
 const ts=Math.floor(Date.now()/1000);
 const digest=createHmac('sha256',secret).update(`${ts}:${raw}`).digest('hex');
 return {raw,header:`ts=${ts};h1=${digest}`,secret};
}
function fixture({changed=true,failAudit=false}={}){
 const calls=[];let released=0;
 const tx={query:async(sql,args=[])=>{
  calls.push({sql,args});
  if(sql===RESUME_OWNED_ACCESS_SQL)return {rows:changed?[{id:A}]:[]};
  if(sql===AUDIT_RESUME_SQL&&failAudit)throw Error('synthetic-resume-audit-failure');
  return {rows:[]};
 },release(){released++}};
 return {pool:{connect:async()=>tx},calls,get released(){return released}};
}
test('signed current resume locks before conditional settlement-bound activation and audit',async()=>{
 const f=fixture();
 const result=await dispatchSignedPaddleEventWithTenantLockReview({
  ...signed(),pool:f.pool,write:applyOwnedPaddleResumeReview
 });
 assert.deepEqual(result,{accessChanged:true,clientStatus:'active'});
 assert.equal(f.calls[3].sql,PILOT_LOCK_SQL);
 assert.equal(f.calls[4].sql,RESUME_OWNED_ACCESS_SQL);
 assert.deepEqual(f.calls[4].args,[A,P,'sub_review123','evt_reviewresume123','2026-11-15T09:30:00Z']);
 assert.equal(f.calls[5].sql,AUDIT_RESUME_SQL);
 assert.equal(f.calls.at(-1).sql,'COMMIT');
 assert.equal(f.released,1);
 assert.match(RESUME_OWNED_ACCESS_SQL,/verified_customer_settlements s ON s\.payment_id=p\.id AND s\.client_id=p\.client_id/);
 assert.match(RESUME_OWNED_ACCESS_SQL,/p\.status='paid' AND p\.method='paddle'/);
 assert.match(RESUME_OWNED_ACCESS_SQL,/e\.event_id=\$4 AND e\.occurred_at=\$5::timestamptz/);
});
test('stale, unowned, already-active or missing verified settlement: no access or audit',async()=>{
 const f=fixture({changed:false});
 assert.deepEqual(await dispatchSignedPaddleEventWithTenantLockReview({
  ...signed('subscription.activated','active'),pool:f.pool,write:applyOwnedPaddleResumeReview
 }),{accessChanged:false});
 assert.equal(f.calls.filter(c=>c.sql===AUDIT_RESUME_SQL).length,0);
 assert.equal(f.calls.at(-1).sql,'COMMIT');
});
test('audit failure rolls back activation with lock still held',async()=>{
 const f=fixture({failAudit:true});
 await assert.rejects(dispatchSignedPaddleEventWithTenantLockReview({
  ...signed(),pool:f.pool,write:applyOwnedPaddleResumeReview
 }),/synthetic-resume-audit-failure/);
 assert.equal(f.calls[3].sql,PILOT_LOCK_SQL);
 assert.equal(f.calls.at(-1).sql,'ROLLBACK');
 assert.equal(f.released,1);
});
test('canceled/invalid event may never activate account',async()=>{
 let count=0;const tx={query:async()=>{count++;return {rows:[]}}};
 const base={type:'subscription.resumed',status:'active',clientId:A,paymentId:P,
  entityId:'sub_review123',id:'evt_test123',occurredAt:'2026-11-15T10:00:00Z'};
 for(const event of [
  {...base,type:'subscription.canceled',status:'canceled'},
  {...base,type:'subscription.updated',status:'canceled'},
  {...base,clientId:'wrong'}, {...base,paymentId:'wrong'},
  {...base,entityId:'txn_wrong'},{...base,id:'bad'},
  {...base,occurredAt:'bad-date'}
 ])await assert.rejects(applyOwnedPaddleResumeReview(tx,event),
  /review-resume-invalid-or-unsupported/);
 assert.equal(count,0);
});
