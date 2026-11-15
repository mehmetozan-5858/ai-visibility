import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withPaddleEntitlementWriterLockReview} from '../lib/portal-paddle-writer-lock-review.mjs';
import {PILOT_LOCK_SQL} from '../lib/portal-pilot-advisory-lock-review.mjs';
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const PAYMENT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
function fixture(tenants=[A,A],lockFails=false){
 const calls=[];let released=0,reads=0;
 const tx={query:async(sql,args=[])=>{
  calls.push({sql,args});
  if(sql.startsWith('SELECT client_id FROM public.payments'))
   return {rows:[{client_id:tenants[Math.min(reads++,tenants.length-1)]}]};
  if(lockFails&&sql===PILOT_LOCK_SQL)throw Error('synthetic-lock-timeout');
  return {rows:[]};
 },release:()=>{released++}};
 return {pool:{connect:async()=>tx},tx,calls,get released(){return released}};
}
test('Paddle review writer locks verified tenant before any FOR UPDATE or status mutation',async()=>{
 const f=fixture();
 const result=await withPaddleEntitlementWriterLockReview(f.pool,PAYMENT,async(tx,identity)=>{
  assert.equal(tx,f.tx);
  assert.deepEqual(identity,{paymentId:PAYMENT,tenantId:A});
  assert.equal(f.calls.length,6);
  assert.match(f.calls[3].sql,/^SELECT client_id/);
  assert.doesNotMatch(f.calls[3].sql,/FOR UPDATE/);
  assert.equal(f.calls[4].sql,PILOT_LOCK_SQL);
  assert.match(f.calls[5].sql,/^SELECT client_id/);
  await tx.query('SELECT id FROM public.payments WHERE id=$1 AND client_id=$2 FOR UPDATE',[PAYMENT,A]);
  await tx.query("UPDATE public.clients SET status='payment-review' WHERE id=$1",[A]);
  return 'review-ok';
 });
 assert.equal(result,'review-ok');
 assert.equal(f.calls[6].sql.includes('FOR UPDATE'),true);
 assert.equal(f.calls[7].sql.startsWith('UPDATE'),true);
 assert.equal(f.calls[8].sql,'COMMIT');
 assert.equal(f.released,1);
});
test('missing, changed tenant, lock timeout and callback error roll back and release',async()=>{
 for(const scenario of ['missing','changed','lock','callback']){
  const f=fixture(scenario==='missing'?['invalid']:scenario==='changed'?[A,B]:[A,A],scenario==='lock');
  let mutations=0;
  await assert.rejects(withPaddleEntitlementWriterLockReview(f.pool,PAYMENT,async()=>{
   mutations++;throw Error('synthetic-callback-failure');
  }),/paddle-review-tenant-missing|paddle-review-tenant-changed|synthetic-lock-timeout|synthetic-callback-failure/);
  assert.equal(mutations,scenario==='callback'?1:0);
  assert.equal(f.calls.at(-1).sql,'ROLLBACK');
  assert.equal(f.calls.some(c=>c.sql==='COMMIT'),false);
  assert.equal(f.released,1);
 }
});
test('invalid payment identifier rejects before any database call',async()=>{
 const f=fixture();
 for(const payment of ['',null,'malformed',A.replace(/a/g,'x')]){
  await assert.rejects(withPaddleEntitlementWriterLockReview(f.pool,payment,async()=>{}),
   /paddle-review-writer-invalid/);
 }
 assert.equal(f.calls.length,0);
 assert.equal(f.released,0);
});
test('live Paddle writer still has a tenant-lock ordering release blocker',async()=>{
 const s=await readFile(new URL('../lib/paddle-live.js',import.meta.url),'utf8');
 const transaction=s.slice(s.indexOf('async function applyTransaction('),s.indexOf('async function applySubscriptionAccess('));
 const subscription=s.slice(s.indexOf('async function applySubscriptionAccess('),s.indexOf('export async function recordPaddleLiveEvent('));
 assert.match(transaction,/FOR UPDATE/);
 assert.match(subscription,/FOR UPDATE/);
 assert.doesNotMatch(transaction,/acquirePilotAdvisoryLockReview/);
 assert.doesNotMatch(subscription,/acquirePilotAdvisoryLockReview/);
 const repository=await readFile(new URL('../lib/repository.js',import.meta.url),'utf8');
 assert.doesNotMatch(repository,/withPaddleEntitlementWriterLockReview/);
});
