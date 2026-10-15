import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {verifyPaddleLiveSignature,normalizePaddleLiveEvent} from '../lib/paddle-live.js';

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

test('ignores unsupported event types and rejects malformed entities',()=>{
  const base={event_id:'evt_abc123',occurred_at:'2026-10-16T00:00:00Z'};
  assert.equal(normalizePaddleLiveEvent({...base,event_type:'customer.created',data:{id:'ctm_123'}}),null);
  assert.throws(()=>normalizePaddleLiveEvent({...base,event_type:'transaction.completed',data:{id:'sub_wrong'}}),/invalid-entity/);
});
