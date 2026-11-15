import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluatePostRefundEntitlementReview as evaluate} from '../lib/portal-post-refund-entitlement-gate-review.mjs';
import {readFile} from 'node:fs/promises';
const tenant='11111111-1111-4111-8111-111111111111';
const outsider='22222222-2222-4222-8222-222222222222';
const refunded='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const base={tenantId:tenant,refundedPaymentId:refunded,
 remainingPayments:[{id:other,tenantId:tenant,status:'paid'}],
 verifiedSettlementIds:[],activeSubscriptionPaymentIds:[]};
test('a paid row alone cannot grant or prove current customer entitlement',()=>{
 assert.deepEqual(evaluate(base),{decision:'hold',reason:'paid-row-without-current-entitlement-evidence'});
 assert.deepEqual(evaluate({...base,verifiedSettlementIds:[other]}),
  {decision:'hold',reason:'paid-row-without-current-entitlement-evidence'});
 assert.deepEqual(evaluate({...base,activeSubscriptionPaymentIds:[other]}),
  {decision:'hold',reason:'paid-row-without-current-entitlement-evidence'});
});
test('even verified paid receipt plus current subscription link stays manual review, never GO',()=>{
 assert.deepEqual(evaluate({...base,verifiedSettlementIds:[other],activeSubscriptionPaymentIds:[other]}),
  {decision:'manual-review',reason:'independent-entitlement-candidate'});
});
test('cross-tenant, duplicate, refunded-payment and malformed candidates fail closed',()=>{
 for(const bad of [
  [{id:other,tenantId:outsider,status:'paid'}],
  [{id:other,tenantId:tenant,status:'paid'},{id:other,tenantId:tenant,status:'paid'}],
  [{id:refunded,tenantId:tenant,status:'paid'}],
  [{id:'invalid',tenantId:tenant,status:'paid'}]
 ]){
  assert.equal(evaluate({...base,remainingPayments:bad}).decision,'hold');
 }
});
test('absence of other paid payment does not erase separate free pilot entitlement',()=>{
 assert.deepEqual(evaluate({...base,remainingPayments:[]}),
  {decision:'manual-review',reason:'check-free-pilot-before-suspension'});
 assert.equal(evaluate({...base,remainingPayments:null}).decision,'hold');
});
test('review gate is disconnected from real Paddle and customer entitlement paths',async()=>{
 const [paddle,settlement]=await Promise.all([
  readFile(new URL('../lib/paddle-live.js',import.meta.url),'utf8'),
  readFile(new URL('../lib/customer-settlement-proof.mjs',import.meta.url),'utf8')
 ]);
 assert.doesNotMatch(paddle,/evaluatePostRefundEntitlementReview/);
 assert.doesNotMatch(settlement,/evaluatePostRefundEntitlementReview/);
});

test('unowned settlement and subscription evidence fails closed even when valid own payment also exists',()=>{
 const foreign='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
 assert.deepEqual(evaluate({...base,verifiedSettlementIds:[other,foreign],activeSubscriptionPaymentIds:[other]}),
  {decision:'hold',reason:'entitlement-evidence-unowned'});
 assert.deepEqual(evaluate({...base,verifiedSettlementIds:[other],activeSubscriptionPaymentIds:[other,foreign]}),
  {decision:'hold',reason:'entitlement-evidence-unowned'});
 assert.deepEqual(evaluate({...base,verifiedSettlementIds:[refunded],activeSubscriptionPaymentIds:[other]}),
  {decision:'hold',reason:'entitlement-evidence-unowned'});
});
test('uppercase UUID proof values normalize without widening entitlement acceptance',()=>{
 assert.deepEqual(evaluate({...base,verifiedSettlementIds:[other.toUpperCase()],activeSubscriptionPaymentIds:[other.toUpperCase()]}),
  {decision:'manual-review',reason:'independent-entitlement-candidate'});
});
