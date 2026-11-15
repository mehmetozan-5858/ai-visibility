import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyAndTransitionMerchantPaymentReview} from '../lib/portal-merchant-reference-uniqueness-review.mjs';
import {PILOT_LOCK_SQL} from '../lib/portal-pilot-advisory-lock-review.mjs';

// REVIEW-ONLY fake verifier. Real provider HMAC, amount/currency receipts,
// durable event idempotency and settlement entitlement are NOT proven here.
const A='11111111-1111-4111-8111-111111111111';
const ID='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OID='12345678abcde';
const event={provider:'synthetic',reference:OID};
const proof={authenticated:true,amountMatched:true,currencyMatched:true,eventNotReplayed:true,reference:OID};
function fixture(){
 const sql=[];
 const tx={query:async(query,args=[])=>{
  sql.push({query,args});
  if(query.includes('FROM public.payments WHERE replace('))
   return {rows:[{id:ID,clientId:A}]};
  if(query.includes('UPDATE public.payments'))
   return {rows:[{id:ID,clientId:A,status:'paid'}]};
  return {rows:[]};
 }};
 return {tx,sql};
}
test('denied provider signature, wrong amount/currency or repeated event blocks all SQL',async()=>{
 for(const defect of ['authenticated','amountMatched','currencyMatched','eventNotReplayed']){
  const f=fixture();
  await assert.rejects(verifyAndTransitionMerchantPaymentReview(f.tx,OID,event,
   async()=>({...proof,[defect]:false})),/merchant-provider-evidence-denied/);
  assert.equal(f.sql.length,0,'no database reads or writes before proof validation');
 }
 const f=fixture();
 await assert.rejects(verifyAndTransitionMerchantPaymentReview(f.tx,OID,event,
  async()=>({...proof,reference:'OTHER123'})),/merchant-provider-evidence-denied/);
 assert.equal(f.sql.length,0);
});
test('unavailable verifier fails closed without touching SQL',async()=>{
 const f=fixture();
 await assert.rejects(verifyAndTransitionMerchantPaymentReview(f.tx,OID,event,null),
  /merchant-provider-verifier-unavailable/);
 assert.equal(f.sql.length,0);
});
test('verified synthetic evidence follows unique lookup, tenant lock, revalidation then id-scoped update',async()=>{
 const f=fixture(),seen=[];
 const row=await verifyAndTransitionMerchantPaymentReview(f.tx,OID,event,async(input)=>{
  seen.push(input);
  assert.equal(f.sql.length,0);
  return proof;
 });
 assert.equal(seen.length,1);
 assert.deepEqual(row,{id:ID,clientId:A,status:'paid'});
 assert.equal(f.sql.length,4);
 assert.match(f.sql[0].query,/LIMIT 2/);
 assert.equal(f.sql[1].query,PILOT_LOCK_SQL);
 assert.match(f.sql[2].query,/LIMIT 2/);
 assert.match(f.sql[3].query,/WHERE id=\$1::uuid AND client_id=\$2::uuid AND status='pending'/);
 assert.deepEqual(f.sql[3].args,[ID,A]);
});
test('verifier error propagates without reading or updating payments',async()=>{
 const f=fixture();
 await assert.rejects(verifyAndTransitionMerchantPaymentReview(f.tx,OID,event,
  async()=>{throw Error('synthetic-provider-timeout')}),/synthetic-provider-timeout/);
 assert.equal(f.sql.length,0);
});
test('new orchestration remains disconnected from real payment APIs',async()=>{
 const {readFile}=await import('node:fs/promises');
 const s=await readFile(new URL('../lib/repository.js',import.meta.url),'utf8');
 assert.doesNotMatch(s,/verifyAndTransitionMerchantPaymentReview/);
});
