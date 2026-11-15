import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {routeSignedPaddleEntitlementReview}
 from '../lib/portal-paddle-entitlement-router-review.mjs';
import {PILOT_LOCK_SQL} from '../lib/portal-pilot-advisory-lock-review.mjs';
import {READ_OWNED_PAYMENT_FOR_COMPLETION_SQL,MARK_VERIFIED_PADDLE_PAYMENT_SQL,
 INSERT_VERIFIED_PADDLE_PROOF_SQL} from '../lib/portal-paddle-completion-write-review.mjs';
import {UPSERT_CURRENT_OWNED_SUBSCRIPTION_SQL}
 from '../lib/portal-paddle-subscription-transition-review.mjs';
import {CANCEL_OWNED_ACCESS_SQL,AUDIT_CANCELLATION_SQL}
 from '../lib/portal-paddle-cancellation-write-review.mjs';
import {RESUME_OWNED_ACCESS_SQL,AUDIT_RESUME_SQL}
 from '../lib/portal-paddle-resume-write-review.mjs';

const A='11111111-1111-4111-8111-111111111111',P='22222222-2222-4222-8222-222222222222';
const secret='synthetic-test-hmac-secret-not-production';
const totals={subtotal:'16900',discount:'0',tax:'0',total:'16900',
 credit:'0',credit_to_balance:'0',balance:'0',grand_total:'16900',currency_code:'EUR'};
function payload(type,status,id){
 const subscription=type.startsWith('subscription.');
 return {event_id:id,event_type:type,occurred_at:'2026-11-15T10:00:00Z',
  data:subscription
   ?{id:'sub_review123',status,custom_data:{client_id:A,payment_id:P}}
   :{id:'txn_review123',status,origin:'api',currency_code:'EUR',
     custom_data:{client_id:A,payment_id:P},
     items:[{quantity:1,price:{unit_price:{amount:'16900'},tax_mode:'internal'}}],
     details:{totals}}};
}
function signed(event){
 const raw=JSON.stringify(event),ts=Math.floor(Date.now()/1000);
 return {raw,header:`ts=${ts};h1=${createHmac('sha256',secret).update(`${ts}:${raw}`).digest('hex')}`,secret};
}
function fixture({proof=true,failAudit=false}={}){
 const calls=[];let connections=0,released=0;
 const tx={async query(sql,args=[]){
  calls.push({sql,args});
  if(sql===READ_OWNED_PAYMENT_FOR_COMPLETION_SQL)
   return {rows:[{id:P,client_id:A,status:'pending',currency:'EUR',setup_amount:120,monthly_amount:49}]};
  if(sql===MARK_VERIFIED_PADDLE_PAYMENT_SQL)return {rows:[{id:P,client_id:A}]};
  if(sql===INSERT_VERIFIED_PADDLE_PROOF_SQL)return {rows:proof?[{payment_id:P}]:[]};
  if(sql===UPSERT_CURRENT_OWNED_SUBSCRIPTION_SQL)return {rows:[{entity_id:'sub_review123'}]};
  if(sql===CANCEL_OWNED_ACCESS_SQL||sql===RESUME_OWNED_ACCESS_SQL)return {rows:[{id:A}]};
  if(failAudit&&(sql===AUDIT_CANCELLATION_SQL||sql===AUDIT_RESUME_SQL))
   throw Error('synthetic-router-audit-error');
  return {rows:[]};
 },release(){released++}};
 return {pool:{connect:async()=>{connections++;return tx}},calls,
  get connections(){return connections},get released(){return released}};
}
const route=(f,event)=>routeSignedPaddleEntitlementReview({...signed(event),pool:f.pool});
test('signed payment creates proof WITHOUT automatic access; subscription separately uses same lock',async()=>{
 const f=fixture();
 assert.deepEqual(await route(f,payload('transaction.completed','completed','evt_complete123')),
  {paymentChanged:true,settlementRecorded:true,accountActivated:false});
 assert.deepEqual(f.calls.map(c=>c.sql).slice(3,7),[
  PILOT_LOCK_SQL,READ_OWNED_PAYMENT_FOR_COMPLETION_SQL,
  MARK_VERIFIED_PADDLE_PAYMENT_SQL,INSERT_VERIFIED_PADDLE_PROOF_SQL]);
 assert.equal(f.calls.filter(c=>c.sql===CANCEL_OWNED_ACCESS_SQL||c.sql===RESUME_OWNED_ACCESS_SQL).length,0);
 assert.deepEqual(await route(f,payload('subscription.canceled','canceled','evt_cancel123')),
  {accessChanged:true,clientStatus:'payment-review',entityAdvanced:true});
 const second=f.calls.map(c=>c.sql);
 const up=second.indexOf(UPSERT_CURRENT_OWNED_SUBSCRIPTION_SQL);
 assert.equal(second[up-1],PILOT_LOCK_SQL);
 assert.deepEqual(second.slice(up,up+3),[
  UPSERT_CURRENT_OWNED_SUBSCRIPTION_SQL,CANCEL_OWNED_ACCESS_SQL,AUDIT_CANCELLATION_SQL]);
 assert.equal(f.released,2);
});
test('signed resume uses current subscription and settlement-bound access SQL',async()=>{
 const f=fixture();
 assert.deepEqual(await route(f,payload('subscription.resumed','active','evt_resume123')),
  {accessChanged:true,clientStatus:'active',entityAdvanced:true});
 assert.deepEqual(f.calls.map(c=>c.sql).slice(3,7),[
  PILOT_LOCK_SQL,UPSERT_CURRENT_OWNED_SUBSCRIPTION_SQL,RESUME_OWNED_ACCESS_SQL,AUDIT_RESUME_SQL]);
});
test('unimplemented failure event cannot modify payment, proof, subscription, or account',async()=>{
 const f=fixture();
 await assert.rejects(route(f,payload('transaction.payment_failed','failed','evt_failed123')),
  /review-entitlement-event-not-implemented/);
 assert.equal(f.calls.some(c=>[
  MARK_VERIFIED_PADDLE_PAYMENT_SQL,INSERT_VERIFIED_PADDLE_PROOF_SQL,
  UPSERT_CURRENT_OWNED_SUBSCRIPTION_SQL,CANCEL_OWNED_ACCESS_SQL,RESUME_OWNED_ACCESS_SQL
 ].includes(c.sql)),false);
 assert.equal(f.calls.at(-1).sql,'ROLLBACK');
});
test('bad signature never connects; failed proof and failed audit both roll back',async()=>{
 const f=fixture();
 const valid=signed(payload('transaction.completed','completed','evt_test123'));
 await assert.rejects(routeSignedPaddleEntitlementReview({
  ...valid,header:'ts=1;h1='+('0'.repeat(64)),pool:f.pool
 }),/review-webhook-signature-required/);
 assert.equal(f.connections,0);
 const p=fixture({proof:false});
 await assert.rejects(route(p,payload('transaction.completed','completed','evt_test123')),
  /review-completion-settlement-proof-conflict/);
 assert.equal(p.calls.at(-1).sql,'ROLLBACK');
 const a=fixture({failAudit:true});
 await assert.rejects(route(a,payload('subscription.resumed','active','evt_testresume123')),
  /synthetic-router-audit-error/);
 assert.equal(a.calls.at(-1).sql,'ROLLBACK');
});
