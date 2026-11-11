import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {strictCustomerSettlementEnabled,validSignedPaddleSettlement,customerHasVerifiedSettlement} from '../lib/customer-settlement-proof.mjs';

const id='11111111-1111-4111-8111-111111111111';
const client='22222222-2222-4222-8222-222222222222';
const valid=()=>({payment:{id,client_id:client,status:'paid',method:'paddle'},
 event:{id:'evt_abc123',type:'transaction.completed',paymentId:id,clientId:client,entityId:'txn_abc123'}});
test('a verified Paddle completion must be for the same exact client/payment',()=>{
 assert.equal(validSignedPaddleSettlement(valid()),true);
 for(const change of [
  {payment:{...valid().payment,method:'bank-transfer'}},
  {payment:{...valid().payment,status:'customer-reported'}},
  {event:{...valid().event,type:'transaction.paid'}},
  {event:{...valid().event,clientId:'33333333-3333-4333-8333-333333333333'}},
  {event:{...valid().event,paymentId:'44444444-4444-4444-8444-444444444444'}}
 ]){
  assert.equal(validSignedPaddleSettlement({...valid(),...change}),false);
 }
});
test('strict paid access is opt-in and missing database evidence fails closed',async()=>{
 const old=process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED;
 delete process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED;
 try{assert.equal(strictCustomerSettlementEnabled(),false);assert.equal(await customerHasVerifiedSettlement('not-a-uuid'),false);}
 finally{if(old===undefined)delete process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED;else process.env.CUSTOMER_SETTLEMENT_PROOF_ENABLED=old}
});
test('webhook records proof only after validated signed transaction completion',async()=>{
 const source=await readFile(new URL('../lib/paddle-live.js',import.meta.url),'utf8');
 const start=source.indexOf('const paymentResult=item.type.startsWith');
 const proof=source.indexOf('INSERT INTO public.verified_customer_settlements');
 assert.ok(start>=0&&proof>start);
 assert.match(source,/strictCustomerSettlementEnabled\(\)&&item.type==='transaction.completed'/);
 assert.match(source,/paymentResult.linked===true&&paymentResult.paymentStatus==='paid'/);
 assert.match(source,/throw Error\('settlement-proof-conflict'\)/);
});
test('portal access is strict-gated but unchanged by default',async()=>{
 const source=await readFile(new URL('../lib/pilot-access.js',import.meta.url),'utf8');
 assert.match(source,/CUSTOMER_SETTLEMENT_PROOF_ENABLED!=='true'\|\|await customerHasVerifiedSettlement/);
 assert.match(source,/independent-settlement-proof-required/);
});
test('evidence schema is unique to exact tenant and payment, not an internal status flag',async()=>{
 const source=await readFile(new URL('../migrations/verified-customer-settlements-review.sql',import.meta.url),'utf8');
 assert.match(source,/payment_id UUID PRIMARY KEY/);
 assert.match(source,/client_id UUID NOT NULL/);
 assert.match(source,/paddle_event_id TEXT NOT NULL UNIQUE/);
 assert.match(source,/transaction_id TEXT NOT NULL UNIQUE/);
});
