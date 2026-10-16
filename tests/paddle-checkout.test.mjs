import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPaddleTransactionPayload,createPaddleLiveTransaction,minorUnitAmount} from '../lib/paddle-checkout.js';

test('converts supported launch currencies to minor units',()=>{
  assert.equal(minorUnitAmount(4990,'TRY'),'499000');
  assert.equal(minorUnitAmount(119,'EUR'),'11900');
  assert.throws(()=>minorUnitAmount(0,'USD'),/invalid-amount/);
});

test('builds one-time checkout with payment linkage metadata',()=>{
  const payload=buildPaddleTransactionPayload({
    plan:{code:'business-diagnosis',name:'Business Diagnosis',currency:'USD',kind:'one-time',firstPayment:129},
    payment:{id:'550e8400-e29b-41d4-a716-446655440000'},
    clientId:'550e8400-e29b-41d4-a716-446655440001'
  });
  assert.equal(payload.collection_mode,'automatic');
  assert.equal(payload.enable_checkout,true);
  assert.equal(payload.items[0].price.tax_mode,'internal');
  assert.equal(payload.items[0].price.billing_cycle,null);
  assert.equal(payload.items[0].price.unit_price.amount,'12900');
  assert.equal(payload.custom_data.payment_id,'550e8400-e29b-41d4-a716-446655440000');
  assert.equal(payload.custom_data.client_id,'550e8400-e29b-41d4-a716-446655440001');
});

test('builds monthly recurring Paddle item',()=>{
  const payload=buildPaddleTransactionPayload({
    plan:{code:'business-monitoring',name:'Monitoring',currency:'GBP',kind:'monthly',firstPayment:139},
    payment:{id:'550e8400-e29b-41d4-a716-446655440000'},
    clientId:'550e8400-e29b-41d4-a716-446655440001'
  });
  assert.equal(payload.enable_checkout,true);
  assert.equal(payload.items[0].price.tax_mode,'internal');
  assert.deepEqual(payload.items[0].price.billing_cycle,{interval:'month',frequency:1});
  assert.equal(payload.items[0].price.unit_price.amount,'13900');
});

test('Paddle API helper sends bearer auth and accepts only transaction ids',async()=>{
  let request;
  const fetchImpl=async(url,options)=>{request={url,options};return {ok:true,status:201,json:async()=>({data:{id:'txn_01h04vsbhqc62t8hmd4z3b578c',status:'draft'}})}};
  const result=await createPaddleLiveTransaction({apiKey:'live-key',payload:{items:[]},fetchImpl});
  assert.equal(request.url,'https://api.paddle.com/transactions');
  assert.equal(request.options.headers.authorization,'Bearer live-key');
  assert.equal(result.transactionId,'txn_01h04vsbhqc62t8hmd4z3b578c');
});

test('Paddle API helper never proceeds without a server API key',async()=>{
  await assert.rejects(()=>createPaddleLiveTransaction({payload:{}}),/paddle-live-api-key-missing/);
});
