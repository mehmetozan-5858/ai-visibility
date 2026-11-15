import test from 'node:test';
import assert from 'node:assert/strict';
import {updateSingleMerchantPaymentReview} from '../lib/portal-merchant-reference-uniqueness-review.mjs';

const PAYMENT='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TENANT='11111111-1111-4111-8111-111111111111';
const OTHER='22222222-2222-4222-8222-222222222222';
const approved={paymentId:PAYMENT,tenantId:TENANT};

test('review transition addresses exactly one stored payment id and tenant, not merchant string',async()=>{
 const calls=[];
 const tx={query:async(sql,args)=>{calls.push({sql,args});return {rows:[{id:PAYMENT,clientId:TENANT,status:'paid'}]}}};
 assert.deepEqual(await updateSingleMerchantPaymentReview(tx,approved),
  {id:PAYMENT,clientId:TENANT,status:'paid'});
 assert.equal(calls.length,1);
 assert.match(calls[0].sql,/WHERE id=\$1::uuid AND client_id=\$2::uuid AND status='pending'/);
 assert.doesNotMatch(calls[0].sql,/reference_code|replace\(/);
 assert.deepEqual(calls[0].args,[PAYMENT,TENANT]);
});

test('missing, wrong-tenant, already-paid or multi-row transition fails closed',async()=>{
 for(const rows of [[],[{id:PAYMENT,clientId:OTHER,status:'paid'}],
  [{id:PAYMENT,clientId:TENANT,status:'pending'}],
  [{id:PAYMENT,clientId:TENANT,status:'paid'},{id:PAYMENT,clientId:TENANT,status:'paid'}]]){
  const tx={query:async()=>({rows})};
  await assert.rejects(updateSingleMerchantPaymentReview(tx,approved),/merchant-payment-not-transitioned/);
 }
});

test('invalid id or tenant cannot run any SQL',async()=>{
 let calls=0;const tx={query:async()=>{calls++;return {rows:[]}}};
 for(const resolved of [null,{}, {paymentId:'not-uuid',tenantId:TENANT},
  {paymentId:PAYMENT,tenantId:'not-uuid'}])
  await assert.rejects(updateSingleMerchantPaymentReview(tx,resolved),/merchant-payment-update-unverified/);
 assert.equal(calls,0);
});

test('review helper is not connected to real repository payment paths',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../lib/repository.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/updateSingleMerchantPaymentReview/);
});
