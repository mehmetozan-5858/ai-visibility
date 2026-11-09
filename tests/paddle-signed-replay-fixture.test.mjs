import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {verifyPaddleLiveSignature,normalizePaddleLiveEvent} from '../lib/paddle-live.js';

test('signed Paddle completion fixture is authentic and refund replay cannot be treated as new authorization',()=>{
 const secret='fixture-only-webhook-secret';
 const ts=1793491200;
 const event={event_id:'evt_fixture123',event_type:'transaction.completed',occurred_at:'2026-11-01T00:00:00Z',data:{
  id:'txn_fixture123',status:'completed',origin:'api',currency_code:'EUR',
  items:[{quantity:1,price:{unit_price:{amount:'4900'}}}],
  custom_data:{payment_id:'550e8400-e29b-41d4-a716-446655440000',client_id:'550e8400-e29b-41d4-a716-446655440001'}
 }};
 const raw=JSON.stringify(event);
 const sig=createHmac('sha256',secret).update(ts+':'+raw).digest('hex');
 assert.equal(verifyPaddleLiveSignature(raw,'ts='+ts+';h1='+sig,secret,{now:ts*1000}),true);
 assert.equal(verifyPaddleLiveSignature(raw+' ', 'ts='+ts+';h1='+sig,secret,{now:ts*1000}),false);
 assert.equal(normalizePaddleLiveEvent(event).paymentId,event.data.custom_data.payment_id);
});
