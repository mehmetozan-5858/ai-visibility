import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {dispatchSignedPaddleEventWithTenantLockReview}
 from '../lib/portal-paddle-locked-dispatch-review.mjs';
import {PILOT_LOCK_SQL} from '../lib/portal-pilot-advisory-lock-review.mjs';
const A='11111111-1111-4111-8111-111111111111',P='22222222-2222-4222-8222-222222222222';
const secret='test-only-review-secret-value-1234567890';
const make=(overrides={})=>{
 const raw=JSON.stringify({event_id:'evt_testreview1',event_type:'subscription.canceled',
  occurred_at:'2026-11-15T08:00:00Z',
  data:{id:'sub_review123',status:'canceled',custom_data:{client_id:A,payment_id:P}},
  ...overrides});
 const ts=Math.floor(Date.now()/1000);
 const h1=createHmac('sha256',secret).update(`${ts}:${raw}`).digest('hex');
 return {raw,header:`ts=${ts};h1=${h1}`,secret};
};
const poolFixture=()=>{
 const calls=[];let released=0,connections=0;
 const tx={query:async(sql,args)=>{calls.push({sql,args});return {rows:[]}},
  release:()=>{released++}};
 return {pool:{connect:async()=>{connections++;return tx}},calls,
  get connections(){return connections},get released(){return released}};
};
test('valid signed cancellation acquires tenant lock before trusted writer, then commits',async()=>{
 const f=poolFixture();
 let writerCalled=0;
 const result=await dispatchSignedPaddleEventWithTenantLockReview({
  ...make(),pool:f.pool,write:async(tx,event)=>{
   writerCalled++;
   assert.equal(event.clientId,A);
   assert.equal(event.paymentId,P);
   assert.equal(f.calls[3].sql,PILOT_LOCK_SQL);
   assert.deepEqual(f.calls[3].args,[A]);
   await tx.query('synthetic-audit-and-revoke',[A]);
   return {reviewOnly:true};
  }
 });
 assert.deepEqual(result,{reviewOnly:true});
 assert.equal(writerCalled,1);
 assert.equal(f.calls.at(-1).sql,'COMMIT');
 assert.equal(f.connections,1);assert.equal(f.released,1);
});
test('bad signature, malformed JSON, missing tenant or unsupported event never opens SQL',async()=>{
 const f=poolFixture(),signed=make();
 const write=async()=>{throw Error('writer should not run')};
 for(const input of [
  {...signed,header:'ts=100;h1='+('0'.repeat(64))},
  make({event_type:'subscription.created'}),
  make({data:{id:'sub_review123',custom_data:{client_id:'bad',payment_id:P}}}),
  make({data:{id:'sub_review123',custom_data:{client_id:A,payment_id:'bad'}}}),
  make({event_type:'adjustment.updated'}),
 ]){
  await assert.rejects(dispatchSignedPaddleEventWithTenantLockReview({
   ...input,pool:f.pool,write
  }));
 }
 assert.equal(f.connections,0);
 assert.equal(f.calls.length,0);
});
test('trusted webhook writer failure rolls back the pinned tenant lock transaction',async()=>{
 const f=poolFixture();
 await assert.rejects(dispatchSignedPaddleEventWithTenantLockReview({
  ...make(),pool:f.pool,write:async()=>{throw Error('synthetic signed-event write failed')}
 }),/synthetic signed-event write failed/);
 assert.equal(f.calls[3].sql,PILOT_LOCK_SQL);
 assert.equal(f.calls.at(-1).sql,'ROLLBACK');
 assert.equal(f.calls.some(c=>c.sql==='COMMIT'),false);
 assert.equal(f.released,1);
});
