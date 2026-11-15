import test from 'node:test';
import assert from 'node:assert/strict';
import {withPaymentAccountLockReview} from '../lib/portal-payment-account-lock-review.mjs';
import {PILOT_LOCK_SQL} from '../lib/portal-pilot-advisory-lock-review.mjs';

const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const paymentId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const merchantOid='12345678abcde';
function fixture({ids=[A,A],failLock=false}={}){
 const calls=[];let released=0,reads=0;
 const tx={query:async(sql,args=[])=>{
  calls.push({sql,args});
  if(sql.startsWith('SELECT client_id FROM public.payments')){
   const client_id=ids[Math.min(reads++,ids.length-1)];
   return {rows:client_id?[{client_id}]:[]};
  }
  if(failLock&&sql===PILOT_LOCK_SQL)throw Object.assign(Error('lock unavailable'),{code:'55P03'});
  return {rows:[]};
 },release:()=>{released++}};
 return {pool:{connect:async()=>tx},calls,tx,get released(){return released}};
}
for(const selector of [{paymentId},{merchantOid}]){
 test('trusted payment lookup obtains tenant lock before any account mutation: '+Object.keys(selector)[0],async()=>{
  const f=fixture();
  const result=await withPaymentAccountLockReview(f.pool,selector,async(tx,tenant)=>{
   assert.equal(tx,f.tx);assert.equal(tenant,A);
   assert.equal(f.calls[3].sql.startsWith('SELECT client_id'),true);
   assert.equal(f.calls[4].sql,PILOT_LOCK_SQL);
   assert.equal(f.calls[5].sql.startsWith('SELECT client_id'),true);
   assert.deepEqual(f.calls[4].args,[A]);
   await tx.query("UPDATE public.clients SET status='active' WHERE id=$1",[tenant]);
   return 'accepted-review';
  });
  assert.equal(result,'accepted-review');
  assert.equal(f.calls[6].sql.startsWith('UPDATE public.clients'),true);
  assert.equal(f.calls[7].sql,'COMMIT');
  assert.equal(f.released,1);
 });
}
test('unknown, changed or invalid tenant rejects before mutation and rolls back',async()=>{
 for(const ids of [[null],[A,B],['not-a-uuid']]){
  const f=fixture({ids});let updates=0;
  await assert.rejects(withPaymentAccountLockReview(f.pool,{paymentId},async()=>{updates++;}),/payment-lock-tenant/);
  assert.equal(updates,0);
  assert.equal(f.calls.some(x=>x.sql==='COMMIT'),false);
  assert.equal(f.calls.at(-1).sql,'ROLLBACK');
  assert.equal(f.released,1);
 }
});
test('advisory-lock timeout and update failure release connection without committing',async()=>{
 for(const mode of ['lock','update']){
  const f=fixture({failLock:mode==='lock'});let mutationCalls=0;
  await assert.rejects(withPaymentAccountLockReview(f.pool,{paymentId},async()=>{
   mutationCalls++;throw Error('synthetic-update-failure');
  }),/lock unavailable|synthetic-update-failure/);
  assert.equal(mutationCalls,mode==='lock'?0:1);
  assert.equal(f.calls.at(-1).sql,'ROLLBACK');
  assert.equal(f.calls.some(x=>x.sql==='COMMIT'),false);
  assert.equal(f.released,1);
 }
});
test('payment selector must be one approved server lookup; invalid input touches no database',async()=>{
 const f=fixture();
 for(const selector of [null,{}, {paymentId,merchantOid},{clientId:A},{paymentId:'invalid'},{merchantOid:'!'}]){
  await assert.rejects(withPaymentAccountLockReview(f.pool,selector,async()=>{}),/payment-lock-selector-invalid/);
 }
 assert.equal(f.calls.length,0);
 assert.equal(f.released,0);
});
test('current live payment/account writers are NOT integrated; release remains HOLD',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../lib/repository.js',import.meta.url),'utf8');
 assert.match(source,/export async function confirmPayment\(/);
 assert.match(source,/export async function confirmCardPaymentByMerchantOid\(/);
 // This is a review-only helper; no claim of live wiring or full inventory.
 assert.doesNotMatch(source,/withPaymentAccountLockReview/);
});
