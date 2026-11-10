import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateCustomerJourney} from '../lib/customer-launch-journey-gates.mjs';

const leadId='11111111-1111-4111-8111-111111111111';
const clientId='22222222-2222-4222-8222-222222222222';
const paymentId='33333333-3333-4333-8333-333333333333';
const base=()=>({
  lead:{id:leadId,email:'customer@example.test',status:'qualified'},
  emailVerification:{verified:true,leadId,email:'customer@example.test'},
  assessment:{status:'ready',leadId,prospectId:'prospect-1',source:'verified-observations',score:61,samples:6,providers:2,queries:2},
  account:{clientId,leadId,access:{allowed:true,kind:'paid'},report:{tenantId:clientId,verified:true,visible:true}},
  payment:{id:paymentId,clientId,status:'paid',method:'paddle'},
  settlementEvidence:{provider:'paddle',paymentId,signed:true,eventType:'transaction.completed',tenantLinked:true,amountMatched:true,reversed:false},
});
test('complete trusted paid flow may be ready',()=>{
 const gates=evaluateCustomerJourney(base());
 assert.equal(gates.productionReady,true);
 assert.equal(gates.results.ready,true);
});
test('lead alone never proves assessment or access',()=>{
 const gates=evaluateCustomerJourney({lead:base().lead});
 assert.equal(gates.application.ready,true);
 assert.equal(gates.assessment.ready,false);
 assert.equal(gates.productionReady,false);
});
test('verified email must match the lead',()=>{
 const input=base();input.emailVerification.email='intruder@example.test';
 assert.equal(evaluateCustomerJourney(input).email.ready,false);
 assert.equal(evaluateCustomerJourney(input).assessment.ready,false);
});
test('demo or insufficient observations cannot be sold as a real score',()=>{
 for(const change of [{source:'demo'},{samples:5},{providers:1},{status:'insufficient'},{score:null}]){
   const input=base();Object.assign(input.assessment,change);
   assert.equal(evaluateCustomerJourney(input).assessment.ready,false);
   assert.equal(evaluateCustomerJourney(input).productionReady,false);
 }
});
test('a paid label or unsigned/mislinked webhook cannot unlock paid access',()=>{
 for(const change of [{signed:false},{tenantLinked:false},{amountMatched:false},{eventType:'transaction.paid'},{paymentId:'wrong'},{reversed:true}]){
   const input=base();Object.assign(input.settlementEvidence,change);
   assert.equal(evaluateCustomerJourney(input).settlement.ready,false);
   assert.equal(evaluateCustomerJourney(input).access.ready,false);
 }
});
test('bank paid status without independent reconciliation is not proof',()=>{
 const input=base();input.payment.method='bank-transfer';input.settlementEvidence={provider:'bank',paymentId,reconciled:false};
 assert.equal(evaluateCustomerJourney(input).productionReady,false);
 input.settlementEvidence.reconciled=true;
 assert.equal(evaluateCustomerJourney(input).settlement.ready,true);
});
test('pilot must be explicitly approved and may not be expired or revoked',()=>{
 const input=base();input.payment=null;input.settlementEvidence=null;
 input.account.access={allowed:true,kind:'pilot',approved:true,expired:false,revoked:false};
 assert.equal(evaluateCustomerJourney(input).productionReady,true);
 input.account.access.revoked=true;
 assert.equal(evaluateCustomerJourney(input).productionReady,false);
});
test('cross-tenant report never counts as customer results',()=>{
 const input=base();input.account.report.tenantId='44444444-4444-4444-8444-444444444444';
 assert.equal(evaluateCustomerJourney(input).results.ready,false);
});
test('a record without an active server-authorized account cannot unlock access',()=>{
 const input=base();input.account.access.allowed=false;
 assert.equal(evaluateCustomerJourney(input).access.ready,false);
});
