import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateFreeGeminiAdmission,FREE_GEMINI_MODEL_ALLOWLIST} from '../lib/free-gemini-admission.mjs';
const complete = Object.freeze({
  billingStatus:'verified-free-no-billing',freeTierEligible:true,remainingRequests:1,
  projectModelAccessVerified:true,
  privacyPermission:'explicit-for-intended-data',tenantAuthorized:true,
  model:'gemini-2.5-flash-lite',verifiedModelPriceUsd:0,priceEvidenceTrusted:true,
  serverKeyConfigured:true,zeroCostReceiptAvailable:true,manualAdminAction:true,
  paidFallbackDisabled:true,searchGroundingDisabled:true,automaticRetriesDisabled:true
});
test('unknown or missing evidence always blocks without network or provider permission',()=>{
  for(const e of [undefined,null,{},[],{billingStatus:'unknown'},'yes']){
    const r=evaluateFreeGeminiAdmission(e);
    assert.equal(r.status,'blocked');assert.equal(r.mayCallProvider,false);
    assert.equal(r.inferenceRequests,0);assert.equal(r.customerDataSent,false);
  }
});
test('each gate fails closed independently and never authorizes inference',()=>{
  for(const key of Object.keys(complete)){
    const e={...complete};delete e[key];const r=evaluateFreeGeminiAdmission(e);
    assert.equal(r.status,'blocked',key);assert.ok(r.blockers.length>=1,key);
  }
});
test('only fixed allowlisted model and exact verified-free pricing can pass',()=>{
  assert.deepEqual(FREE_GEMINI_MODEL_ALLOWLIST,['gemini-2.5-flash-lite','gemini-3.5-flash-lite']);
  assert.equal(evaluateFreeGeminiAdmission({...complete,model:'gemini-3.5-flash-lite'}).status,'evidence-complete-not-executable');
  assert.equal(evaluateFreeGeminiAdmission({...complete,model:'gemini-3.5-flash-lite',projectModelAccessVerified:false}).status,'blocked');
  for(const model of ['gemini-2.5-pro','gemini-3.8-flash','GEMINI-2.5-FLASH-LITE','gemini-2.5-flash-lite:free'])
    assert.equal(evaluateFreeGeminiAdmission({...complete,model}).status,'blocked');
  for(const price of [undefined,null,'0',0.001,-1,NaN])
    assert.equal(evaluateFreeGeminiAdmission({...complete,verifiedModelPriceUsd:price}).status,'blocked');
});
test('complete checklist remains non-executable and does not prove quota',()=>{
  const r=evaluateFreeGeminiAdmission(complete);
  assert.equal(r.status,'evidence-complete-not-executable');
  assert.deepEqual(r.blockers,[]);assert.equal(r.mayCallProvider,false);
  assert.equal(r.priceOrQuotaVerifiedByThisCheck,false);
  assert.equal(r.inferenceRequests,0);
});
test('secrets, customer information and account payloads are never returned',()=>{
  const r=evaluateFreeGeminiAdmission({...complete,apiKey:'do-not-leak',
    customerEmail:'secret@example.test',rawAccount:{secret:'private'}});
  assert.doesNotMatch(JSON.stringify(r),/do-not-leak|secret@example|private/);
});
