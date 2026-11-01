import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {verifyPaddleLiveSignature,normalizePaddleLiveEvent,subscriptionAccessState,transactionPricedAmount,isPaddleRenewal,expectedPaddleItemAmount} from '../lib/paddle-live.js';

function sign(raw,secret,ts){return createHmac('sha256',secret).update(`${ts}:${raw}`).digest('hex')}

test('verifies a fresh Paddle live signature',()=>{
  const secret='whsec_test_secret',ts=1730000000,raw='{"ok":true}';
  const header=`ts=${ts};h1=${sign(raw,secret,ts)}`;
  assert.equal(verifyPaddleLiveSignature(raw,header,secret,{now:ts*1000}),true);
});

test('rejects stale or altered Paddle live signatures',()=>{
  const secret='whsec_test_secret',ts=1730000000,raw='{"ok":true}';
  const header=`ts=${ts};h1=${sign(raw,secret,ts)}`;
  assert.equal(verifyPaddleLiveSignature(raw,header,secret,{now:(ts+301)*1000}),false);
  assert.equal(verifyPaddleLiveSignature(raw+'x',header,secret,{now:ts*1000}),false);
});

test('normalizes supported transaction event and customer link metadata',()=>{
  const event={event_id:'evt_abc123',event_type:'transaction.completed',occurred_at:'2026-10-16T00:00:00Z',data:{id:'txn_abc123',status:'completed',currency_code:'TRY',custom_data:{payment_id:'550e8400-e29b-41d4-a716-446655440000',client_id:'550e8400-e29b-41d4-a716-446655440001'}}};
  const item=normalizePaddleLiveEvent(event);
  assert.equal(item.type,'transaction.completed');
  assert.equal(item.paymentId,event.data.custom_data.payment_id);
  assert.equal(item.clientId,event.data.custom_data.client_id);
});

test('reads the original Paddle item price rather than tax-adjusted grand total',()=>{
  const data={items:[{quantity:1,price:{unit_price:{amount:'16900'}}}],details:{totals:{grand_total:'20280',tax:'3380'}}};
  assert.equal(transactionPricedAmount(data),16900);
  assert.equal(transactionPricedAmount({items:[{quantity:2,price:{unit_price:{amount:'9900'}}}]}),19800);
  assert.equal(transactionPricedAmount({items:[]}),null);
});

test('identifies only completed recurring subscription transactions as renewals',()=>{
  assert.equal(isPaddleRenewal({type:'transaction.completed',data:{origin:'subscription_recurring'}}),true);
  assert.equal(isPaddleRenewal({type:'transaction.completed',data:{origin:'api'}}),false);
  assert.equal(isPaddleRenewal({type:'transaction.payment_failed',data:{origin:'subscription_recurring'}}),false);
});

test('ignores unsupported event types and rejects malformed entities',()=>{
  const base={event_id:'evt_abc123',occurred_at:'2026-10-16T00:00:00Z'};
  assert.equal(normalizePaddleLiveEvent({...base,event_type:'customer.created',data:{id:'ctm_123'}}),null);
  assert.throws(()=>normalizePaddleLiveEvent({...base,event_type:'transaction.completed',data:{id:'sub_wrong'}}),/invalid-entity/);
});

test('subscription lifecycle blocks access for paused, past-due and canceled states',()=>{
  for(const type of ['subscription.paused','subscription.past_due','subscription.canceled']){
    assert.equal(subscriptionAccessState({type,status:''}),'payment-review');
  }
  assert.equal(subscriptionAccessState({type:'subscription.updated',status:'past_due'}),'payment-review');
});

test('subscription lifecycle restores access only on explicit active states',()=>{
  assert.equal(subscriptionAccessState({type:'subscription.activated',status:'active'}),'active');
  assert.equal(subscriptionAccessState({type:'subscription.resumed',status:'active'}),'active');
  assert.equal(subscriptionAccessState({type:'subscription.updated',status:'active'}),'active');
  assert.equal(subscriptionAccessState({type:'subscription.created',status:'active'}),null);
  assert.equal(subscriptionAccessState({type:'transaction.completed',status:'completed'}),null);
});

test('first payment requires setup plus monthly, recurring renewal only monthly',()=>{
 const payment={setup_amount:120,monthly_amount:49};
 const original={type:'transaction.completed',data:{origin:'api'}};
 const renewal={type:'transaction.completed',data:{origin:'subscription_recurring'}};
 assert.equal(expectedPaddleItemAmount(original,payment),16900);
 assert.equal(expectedPaddleItemAmount(renewal,payment),4900);
 assert.notEqual(expectedPaddleItemAmount(renewal,payment),16900);
});
test('invalid payment amount cannot authorize transaction',()=>{
 const event={type:'transaction.completed',data:{origin:'subscription_recurring'}};
 assert.equal(expectedPaddleItemAmount(event,{setup_amount:-1,monthly_amount:49}),null);
 assert.equal(expectedPaddleItemAmount(event,{setup_amount:120,monthly_amount:NaN}),null);
 assert.equal(expectedPaddleItemAmount(event,{setup_amount:120,monthly_amount:0.5}),null);
});

test('zero total must never authorize a successful payment event',()=>{
 const initial={type:'transaction.completed',data:{origin:'api'}};
 const renewal={type:'transaction.completed',data:{origin:'subscription_recurring'}};
 assert.equal(expectedPaddleItemAmount(initial,{setup_amount:0,monthly_amount:0}),null);
 assert.equal(expectedPaddleItemAmount(renewal,{setup_amount:120,monthly_amount:0}),null);
});

test('a delayed completed webhook cannot overwrite a refunded payment',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../lib/paddle-live.js',import.meta.url),'utf8');
 assert.match(source,/UPDATE payments SET status='paid'[\s\S]*?WHERE id=\$1 AND client_id=\$2 AND status NOT IN \('paid','refunded'\)/);
});

test('live paid and past_due notices are recognized but not settlement authorization',()=>{
 for(const type of ['transaction.paid','transaction.past_due']){
  const event={event_id:'evt_test123',event_type:type,occurred_at:'2026-11-01T00:00:00Z',data:{id:'txn_test123',status:type.split('.')[1]}};
  assert.equal(normalizePaddleLiveEvent(event).type,type);
 }
 const source=readFileSync(new URL('../lib/paddle-live.js',import.meta.url),'utf8');
 assert.ok(source.includes("item.type==='transaction.paid'||item.type==='transaction.past_due'"));
});
