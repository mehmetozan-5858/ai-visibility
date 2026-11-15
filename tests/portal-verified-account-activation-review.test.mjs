import test from 'node:test';
import assert from 'node:assert/strict';
import {
 activateVerifiedPaddleAccountReview,VERIFIED_PADDLE_SETTLEMENT_SQL,
 LOCKED_ACCOUNT_ACTIVATION_SQL
} from '../lib/portal-verified-account-activation-review.mjs';
import {PILOT_LOCK_SQL} from '../lib/portal-pilot-advisory-lock-review.mjs';
import {readFile} from 'node:fs/promises';

const A='11111111-1111-4111-8111-111111111111';
function fixture(options={}){
 const {changed=true,failSql}=options;
 const proof=Object.hasOwn(options,'proof')?options.proof:true;
 const calls=[];let released=0;
 const conn={query:async(sql,args=[])=>{
  calls.push({sql,args});
  if(failSql===sql)throw Error('synthetic SQL failure');
  if(sql===VERIFIED_PADDLE_SETTLEMENT_SQL)return {rows:[{verifiedSettlement:proof}]};
  if(sql===LOCKED_ACCOUNT_ACTIVATION_SQL)return {rows:changed?[{id:A}]:[]};
  return {rows:[]};
 },release(){released++}};
 return {pool:{connect:async()=>conn},calls,get released(){return released}};
}
test('trusted account activation rechecks signed settlement AFTER the tenant lock',async()=>{
 const f=fixture();
 assert.deepEqual(await activateVerifiedPaddleAccountReview(f.pool,A),{activated:true});
 assert.deepEqual(f.calls.map(x=>x.sql),[
  'BEGIN ISOLATION LEVEL READ COMMITTED',
  "SET LOCAL lock_timeout = '2500ms'",
  "SET LOCAL statement_timeout = '10000ms'",
  PILOT_LOCK_SQL,VERIFIED_PADDLE_SETTLEMENT_SQL,
  LOCKED_ACCOUNT_ACTIVATION_SQL,'COMMIT'
 ]);
 for(const idx of [3,4,5])assert.deepEqual(f.calls[idx].args,[A]);
 assert.equal(f.released,1);
 assert.match(VERIFIED_PADDLE_SETTLEMENT_SQL,/p\.status='paid' AND p\.method='paddle'/);
 assert.match(VERIFIED_PADDLE_SETTLEMENT_SQL,/s\.payment_id/);
 assert.match(LOCKED_ACCOUNT_ACTIVATION_SQL,/c\.status='payment-review'/);
 assert.match(LOCKED_ACCOUNT_ACTIVATION_SQL,/AND EXISTS\(/);
 assert.match(LOCKED_ACCOUNT_ACTIVATION_SQL,/p\.status='paid' AND p\.method='paddle'/);
});
test('missing signed settlement cannot write account state',async()=>{
 for(const proof of [false,null,undefined]){
  const f=fixture({proof});
  await assert.rejects(activateVerifiedPaddleAccountReview(f.pool,A),
   /review-activation-independent-settlement-required/);
  assert.equal(f.calls.some(x=>x.sql===LOCKED_ACCOUNT_ACTIVATION_SQL),false);
  assert.equal(f.calls.at(-1).sql,'ROLLBACK');
  assert.equal(f.released,1);
 }
});
test('failed settlement query or account update always rolls back and releases',async()=>{
 for(const failSql of [VERIFIED_PADDLE_SETTLEMENT_SQL,LOCKED_ACCOUNT_ACTIVATION_SQL]){
  const f=fixture({failSql});
  await assert.rejects(activateVerifiedPaddleAccountReview(f.pool,A),/synthetic SQL failure/);
  assert.equal(f.calls.at(-1).sql,'ROLLBACK');
  assert.equal(f.released,1);
 }
});
test('invalid tenant never acquires a DB connection',async()=>{
 let acquired=0;
 const pool={connect:async()=>{acquired++;throw Error('unexpected SQL')}};
 for(const bad of ['',null,'missing','11111111-1111-1111-1111-111111111111']){
  await assert.rejects(activateVerifiedPaddleAccountReview(pool,bad),
   /review-activation-tenant-invalid/);
 }
 assert.equal(acquired,0);
});
test('legacy payment functions remain explicitly unmodified and BLOCKED',async()=>{
 const source=await readFile(new URL('../lib/repository.js',import.meta.url),'utf8');
 assert.match(source,/export async function confirmPayment/);
 assert.match(source,/export async function confirmCardPaymentByMerchantOid/);
 assert.doesNotMatch(source,/activateVerifiedPaddleAccountReview/);
});

test('valid v4 UUID reaches locked settlement query, invalid variant fails before SQL',async()=>{
 const accepted='11111111-1111-4111-8111-111111111111';
 const f=fixture({proof:false});
 await assert.rejects(activateVerifiedPaddleAccountReview(f.pool,accepted),
  /review-activation-independent-settlement-required/);
 assert.equal(f.calls.filter(x=>x.sql===VERIFIED_PADDLE_SETTLEMENT_SQL).length,1);
 assert.equal(f.calls.at(-1).sql,'ROLLBACK');
 const n=f.calls.length;
 for(const malformed of [
  '11111111-1111-4111-1111-111111111111',
  '11111111-1111-4111-811-111111111111',
  '11111111-1111-4111-81111-111111111111'
 ]){
  await assert.rejects(activateVerifiedPaddleAccountReview(f.pool,malformed),
   /review-activation-tenant-invalid/);
 }
 assert.equal(f.calls.length,n);
});

test('already-active account cannot be counted as a fresh settlement activation',async()=>{
 const f=fixture({proof:true,changed:false});
 assert.deepEqual(await activateVerifiedPaddleAccountReview(f.pool,A),{activated:false});
 assert.equal(f.calls.at(-1).sql,'COMMIT');
 assert.equal(f.calls.filter(x=>x.sql===LOCKED_ACCOUNT_ACTIVATION_SQL).length,1);
 assert.equal(f.released,1);
});

test('settlement evidence must not be a historical paid label or bank transfer',()=>{
 assert.match(VERIFIED_PADDLE_SETTLEMENT_SQL,/JOIN public\.payments p ON p\.id=s\.payment_id AND p\.client_id=s\.client_id/);
 assert.match(VERIFIED_PADDLE_SETTLEMENT_SQL,/s\.client_id=\$1::uuid/);
 assert.match(VERIFIED_PADDLE_SETTLEMENT_SQL,/p\.status='paid' AND p\.method='paddle'/);
 assert.doesNotMatch(VERIFIED_PADDLE_SETTLEMENT_SQL,/bank|card|customer-reported|bank-transfer/i);
});

test('settlement vanishes before conditional UPDATE: no activation credited',async()=>{
 // Even if the preceding SELECT saw signed settlement, the conditional
 // UPDATE must re-evaluate current paid Paddle proof. A zero-row response
 // is NOT a successful activation.
 const f=fixture({proof:true,changed:false});
 assert.deepEqual(await activateVerifiedPaddleAccountReview(f.pool,A),{activated:false});
 const statements=f.calls.map(x=>x.sql);
 assert.ok(statements.indexOf(VERIFIED_PADDLE_SETTLEMENT_SQL)<
  statements.indexOf(LOCKED_ACCOUNT_ACTIVATION_SQL));
 assert.match(LOCKED_ACCOUNT_ACTIVATION_SQL,/AND EXISTS\(/);
 assert.equal(f.calls.at(-1).sql,'COMMIT');
});
