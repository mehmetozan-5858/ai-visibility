import test from 'node:test';
import assert from 'node:assert/strict';
import {initializePaymentLink} from '../lib/paddle-payment-link.mjs';

const transactionId='txn_01h04vsbhqc62t8hmd4z3b578c';
test('provider payment-link initialization cannot run without readiness and a single valid existing transaction',()=>{
 let calls=0;const paddle={Initialize(){calls++}};
 for(const input of [{ready:false},{transactionId:''},{transactionId:[transactionId,transactionId]},
  {transactionId:'https://evil.test'},{transactionId:transactionId+'?amount=1'},{clientToken:'test_fixture'}]){
  assert.equal(initializePaymentLink({ready:true,transactionId,clientToken:'live_fixture',paddle,...input}),false);
 }
 assert.equal(calls,0);
});
test('default-link flow initializes SDK once and never opens a duplicate checkout',()=>{
 let calls=0;const paddle={Initialize(options){assert.deepEqual(options,{token:'live_fixture'});calls++;this.Initialized=true},Checkout:{open(){assert.fail('must use provider URL flow')}}};
 const input={ready:true,transactionId,clientToken:'live_fixture',paddle};
 assert.equal(initializePaymentLink(input),true);
 assert.equal(initializePaymentLink(input),true);
 assert.equal(calls,1);
});
