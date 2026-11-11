import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewRevenueRecords} from '../lib/rd-revenue-review.mjs';
import {runRevenuePilot} from '../lib/rd-revenue-pilot.mjs';
const p={id:'payment-a',clientId:'tenant-a',status:'paid',expectedMinor:4900,currency:'TRY',accessActive:false};
const s={paymentId:p.id,clientId:p.clientId,transactionId:'txn_test',eventId:'evt_test',paidMinor:4900,currency:'TRY',independentlyConfirmed:true};
const review=(payment=p,settlements=[s])=>reviewRevenueRecords({clientId:p.clientId,payments:[payment],settlements});
test('matching records never become verified or recovered revenue and inputs stay unchanged',()=>{
 const payment=Object.freeze({...p}),proof=Object.freeze({...s});
 const r=review(payment,[proof]);
 assert.equal(r.findings[0].state,'consistent-records');
 assert.equal(r.verifiedRevenue,null);assert.equal(r.recoveredRevenue,null);
 assert.equal(r.externalActions,false);assert.equal(r.paymentChanges,false);
 assert.deepEqual(payment,p);assert.deepEqual(proof,s);
 for(const status of ['pending','failed'])assert.equal(review({...p,status},[]).findings[0].state,'pending');
 assert.equal(review({...p,status:'refunded'}).findings[0].state,'not-revenue');
 assert.equal(review({...p,status:'refunded',accessActive:true}).findings[0].state,'review');
});
test('missing, ambiguous, mismatched and reused provider evidence is flagged without arithmetic across currencies',()=>{
 for(const [proofs,reason] of [[[],'missing-settlement-proof'],[[{...s,independentlyConfirmed:false}],'missing-settlement-proof'],[[s,s],'ambiguous-settlement-proof'],[[{...s,paidMinor:4800}],'amount-mismatch'],[[{...s,currency:'EUR'}],'currency-mismatch']]){
  const r=review(p,proofs);assert.equal(r.findings[0].state,'review');assert.ok(r.findings[0].reasons.includes(reason));assert.equal(r.verifiedRevenue,null);
 }
 const b={...p,id:'payment-b'};
 const r=reviewRevenueRecords({clientId:p.clientId,payments:[p,b],settlements:[s,{...s,paymentId:b.id,eventId:'evt_other'}]});
 assert.equal(r.reviewCount,2);assert.ok(r.findings.every(f=>f.reasons.includes('reused-provider-identity')));
});
test('tenant contamination and malformed evidence cannot produce a trusted result',()=>{
 assert.throws(()=>review(p,[{...s,clientId:'tenant-b'}]),/tenant-scope-mismatch/);
 assert.throws(()=>reviewRevenueRecords({clientId:p.clientId,payments:[p,p]}),/ambiguous-payment-identity/);
 assert.throws(()=>reviewRevenueRecords({clientId:p.clientId,payments:Array(201).fill(p)}),/invalid-review-input/);
 for(const expectedMinor of [NaN,-1,0.5,Number.MAX_SAFE_INTEGER+1])assert.equal(review({...p,expectedMinor}).findings[0].state,'unknown');
 assert.equal(review({...p,expectedMinor:0},[]).findings[0].state,'not-revenue');
 assert.deepEqual(review({...p,expectedMinor:0}).findings[0].reasons,['unexpected-positive-charge']);
 assert.equal(review(p,[{...s,transactionId:'sub_wrong'}]).findings[0].state,'unknown');
});
test('public pilot exposes only ten fixed synthetic checks and requires no network',()=>{
 const oldFetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('network-forbidden')};
 try{
  const r=runRevenuePilot();assert.equal(r.ok,true);assert.equal(r.passed,10);assert.equal(r.total,10);
  assert.equal(r.customerDataRead,false);assert.equal(r.paymentChanges,false);assert.equal(r.paidProviderCalls,0);
  assert.equal(r.verifiedRevenue,null);assert.equal(r.recoveredRevenue,null);
  for(const row of r.results)assert.deepEqual(Object.keys(row).sort(),['id','name','passed']);
  assert.doesNotMatch(JSON.stringify(r),/synthetic-payment|synthetic-tenant|txn_synthetic|evt_synthetic/);
 }finally{globalThis.fetch=oldFetch}
});
